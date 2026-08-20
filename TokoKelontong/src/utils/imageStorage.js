import * as FileSystemLegacy from "expo-file-system/legacy";
import { supabase } from "../services/supabaseClient";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig";

const BUCKET = "product-images";

/**
 * Upload foto produk lokal (file://) ke Supabase Storage dan
 * mengembalikan URL publik yang bisa dirender di semua perangkat.
 *
 * Prasyarat: bucket publik 'product-images' sudah dibuat
 * (lihat supabase/migration_v3_storage.sql).
 *
 * @param {string} localUri - URI lokal dari image picker (file://...)
 * @param {string} folder - folder tujuan di dalam bucket (default "products")
 * @returns {Promise<string>} URL publik gambar
 */
export const uploadProductImage = async (localUri, folder = "products") => {
  // Pastikan file lokal benar-benar ada sebelum diunggah.
  const info = await FileSystemLegacy.getInfoAsync(localUri);
  if (!info.exists) {
    throw new Error("File foto tidak ditemukan di perangkat");
  }

  // Tentukan ekstensi dari URI (fallback jpg)
  const rawExt = (localUri.split(".").pop() || "").toLowerCase();
  const ext = ["png", "jpg", "jpeg", "webp", "heic"].includes(rawExt)
    ? rawExt === "jpeg"
      ? "jpg"
      : rawExt
    : "jpg";
  const contentType = `image/${ext === "jpg" ? "jpeg" : ext}`;

  // Path unik per upload — folder sesuai tujuan per nama file unik
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${ext}`;

  // Token sesi agar lolos policy storage (insert untuk user login).
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  // Upload native: file di-stream langsung oleh modul native.
  // Jauh lebih andal di React Native dibanding fetch()->blob()
  // yang sering gagal dengan "Network request failed".
  const res = await FileSystemLegacy.uploadAsync(
    `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`,
    localUri,
    {
      httpMethod: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "x-upsert": "false",
      },
      contentType,
    },
  );

  if (!res || res.status < 200 || res.status >= 300) {
    throw new Error(
      `Upload ditolak server (${res ? res.status : "?"}): ${
        res && res.body ? res.body : "respons kosong"
      }`,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

/**
 * Apakah URI ini URL cloud (bukan file lokal)?
 */
export const isCloudImageUri = (uri) =>
  !!uri && /^https?:\/\//.test(uri);
