import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

// ID perangkat unik untuk instalasi ini. Format: MPOS-XXXX (8 digit hex).
//
// CATATAN RIWAYAT (model tier SaaS manual, lihat 13 11 2026 update pro dan gratis .md):
// - Fungsi lama getLicenseInfo(), activateSerialKey(), dan
//   ensureLegacyClientProtected() DIHAPUS. Mereka memberi status "lifetime"
//   dan "trial", yang bertentangan dengan keputusan K-05 (trial dihapus)
//   dan K-06 (klien lama ikut model baru).
// - Status langganan kini ditentukan oleh services/planService.js.
// - Data tersimpan lama (key "@TokoKelontong:LicenseData" dan
//   "@TokoKelontong:TrialStartDate") TIDAK dihapus dari HP klien.
//   Key itu hanya tidak dibaca lagi, sehingga tidak ada data yang rusak.

const DEVICE_ID_KEY = "@TokoKelontong:DeviceId";

// Fungsi hash deterministik murni JS (32-bit FNV-1a berulang).
// Dipakai untuk membuat ID stabil dari seed instalasi.
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
