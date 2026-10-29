import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";

const LOCAL_WHOLESALE_KEY = "@TokoKelontong:LocalWholesale";

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
   * Mengambil semua produk dari Supabase, diurutkan berdasarkan nama (A-Z)
   */
  async getAllProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("product_name", { ascending: true });
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
   * Mencari produk berdasarkan barcode
   */
  async getProductByBarcode(barcode) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("barcode", barcode)
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
   * Mencari produk berdasarkan nama (sebagian atau penuh)
   */
  async searchProductByName(keyword) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .ilike("product_name", `%${keyword}%`)
      .order("product_name", { ascending: true });
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
      .filter((p) => p.stock_quantity <= (p.min_stock_threshold || 5))
      .sort((a, b) => a.stock_quantity - b.stock_quantity);
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
    if (barcode) {
      const existing = await this.getProductByBarcode(barcode);
      if (existing) {
        throw new Error(
          `Barcode sudah terdaftar untuk produk: ${existing.product_name}.`,
        );
      }
    }

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
      .select();
    if (error) throw error;
    return (data || []).length > 0;
  }
}

export default new ProductRepository();
