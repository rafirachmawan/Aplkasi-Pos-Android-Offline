import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { supabase } from "./supabaseClient";
import { getAuthSnapshot, getLastStoreId } from "./sessionStore";

// Status langganan toko (tier GRATIS / PRO) untuk model SaaS manual.
//
// Prinsip:
// 1. Plan disimpan DI HP sehingga berfungsi penuh saat offline.
// 2. Tier efektif dihitung LOKAL: pro hanya bila belum melewati tanggal
//    berakhir. Hitung mundur berjalan tanpa internet dan tanpa server.
// 3. Server hanya sumber kebenaran saat online (untuk naik turun tier).
// 4. Tier tidak PERNAH memblokir jualan, struk, atau sinkronisasi.
//    Yang dikunci hanya fitur manajemen (lihat components/ProLock.js).

const PLAN_KEY = "@TokoKelontong:StorePlan";

// Interval minimum antar penarikan plan dari server (cegah query berlebihan).
const MIN_REFRESH_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;

const state = {
  plan: "free",
  startedAt: null,
  expiresAt: null,
  syncedAt: 0,
  syncing: false,
  lastError: null,
};

const listeners = new Set();

function snapshot() {
  return { ...state };
}

function emit(patch) {
  Object.assign(state, patch);
  const snap = snapshot();
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      // abaikan error listener
    }
  });
}

export function getPlanState() {
  return snapshot();
}

export function subscribePlan(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Tier efektif dihitung dari waktu SEKARANG, bukan dari flag tersimpan.
 * Karena itu masa aktif terus "berjalan mundur" walau HP offline.
 */
function computeEffective(state) {
  if (state.plan !== "pro" || !state.expiresAt) {
    return { tier: "free", daysRemaining: 0, expired: false };
  }

  const diff = new Date(state.expiresAt).getTime() - Date.now();
  if (diff <= 0) {
    return { tier: "free", daysRemaining: 0, expired: true };
  }

  // Dibulatkan ke atas: sisa 1 hari tetap "1" sepanjang hari terakhir.
  return {
    tier: "pro",
    daysRemaining: Math.ceil(diff / 86400000),
    expired: false,
  };
}

/** Gabungan state tersimpan + tier efektif waktu nyata. */
export function getPlanStatus() {
  const effective = computeEffective(state);
  return {
    ...snapshot(),
    tier: effective.tier,
    isPro: effective.tier === "pro",
    daysRemaining: effective.daysRemaining,
    expired: effective.expired,
  };
}

function normalizePlan(row) {
  if (!row) return null;
  return {
    plan: row.plan === "pro" ? "pro" : "free",
    startedAt: row.plan_started_at || null,
    expiresAt: row.plan_expires_at || null,
    syncedAt: Date.now(),
  };
}

/** Muat plan dari cache HP. Tidak pernah melempar error. */
export async function loadPlanFromCache() {
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return;

    emit({
      plan: saved.plan === "pro" ? "pro" : "free",
      startedAt: saved.startedAt || null,
      expiresAt: saved.expiresAt || null,
      syncedAt: saved.syncedAt || 0,
    });
  } catch (err) {
    console.warn("Gagal membaca cache langganan:", err);
  }
}

async function savePlanToCache() {
  try {
    await AsyncStorage.setItem(
      PLAN_KEY,
      JSON.stringify({
        plan: state.plan,
        startedAt: state.startedAt,
        expiresAt: state.expiresAt,
        syncedAt: state.syncedAt,
      }),
    );
  } catch (err) {
    console.warn("Gagal menyimpan cache langganan:", err);
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
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

function isNetworkLike(err) {
  if (!err) return false;
  const msg = String(err.message || err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("connection")
  );
}

/**
 * Tarik plan dari server lalu simpan ke cache.
 * Gagal (offline / tabel belum ada) TIDAK mengubah plan tersimpan.
 */
export async function refreshPlan({ force = false } = {}) {
  if (state.syncing) return getPlanStatus();

  const now = Date.now();
  if (!force && state.syncedAt && now - state.syncedAt < MIN_REFRESH_MS) {
    return getPlanStatus();
  }

  emit({ syncing: true });

  try {
    const snap = await getAuthSnapshot();
    let storeId = snap?.store_id;

    if (!storeId) {
      storeId = await getLastStoreId();
    }

    if (!storeId) {
      try {
        const { data: sessData } = await supabase.auth.getSession();
        const userId = sessData?.session?.user?.id;
        if (userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("store_id")
            .eq("id", userId)
            .maybeSingle();
          if (prof?.store_id) {
            storeId = prof.store_id;
          }
        }
      } catch (sessErr) {
        console.warn("Gagal mendapatkan sesi toko:", sessErr);
      }
    }

    let query = supabase
      .from("store_subscriptions")
      .select("plan, plan_started_at, plan_expires_at");

    if (storeId) {
      query = query.eq("store_id", storeId);
    }

    const { data, error } = await withTimeout(
      query.maybeSingle(),
      REQUEST_TIMEOUT_MS,
    );

    if (error) {
      // Tabel belum ada (migrasi v9 belum jalan) atau jaringan bermasalah:
      // biarkan plan tersimpan apa adanya, jangan dianggap gagal fatal.
      const msg = String(error.message || "");
      const migrationMissing =
        msg.includes("store_subscriptions") || error.code === "PGRST202";
      emit({
        syncing: false,
        lastError: migrationMissing ? null : isNetworkLike(error) ? null : msg,
      });
      return getPlanStatus();
    }

    const normalized = normalizePlan(data);
    if (normalized) {
      emit({ ...normalized, syncing: false, lastError: null });
      await savePlanToCache();
    } else {
      // Toko punya baris: tidak ada yang perlu diubah.
      emit({ syncing: false, syncedAt: Date.now(), lastError: null });
    }
  } catch (err) {
    // Offline/timeout: plan lama tetap dipakai. Jangan tampilkan error.
    emit({ syncing: false, lastError: isNetworkLike(err) ? null : String(err?.message || err) });
  }

  return getPlanStatus();
}

/** Hapus plan saat logout eksplisit. TIDAK menyentuh outbox atau katalog. */
export async function clearPlan() {
  emit({ plan: "free", startedAt: null, expiresAt: null, syncedAt: 0, lastError: null });
  try {
    await AsyncStorage.removeItem(PLAN_KEY);
  } catch {
    // abaikan
  }
}

let appSub = null;

/** Mulai memantau plan: saat app kembali aktif dan tiap interval. */
export function startPlanEngine() {
  if (appSub) return;

  appSub = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") void refreshPlan();
  });

  void loadPlanFromCache().then(() => refreshPlan());
}

export function stopPlanEngine() {
  if (appSub) {
    appSub.remove();
    appSub = null;
  }
}
