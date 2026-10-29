import { supabase } from "../services/supabaseClient";
import {
  enqueueOfflineTransaction,
  getOfflineQueue,
  removeOfflineTransaction,
} from "../utils/offlineQueue";

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

// Flag cache ketersediaan kolom payment_method di database Supabase
let hasPaymentMethodCol = null;

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

function isNetworkError(err) {
  if (!err) return false;
  const msg = String(err.message || "").toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("timeout") ||
    msg.includes("offline") ||
    msg.includes("connection reset") ||
    msg.includes("networkerror")
  );
}

class TransactionRepository {
  /**
   * Mengirim data transaksi langsung ke RPC Supabase dengan fallback multi-versi.
   */
  async _sendToSupabaseCheckout(
    pItems,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
    payment_method,
    payment_notes,
    order_type,
    table_number,
  ) {
    // 1. Coba pemanggilan versi 10 parameter (v7 - Fase 3)
    let rpcRes = await supabase.rpc("checkout", {
      p_items: pItems,
      p_total_price: total_price,
      p_discount_amount: discount_amount,
      p_grand_total: grand_total,
      p_cash_received: cash_received,
      p_cash_return: cash_return,
      p_payment_method: payment_method || "cash",
      p_payment_notes: payment_notes || "",
      p_order_type: order_type || "retail",
      p_table_number: table_number || "",
    });

    // 2. Fallback jika RPC 10-param belum ada di Supabase, coba versi 8-param (v5/v6)
    if (
      rpcRes.error &&
      (rpcRes.error.code === "PGRST202" ||
        rpcRes.error.code === "42883" ||
        String(rpcRes.error.message || "").toLowerCase().includes("p_order_type") ||
        String(rpcRes.error.message || "").toLowerCase().includes("schema cache") ||
        String(rpcRes.error.message || "").toLowerCase().includes("could not find the function"))
    ) {
      console.warn("RPC checkout 10-param belum ada di Supabase, fallback ke 8-param:", rpcRes.error.message);
      rpcRes = await supabase.rpc("checkout", {
        p_items: pItems,
        p_total_price: total_price,
        p_discount_amount: discount_amount,
        p_grand_total: grand_total,
        p_cash_received: cash_received,
        p_cash_return: cash_return,
        p_payment_method: payment_method || "cash",
        p_payment_notes: payment_notes || "",
      });
    }

    // 3. Fallback jika RPC 8-param juga belum ada, coba versi 6-param awal
    if (
      rpcRes.error &&
      (rpcRes.error.code === "PGRST202" ||
        rpcRes.error.code === "42883" ||
        String(rpcRes.error.message || "").toLowerCase().includes("p_payment_method") ||
        String(rpcRes.error.message || "").toLowerCase().includes("schema cache") ||
        String(rpcRes.error.message || "").toLowerCase().includes("could not find the function"))
    ) {
      console.warn("RPC checkout 8-param belum ada di Supabase, fallback ke 6-param:", rpcRes.error.message);
      rpcRes = await supabase.rpc("checkout", {
        p_items: pItems,
        p_total_price: total_price,
        p_discount_amount: discount_amount,
        p_grand_total: grand_total,
        p_cash_received: cash_received,
        p_cash_return: cash_return,
      });
    }

    if (rpcRes.error) {
      const msg = String(rpcRes.error.message || "");
      if (msg.includes("insufficient_stock")) {
        throw new Error(
          "Stok tidak mencukupi untuk salah satu item (mungkin baru terjual di kasir lain). Muat ulang produk.",
        );
      }
      throw rpcRes.error;
    }

    return rpcRes.data?.id || rpcRes.data;
  }

