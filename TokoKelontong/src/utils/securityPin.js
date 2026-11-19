import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";
import {
  getAuthSnapshot,
  updateSnapshotPin,
  updateSnapshotLockedMenus,
} from "../services/sessionStore";
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
const lockedKeyFor = (storeId) => `${LOCKED_MENUS_STORAGE_KEY}:${storeId}`;

function isHexSha256(val) {
  return typeof val === "string" && /^[0-9a-f]{64}$/i.test(val.trim());
}

function isMissingRpcError(err, rpcName = "") {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || "").toLowerCase();
  return (
    code === "PGRST202" ||
    code === "42883" ||
    (rpcName ? msg.includes(rpcName.toLowerCase()) : false)
  );
}

/**
 * Menormalkan object/JSON konfigurasi menu terkunci terhadap DEFAULT_LOCKED_MENUS.
 * Mengembalikan null bila nilai mentah kosong atau tidak valid.
 */
export function normalizeLockedMenusConfig(raw) {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const normalized = { ...DEFAULT_LOCKED_MENUS };
  for (const key of Object.keys(DEFAULT_LOCKED_MENUS)) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      normalized[key] = Boolean(parsed[key]);
    }
  }
  return normalized;
}

async function readLocalLockedMenus(storeId) {
  const keys = storeId
    ? [lockedKeyFor(storeId), LOCKED_MENUS_STORAGE_KEY]
    : [LOCKED_MENUS_STORAGE_KEY];

  for (const k of keys) {
    try {
      const raw = await AsyncStorage.getItem(k);
      const parsed = normalizeLockedMenusConfig(raw);
      if (parsed) return parsed;
    } catch {
      // lanjut ke key berikutnya
    }
  }
  return null;
}

async function writeLocalLockedMenus(storeId, config) {
  const payload = JSON.stringify(config);
  if (storeId) {
    await AsyncStorage.setItem(lockedKeyFor(storeId), payload);
    await AsyncStorage.removeItem(LOCKED_MENUS_STORAGE_KEY);
    await updateSnapshotLockedMenus(storeId, config);
    return;
  }
  await AsyncStorage.setItem(LOCKED_MENUS_STORAGE_KEY, payload);
}

async function pushLockedMenusToServer(storeId, cleanConfig) {
  try {
    const { error: rpcErr } = await supabase.rpc("set_store_locked_menus", {
      p_locked_menus: cleanConfig,
    });
    if (!rpcErr) return true;
    if (isMissingRpcError(rpcErr, "set_store_locked_menus") && storeId) {
      const { error: updErr } = await supabase
        .from("stores")
        .update({ locked_menus: cleanConfig })
        .eq("id", storeId);
      return !updErr;
    }
  } catch (err) {
    console.warn("Gagal sinkron locked_menus ke server:", err?.message || err);
  }
  return false;
}

/**
 * Mengambil data store aktif beserta hash PIN & konfigurasi menu terkunci dari Supabase.
 * Mendukung fallback ke skema lama sebelum migrasi v11/v13 dijalankan.
 */
async function fetchOnlineStoreData() {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id;
  if (!uid) return null;

  const variants = [
    {
      cols: "store_id, stores(id, security_pin_hash, security_pin, locked_menus)",
      hasLockedCol: true,
    },
    {
      cols: "store_id, stores(id, security_pin_hash, security_pin)",
      hasLockedCol: false,
    },
    {
      cols: "store_id, stores(id, security_pin)",
      hasLockedCol: false,
    },
  ];

  let res = null;
  let hasServerLockedMenusColumn = false;
  for (const variant of variants) {
    res = await supabase
      .from("profiles")
      .select(variant.cols)
      .eq("id", uid)
      .maybeSingle();
    if (!res.error) {
      hasServerLockedMenusColumn = variant.hasLockedCol;
      break;
    }
  }

  if (!res || res.error || !res.data) return null;

  const storeId = res.data.store_id || null;
  const serverHash = res.data.stores?.security_pin_hash || null;
  const legacyPin = res.data.stores?.security_pin || null;
  const pinHash = isHexSha256(serverHash)
    ? serverHash.trim().toLowerCase()
    : legacyPin && String(legacyPin).length >= 4
      ? hashStorePin(storeId, legacyPin)
      : null;

  const lockedMenus = normalizeLockedMenusConfig(res.data.stores?.locked_menus);

  return {
    storeId,
    pinHash,
    lockedMenus,
    hasServerLockedMenusColumn,
    offline: false,
  };
}

// Saat offline: baca hash PIN & konfigurasi menu lokal toko ini.
async function getOfflineStoreData() {
  try {
    const snap = await getAuthSnapshot();
    if (!snap?.store_id) return null;
    const storeId = snap.store_id;

    let derivedHash = null;
    const storedHash = await AsyncStorage.getItem(hashKeyFor(storeId));
    if (isHexSha256(storedHash)) {
      derivedHash = storedHash.trim().toLowerCase();
    } else {
      const legacyScoped = await AsyncStorage.getItem(legacyKeyFor(storeId));
      const plainFallback = legacyScoped || snap.security_pin || null;
      derivedHash =
        snap.security_pin_hash ||
        (plainFallback && String(plainFallback).length >= 4
          ? hashStorePin(storeId, plainFallback)
          : null);

      if (derivedHash) {
        await AsyncStorage.setItem(hashKeyFor(storeId), derivedHash);
        await AsyncStorage.multiRemove([
          legacyKeyFor(storeId),
          PIN_STORAGE_KEY,
        ]);
      }
    }

    const localLocked =
      (await readLocalLockedMenus(storeId)) ||
      normalizeLockedMenusConfig(snap.locked_menus);

    return {
      storeId,
      pinHash: derivedHash,
      lockedMenus: localLocked,
      hasServerLockedMenusColumn: false,
      offline: true,
    };
  } catch {
    return null;
  }
}

