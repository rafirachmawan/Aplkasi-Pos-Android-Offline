import { supabase } from "../services/supabaseClient";

const BUCKET = "product-images";

/**
 * Upload foto produk lokal (file://) ke Supabase Storage dan
 * mengembalikan URL publik yang bisa dirender di semua perangkat.
 *
 * Prasyarat: bucket publik 'product-images' sudah dibuat
 * (lihat supabase/migration_v3_storage.sql).
 *
 * @param {string} localUri - URI lokal dari image picker (file://...)
 * @returns {Promise<string>} URL publik gambar
 */
export const uploadProductImage = async (localUri) => {
  // Baca file lokal menjadi Blob (fetch mendukung URI file:// di RN)
  const response = await fetch(localUri);
  const blob = await response.blob();

  // Tentukan ekstensi dari URI (fallback jpg)
  const rawExt = (localUri.split(".").pop() || "").toLowerCase();
  const ext = ["png", "jpg", "jpeg", "webp", "heic"].includes(rawExt)
    ? rawExt === "jpeg"
      ? "jpg"
      : rawExt
    : "jpg";

  // Path unik per upload — folder "products" per nama file unik
  const fileName = `products/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: false,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
};

/**
 * Apakah URI ini URL cloud (bukan file lokal)?
 */
export const isCloudImageUri = (uri) =>
  !!uri && /^https?:\/\//.test(uri);