  /**
   * Membuat transaksi via fungsi `checkout` di Supabase.
   * RESILIENCE: Jika internet mati / offline, otomatis simpan ke Offline Queue lokal
   * tanpa melempar error kegagalan ke kasir!
   */
  async createTransaction(
    items,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
    payment_method = "cash",
    payment_notes = "",
    order_type = "retail",
    table_number = "",
  ) {
    const pItems = items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name || "",
      quantity: i.quantity,
      price_at_sale: i.selling_price,
      capital_at_sale: i.capital_price,
    }));

    try {
      const onlineTxId = await this._sendToSupabaseCheckout(
        pItems,
        total_price,
        discount_amount,
        grand_total,
        cash_received,
        cash_return,
        payment_method,
        payment_notes,
        order_type,
        table_number,
      );
      return onlineTxId;
    } catch (err) {
      // Jika error karena masalah jaringan / offline, simpan ke antrean offline lokal
      if (isNetworkError(err)) {
        console.warn("Internet offline saat checkout, menyimpan transaksi ke antrean lokal:", err.message);
        const queued = await enqueueOfflineTransaction({
          items,
          total_price,
          discount_amount,
          grand_total,
          cash_received,
          cash_return,
          payment_method,
          payment_notes,
          order_type,
          table_number,
        });
        return queued.id;
      }
      // Jika error validasi bisnis (misal stok habis), teruskan error
      throw new Error(`Gagal menyimpan transaksi: ${err.message}`);
    }
  }

  /**
   * Sinkronisasi antrean transaksi offline ke server Supabase.
   */
  async syncOfflineQueue(onProgress) {
    const queue = await getOfflineQueue();
    if (!queue || queue.length === 0) {
      return { total: 0, synced: 0, failed: 0, errors: [] };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      try {
        const pItems = (item.items || []).map((it) => ({
          product_id: it.product_id,
          product_name: it.product_name || "",
          quantity: it.quantity,
          price_at_sale: it.selling_price || it.price_at_sale,
          capital_at_sale: it.capital_price || it.capital_at_sale || 0,
        }));

        const syncNotes = item.payment_notes
          ? `${item.payment_notes} (Sync Offline: ${item.invoice_number})`
          : `Sync Offline: ${item.invoice_number}`;

        await this._sendToSupabaseCheckout(
          pItems,
          item.total_price,
          item.discount_amount,
          item.grand_total,
          item.cash_received,
          item.cash_return,
          item.payment_method,
          syncNotes,
          item.order_type || "retail",
          item.table_number || "",
        );

        await removeOfflineTransaction(item.id);
        synced++;
      } catch (err) {
        failed++;
        errors.push({ id: item.id, invoice: item.invoice_number, error: err.message });
      }

      if (typeof onProgress === "function") {
        onProgress(i + 1, queue.length);
      }
    }

    return { total: queue.length, synced, failed, errors };
  }

  /**
   * Mengambil satu transaksi berdasarkan ID.
   * Mendukung pencarian transaksi offline di antrean lokal bila ID berawalan 'off_'.
   */
  async getTransactionById(transactionId) {
    if (String(transactionId || "").startsWith("off_")) {
      const queue = await getOfflineQueue();
      const match = queue.find((item) => item.id === transactionId);
      if (match) {
        return {
          id: match.id,
          invoice_number: match.invoice_number,
          created_at: match.created_at,
          total_price: match.total_price,
          discount_amount: match.discount_amount,
          grand_total: match.grand_total,
          cash_received: match.cash_received,
          cash_return: match.cash_return,
          payment_method: match.payment_method,
          payment_notes: match.payment_notes,
          order_type: match.order_type,
          table_number: match.table_number,
          is_offline: true,
        };
      }
    }

    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", transactionId)
        .single();
      if (error) throw error;
      return data;
    } catch (err) {
      // Fallback periksa antrean offline jika Supabase error
      const queue = await getOfflineQueue();
      const match = queue.find((item) => item.id === transactionId);
      if (match) {
        return {
          id: match.id,
          invoice_number: match.invoice_number,
          created_at: match.created_at,
          total_price: match.total_price,
          discount_amount: match.discount_amount,
          grand_total: match.grand_total,
          cash_received: match.cash_received,
          cash_return: match.cash_return,
          payment_method: match.payment_method,
          payment_notes: match.payment_notes,
          order_type: match.order_type,
          table_number: match.table_number,
          is_offline: true,
        };
      }
      throw err;
    }
  }

  /**
   * Mengambil detail item untuk satu transaksi (offline atau online)
   */
  async getTransactionDetails(transactionId) {
    if (String(transactionId || "").startsWith("off_")) {
      const queue = await getOfflineQueue();
      const match = queue.find((item) => item.id === transactionId);
      if (match) {
        return (match.items || []).map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          price_at_sale: it.selling_price || it.price_at_sale,
          capital_at_sale: it.capital_price || it.capital_at_sale || 0,
        }));
      }
    }

    try {
      const { data, error } = await supabase
        .from("transaction_details")
        .select("*")
        .eq("transaction_id", transactionId);
      if (error) throw error;
      return data || [];
    } catch (err) {
      const queue = await getOfflineQueue();
      const match = queue.find((item) => item.id === transactionId);
      if (match) {
        return (match.items || []).map((it) => ({
          product_name: it.product_name,
          quantity: it.quantity,
          price_at_sale: it.selling_price || it.price_at_sale,
          capital_at_sale: it.capital_price || it.capital_at_sale || 0,
        }));
      }
      throw err;
    }
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
    let data = null;

    if (hasPaymentMethodCol !== false) {
      const res = await supabase
        .from("transactions")
        .select(
          "invoice_number, created_at, total_price, discount_amount, payment_method, order_type, table_number, transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
        )
        .order("created_at", { ascending: false });

      if (!res.error) {
        hasPaymentMethodCol = true;
        data = res.data;
      } else if (
        res.error.code === "42703" ||
        String(res.error.message || "").toLowerCase().includes("payment_method") ||
        String(res.error.message || "").toLowerCase().includes("order_type")
      ) {
        hasPaymentMethodCol = false;
      } else {
        throw res.error;
      }
    }

    if (!data) {
      const fbRes = await supabase
        .from("transactions")
        .select(
          "invoice_number, created_at, total_price, discount_amount, transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
        )
        .order("created_at", { ascending: false });
      if (fbRes.error) throw fbRes.error;
      data = fbRes.data;
    }

    const rows = [];
    for (const t of data || []) {
      const d = new Date(t.created_at); // tanggal lokal perangkat
      const tanggal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const totalPrice = t.total_price || 0;
      const discountAmount = t.discount_amount || 0;
      for (const td of t.transaction_details || []) {
        const lineRevenue = td.quantity * td.price_at_sale;
        const allocatedDiscount =
          totalPrice > 0
            ? Math.round((lineRevenue / totalPrice) * discountAmount)
            : 0;
        rows.push({
          Tanggal: tanggal,
          No_Nota: t.invoice_number,
          Metode_Bayar: (t.payment_method || "cash").toUpperCase(),
          Tipe_Pesanan: (t.order_type || "retail").toUpperCase(),
          Nomor_Meja: t.table_number || "-",
          Nama_Barang: td.product_name,
          Qty: td.quantity,
          Harga_Modal: td.capital_at_sale,
          Harga_Jual: td.price_at_sale,
          Total_Penjualan: lineRevenue,
          Total_Keuntungan:
            lineRevenue - allocatedDiscount - td.quantity * (td.capital_at_sale || 0),
        });
      }
    }
    return rows;
  }

  /**
   * Total Omzet, Laba Bersih, rincian Tunai vs Non-Tunai, dan produk terlaris
   */
  async getSummaryByDatePattern(datePattern = "") {
    const { start, end } = rangeFromPattern(datePattern);
    let data = null;

    if (hasPaymentMethodCol !== false) {
      let query = supabase
        .from("transactions")
        .select(
          "grand_total, payment_method, transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
        );
      if (start) query = query.gte("created_at", start);
      if (end) query = query.lt("created_at", end);
      const res = await query;

      if (!res.error) {
        hasPaymentMethodCol = true;
        data = res.data;
      } else if (
        res.error.code === "42703" ||
        String(res.error.message || "").toLowerCase().includes("payment_method")
      ) {
        hasPaymentMethodCol = false;
      } else {
        throw res.error;
      }
    }

    if (!data) {
      let fbQuery = supabase
        .from("transactions")
        .select(
          "grand_total, transaction_details(product_name, quantity, price_at_sale, capital_at_sale)",
        );
      if (start) fbQuery = fbQuery.gte("created_at", start);
      if (end) fbQuery = fbQuery.lt("created_at", end);
      const fbRes = await fbQuery;
      if (fbRes.error) throw fbRes.error;
      data = fbRes.data;
    }

    let omzet = 0;
    let omzet_tunai = 0;
    let omzet_non_tunai = 0;
    let laba = 0;
    const productSalesMap = {};

    for (const t of data || []) {
      const gTotal = t.grand_total || 0;
      omzet += gTotal;

      const method = String(t.payment_method || "cash").toLowerCase();
      if (method === "qris" || method === "transfer" || method === "debit") {
        omzet_non_tunai += gTotal;
      } else {
        omzet_tunai += gTotal;
      }

      let modal = 0;
      for (const td of t.transaction_details || []) {
        const qty = td.quantity || 0;
        modal += qty * (td.capital_at_sale || 0);
        if (td.product_name) {
          productSalesMap[td.product_name] =
            (productSalesMap[td.product_name] || 0) + qty;
        }
      }
      laba += gTotal - modal;
    }

    const topProducts = Object.entries(productSalesMap)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      omzet,
      omzet_tunai,
      omzet_non_tunai,
      laba,
      count: (data || []).length,
      top_products: topProducts,
    };
  }
}

export default new TransactionRepository();