let inFlightStoreFetch = null;

export async function getCurrentStoreData() {
  if (inFlightStoreFetch) return inFlightStoreFetch;
  inFlightStoreFetch = (async () => {
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
  })();

  try {
    return await inFlightStoreFetch;
  } finally {
    inFlightStoreFetch = null;
  }
}

function resolveLockedMenusFromStoreData(storeData, localFallback) {
  if (storeData?.storeId && !storeData.offline && storeData.lockedMenus) {
    return {
      menus: storeData.lockedMenus,
      source: "server",
      shouldSyncLocal: true,
      shouldBackfillServer: false,
    };
  }

  if (localFallback) {
    return {
      menus: localFallback,
      source: "local",
      shouldSyncLocal: false,
      shouldBackfillServer: Boolean(
        storeData?.storeId &&
          !storeData.offline &&
          storeData.hasServerLockedMenusColumn &&
          storeData.lockedMenus === null,
      ),
    };
  }

  return {
    menus: { ...DEFAULT_LOCKED_MENUS },
    source: "default",
    shouldSyncLocal: false,
    shouldBackfillServer: false,
  };
}

/**
 * Mengambil status lengkap PIN aktif + peta menu terkunci dalam satu panggilan.
 */
export const getPinSecurityStatus = async () => {
  try {
    const storeData = await getCurrentStoreData();
    let pinHash = null;

    if (storeData?.storeId) {
      const scopedHashKey = hashKeyFor(storeData.storeId);
      if (storeData.offline) {
        pinHash = isHexSha256(storeData.pinHash) ? storeData.pinHash : null;
      } else if (isHexSha256(storeData.pinHash)) {
        await AsyncStorage.setItem(scopedHashKey, storeData.pinHash);
        await AsyncStorage.multiRemove([
          legacyKeyFor(storeData.storeId),
          PIN_STORAGE_KEY,
        ]);
        await updateSnapshotPin(storeData.storeId, storeData.pinHash);
        pinHash = storeData.pinHash;
      } else {
        await AsyncStorage.multiRemove([
          scopedHashKey,
          legacyKeyFor(storeData.storeId),
          PIN_STORAGE_KEY,
        ]);
        await updateSnapshotPin(storeData.storeId, null);
        pinHash = null;
      }
    } else {
      const legacy = await AsyncStorage.getItem(PIN_STORAGE_KEY);
      pinHash = legacy ? hashStorePin("global", legacy) : null;
    }

    const localFallback = storeData?.offline
      ? storeData.lockedMenus
      : await readLocalLockedMenus(storeData?.storeId || null);

    const resolved = resolveLockedMenusFromStoreData(storeData, localFallback);

    if (resolved.shouldSyncLocal && storeData?.storeId) {
      await writeLocalLockedMenus(storeData.storeId, resolved.menus);
    } else if (resolved.shouldBackfillServer && storeData?.storeId) {
      void pushLockedMenusToServer(storeData.storeId, resolved.menus);
    }

    return {
      hasPin: isHexSha256(pinHash),
      pinHash,
      lockedMenus: resolved.menus,
    };
  } catch {
    return {
      hasPin: false,
      pinHash: null,
      lockedMenus: { ...DEFAULT_LOCKED_MENUS },
    };
  }
};

/**
 * Mengembalikan hash SHA-256 PIN toko aktif (atau null bila PIN belum diatur).
 * Tidak lagi menyimpan maupun mengembalikan PIN plaintext ke storage lokal.
 */
export const getSecurityPinHash = async () => {
  const status = await getPinSecurityStatus();
  return status.pinHash;
};

export const isPinProtected = async () => {
  const status = await getPinSecurityStatus();
  return status.hasPin;
};

export const getLockedMenus = async () => {
  const status = await getPinSecurityStatus();
  return status.lockedMenus;
};

export const setLockedMenus = async (config) => {
  try {
    const cleanConfig =
      normalizeLockedMenusConfig(config) || { ...DEFAULT_LOCKED_MENUS };
    const snap = await getAuthSnapshot();
    let storeId = snap?.store_id || null;
    if (!storeId) {
      const storeData = await getCurrentStoreData();
      storeId = storeData?.storeId || null;
    }

    await writeLocalLockedMenus(storeId, cleanConfig);

    if (storeId) {
      await pushLockedMenusToServer(storeId, cleanConfig);
    }
  } catch (err) {
    console.warn("Gagal menyimpan preferensi menu terkunci:", err);
  }
};

export const isScreenLocked = async (screenName) => {
  const { hasPin, lockedMenus } = await getPinSecurityStatus();
  if (!hasPin) return false;
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
    await updateSnapshotPin(storeData.storeId, pinHash);

    try {
      const { error: rpcErr } = await supabase.rpc("set_store_security_pin", {
        p_pin_hash: pinHash,
        p_legacy_pin: cleanPin,
      });
      if (rpcErr && isMissingRpcError(rpcErr, "set_store_security_pin")) {
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
    await updateSnapshotPin(storeData.storeId, null);

    try {
      const { error: rpcErr } = await supabase.rpc("set_store_security_pin", {
        p_pin_hash: null,
        p_legacy_pin: null,
      });
      if (rpcErr && isMissingRpcError(rpcErr, "set_store_security_pin")) {
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
