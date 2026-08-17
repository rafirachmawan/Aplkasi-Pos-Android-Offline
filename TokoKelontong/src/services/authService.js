import { supabase } from "./supabaseClient";

// Semua username disimpan sebagai email internal di Supabase Auth,
// sehingga pengguna tidak butuh email asli.
const EMAIL_DOMAIN = "@marketpos.app";

export const toAuthEmail = (username) =>
  `${String(username).trim().toLowerCase()}${EMAIL_DOMAIN}`;

// Daftar akun baru: buat auth user, lalu toko + profile (role kasir).
export async function signUp({ username, password, storeName }) {
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
  return supabase.auth.signOut();
}

// Profile akun + toko milik user yang sedang login.
export async function getProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role, store_id, stores(id, store_name)")
    .single();
  if (error) throw error;
  return data;
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
