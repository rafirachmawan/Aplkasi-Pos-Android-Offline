import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabaseClient";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig";
import { LEGACY_GLOBAL_STORE_KEYS } from "./sessionStore";

// Semua username disimpan sebagai email internal di Supabase Auth,
// sehingga pengguna tidak butuh email asli.
const EMAIL_DOMAIN = "@marketpos.app";

export const toAuthEmail = (username) =>
  `${String(username).trim().toLowerCase()}${EMAIL_DOMAIN}`;

/**
 * Membersihkan data cache lokal toko agar sesi dan konfigurasi tidak bocor
 * ke akun lain.
 * - Default (logout): hanya PIN & menu terkunci. Profil nota, nama toko, dan
 *   pesanan tertahan dipertahankan; semuanya dibersihkan otomatis bila yang
 *   login berikutnya adalah TOKO LAIN (lihat AuthContext).
 * - full: bersihkan semua (daftar toko baru / ganti toko).
 * Outbox transaksi & katalog di SQLite TIDAK pernah dihapus di sini.
 */
export async function clearStoreLocalSession({ full = false } = {}) {
  try {
    const keys = [
      "@TokoKelontong:SecurityPin",
      "@TokoKelontong:LockedMenus",
      ...LEGACY_GLOBAL_STORE_KEYS,
    ];
    if (full) {
      keys.push("@TokoKelontong:HeldOrders");
    }
    await AsyncStorage.multiRemove(keys);
  } catch (err) {
    console.warn("Gagal membersihkan cache lokal sesi toko:", err);
  }
}

// Daftar akun baru: buat auth user, lalu toko + profile (role kasir).
export async function signUp({ username, password, storeName }) {
  await clearStoreLocalSession({ full: true });
  const email = toAuthEmail(username);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) {
    // Terjadi bila "Confirm email" masih aktif di dashboard Supabase.
    throw new Error("email_confirmation_still_on");
  }
  await ensureProfile(username, storeName);
  return data.session;
}

// Pastikan toko + profile sudah ada (aman dipanggil berulang).
// Memperbaiki akun "setengah terdaftar" (auth user ada, profile belum).
export async function ensureProfile(username, storeName) {
  try {
    await getProfile();
    return; // profile sudah ada
  } catch (e) {
    // belum terdaftar → buat sekarang
  }
  const { error } = await supabase.rpc("register_store", {
    p_username: String(username).trim().toLowerCase(),
    p_store_name: storeName || "",
  });
  if (error && !String(error.message).includes("already_registered")) {
    throw error;
  }
}

// Masuk dengan username + password.
export async function signIn({ username, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(username),
    password,
  });
  if (error) throw error;
  // Self-heal: bila profile belum terbentuk (misal daftar pernah gagal),
  // buat toko + profile sekarang.
  await ensureProfile(username, "");
  return data.session;
}

export async function signOut() {
  let accessToken = null;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token || null;
  } catch {
    accessToken = null;
  }

  await clearStoreLocalSession();
  try {
    const ref = (String(SUPABASE_URL).match(/^https?:\/\/([^./]+)/) || [])[1];
    if (ref) {
      const key = `sb-${ref}-auth-token`;
      await AsyncStorage.multiRemove([key, `${key}-user`, `${key}-code-verifier`]);
    }
  } catch (err) {
    console.warn("Gagal menghapus sesi lokal:", err);
  }

  // Keluar lokal seketika agar mode offline tidak menggantung menunggu timeout jaringan.
  const res = await supabase.auth.signOut({ scope: "local" });

  // Cabut token sesi di server secara best-effort di latar belakang bila online.
  if (accessToken) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }

  return res;
}

// Profile akun + toko milik user yang sedang login.
export async function getProfile() {
  const selectVariants = [
    "id, username, role, store_id, stores(id, store_name, security_pin, security_pin_hash)",
    "id, username, role, store_id, stores(id, store_name, security_pin)",
    "id, username, role, store_id, stores(id, store_name)",
  ];

  let lastRes = null;
  for (const cols of selectVariants) {
    lastRes = await supabase.from("profiles").select(cols).single();
    if (!lastRes.error) {
      return lastRes.data;
    }
  }

  throw lastRes.error;
}

// Ganti nama toko di cloud (terbaca oleh semua HP toko yang sama).
export async function updateStoreName(storeName) {
  const { data: storeId, error: idError } =
    await supabase.rpc("current_store_id");
  if (idError) throw idError;
  if (!storeId) throw new Error("not_registered");
  const { error } = await supabase
    .from("stores")
    .update({ store_name: storeName })
    .eq("id", storeId);
  if (error) throw error;
}

// Ganti password: validasi password lama dulu, baru update.
export async function changePassword(currentPassword, newPassword) {
  const profile = await getProfile();
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: toAuthEmail(profile.username),
    password: currentPassword,
  });
  if (verifyError) throw new Error("wrong_password");
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
