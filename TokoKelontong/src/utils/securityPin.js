import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";
import { getAuthSnapshot } from "../services/sessionStore";
import { hashStorePin } from "./helpers";

const PIN_STORAGE_KEY = "@TokoKelontong:SecurityPin";
const PIN_HASH_KEY_PREFIX = "@TokoKelontong:SecurityPinHash";
const LOCKED_MENUS_STORAGE_KEY = "@TokoKelontong:LockedMenus";

/**
 * Daftar menu aplikasi yang bisa dikonfigurasi proteksi PIN-nya oleh pemilik.
 */
export const LOCKABLE_MENU_OPTIONS = [
  {
    key: "Gudang",
    name: "Gudang & Stok",
    desc: "Kelola stok, tambah/edit produk, dan atur harga modal/jual",
    icon: "package-variant-closed",
  },
  {
    key: "Laporan",
    name: "Laporan Penjualan",
    desc: "Lihat omzet, laba bersih, riwayat transaksi, dan ekspor laporan",
    icon: "file-document-outline",
  },
  {
    key: "Pengaturan",
    name: "Pengaturan Toko",
    desc: "Profil toko, akun, sinkronisasi cloud, dan sistem",
    icon: "cog-outline",
  },
  {
    key: "Dashboard",
    name: "Dashboard Statistik",
    desc: "Grafik omzet dan performa penjualan berkala",
    icon: "chart-arc",
  },
  {
    key: "BukuKasbon",
    name: "Buku Kasbon & Hutang",
    desc: "Catatan piutang pelanggan, pembayaran cicilan, dan pengingat WA",
    icon: "book-account-outline",
  },
  {
    key: "SettingNota",
    name: "Format Nota & Struk",
    desc: "Desain struk kasir dan konfigurasi printer Bluetooth",
    icon: "receipt",
  },
  {
    key: "Kasir",
    name: "Kasir POS",
    desc: "Buka menu transaksi kasir penjualan langsung",
    icon: "storefront-outline",
  },
];

export const DEFAULT_LOCKED_MENUS = {
  Gudang: true,
  Laporan: true,
  Pengaturan: true,
  BukuKasbon: false,
  Dashboard: false,
  SettingNota: false,
  Kasir: false,
};

const hashKeyFor = (storeId) => `${PIN_HASH_KEY_PREFIX}:${storeId}`;
const legacyKeyFor = (storeId) => `${PIN_STORAGE_KEY}:${storeId}`;

function isHexSha256(val) {
  return typeof val === "string" && /^[0-9a-f]{64}$/i.test(val.trim());
}

function isMissingRpcError(err) {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || "").toLowerCase();
  return code === "PGRST202" || code === "42883" || msg.includes("set_store_security_pin");
}

/**
 * Mengambil data store aktif beserta hash PIN dari Supabase.
 * Mendukung fallback ke security_pin plaintext selama masa transisi APK lama.
 */
async function fetchOnlineStoreData() {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return null;

  let res = await supabase
    .from("profiles")
    .select("store_id, stores(id, security_pin_hash, security_pin)")
    .eq("id", uid)
    .maybeSingle();

  if (res.error) {
    res = await supabase
      .from("profiles")
      .select("store_id, stores(id, security_pin)")
      .eq("id", uid)
      .maybeSingle();
  }

  if (res.error || !res.data) return null;

  const storeId = res.data.store_id || null;
  const serverHash = res.data.stores?.security_pin_hash || null;
  const legacyPin = res.data.stores?.security_pin || null;
  const pinHash =
    isHexSha256(serverHash)
      ? serverHash.trim().toLowerCase()
      : legacyPin && String(legacyPin).length >= 4
        ? hashStorePin(storeId, legacyPin)
        : null;

  return { storeId, pinHash };
}

// Saat offline: baca hash PIN lokal toko ini, migrasikan format plaintext lama bila ada.
async function getOfflineStoreData() {
  try {
    const snap = await getAuthSnapshot();
    if (!snap?.store_id) return null;
    const storeId = snap.store_id;

    const storedHash = await AsyncStorage.getItem(hashKeyFor(storeId));
    if (isHexSha256(storedHash)) {
      return { storeId, pinHash: storedHash.trim().toLowerCase(), offline: true };
    }

    const legacyScoped = await AsyncStorage.getItem(legacyKeyFor(storeId));
    const plainFallback = legacyScoped || snap.security_pin || null;
    const derivedHash =
      snap.security_pin_hash ||
      (plainFallback && String(plainFallback).length >= 4
        ? hashStorePin(storeId, plainFallback)
        : null);

    if (derivedHash) {
      await AsyncStorage.setItem(hashKeyFor(storeId), derivedHash);
      await AsyncStorage.multiRemove([legacyKeyFor(storeId), PIN_STORAGE_KEY]);
    }

    return { storeId, pinHash: derivedHash, offline: true };
  } catch {
    return null;
  }
}

export async function getCurrentStoreData() {
  try {
    const online = await Promise.race([
      fetchOnlineStoreData(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 5000),
      ),
    ]);
    if (online) return online;
  } catch {
    // jatuh ke data lokal di bawah
  }
  return getOfflineStoreData();
}

