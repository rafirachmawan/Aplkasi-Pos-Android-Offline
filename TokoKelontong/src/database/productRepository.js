import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";
import { getActiveStoreId } from "../services/sessionStore";
import { deleteProductImageByUrl } from "../utils/imageStorage";
import {
  getCatalog,
  getCatalogProductByBarcode,
  applyPendingStockDeductions,
} from "./localDb";

const LOCAL_WHOLESALE_KEY = "@TokoKelontong:LocalWholesale";
const PAGE_SIZE = 1000;

export function isNetworkLikeError(err) {
  if (!err) return false;
  const msg = String(err.message || err.details || "").toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("offline") ||
    msg.includes("load failed") ||
    msg.includes("connection") ||
    msg.includes("networkerror")
  );
}

// Ambil seluruh produk per halaman (batas default Supabase 1000 baris).
async function fetchAllProductRows(storeId) {
  let targetStoreId = storeId;
  if (!targetStoreId) {
    try {
      targetStoreId = (await getActiveStoreId()) || (await getStoreId());
    } catch {
      targetStoreId = null;
    }
  }

  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("products")
      .select("*")
      .order("product_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (targetStoreId) {
      query = query.eq("store_id", targetStoreId);
    }

    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// store_id toko milik user yang sedang login (di-cache per user, jadi
// ganti akun tanpa restart aplikasi tetap memakai toko yang benar).
let cachedStoreId = null;
let cachedForUser = null;
let hasWholesaleCol = null;

async function getStoreId() {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id || null;
  if (cachedStoreId && cachedForUser === uid) return cachedStoreId;
  const { data, error } = await supabase.rpc("current_store_id");
  if (error) throw error;
  if (!data) throw new Error("Akun belum terdaftar ke toko mana pun.");
  cachedStoreId = data;
  cachedForUser = uid;
  return cachedStoreId;
}

async function getLocalWholesaleMap() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_WHOLESALE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function setLocalWholesale(productId, rules) {
  try {
    const map = await getLocalWholesaleMap();
    map[productId] = rules || [];
    await AsyncStorage.setItem(LOCAL_WHOLESALE_KEY, JSON.stringify(map));
  } catch (err) {
    console.warn("Gagal simpan harga grosir lokal:", err);
  }
}

class ProductRepository {
  /**
   * Mengambil semua produk dari Supabase (semua halaman), diurutkan A-Z.
   * Jika jaringan bermasalah dan katalog lokal tersedia, katalog lokal dipakai.
   */
  async getAllProducts() {
    const { products } = await this.getAllProductsWithSource();
    return products;
  }

  /**
   * Mengambil semua produk beserta informasi apakah berasal dari cache lokal
   * (`fromCache: true`) agar Gudang tahu saat perangkat offline.
   */
  async getAllProductsWithSource() {
    try {
      let targetStoreId = null;
      try {
        targetStoreId = (await getActiveStoreId()) || (await getStoreId());
      } catch {
        targetStoreId = null;
      }
      const serverProducts = await this.fetchProductsFromServer(targetStoreId);
      const products = targetStoreId
        ? await applyPendingStockDeductions(targetStoreId, serverProducts)
        : serverProducts;
      return { products, fromCache: false };
    } catch (err) {
      if (isNetworkLikeError(err)) {
        const cached = await this.getCachedProducts();
        if (cached.length > 0) return { products: cached, fromCache: true };
      }
      throw err;
    }
  }

  /**
   * Ambil katalog langsung dari server (tanpa cadangan lokal).
   */
  async fetchProductsFromServer(storeId) {
    let targetStoreId = storeId;
    if (!targetStoreId) {
      try {
        targetStoreId = (await getActiveStoreId()) || (await getStoreId());
      } catch {
        targetStoreId = null;
      }
    }
    const rows = await fetchAllProductRows(targetStoreId);
    const localMap = await getLocalWholesaleMap();
    return rows.map((p) => ({
      ...p,
      wholesale_rules:
        p.wholesale_rules && Array.isArray(p.wholesale_rules) && p.wholesale_rules.length > 0
          ? p.wholesale_rules
          : localMap[p.id] || [],
    }));
  }

  /**
   * Katalog produk dari penyimpanan lokal (SQLite) dengan stok efektif
   * (stok server terakhir dikurangi penjualan yang belum terkirim).
   */
  async getCachedProducts() {
    try {
      const storeId = await getActiveStoreId();
      if (!storeId) return [];
      return await getCatalog(storeId);
    } catch (err) {
      console.warn("Gagal membaca katalog lokal:", err?.message || err);
      return [];
    }
  }

  /**
   * Mencari produk berdasarkan barcode.
   * Jika `localFirst` aktif (mode kasir), baca SQLite lokal dulu agar instan & offline-first.
   */
  async getProductByBarcode(barcode, { localFirst = false } = {}) {
    let targetStoreId = null;
    try {
      targetStoreId = (await getActiveStoreId()) || (await getStoreId());
    } catch (_) {}

    if (localFirst && targetStoreId) {
      try {
        const cached = await getCatalogProductByBarcode(targetStoreId, barcode);
        if (cached) return cached;
      } catch {
        // lanjut cek server
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let res;
    try {
      let query = supabase
        .from("products")
        .select("*")
        .eq("barcode", barcode);
      if (targetStoreId) {
        query = query.eq("store_id", targetStoreId);
      }
      res = await query.abortSignal(controller.signal).maybeSingle();
    } catch (err) {
      res = { error: err };
    } finally {
      clearTimeout(timer);
    }

    if (res.error) {
      if (isNetworkLikeError(res.error)) {
        try {
          const storeId = targetStoreId || (await getActiveStoreId());
          const cached = storeId
            ? await getCatalogProductByBarcode(storeId, barcode)
            : null;
          if (cached) return cached;
        } catch {
          // lanjut ke error asli
        }
      }
      throw res.error;
    }
    const data = res.data;
    if (!data) return null;

    const localMap = await getLocalWholesaleMap();
    const product = {
      ...data,
      wholesale_rules:
        data.wholesale_rules && Array.isArray(data.wholesale_rules) && data.wholesale_rules.length > 0
          ? data.wholesale_rules
          : localMap[data.id] || [],
    };
    if (targetStoreId) {
      const [adjusted] = await applyPendingStockDeductions(targetStoreId, [product]);
      return adjusted;
    }
    return product;
  }

  /**
   * Mencari produk berdasarkan nama (sebagian atau penuh)
   */
  async searchProductByName(keyword) {
    let targetStoreId = null;
    try {
      targetStoreId = (await getActiveStoreId()) || (await getStoreId());
    } catch (_) {}

    let query = supabase
      .from("products")
      .select("*")
      .ilike("product_name", `%${keyword}%`)
      .order("product_name", { ascending: true });

    if (targetStoreId) {
      query = query.eq("store_id", targetStoreId);
    }
    const { data, error } = await query;
    if (error) throw error;

    const localMap = await getLocalWholesaleMap();
    return (data || []).map((p) => ({
      ...p,
      wholesale_rules:
        p.wholesale_rules && Array.isArray(p.wholesale_rules) && p.wholesale_rules.length > 0
          ? p.wholesale_rules
          : localMap[p.id] || [],
    }));
  }

  /**
   * Mengambil produk yang stoknya menipis (termasuk habis)
   */
  async getLowStockProducts() {
    const all = await this.getAllProducts();
    return all
      .filter(
        (p) =>
          Number(p.min_stock_threshold) >= 0 &&
          p.stock_quantity <= (p.min_stock_threshold ?? 5),
      )
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
  }

  async _assertUniqueBarcode(barcode, excludeProductId = null) {
    const clean = String(barcode || "").trim();
    if (!clean) return;
    const existing = await this.getProductByBarcode(clean);
    if (existing && existing.id !== excludeProductId) {
      throw new Error(
        `Barcode sudah terdaftar untuk produk: ${existing.product_name}.`,
      );
    }
  }

  /**
   * Menambahkan produk baru (store_id otomatis milik akun login)
   */
  async addProduct(product) {
    const {
      barcode,
      product_name,
      capital_price,
      selling_price,
      stock_quantity,
      min_stock_threshold = 5,
      image_uri = null,
      unit = "pack",
      category = "makanan",
      wholesale_rules = [],
    } = product;

    // Validasi barcode unik (pesan ramah seperti versi lokal)
    await this._assertUniqueBarcode(barcode);

    const storeId = await getStoreId();
    const payload = {
      store_id: storeId,
      barcode,
      product_name,
      capital_price,
      selling_price,
      stock_quantity,
      min_stock_threshold,
      image_uri,
      unit,
      category,
    };

    let result = null;

    if (hasWholesaleCol !== false) {
      const res = await supabase
        .from("products")
        .insert({
          ...payload,
          wholesale_rules: wholesale_rules || [],
        })
        .select()
        .single();

      if (!res.error) {
        hasWholesaleCol = true;
        result = res.data;
      } else if (
        res.error.code === "42703" ||
        String(res.error.message || "").toLowerCase().includes("wholesale_rules")
      ) {
        hasWholesaleCol = false;
      } else {
        throw res.error;
      }
    }

    if (!result) {
      const fbRes = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();
      if (fbRes.error) throw fbRes.error;
      result = fbRes.data;

      // Simpan aturan grosir di penyimpanan lokal jika server belum migrasi
      if (wholesale_rules && wholesale_rules.length > 0) {
        await setLocalWholesale(result.id, wholesale_rules);
      }
    }

    return result.id;
  }

  /**
   * Mengambil satu produk berdasarkan ID
   */
  async getProductById(id) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const localMap = await getLocalWholesaleMap();
    return {
      ...data,
      wholesale_rules:
        data.wholesale_rules && Array.isArray(data.wholesale_rules) && data.wholesale_rules.length > 0
          ? data.wholesale_rules
          : localMap[data.id] || [],
    };
  }

  /**
   * Memperbarui data produk berdasarkan ID
   */
  async updateProduct(id, product) {
    const {
      barcode,
      product_name,
      capital_price,
      selling_price,
      stock_quantity,
      min_stock_threshold,
      image_uri = null,
      unit = "pack",
      category = "makanan",
      wholesale_rules = [],
    } = product;

    await this._assertUniqueBarcode(barcode, id);

    let oldImageUri = null;
    try {
      const { data: existingRow } = await supabase
        .from("products")
        .select("image_uri")
        .eq("id", id)
        .maybeSingle();
      oldImageUri = existingRow?.image_uri || null;
    } catch {
      oldImageUri = null;
    }

    const payload = {
      barcode,
      product_name,
      capital_price,
      selling_price,
      stock_quantity,
      min_stock_threshold,
      image_uri,
      unit,
      category,
    };

    let updated = false;

    if (hasWholesaleCol !== false) {
      const res = await supabase
        .from("products")
        .update({
          ...payload,
          wholesale_rules: wholesale_rules || [],
        })
        .eq("id", id)
        .select();

      if (!res.error) {
        hasWholesaleCol = true;
        updated = (res.data || []).length > 0;
      } else if (
        res.error.code === "42703" ||
        String(res.error.message || "").toLowerCase().includes("wholesale_rules")
      ) {
        hasWholesaleCol = false;
      } else {
        throw res.error;
      }
    }

    if (!updated) {
      const fbRes = await supabase
        .from("products")
        .update(payload)
        .eq("id", id)
        .select();
      if (fbRes.error) throw fbRes.error;
      updated = (fbRes.data || []).length > 0;

      // Update harga grosir di cache lokal
      await setLocalWholesale(id, wholesale_rules || []);
    }

    if (updated && oldImageUri && oldImageUri !== image_uri) {
      void deleteProductImageByUrl(oldImageUri);
    }

    return updated;
  }

  /**
   * Menghapus produk berdasarkan ID
   */
  async deleteProduct(id) {
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", id)
      .select("id, image_uri");
    if (error) throw error;
    for (const row of data || []) {
      if (row?.image_uri) {
        void deleteProductImageByUrl(row.image_uri);
      }
    }
    return (data || []).length > 0;
  }
}

// Mengubah master barang butuh server (Gudang hanya-baca saat offline).
const OFFLINE_EDIT_MESSAGE =
  "Mengubah data barang membutuhkan koneksi internet. Sambungkan internet lalu coba lagi. Penjualan di Kasir tetap bisa dilakukan tanpa internet.";

const repository = new ProductRepository();
for (const name of ["addProduct", "updateProduct", "deleteProduct", "getProductById"]) {
  const original = repository[name].bind(repository);
  repository[name] = async (...args) => {
    try {
      return await original(...args);
    } catch (err) {
      if (isNetworkLikeError(err)) throw new Error(OFFLINE_EDIT_MESSAGE);
      throw err;
    }
  };
}

export default repository;
