import { supabase } from "../services/supabaseClient";
import { getActiveStoreId } from "../services/sessionStore";
import { kickSync, syncNow, getSyncState } from "../services/syncService";
import {
  enqueueTransaction,
  getOutboxTransaction,
  getOutboxItems,
  listOutbox,
} from "./localDb";
import { getOfflineQueue } from "../utils/offlineQueue";
import { isNetworkLikeError } from "./productRepository";

// Konversi pola tanggal ('YYYY-MM-DD' / 'YYYY-MM' / '') menjadi rentang
// timestamp ISO sesuai ZONA WAKTU PERANGKAT, agar query "hari ini / bulan ini"
// cocok dengan jam toko (created_at di server disimpan dalam UTC).
function rangeFromPattern(pattern = "") {
  const p = String(pattern || "");
  let start = null;
  let end = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const [y, m, d] = p.split("-").map(Number);
    start = new Date(y, m - 1, d, 0, 0, 0, 0);
    end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  } else if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split("-").map(Number);
    start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    end = new Date(y, m, 1, 0, 0, 0, 0);
  }
  return {
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
  };
}

// Flag cache ketersediaan kolom di database Supabase (untuk DB lama sebelum migrasi)
let hasPaymentMethodCol = null;
let hasClientTxIdCol = null;
const PAGE_SIZE = 1000;

async function fetchAllPages(buildQuery) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// Transaksi di HP yang belum terkirim (pending / perlu ditinjau) pada rentang
// tanggal. Yang sudah terkirim tidak diambil karena sudah ada di server.
// Dengan begitu laporan tidak menghitung ganda dan tetap lengkap saat offline.
async function getUnsyncedInRange(pattern) {
  try {
    const storeId = await getActiveStoreId();
    if (!storeId) return [];
    const { start, end } = rangeFromPattern(pattern);
    const rows = await listOutbox(storeId, ["pending", "needs_review"]);
    const inRange = rows.filter(
      (r) => (!start || r.created_at >= start) && (!end || r.created_at < end),
    );
    const out = [];
    for (const row of inRange) {
      out.push({ row, items: await getOutboxItems(row.client_tx_id) });
    }
    return out;
  } catch (err) {
    console.warn("Gagal membaca transaksi lokal:", err?.message || err);
    return [];
  }
}

// Ambil data server; bila gagal karena jaringan, kembalikan null agar
// pemanggil memakai data lokal saja. Error lain tetap dilempar.
async function serverOrNull(run) {
  try {
    return await run();
  } catch (err) {
    if (isNetworkLikeError(err)) return null;
    throw err;
  }
}

async function fetchTransactions(pattern) {
  const { start, end } = rangeFromPattern(pattern);
  const server = await serverOrNull(() =>
    fetchAllPages(() => {
      let query = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      if (start) query = query.gte("created_at", start);
      if (end) query = query.lt("created_at", end);
      return query;
    }),
  );
  const serverClientIds = new Set(
    (server || []).map((r) => r.client_tx_id).filter(Boolean),
  );
  const local = (await getUnsyncedInRange(pattern))
    .filter(({ row }) => !serverClientIds.has(row.client_tx_id))
    .map(({ row }) => outboxRowToTransaction(row));
  if (server === null && local.length === 0) {
    throw new Error("Tidak ada koneksi internet dan belum ada transaksi lokal.");
  }
  return [...local, ...(server || [])].sort((a, b) =>
    String(b.created_at).localeCompare(String(a.created_at)),
  );
}

