import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";

const LOCAL_DEBTS_KEY = "@TokoKelontong:CustomerDebts";
const LOCAL_PAYMENTS_KEY = "@TokoKelontong:DebtPayments";

let hasDebtTable = null;

async function getStoreId() {
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session?.user) return null;
    const { data } = await supabase.rpc("current_store_id");
    return data || null;
  } catch {
    return null;
  }
}

// ── Helper Local Storage ──
async function getLocalDebts() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_DEBTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalDebts(debts) {
  try {
    await AsyncStorage.setItem(LOCAL_DEBTS_KEY, JSON.stringify(debts));
  } catch (err) {
    console.warn("Gagal simpan kasbon lokal:", err);
  }
}

async function getLocalPayments() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_PAYMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveLocalPayments(payments) {
  try {
    await AsyncStorage.setItem(LOCAL_PAYMENTS_KEY, JSON.stringify(payments));
  } catch (err) {
    console.warn("Gagal simpan pembayaran kasbon lokal:", err);
  }
}

class DebtRepository {
  /**
   * Mengambil semua daftar kasbon / hutang pelanggan.
   * Mendukung filter: 'all', 'unpaid' (termasuk partially_paid), 'paid'
   */
  async getDebts(filter = "all") {
    if (hasDebtTable !== false) {
      try {
        let query = supabase
          .from("customer_debts")
          .select("*, debt_payments(*)")
          .order("created_at", { ascending: false });

        if (filter === "unpaid") {
          query = query.neq("status", "paid");
        } else if (filter === "paid") {
          query = query.eq("status", "paid");
        }

        const { data, error } = await query;
        if (!error && data) {
          hasDebtTable = true;
          return data;
        }
        if (
          error &&
          (error.code === "42P01" ||
            String(error.message || "").toLowerCase().includes("customer_debts"))
        ) {
          hasDebtTable = false;
        }
      } catch {
        hasDebtTable = false;
      }
    }

    // Fallback offline / local
    const local = await getLocalDebts();
    const payments = await getLocalPayments();

    const merged = local.map((d) => ({
      ...d,
      debt_payments: payments.filter((p) => p.debt_id === d.id),
    }));

    if (filter === "unpaid") {
      return merged.filter((d) => d.status !== "paid");
    } else if (filter === "paid") {
      return merged.filter((d) => d.status === "paid");
    }
    return merged.sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
    );
  }

  /**
   * Mendapatkan detail satu catatan kasbon beserta riwayat cicilan
   */
  async getDebtById(debtId) {
    if (hasDebtTable !== false) {
      try {
        const { data, error } = await supabase
          .from("customer_debts")
          .select("*, debt_payments(*)")
          .eq("id", debtId)
          .maybeSingle();
        if (!error && data) return data;
      } catch {
        // fallback
      }
    }

    const local = await getLocalDebts();
    const found = local.find((d) => d.id === debtId);
    if (!found) return null;
    const payments = await getLocalPayments();
    return {
      ...found,
      debt_payments: payments.filter((p) => p.debt_id === debtId),
    };
  }

  /**
   * Mencatat kasbon baru saat checkout transaksi atau manual
   */
  async createDebt({
    customer_name,
    customer_phone = "",
    transaction_id = null,
    invoice_number = "",
    total_debt = 0,
    remaining_debt = 0,
    due_date = null,
    notes = "",
  }) {
    const debtObj = {
      id: "debt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      transaction_id,
      invoice_number,
      total_debt: Number(total_debt),
      remaining_debt: Number(remaining_debt),
      due_date: due_date || null,
      notes: notes.trim(),
      status: Number(remaining_debt) <= 0 ? "paid" : "unpaid",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (hasDebtTable !== false) {
      try {
        const storeId = await getStoreId();
        if (storeId) {
          const { data, error } = await supabase
            .from("customer_debts")
            .insert({
              store_id: storeId,
              customer_name: debtObj.customer_name,
              customer_phone: debtObj.customer_phone,
              transaction_id: debtObj.transaction_id,
              invoice_number: debtObj.invoice_number,
              total_debt: debtObj.total_debt,
              remaining_debt: debtObj.remaining_debt,
              due_date: debtObj.due_date,
              notes: debtObj.notes,
              status: debtObj.status,
            })
            .select()
            .single();

          if (!error && data) {
            hasDebtTable = true;
            debtObj.id = data.id;
          }
        }
      } catch (err) {
        console.warn("Simpan hutang ke server gagal, fallback lokal:", err);
      }
    }

    // Selalu simpan di lokal sebagai cache offline
    const local = await getLocalDebts();
    await saveLocalDebts([debtObj, ...local]);

    return debtObj;
  }

  /**
   * Mencatat cicilan atau pelunasan kasbon
   */
  async recordPayment(
    debtId,
    { payment_amount, payment_method = "cash", notes = "" },
  ) {
    const amount = Number(payment_amount);
    if (amount <= 0) {
      throw new Error("Nominal pembayaran harus lebih dari Rp 0.");
    }

    const payObj = {
      id: "pay_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      debt_id: debtId,
      payment_amount: amount,
      payment_method,
      notes: notes.trim(),
      created_at: new Date().toISOString(),
    };

    let updatedRemaining = 0;
    let newStatus = "unpaid";

    // Hitung sisa hutang dari cache lokal
    const localDebts = await getLocalDebts();
    const idx = localDebts.findIndex((d) => d.id === debtId);
    if (idx !== -1) {
      const curDebt = localDebts[idx];
      updatedRemaining = Math.max(0, curDebt.remaining_debt - amount);
      newStatus = updatedRemaining === 0 ? "paid" : "partially_paid";

      localDebts[idx] = {
        ...curDebt,
        remaining_debt: updatedRemaining,
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      await saveLocalDebts(localDebts);

      const localPays = await getLocalPayments();
      await saveLocalPayments([payObj, ...localPays]);
    }

    // Sinkronisasi ke Supabase jika tabel tersedia
    if (hasDebtTable !== false) {
      try {
        const storeId = await getStoreId();
        if (storeId) {
          await supabase.from("debt_payments").insert({
            store_id: storeId,
            debt_id: debtId,
            payment_amount: amount,
            payment_method,
            notes: notes.trim(),
          });

          await supabase
            .from("customer_debts")
            .update({
              remaining_debt: updatedRemaining,
              status: newStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", debtId);
        }
      } catch (err) {
        console.warn("Sync pembayaran kasbon ke server gagal:", err);
      }
    }

    return { success: true, remaining: updatedRemaining, status: newStatus };
  }

  /**
   * Menghitung ringkasan piutang toko:
   * - Total nominal hutang belum lunas
   * - Jumlah pelanggan yang berhutang
   */
  async getDebtSummary() {
    try {
      const activeDebts = await this.getDebts("unpaid");
      const totalAmount = activeDebts.reduce(
        (sum, d) => sum + (Number(d.remaining_debt) || 0),
        0,
      );
      // Hitung pelanggan unik berdasarkan nama pelanggan
      const uniqueCustomers = new Set(
        activeDebts.map((d) => (d.customer_name || "").trim().toLowerCase()),
      );

      return {
        totalUnpaidDebt: totalAmount,
        unpaidCustomerCount: uniqueCustomers.size,
        totalRecords: activeDebts.length,
      };
    } catch {
      return { totalUnpaidDebt: 0, unpaidCustomerCount: 0, totalRecords: 0 };
    }
  }
}

export default new DebtRepository();
