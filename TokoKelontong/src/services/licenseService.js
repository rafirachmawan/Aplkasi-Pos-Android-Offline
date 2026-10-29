import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { supabase } from "./supabaseClient";

const DEVICE_ID_KEY = "@TokoKelontong:DeviceId";
const LICENSE_KEY_STORAGE = "@TokoKelontong:LicenseData";
const TRIAL_START_KEY = "@TokoKelontong:TrialStartDate";
const LEGACY_CLIENT_KEY = "@TokoKelontong:LegacyClientFlag";

// Salt tidak disimpan di source. Isi EXPO_PUBLIC_LICENSE_SALT di .env.local.
const SECRET_SALT = process.env.EXPO_PUBLIC_LICENSE_SALT || "";
const TRIAL_DAYS = 14;

// Fungsi hash deterministik murni JS (32-bit FNV-1a berulang)
function computeHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch;
    h2 = Math.imul(h2, 0x5bd1e995);
  }
  const part1 = ((h1 >>> 0).toString(16).padStart(8, "0")).slice(0, 4).toUpperCase();
  const part2 = ((h2 >>> 0).toString(16).padStart(8, "0")).slice(0, 4).toUpperCase();
  return `${part1}-${part2}`;
}

export function generateExpectedKey(deviceId) {
  if (!SECRET_SALT) {
    throw new Error("Konfigurasi lisensi belum diatur. Hubungi developer.");
  }
  const cleanId = String(deviceId || "").trim().toUpperCase();
  return computeHash(`${SECRET_SALT}:${cleanId}:LIFETIME`);
}

/**
 * Mendapatkan atau membuat Device ID unik untuk perangkat ini.
 * Format: MPOS-XXXX-YYYY (8 digit hex konsisten).
 */
export async function getDeviceId() {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;

    // Coba gunakan ID instalasi dari Constants jika ada, atau buat random hex
    const seed =
      Constants.installationId ||
      Constants.sessionId ||
      Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    const hash = computeHash(seed);
    const newId = `MPOS-${hash}`;

    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch (err) {
    console.warn("Gagal getDeviceId:", err);
    return "MPOS-DEV-8888";
  }
}

/**
 * Memastikan klien lama (yang sudah memakai aplikasi sebelum v7)
 * otomatis mendapatkan lisensi seumur hidup (LIFETIME) tanpa terganggu.
 */
async function ensureLegacyClientProtected() {
  try {
    const legacyFlag = await AsyncStorage.getItem(LEGACY_CLIENT_KEY);
    if (legacyFlag === "1") return;

    // Cek apakah ada data toko lama
    const storeProfile = await AsyncStorage.getItem("@TokoKelontong:StoreProfile");
    const storeName = await AsyncStorage.getItem("storeName");

    if (storeProfile || storeName) {
      // Ini adalah klien lama yang aktif! Aktifkan lisensi permanen langsung
      const deviceId = await getDeviceId();
      const expectedCode = generateExpectedKey(deviceId);
      const fullSerial = `${deviceId}-${expectedCode}`;

      await AsyncStorage.setItem(
        LICENSE_KEY_STORAGE,
        JSON.stringify({
          status: "lifetime",
          licenseKey: fullSerial,
          activatedAt: new Date().toISOString(),
          isLegacyClient: true,
        }),
      );
      await AsyncStorage.setItem(LEGACY_CLIENT_KEY, "1");
    }
  } catch (err) {
    console.warn("Error protecting legacy client:", err);
  }
}

/**
 * Mengambil informasi lisensi perangkat saat ini.
 */
export async function getLicenseInfo() {
  await ensureLegacyClientProtected();
  const deviceId = await getDeviceId();

  try {
    const raw = await AsyncStorage.getItem(LICENSE_KEY_STORAGE);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.status === "lifetime") {
        return {
          status: "lifetime",
          isLicensed: true,
          deviceId,
          licenseKey: data.licenseKey || "",
          activatedAt: data.activatedAt,
          daysRemaining: 9999,
        };
      }
    }

    // Periksa masa Trial
    let trialStart = await AsyncStorage.getItem(TRIAL_START_KEY);
    if (!trialStart) {
      trialStart = new Date().toISOString();
      await AsyncStorage.setItem(TRIAL_START_KEY, trialStart);
    }

    const startDate = new Date(trialStart);
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const daysElapsed = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, TRIAL_DAYS - daysElapsed);

    if (daysRemaining > 0) {
      return {
        status: "trial",
        isLicensed: true,
        deviceId,
        daysRemaining,
        trialStartDate: trialStart,
      };
    }

    return {
      status: "expired",
      isLicensed: false,
      deviceId,
      daysRemaining: 0,
      trialStartDate: trialStart,
    };
  } catch (err) {
    console.warn("Gagal getLicenseInfo:", err);
    return {
      status: "trial",
      isLicensed: true,
      deviceId,
      daysRemaining: TRIAL_DAYS,
    };
  }
}

/**
 * Aktivasi Serial Key untuk perangkat ini.
 * Mendukung format:
 * 1. Full Key: MPOS-XXXX-YYYY-ZZZZ-WWWW
 * 2. Signature Only: ZZZZ-WWWW atau ZZZZWWWW
 */
export async function activateSerialKey(inputKey) {
  const deviceId = await getDeviceId();
  const cleanInput = String(inputKey || "").trim().toUpperCase().replace(/\s+/g, "");
  const expectedCode = generateExpectedKey(deviceId); // e.g. "E4D1-9B5A"
  const expectedCodeClean = expectedCode.replace(/-/g, "");
  const fullExpectedKey = `${deviceId}-${expectedCode}`; // e.g. "MPOS-7A3F-89B2-E4D1-9B5A"

  // Cek apakah input cocok dengan expected code atau full serial key
  const isMatch =
    cleanInput === fullExpectedKey ||
    cleanInput === expectedCode ||
    cleanInput.replace(/-/g, "") === expectedCodeClean ||
    cleanInput.endsWith(expectedCode) ||
    cleanInput.endsWith(expectedCodeClean);

  if (!isMatch) {
    throw new Error(
      "Serial Key tidak valid untuk ID Perangkat ini. Periksa kembali karakter Serial Key Anda.",
    );
  }

  const payload = {
    status: "lifetime",
    licenseKey: fullExpectedKey,
    activatedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(LICENSE_KEY_STORAGE, JSON.stringify(payload));

  // Laporkan ke cloud Supabase (jika online dan store_id tersedia) secara non-blocking
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (sess?.session?.user) {
      await supabase.from("app_licenses").upsert(
        {
          device_id: deviceId,
          license_key: fullExpectedKey,
          license_type: "lifetime",
          status: "active",
          activated_at: new Date().toISOString(),
          notes: "Aktivasi manual dari perangkat",
        },
        { onConflict: "device_id" },
      );
    }
  } catch (syncErr) {
    console.warn("Cloud license logging skipped (offline/unregistered):", syncErr.message);
  }

  return { success: true, message: "Aktivasi Lisensi Permanen Berhasil!" };
}