function newClientTxId(prefix) {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

// Kasbon dikirim langsung ke server. Bila kasir mengulang percobaan yang sama
// (misal timeout padahal server sudah menyimpan), client_tx_id dipakai ulang
// sehingga server tidak membuat transaksi ganda.
let lastOnlineAttempt = null;

function outboxRowToTransaction(row) {
  return {
    id: row.client_tx_id,
    invoice_number:
      row.status === "synced" && row.server_invoice
        ? row.server_invoice
        : row.invoice_number,
    created_at: row.created_at,
    total_price: row.total_price,
    discount_amount: row.discount_amount,
    grand_total: row.grand_total,
    cash_received: row.cash_received,
    cash_return: row.cash_return,
    payment_method: row.payment_method,
    payment_notes: row.payment_notes,
    order_type: row.order_type,
    table_number: row.table_number,
    is_offline: row.status !== "synced",
    sync_status: row.status,
  };
}

function outboxItemsToDetails(items) {
  return (items || []).map((it) => ({
    product_name: it.product_name,
    quantity: it.quantity,
    price_at_sale: it.price_at_sale,
    capital_at_sale: it.capital_at_sale || 0,
  }));
}

function legacyToTransaction(match) {
  return {
    id: match.id,
    invoice_number: match.invoice_number,
    created_at: match.created_at,
    total_price: match.total_price,
    discount_amount: match.discount_amount,
    grand_total: match.grand_total,
    cash_received: match.cash_received,
    cash_return: match.cash_return,
    payment_method: match.payment_method,
    payment_notes: match.payment_notes,
    order_type: match.order_type,
    table_number: match.table_number,
    is_offline: true,
  };
}

function legacyToDetails(match) {
  return (match.items || []).map((it) => ({
    product_name: it.product_name,
    quantity: it.quantity,
    price_at_sale: it.selling_price || it.price_at_sale,
    capital_at_sale: it.capital_price || it.capital_at_sale || 0,
  }));
}

class TransactionRepository {
  /**
   * Mengirim data transaksi langsung ke RPC Supabase dengan fallback multi-versi.
   */
  async _sendToSupabaseCheckout(
    pItems,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
    payment_method,
    payment_notes,
    order_type,
    table_number,
  ) {
    // 1. Coba pemanggilan versi 10 parameter (v7 - Fase 3)
    let rpcRes = await supabase.rpc("checkout", {
      p_items: pItems,
      p_total_price: total_price,
      p_discount_amount: discount_amount,
      p_grand_total: grand_total,
      p_cash_received: cash_received,
      p_cash_return: cash_return,
      p_payment_method: payment_method || "cash",
      p_payment_notes: payment_notes || "",
      p_order_type: order_type || "retail",
      p_table_number: table_number || "",
    });

    // 2. Fallback jika RPC 10-param belum ada di Supabase, coba versi 8-param (v5/v6)
    if (
      rpcRes.error &&
      (rpcRes.error.code === "PGRST202" ||
        rpcRes.error.code === "42883" ||
        String(rpcRes.error.message || "").toLowerCase().includes("p_order_type") ||
        String(rpcRes.error.message || "").toLowerCase().includes("schema cache") ||
        String(rpcRes.error.message || "").toLowerCase().includes("could not find the function"))
    ) {
      console.warn("RPC checkout 10-param belum ada di Supabase, fallback ke 8-param:", rpcRes.error.message);
      rpcRes = await supabase.rpc("checkout", {
        p_items: pItems,
        p_total_price: total_price,
        p_discount_amount: discount_amount,
        p_grand_total: grand_total,
        p_cash_received: cash_received,
        p_cash_return: cash_return,
        p_payment_method: payment_method || "cash",
        p_payment_notes: payment_notes || "",
      });
    }

    // 3. Fallback jika RPC 8-param juga belum ada, coba versi 6-param awal
    if (
      rpcRes.error &&
      (rpcRes.error.code === "PGRST202" ||
        rpcRes.error.code === "42883" ||
        String(rpcRes.error.message || "").toLowerCase().includes("p_payment_method") ||
        String(rpcRes.error.message || "").toLowerCase().includes("schema cache") ||
        String(rpcRes.error.message || "").toLowerCase().includes("could not find the function"))
    ) {
      console.warn("RPC checkout 8-param belum ada di Supabase, fallback ke 6-param:", rpcRes.error.message);
      rpcRes = await supabase.rpc("checkout", {
        p_items: pItems,
        p_total_price: total_price,
        p_discount_amount: discount_amount,
        p_grand_total: grand_total,
        p_cash_received: cash_received,
        p_cash_return: cash_return,
      });
    }

    if (rpcRes.error) {
      const msg = String(rpcRes.error.message || "");
      if (msg.includes("insufficient_stock")) {
        throw new Error(
          "Stok tidak mencukupi untuk salah satu item (mungkin baru terjual di kasir lain). Muat ulang produk.",
        );
      }
      throw rpcRes.error;
    }

    return rpcRes.data?.id || rpcRes.data;
  }

  /**
   * Membuat transaksi. LOCAL-FIRST: transaksi disimpan dulu ke SQLite di HP
   * (instan, tidak butuh internet) lalu dikirim ke server di latar belakang.
   * Pengecualian: kasbon membutuhkan server (id transaksi dipakai buku kasbon).
   * Mengembalikan id transaksi (client_tx_id berawalan "off_" untuk lokal).
   */
  async createTransaction(
    items,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
    payment_method = "cash",
    payment_notes = "",
    order_type = "retail",
    table_number = "",
  ) {
    const method = payment_method || "cash";

    if (method === "kasbon") {
      return this._createOnlineTransaction(
        items,
        total_price,
        discount_amount,
        grand_total,
        cash_received,
        cash_return,
        method,
        payment_notes,
        order_type,
        table_number,
      );
    }

    const storeId = await getActiveStoreId();
    if (!storeId) throw new Error("Akun belum terdaftar ke toko mana pun.");

    const record = await enqueueTransaction(storeId, {
      items,
      total_price,
      discount_amount,
      grand_total,
      cash_received,
      cash_return,
      payment_method: method,
      payment_notes,
      order_type,
      table_number,
    });
    kickSync();
    return record.client_tx_id;
  }

  /**
   * Jalur online (kasbon): checkout_v2 langsung ke server. Bila server belum
   * dimigrasi (v8), memakai fungsi checkout lama sebagai cadangan.
   */
  async _createOnlineTransaction(
    items,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
    payment_method,
    payment_notes,
    order_type,
    table_number,
  ) {
    const pItems = items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name || "",
      quantity: i.quantity,
      price_at_sale: i.selling_price,
      capital_at_sale: i.capital_price,
    }));

    const signature = JSON.stringify([
      pItems,
      total_price,
      discount_amount,
      grand_total,
      payment_method,
      payment_notes,
    ]);
    if (
      !lastOnlineAttempt ||
      lastOnlineAttempt.signature !== signature ||
      Date.now() - lastOnlineAttempt.at > 10 * 60 * 1000
    ) {
      lastOnlineAttempt = {
        signature,
        id: newClientTxId("onl"),
        at: Date.now(),
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let res;
    try {
      res = await supabase
        .rpc("checkout_v2", {
          p_client_tx_id: lastOnlineAttempt.id,
          p_items: pItems,
          p_total_price: total_price,
          p_discount_amount: discount_amount,
          p_grand_total: grand_total,
          p_cash_received: cash_received,
          p_cash_return: cash_return,
          p_payment_method: payment_method,
          p_payment_notes: payment_notes || "",
          p_order_type: order_type || "retail",
          p_table_number: table_number || "",
        })
        .abortSignal(controller.signal);
    } catch (e) {
      res = { error: e };
    } finally {
      clearTimeout(timer);
    }

    if (!res.error && res.data) {
      lastOnlineAttempt = null;
      return res.data.id;
    }

    const err = res.error || new Error("Respons server kosong");
    const code = String(err.code || "");
    const msg = String(err.message || "");

    if (code === "PGRST202" || code === "42883") {
      // Server belum menjalankan migrasi v8: pakai checkout lama.
      try {
        const id = await this._sendToSupabaseCheckout(
          pItems,
          total_price,
          discount_amount,
          grand_total,
          cash_received,
          cash_return,
          payment_method,
          payment_notes,
          order_type,
          table_number,
        );
        lastOnlineAttempt = null;
        return id;
      } catch (legacyErr) {
        throw new Error(`Gagal menyimpan transaksi: ${legacyErr.message}`);
      }
    }

    if (isNetworkLikeError(err) || !res.status) {
      throw new Error(
        "Kasbon membutuhkan koneksi internet. Sambungkan internet lalu coba lagi, atau pilih metode pembayaran lain.",
      );
    }
    throw new Error(`Gagal menyimpan transaksi: ${msg}`);
  }

  /**
   * Sinkronisasi manual outbox ke server (tombol "Sinkronkan").
   * Mengembalikan { total, synced, failed, errors }.
   */
  async syncOfflineQueue() {
    return syncNow({ manual: true, forceCatalog: true });
  }

  /**
   * Mengambil satu transaksi berdasarkan ID.
   * ID berawalan 'off_' berasal dari outbox lokal (HP).
   */
  async getTransactionById(transactionId) {
    if (!transactionId) return null;
    const idStr = String(transactionId);
    try {
      const row = await getOutboxTransaction(idStr);
      if (row) return outboxRowToTransaction(row);
      const queue = await getOfflineQueue();
      const match = queue.find((item) => String(item.id) === idStr);
      if (match) return legacyToTransaction(match);
    } catch (e) {
      console.warn("Gagal membaca outbox lokal untuk ID:", idStr, e);
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", transactionId)
      .single();
    if (error) throw error;
    return data;
  }

  /**
   * Mengambil detail item untuk satu transaksi (lokal atau server)
   */
  async getTransactionDetails(transactionId) {
    if (!transactionId) return [];
    const idStr = String(transactionId);
    try {
      const row = await getOutboxTransaction(idStr);
      if (row) return outboxItemsToDetails(await getOutboxItems(idStr));
      const queue = await getOfflineQueue();
      const match = queue.find((item) => String(item.id) === idStr);
      if (match) return legacyToDetails(match);
    } catch (e) {
      console.warn("Gagal membaca detail outbox lokal untuk ID:", idStr, e);
    }

    const { data, error } = await supabase
      .from("transaction_details")
      .select("*")
      .eq("transaction_id", transactionId);
    if (error) throw error;
    return data || [];
  }

  /**
   * Mendapatkan transaksi pada tanggal tertentu (YYYY-MM-DD waktu lokal)
   */
  getTransactionsByDate(dateStr) {
    return fetchTransactions(dateStr);
  }

  /**
   * Mendapatkan transaksi untuk bulan tertentu (YYYY-MM), atau semua bila ''
   */
  getMonthlyTransactions(yearMonthStr) {
    return fetchTransactions(yearMonthStr);
  }

  /**
   * Data lengkap untuk ekspor CSV (nota + detail, nama barang snapshot)
   */
  async getFullReportForExport(datePattern = "") {
    const { start, end } = rangeFromPattern(datePattern);
    const server = await serverOrNull(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const cols = [
          "invoice_number",
          "created_at",
          "total_price",
          "discount_amount",
        ];
        if (hasPaymentMethodCol !== false) {
          cols.push("payment_method", "order_type", "table_number");
        }
        if (hasClientTxIdCol !== false) {
          cols.push("client_tx_id");
        }
        cols.push(
          "transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
        );
        const selectCols = cols.join(", ");
        try {
          const rows = await fetchAllPages(() => {
            let query = supabase
              .from("transactions")
              .select(selectCols)
              .order("created_at", { ascending: false })
              .order("id", { ascending: false });
            if (start) query = query.gte("created_at", start);
            if (end) query = query.lt("created_at", end);
            return query;
          });
          if (hasPaymentMethodCol === null) hasPaymentMethodCol = true;
          if (hasClientTxIdCol === null) hasClientTxIdCol = true;
          return rows;
        } catch (err) {
          const msg = String(err?.message || "").toLowerCase();
          if (
            err?.code === "42703" ||
            msg.includes("payment_method") ||
            msg.includes("order_type") ||
            msg.includes("table_number") ||
            msg.includes("client_tx_id")
          ) {
            let changed = false;
            if (
              (msg.includes("payment_method") ||
                msg.includes("order_type") ||
                msg.includes("table_number")) &&
              hasPaymentMethodCol !== false
            ) {
              hasPaymentMethodCol = false;
              changed = true;
            }
            if (msg.includes("client_tx_id") && hasClientTxIdCol !== false) {
              hasClientTxIdCol = false;
              changed = true;
            }
            if (!changed) {
              if (hasPaymentMethodCol !== false) {
                hasPaymentMethodCol = false;
                changed = true;
              } else if (hasClientTxIdCol !== false) {
                hasClientTxIdCol = false;
                changed = true;
              }
            }
            if (changed) continue;
          }
          throw err;
        }
      }
      return [];
    });

    const serverClientIds = new Set(
      (server || []).map((r) => r.client_tx_id).filter(Boolean),
    );
    const localUnsynced = (await getUnsyncedInRange(datePattern)).filter(
      ({ row }) => !serverClientIds.has(row.client_tx_id),
    );
    if (server === null && localUnsynced.length === 0) {
      throw new Error("Tidak ada koneksi internet dan belum ada transaksi lokal.");
    }

    const data = [
      ...(server || []),
      ...localUnsynced.map(({ row, items }) => ({
        invoice_number: row.invoice_number,
        created_at: row.created_at,
        total_price: row.total_price,
        discount_amount: row.discount_amount,
        payment_method: row.payment_method,
        order_type: row.order_type,
        table_number: row.table_number,
        transaction_details: items.map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          price_at_sale: it.price_at_sale,
          capital_at_sale: it.capital_at_sale,
        })),
      })),
    ].sort((a, b) =>
      String(b.created_at).localeCompare(String(a.created_at)),
    );

    const rows = [];
    for (const t of data || []) {
      const d = new Date(t.created_at); // tanggal lokal perangkat
      const tanggal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const totalPrice = t.total_price || 0;
      const discountAmount = t.discount_amount || 0;
      for (const td of t.transaction_details || []) {
        const lineRevenue = td.quantity * td.price_at_sale;
        const allocatedDiscount =
          totalPrice > 0
            ? Math.round((lineRevenue / totalPrice) * discountAmount)
            : 0;
        rows.push({
          Tanggal: tanggal,
          No_Nota: t.invoice_number,
          Metode_Bayar: (t.payment_method || "cash").toUpperCase(),
          Tipe_Pesanan: (t.order_type || "retail").toUpperCase(),
          Nomor_Meja: t.table_number || "-",
          Nama_Barang: td.product_name,
          Qty: td.quantity,
          Harga_Modal: td.capital_at_sale,
          Harga_Jual: td.price_at_sale,
          Total_Penjualan: lineRevenue,
          Total_Keuntungan:
            lineRevenue - allocatedDiscount - td.quantity * (td.capital_at_sale || 0),
        });
      }
    }
    return rows;
  }

  /**
   * Baris mentah ringkasan dari server (dengan cadangan bila kolom
   * payment_method belum ada).
   */
  async _fetchSummaryRows(start, end) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const cols = ["grand_total"];
      if (hasPaymentMethodCol !== false) cols.push("payment_method");
      if (hasClientTxIdCol !== false) cols.push("client_tx_id");
      cols.push(
        "transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
      );
      const selectCols = cols.join(", ");
      try {
        const rows = await fetchAllPages(() => {
          let query = supabase
            .from("transactions")
            .select(selectCols)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false });
          if (start) query = query.gte("created_at", start);
          if (end) query = query.lt("created_at", end);
          return query;
        });
        if (hasPaymentMethodCol === null) hasPaymentMethodCol = true;
        if (hasClientTxIdCol === null) hasClientTxIdCol = true;
        return rows;
      } catch (err) {
        const msg = String(err?.message || "").toLowerCase();
        if (
          err?.code === "42703" ||
          msg.includes("payment_method") ||
          msg.includes("client_tx_id")
        ) {
          let changed = false;
          if (msg.includes("payment_method") && hasPaymentMethodCol !== false) {
            hasPaymentMethodCol = false;
            changed = true;
          }
          if (msg.includes("client_tx_id") && hasClientTxIdCol !== false) {
            hasClientTxIdCol = false;
            changed = true;
          }
          if (!changed) {
            if (hasPaymentMethodCol !== false) {
              hasPaymentMethodCol = false;
              changed = true;
            } else if (hasClientTxIdCol !== false) {
              hasClientTxIdCol = false;
              changed = true;
            }
          }
          if (changed) continue;
        }
        throw err;
      }
    }
    return [];
  }

  /**
   * Total Omzet, Laba Bersih, rincian Tunai vs Non-Tunai, dan produk terlaris
   */
  async getSummaryByDatePattern(datePattern = "") {
    const { start, end } = rangeFromPattern(datePattern);
    const server = await serverOrNull(() => this._fetchSummaryRows(start, end));
    const serverClientIds = new Set(
      (server || []).map((r) => r.client_tx_id).filter(Boolean),
    );
    const local = (await getUnsyncedInRange(datePattern)).filter(
      ({ row }) => !serverClientIds.has(row.client_tx_id),
    );
    if (server === null && local.length === 0) {
      throw new Error("Tidak ada koneksi internet dan belum ada transaksi lokal.");
    }
    const data = [
      ...(server || []),
      ...local.map(({ row, items }) => ({
        grand_total: row.grand_total,
        payment_method: row.payment_method,
        transaction_details: items.map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          price_at_sale: it.price_at_sale,
          capital_at_sale: it.capital_at_sale,
        })),
      })),
    ];

    let omzet = 0;
    let omzet_tunai = 0;
    let omzet_non_tunai = 0;
    let laba = 0;
    const productSalesMap = {};

    for (const t of data || []) {
      const gTotal = t.grand_total || 0;
      omzet += gTotal;

      const method = String(t.payment_method || "cash").toLowerCase();
      if (method === "qris" || method === "transfer" || method === "debit") {
        omzet_non_tunai += gTotal;
      } else {
        omzet_tunai += gTotal;
      }

      let modal = 0;
      for (const td of t.transaction_details || []) {
        const qty = td.quantity || 0;
        modal += qty * (td.capital_at_sale || 0);
        if (td.product_name) {
          productSalesMap[td.product_name] =
            (productSalesMap[td.product_name] || 0) + qty;
        }
      }
      laba += gTotal - modal;
    }

    const topProducts = Object.entries(productSalesMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      omzet,
      omzet_tunai,
      omzet_non_tunai,
      laba,
      count: (data || []).length,
      top_products: topProducts,
    };
  }
}

export default new TransactionRepository();
