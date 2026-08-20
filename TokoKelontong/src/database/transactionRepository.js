import { supabase } from "../services/supabaseClient";

// Konversi pola tanggal ('YYYY-MM-DD' / 'YYYY-MM' / '') menjadi rentang
// timestamp ISO sesuai ZONA WAKTU PERANGKAT, agar query "hari ini / bulan ini"
// cocok dengan jam toko (created_at di server disimpan dalam UTC).
function rangeFromPattern(pattern = "") {
  const p = String(pattern || "");
  let start = null;
  let end = null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const [y, m, d] = p.split("-").map(Number);
    start = new Date(y, m - 1, d, 0, 0, 0, 0);
    end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  } else if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split("-").map(Number);
    start = new Date(y, m - 1, 1, 0, 0, 0, 0);
    end = new Date(y, m, 1, 0, 0, 0, 0);
  }
  return {
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
  };
}

async function fetchTransactions(pattern) {
  const { start, end } = rangeFromPattern(pattern);
  let query = supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

class TransactionRepository {
  /**
   * Membuat transaksi via fungsi `checkout` di Supabase:
   * stok divalidasi & dikurangi atomik di server (anti bentrok 2 HP),
   * nomor nota dibuat unik per toko per hari.
   * Return: id transaksi (uuid).
   */
  async createTransaction(
    items,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
  ) {
    const pItems = items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name || "",
      quantity: i.quantity,
      price_at_sale: i.selling_price,
      capital_at_sale: i.capital_price,
    }));

    const { data, error } = await supabase.rpc("checkout", {
      p_items: pItems,
      p_total_price: total_price,
      p_discount_amount: discount_amount,
      p_grand_total: grand_total,
      p_cash_received: cash_received,
      p_cash_return: cash_return,
    });
    if (error) {
      const msg = String(error.message || "");
      if (msg.includes("insufficient_stock")) {
        throw new Error(
          "Stok tidak mencukupi untuk salah satu item (mungkin baru terjual di kasir lain). Muat ulang produk.",
        );
      }
      throw new Error(`Gagal menyimpan transaksi: ${error.message}`);
    }
    return data.id;
  }

  /**
   * Mendapatkan transaksi pada tanggal tertentu (YYYY-MM-DD waktu lokal)
   */
  getTransactionsByDate(dateStr) {
    return fetchTransactions(dateStr);
  }

  /**
   * Mendapatkan transaksi untuk bulan tertentu (YYYY-MM), atau semua bila ''
   */
  getMonthlyTransactions(yearMonthStr) {
    return fetchTransactions(yearMonthStr);
  }

  /**
   * Data lengkap untuk ekspor CSV (nota + detail, nama barang snapshot)
   */
  async getFullReportForExport() {
    const { data, error } = await supabase
      .from("transactions")
      .select(
        "invoice_number, created_at, transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;

    const rows = [];
    for (const t of data || []) {
      const d = new Date(t.created_at); // tanggal lokal perangkat
      const tanggal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      for (const td of t.transaction_details || []) {
        rows.push({
          Tanggal: tanggal,
          No_Nota: t.invoice_number,
          Nama_Barang: td.product_name,
          Qty: td.quantity,
          Harga_Modal: td.capital_at_sale,
          Harga_Jual: td.price_at_sale,
          Total_Penjualan: td.quantity * td.price_at_sale,
          Total_Keuntungan:
            td.quantity * (td.price_at_sale - td.capital_at_sale),
        });
      }
    }
    return rows;
  }

  /**
   * Mengambil detail item untuk satu transaksi
   */
  async getTransactionDetails(transactionId) {
    const { data, error } = await supabase
      .from("transaction_details")
      .select("*")
      .eq("transaction_id", transactionId);
    if (error) throw error;
    return data || [];
  }

  /**
   * Total Omzet, Laba Bersih, dan jumlah transaksi sesuai pola tanggal
   * ('' = semua, 'YYYY-MM' = bulan, 'YYYY-MM-DD' = hari)
   */
  async getSummaryByDatePattern(datePattern = "") {
    const { start, end } = rangeFromPattern(datePattern);
    let query = supabase
      .from("transactions")
      .select(
        "grand_total, transaction_details(quantity, price_at_sale, capital_at_sale)",
      );
    if (start) query = query.gte("created_at", start);
    if (end) query = query.lt("created_at", end);
    const { data, error } = await query;
    if (error) throw error;

    let omzet = 0;
    let laba = 0;
    for (const t of data || []) {
      omzet += t.grand_total || 0;
      // Laba = penerimaan nyata (grand_total sesudah diskon) - modal,
      // agar diskon tidak ikut terhitung sebagai keuntungan.
      let modal = 0;
      for (const td of t.transaction_details || []) {
        modal += td.quantity * (td.capital_at_sale || 0);
      }
      laba += (t.grand_total || 0) - modal;
    }
    return { omzet, laba, count: (data || []).length };
  }
}

export default new TransactionRepository();