/**
 * Mengembalikan hash SHA-256 PIN toko aktif (atau null bila PIN belum diatur).
 * Tidak lagi menyimpan maupun mengembalikan PIN plaintext ke storage lokal.
 */
export const getSecurityPinHash = async () => {
  try {
    const storeData = await getCurrentStoreData();
    if (storeData?.storeId) {
      const scopedHashKey = hashKeyFor(storeData.storeId);
      if (storeData.offline) {
        return isHexSha256(storeData.pinHash) ? storeData.pinHash : null;
      }

      if (isHexSha256(storeData.pinHash)) {
        await AsyncStorage.setItem(scopedHashKey, storeData.pinHash);
        await AsyncStorage.multiRemove([
          legacyKeyFor(storeData.storeId),
          PIN_STORAGE_KEY,
        ]);
        return storeData.pinHash;
      }

      // Toko ini tidak memiliki PIN di database -> bersihkan cache lokal agar tidak bocor
      await AsyncStorage.multiRemove([
        scopedHashKey,
        legacyKeyFor(storeData.storeId),
        PIN_STORAGE_KEY,
      ]);
      return null;
    }

    const legacy = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    return legacy ? hashStorePin("global", legacy) : null;
  } catch {
    return null;
  }
};

export const isPinProtected = async () => {
  const hash = await getSecurityPinHash();
  return isHexSha256(hash);
};

export const getLockedMenus = async () => {
  try {
    const storeData = await getCurrentStoreData();
    const key = storeData?.storeId
      ? `${LOCKED_MENUS_STORAGE_KEY}:${storeData.storeId}`
      : LOCKED_MENUS_STORAGE_KEY;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { ...DEFAULT_LOCKED_MENUS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LOCKED_MENUS, ...parsed };
  } catch {
    return { ...DEFAULT_LOCKED_MENUS };
  }
};

export const setLockedMenus = async (config) => {
  try {
    const storeData = await getCurrentStoreData();
    if (storeData?.storeId) {
      await AsyncStorage.setItem(
        `${LOCKED_MENUS_STORAGE_KEY}:${storeData.storeId}`,
        JSON.stringify(config),
      );
    }
    await AsyncStorage.setItem(
      LOCKED_MENUS_STORAGE_KEY,
      JSON.stringify(config),
    );
  } catch (err) {
    console.warn("Gagal menyimpan preferensi menu terkunci:", err);
  }
};

export const isScreenLocked = async (screenName) => {
  const hasPin = await isPinProtected();
  if (!hasPin) return false;
  const lockedMenus = await getLockedMenus();
  return !!lockedMenus[screenName];
};

export const setSecurityPin = async (newPin) => {
  if (!newPin || String(newPin).length < 4) {
    throw new Error("PIN harus terdiri dari 4 digit angka.");
  }

  const cleanPin = String(newPin);
  const storeData = await getCurrentStoreData();
  if (storeData?.storeId) {
    const pinHash = hashStorePin(storeData.storeId, cleanPin);
    await AsyncStorage.setItem(hashKeyFor(storeData.storeId), pinHash);
    await AsyncStorage.multiRemove([
      legacyKeyFor(storeData.storeId),
      PIN_STORAGE_KEY,
    ]);

    try {
      const { error: rpcErr } = await supabase.rpc("set_store_security_pin", {
        p_pin_hash: pinHash,
        p_legacy_pin: cleanPin,
      });
      if (rpcErr && isMissingRpcError(rpcErr)) {
        await supabase
          .from("stores")
          .update({ security_pin: cleanPin })
          .eq("id", storeData.storeId);
      }
    } catch (err) {
      console.warn("Gagal sinkron PIN ke server:", err.message);
    }
    return;
  }

  await AsyncStorage.setItem(PIN_STORAGE_KEY, cleanPin);
};

export const removeSecurityPin = async () => {
  const storeData = await getCurrentStoreData();
  if (storeData?.storeId) {
    await AsyncStorage.multiRemove([
      hashKeyFor(storeData.storeId),
      legacyKeyFor(storeData.storeId),
      PIN_STORAGE_KEY,
    ]);
    try {
      const { error: rpcErr } = await supabase.rpc("set_store_security_pin", {
        p_pin_hash: null,
        p_legacy_pin: null,
      });
      if (rpcErr && isMissingRpcError(rpcErr)) {
        await supabase
          .from("stores")
          .update({ security_pin: null })
          .eq("id", storeData.storeId);
      }
    } catch (err) {
      console.warn("Gagal sinkron hapus PIN ke server:", err.message);
    }
    return;
  }
  await AsyncStorage.removeItem(PIN_STORAGE_KEY);
};

export const verifyPin = async (inputPin) => {
  const storeData = await getCurrentStoreData();
  if (storeData?.storeId) {
    const expectedHash = isHexSha256(storeData.pinHash)
      ? storeData.pinHash
      : await getSecurityPinHash();
    if (!expectedHash) return true;
    const candidateHash = hashStorePin(storeData.storeId, String(inputPin));
    return candidateHash === expectedHash;
  }

  const stored = await getSecurityPinHash();
  if (!stored) return true;
  return hashStorePin("global", String(inputPin)) === stored;
};
