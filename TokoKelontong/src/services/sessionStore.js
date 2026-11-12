import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabaseClient";

// Salinan ringan identitas akun + toko yang sedang aktif. Dipakai agar
// aplikasi tetap tahu "saya siapa / toko mana" saat HP offline, tanpa
// menghubungi server.
const SNAPSHOT_KEY = "@TokoKelontong:AuthSnapshot";
const LAST_STORE_KEY = "@TokoKelontong:LastStoreId";

let memorySnapshot = null;

export async function getAuthSnapshot() {
  if (memorySnapshot) return memorySnapshot;
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    memorySnapshot = raw ? JSON.parse(raw) : null;
  } catch {
    memorySnapshot = null;
  }
  return memorySnapshot;
}

export async function saveAuthSnapshot(profile) {
  if (!profile || !profile.store_id) return;
  const snap = {
    user_id: profile.id || null,
    store_id: profile.store_id,
    username: profile.username || null,
    role: profile.role || null,
    store_name: profile.stores?.store_name || null,
    security_pin: profile.stores?.security_pin || null,
    saved_at: Date.now(),
  };
  memorySnapshot = snap;
  try {
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch (err) {
    console.warn("Gagal menyimpan snapshot sesi:", err);
  }
}

export async function clearAuthSnapshot() {
  memorySnapshot = null;
  try {
    await AsyncStorage.removeItem(SNAPSHOT_KEY);
  } catch (err) {
    console.warn("Gagal menghapus snapshot sesi:", err);
  }
}

// Toko terakhir yang login di HP ini (untuk mendeteksi pergantian toko).
export async function getLastStoreId() {
  try {
    return await AsyncStorage.getItem(LAST_STORE_KEY);
  } catch {
    return null;
  }
}

export async function setLastStoreId(storeId) {
  try {
    if (storeId) await AsyncStorage.setItem(LAST_STORE_KEY, String(storeId));
  } catch {
    // abaikan
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

// store_id toko aktif. Utama: snapshot lokal (instan, tanpa jaringan; dibuat
// saat login/muat profil dan dihapus saat logout atau ganti akun).
// Cadangan: tanya server lewat RPC current_store_id.
export async function getActiveStoreId() {
  const snap = await getAuthSnapshot();
  if (snap?.store_id) return snap.store_id;
  const { data, error } = await withTimeout(
    supabase.rpc("current_store_id"),
    10000,
  );
  if (error) throw error;
  return data || null;
}
