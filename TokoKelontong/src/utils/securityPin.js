import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";

const PIN_STORAGE_KEY = "@TokoKelontong:SecurityPin";
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
    desc: "Profil toko, akun, backup/restore database, dan sistem",
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

/**
 * Mengambil data store aktif (store_id & security_pin dari Supabase)
 * untuk memastikan isolasi antar toko dan mencegah kebocoran PIN ke toko baru.
 */
export async function getCurrentStoreData() {
  try {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess?.session?.user?.id;
    if (!uid) return null;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("store_id, stores(id, security_pin)")
      .eq("id", uid)
      .maybeSingle();

    if (error || !profile) return null;

    const storeId = profile.store_id || null;
    const pin = profile.stores?.security_pin || null;
    return { storeId, pin };
  } catch (err) {
    return null;
  }
}

export const getSecurityPin = async () => {
  try {
    // 1. Sinkronisasi dengan toko aktif di Supabase
    const storeData = await getCurrentStoreData();
    if (storeData && storeData.storeId) {
      const scopedKey = `${PIN_STORAGE_KEY}:${storeData.storeId}`;
      if (storeData.pin && String(storeData.pin).length >= 4) {
        // Toko ini memang telah mengatur PIN di database
        await AsyncStorage.setItem(scopedKey, String(storeData.pin));
        return String(storeData.pin);
      } else {
        // Toko ini (misal toko yang baru dibuat) TIDAK memiliki PIN di database!
        // Bersihkan seluruh cache PIN lokal agar tidak bocor dari sesi akun toko sebelumnya
        await AsyncStorage.removeItem(scopedKey);
        await AsyncStorage.removeItem(PIN_STORAGE_KEY);
        return null;
      }
    }

    // 2. Jika offline / belum login, periksa session lokal ter-scope
    const legacy = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    return legacy || null;
  } catch {
    return null;
  }
};

export const isPinProtected = async () => {
  const pin = await getSecurityPin();
  return !!pin && pin.length >= 4;
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
  if (!newPin || newPin.length < 4) {
    throw new Error("PIN harus terdiri dari 4 digit angka.");
  }

  const storeData = await getCurrentStoreData();
  if (storeData?.storeId) {
    await AsyncStorage.setItem(
      `${PIN_STORAGE_KEY}:${storeData.storeId}`,
      String(newPin),
    );
    try {
      await supabase
        .from("stores")
        .update({ security_pin: String(newPin) })
        .eq("id", storeData.storeId);
    } catch (err) {
      console.warn("Gagal sinkron PIN ke server:", err.message);
    }
  }
  await AsyncStorage.setItem(PIN_STORAGE_KEY, String(newPin));
};

export const removeSecurityPin = async () => {
  const storeData = await getCurrentStoreData();
  if (storeData?.storeId) {
    await AsyncStorage.removeItem(`${PIN_STORAGE_KEY}:${storeData.storeId}`);
    try {
      await supabase
        .from("stores")
        .update({ security_pin: null })
        .eq("id", storeData.storeId);
    } catch (err) {
      console.warn("Gagal sinkron hapus PIN ke server:", err.message);
    }
  }
  await AsyncStorage.removeItem(PIN_STORAGE_KEY);
};

export const verifyPin = async (inputPin) => {
  const currentPin = await getSecurityPin();
  if (!currentPin) return true; // jika belum diset, anggap lolos
  return String(inputPin) === String(currentPin);
};
