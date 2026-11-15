import { AppState } from "react-native";
import { supabase } from "./supabaseClient";
import { getActiveStoreId } from "./sessionStore";
import * as localDb from "../database/localDb";
import ProductRepository, {
  isNetworkLikeError,
} from "../database/productRepository";
import { getOfflineQueue, removeOfflineTransaction } from "../utils/offlineQueue";

// Mesin sinkronisasi: mengirim outbox (transaksi yang dibuat di HP) ke
// server lewat RPC idempotent `checkout_v2`, lalu menyegarkan katalog lokal.
// Prinsip: data di outbox TIDAK PERNAH dihapus karena gagal kirim.

const REQUEST_TIMEOUT_MS = 15000;
const SESSION_TIMEOUT_MS = 5000;
const CATALOG_TIMEOUT_MS = 30000;
const BACKOFF_MS = [5000, 15000, 60000, 300000];
const TICK_MS = 45000;
const CATALOG_STALE_MS = 10 * 60 * 1000;

const state = {
  syncing: false,
  pending: 0,
  needsReview: 0,
  unsynced: 0,
  offline: false,
  lastSyncAt: 0,
  lastError: null,
};
const listeners = new Set();

function snapshotState() {
  return { ...state };
}

function emit(patch) {
  Object.assign(state, patch);
  state.unsynced = state.pending + state.needsReview;
  const snap = snapshotState();
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      // abaikan error listener
    }
  });
}

export function getSyncState() {
  return snapshotState();
}

export function subscribeSync(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function refreshSyncCounts() {
  try {
    const storeId = await getActiveStoreId();
    if (!storeId) {
      emit({ pending: 0, needsReview: 0 });
      return;
    }
    const counts = await localDb.getOutboxCounts(storeId);
    emit({ pending: counts.pending, needsReview: counts.needsReview });
  } catch {
    // abaikan: tampilan hitungan tidak boleh mengganggu kasir
  }
}

function withTimeout(promise, ms, label = "timeout") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// 'review' = data bermasalah (jangan dicoba otomatis terus), 'auth' = perlu
// sesi login valid, 'retry' = jaringan/server sementara bermasalah.
function classifyError(error, httpStatus) {
  const msg = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "");
  const status = Number(httpStatus || error?.status || 0);
  if (
    msg.includes("store_mismatch") ||
    msg.includes("invalid_items") ||
    msg.includes("invalid_quantity") ||
    msg.includes("invalid_client_tx_id")
  ) {
    return "review";
  }
  if (["22P02", "22003", "23502", "23503", "23514"].includes(code)) {
    return "review";
  }
  if (
    msg.includes("not_registered") ||
    msg.includes("jwt") ||
    code === "PGRST301" ||
    status === 401 ||
    status === 403
  ) {
    return "auth";
  }
  return "retry";
}

function friendlyError(error) {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  if (code === "PGRST202" || code === "42883" || msg.includes("checkout_v2")) {
    return "Server belum diperbarui (migrasi v8 belum dijalankan).";
  }
  return msg || "Gagal mengirim transaksi.";
}

async function hasUsableSession() {
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_TIMEOUT_MS,
    );
    return !!data?.session;
  } catch {
    return false;
  }
}

const migratedStores = new Set();
async function migrateLegacy(storeId) {
  if (migratedStores.has(storeId)) return;
  try {
    const queue = await getOfflineQueue();
    if (queue.length > 0) await localDb.importLegacyQueue(storeId, queue);
    migratedStores.add(storeId);
  } catch (err) {
    console.warn("Gagal memindahkan antrean lama ke outbox:", err?.message || err);
  }
}

async function sendOne(tx) {
  const items = await localDb.getOutboxItems(tx.client_tx_id);
  const isLegacy = tx.source === "legacy";
  const params = {
    p_client_tx_id: tx.client_tx_id,
    p_items: items.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name || "",
      quantity: it.quantity,
      price_at_sale: it.price_at_sale,
      capital_at_sale: it.capital_at_sale,
    })),
    p_total_price: tx.total_price,
    p_discount_amount: tx.discount_amount,
    p_grand_total: tx.grand_total,
    p_cash_received: tx.cash_received,
    p_cash_return: tx.cash_return,
    p_payment_method: tx.payment_method || "cash",
    p_payment_notes: isLegacy
      ? tx.payment_notes
        ? `${tx.payment_notes} (Sync Offline: ${tx.invoice_number})`
        : `Sync Offline: ${tx.invoice_number}`
      : tx.payment_notes || "",
    p_order_type: tx.order_type || "retail",
    p_table_number: tx.table_number || "",
    p_invoice_number: isLegacy ? null : tx.invoice_number,
    p_client_created_at: tx.created_at,
    p_expected_store: tx.store_id,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await supabase.rpc("checkout_v2", params).abortSignal(controller.signal);
  } catch (e) {
    res = { error: e };
  } finally {
    clearTimeout(timer);
  }
  return res;
}

