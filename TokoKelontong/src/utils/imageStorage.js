import * as FileSystemLegacy from "expo-file-system/legacy";
import { supabase } from "../services/supabaseClient";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config/supabaseConfig";

const DEFAULT_BUCKET = "product-images";

/**
 * Upload foto lokal (file://) ke Supabase Storage dan
 * mengembalikan URL publik yang bisa dirender di semua perangkat.
 *
 * @param {string} localUri - URI lokal dari image picker (file://...)
 * @param {string} bucketName - nama bucket tujuan (default "product-images")
 * @param {string} folder - folder tujuan di dalam bucket (default "uploads")
 * @returns {Promise<string>} URL publik gambar
 */
export const uploadImageToBucket = async (
  localUri,
  bucketName = DEFAULT_BUCKET,
  folder = "uploads"
) => {
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

  // Path unik per upload
  const fileName = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}.${ext}`;

  // Token sesi
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  // Coba upload ke bucket target, jika bucket belum ada / error, fallback ke DEFAULT_BUCKET
  let targetBucket = bucketName;
  let res;

  try {
    res = await FileSystemLegacy.uploadAsync(
      `${SUPABASE_URL}/storage/v1/object/${targetBucket}/${fileName}`,
      localUri,
      {
        httpMethod: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "x-upsert": "false",
        },
        contentType,
      }
    );
  } catch (err) {
    if (targetBucket !== DEFAULT_BUCKET) {
      targetBucket = DEFAULT_BUCKET;
      res = await FileSystemLegacy.uploadAsync(
        `${SUPABASE_URL}/storage/v1/object/${targetBucket}/${fileName}`,
        localUri,
        {
          httpMethod: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "x-upsert": "false",
          },
          contentType,
        }
      );
    } else {
      throw err;
    }
  }

  if (!res || res.status < 200 || res.status >= 300) {
    // Jika gagal di custom bucket, coba fallback ke product-images
    if (targetBucket !== DEFAULT_BUCKET) {
      targetBucket = DEFAULT_BUCKET;
      res = await FileSystemLegacy.uploadAsync(
        `${SUPABASE_URL}/storage/v1/object/${targetBucket}/${fileName}`,
        localUri,
        {
          httpMethod: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            "x-upsert": "false",
          },
          contentType,
        }
      );
    }
  }

  if (!res || res.status < 200 || res.status >= 300) {
    throw new Error(
      `Upload ditolak server (${res ? res.status : "?"}): ${
        res && res.body ? res.body : "respons kosong"
      }`
    );
  }

  const { data } = supabase.storage.from(targetBucket).getPublicUrl(fileName);
  return data.publicUrl;
};

/**
 * Upload foto produk lokal (file://) ke Supabase Storage (kompatibel penuh dengan kode lama).
 */
export const uploadProductImage = async (localUri, folder = "products") => {
  return uploadImageToBucket(localUri, DEFAULT_BUCKET, folder);
};

/**
 * Apakah URI ini URL cloud (bukan file lokal)?
 */
export const isCloudImageUri = (uri) =>
  !!uri && /^https?:\/\//.test(uri);
