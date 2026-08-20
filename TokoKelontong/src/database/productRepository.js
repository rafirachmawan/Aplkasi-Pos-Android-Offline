import { supabase } from "../services/supabaseClient";

// store_id toko milik user yang sedang login (di-cache per user, jadi
// ganti akun tanpa restart aplikasi tetap memakai toko yang benar).
let cachedStoreId = null;
let cachedForUser = null;
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
    return data || [];
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
    return data;
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
    return data || [];
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
    const { data, error } = await supabase
      .from("products")
      .insert({
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
      })
      .select()
      .single();
    if (error) throw error;
    return data.id;
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
    return data;
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
    } = product;

    const { data, error } = await supabase
      .from("products")
      .update({
        barcode,
        product_name,
        capital_price,
        selling_price,
        stock_quantity,
        min_stock_threshold,
        image_uri,
        unit,
        category,
      })
      .eq("id", id)
      .select();
    if (error) throw error;
    return (data || []).length > 0;
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