async function syncPending(storeId, result) {
  const due = await localDb.listDueTransactions(storeId, Date.now());
  result.total = due.length;
  if (due.length === 0) return;

  if (!(await hasUsableSession())) {
    emit({ lastError: "Sesi login belum aktif. Transaksi tetap aman di HP." });
    result.failed = due.length;
    return;
  }

  for (const tx of due) {
    const res = await sendOne(tx);
    if (!res.error && res.data) {
      const serverId = res.data.id || null;
      await localDb.markSynced(tx.client_tx_id, serverId, res.data.invoice_number);
      if (tx.source === "legacy") {
        await removeOfflineTransaction(tx.client_tx_id);
      }
      result.synced++;
      emit({ offline: false, lastSyncAt: Date.now(), lastError: null });
      await refreshSyncCounts();
      continue;
    }

    const error = res.error || new Error("Respons server kosong");
    const kind = classifyError(error, res.status);
    const message = friendlyError(error);
    result.failed++;
    result.errors.push({
      id: tx.client_tx_id,
      invoice: tx.invoice_number,
      error: message,
    });

    if (kind === "review") {
      await localDb.markNeedsReview(tx.client_tx_id, message);
      emit({ lastError: message });
      await refreshSyncCounts();
      continue; // transaksi lain masih boleh dicoba
    }

    const delay =
      kind === "auth" ? 15000 : BACKOFF_MS[Math.min(tx.attempts || 0, BACKOFF_MS.length - 1)];
    await localDb.markRetry(tx.client_tx_id, message, Date.now() + delay);
    emit({
      offline: isNetworkLikeError(error) || !res.status,
      lastError: message,
    });
    await refreshSyncCounts();
    break; // jaringan/server bermasalah: hentikan putaran, urutan tetap terjaga
  }
}

async function refreshCatalogLocked(storeId) {
  const products = await withTimeout(
    ProductRepository.fetchProductsFromServer(storeId),
    CATALOG_TIMEOUT_MS,
  );
  const refreshed = await localDb.replaceCatalog(storeId, products);
  if (!refreshed) {
    // Respons kosong padahal cache berisi: cache dipertahankan, coba lagi
    // pada putaran berikutnya (catalog_synced_at sengaja tidak diperbarui).
    console.warn(
      "Penyegaran katalog dilewati: server mengembalikan daftar kosong — cache lokal dipertahankan.",
    );
  }
}

async function runCycle({ manual = false, forceCatalog = false, catalogMaxAgeMs } = {}) {
  const result = { total: 0, synced: 0, failed: 0, errors: [] };
  let storeId = null;
  try {
    storeId = await getActiveStoreId();
  } catch {
    storeId = null;
  }
  if (!storeId) return result;

  emit({ syncing: true });
  try {
    await migrateLegacy(storeId);
    if (manual) await localDb.resetForRetry(storeId);
    await syncPending(storeId, result);

    // Segarkan katalog setelah transaksi terkirim agar stok sama dengan server.
    const catalogAt = await localDb.getCatalogSyncedAt(storeId);
    const stale =
      Date.now() - catalogAt > (catalogMaxAgeMs ?? CATALOG_STALE_MS);
    if (forceCatalog || stale || result.synced > 0) {
      try {
        await refreshCatalogLocked(storeId);
        if (result.failed === 0) emit({ offline: false });
      } catch (err) {
        if (isNetworkLikeError(err)) emit({ offline: true });
        else console.warn("Gagal menyegarkan katalog:", err?.message || err);
      }
    }
    await localDb.pruneSynced();
  } catch (err) {
    console.warn("Putaran sinkronisasi gagal:", err?.message || err);
    emit({ lastError: String(err?.message || err) });
  } finally {
    await refreshSyncCounts();
    emit({ syncing: false });
  }
  return result;
}

let chain = Promise.resolve();
let inflight = null;

function runNow(opts) {
  const p = chain.then(() => runCycle(opts));
  chain = p.catch(() => {});
  inflight = p;
  p.finally(() => {
    if (inflight === p) inflight = null;
  }).catch(() => {});
  return p;
}

// Satu putaran sinkronisasi pada satu waktu. Permintaan yang datang saat
// putaran berjalan digabung, kecuali yang meminta tindakan manual/katalog.
export function syncNow(opts = {}) {
  if (inflight) {
    if (opts.manual || opts.forceCatalog) return inflight.then(() => runNow(opts));
    return inflight;
  }
  return runNow(opts);
}

export function kickSync() {
  syncNow().catch(() => {});
}

let started = false;
let timer = null;
let appSub = null;

export function startSyncEngine() {
  if (started) return;
  started = true;
  refreshSyncCounts();
  syncNow({ forceCatalog: true }).catch(() => {});
  timer = setInterval(() => {
    syncNow().catch(() => {});
  }, TICK_MS);
  appSub = AppState.addEventListener("change", (s) => {
    if (s === "active") syncNow({ forceCatalog: true }).catch(() => {});
  });
}

export function stopSyncEngine() {
  started = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (appSub) appSub.remove();
  appSub = null;
  migratedStores.clear();
  emit({ pending: 0, needsReview: 0, offline: false, lastError: null });
}
