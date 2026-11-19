import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabaseClient";
import {
  getActiveStoreId,
  getDebtsCacheKey,
  getDebtPaymentsCacheKey,
  readScopedJsonArrayWithMigration,
} from "../services/sessionStore";

const LEGACY_DEBTS_KEY = "@TokoKelontong:CustomerDebts";
const LEGACY_PAYMENTS_KEY = "@TokoKelontong:DebtPayments";

let hasDebtTable = null;
let debtSyncPromise = null;

function isOfflineDebtId(id) {
  return String(id || "").startsWith("debt_");
}

function isValidUuid(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(id || "").trim(),
  );
}

function isNetworkOrOfflineError(err) {
  if (!err) return false;
  const msg = String(err.message || err || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("offline")
  );
}

function isMissingTableError(err) {
  if (!err) return false;
  const msg = String(err.message || err.details || "").toLowerCase();
  return (
    err.code === "42P01" ||
    msg.includes("does not exist") ||
    (msg.includes("customer_debts") && msg.includes("schema cache"))
  );
}

async function resolveActiveStoreId() {
  try {
    const active = await getActiveStoreId();
    if (active) return active;
  } catch {
    // lanjut ke rpc cadangan bila snapshot belum siap
  }
  try {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session?.user) return null;
    const { data } = await supabase.rpc("current_store_id");
    return data || null;
  } catch {
    return null;
  }
}

async function getLocalDebts(storeId) {
  if (!storeId) return [];
  const key = getDebtsCacheKey(storeId);
  return readScopedJsonArrayWithMigration(
    key,
    LEGACY_DEBTS_KEY,
    (d) => d && (!d.store_id || d.store_id === storeId),
  );
}

async function saveLocalDebts(storeId, debts) {
  const key = getDebtsCacheKey(storeId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(debts || []));
  } catch (err) {
    console.warn("Gagal simpan kasbon lokal:", err);
  }
}

async function getLocalPayments(storeId) {
  if (!storeId) return [];
  const key = getDebtPaymentsCacheKey(storeId);
  return readScopedJsonArrayWithMigration(
    key,
    LEGACY_PAYMENTS_KEY,
    (p) => p && (!p.store_id || p.store_id === storeId),
  );
}

async function saveLocalPayments(storeId, payments) {
  const key = getDebtPaymentsCacheKey(storeId);
  if (!key) return;
  try {
    await AsyncStorage.setItem(key, JSON.stringify(payments || []));
  } catch (err) {
    console.warn("Gagal simpan pembayaran kasbon lokal:", err);
  }
}

function applyDebtFilter(list, filter) {
  const sorted = [...(list || [])].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0),
  );
  if (filter === "unpaid") {
    return sorted.filter((d) => d.status !== "paid");
  }
  if (filter === "paid") {
    return sorted.filter((d) => d.status === "paid");
  }
  return sorted;
}

class DebtRepository {
  /**
   * Mengunggah catatan kasbon manual & cicilan offline yang belum tersinkron ke server.
   */
  async syncPendingDebts(targetStoreId = null) {
    if (debtSyncPromise) return debtSyncPromise;
    debtSyncPromise = this._runSyncPendingDebts(targetStoreId).finally(() => {
      debtSyncPromise = null;
    });
    return debtSyncPromise;
  }

  async _runSyncPendingDebts(targetStoreId = null) {
    const emptyRes = { syncedDebts: 0, syncedPayments: 0, remappedIds: {} };
    if (hasDebtTable === false) return emptyRes;

    const storeId = targetStoreId || (await resolveActiveStoreId());
    if (!storeId) return emptyRes;

    let localDebts = await getLocalDebts(storeId);
    let localPays = await getLocalPayments(storeId);
    const hasPendingDebt = localDebts.some(
      (d) => isOfflineDebtId(d?.id) || d?.pending_sync,
    );
    const hasPendingPay = localPays.some((p) => p?.pending_sync);
    if (!hasPendingDebt && !hasPendingPay) return emptyRes;

    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session?.user) return emptyRes;
    } catch {
      return emptyRes;
    }

    let syncedDebts = 0;
    let syncedPayments = 0;
    const remappedIds = {};

    // 1. Unggah catatan kasbon yang masih lokal (urut paling lama lebih dulu)
    const pendingDebts = localDebts
      .filter((d) => isOfflineDebtId(d?.id) || d?.pending_sync)
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    for (const d of pendingDebts) {
      const oldId = d.id;
      const safeTxId = isValidUuid(d.transaction_id) ? d.transaction_id : null;
      try {
        const { data, error } = await supabase
          .from("customer_debts")
          .insert({
            store_id: storeId,
            customer_name: d.customer_name,
            customer_phone: d.customer_phone || "",
            transaction_id: safeTxId,
            invoice_number: d.invoice_number || "",
            total_debt: Number(d.total_debt || 0),
            remaining_debt: Number(d.remaining_debt || 0),
            due_date: d.due_date || null,
            notes: d.notes || "",
            status: d.status || "unpaid",
          })
          .select()
          .single();

        if (error) {
          if (isMissingTableError(error)) {
            hasDebtTable = false;
          }
          break;
        }
        if (data?.id) {
          hasDebtTable = true;
          remappedIds[oldId] = data.id;
          syncedDebts += 1;

          localDebts = localDebts.map((item) =>
            item.id === oldId
              ? {
                  ...item,
                  id: data.id,
                  pending_sync: false,
                  created_at: data.created_at || item.created_at,
                  updated_at: data.updated_at || item.updated_at,
                }
              : item,
          );
          localPays = localPays.map((p) =>
            p.debt_id === oldId ? { ...p, debt_id: data.id } : p,
          );
          await saveLocalDebts(storeId, localDebts);
          await saveLocalPayments(storeId, localPays);
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          hasDebtTable = false;
        }
        break;
      }
    }

    // 2. Unggah riwayat DP & cicilan offline ke parent kasbon yang sudah punya UUID server
    const pendingPayments = localPays
      .filter((p) => p?.pending_sync && !isOfflineDebtId(p?.debt_id))
      .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));

    for (const p of pendingPayments) {
      try {
        const { error: payErr } = await supabase.from("debt_payments").insert({
          store_id: storeId,
          debt_id: p.debt_id,
          payment_amount: Number(p.payment_amount || 0),
          payment_method: p.payment_method || "cash",
          notes: p.notes || "",
        });

        if (payErr) {
          if (isMissingTableError(payErr)) {
            hasDebtTable = false;
          }
          break;
        }

        if (!p.applied_in_debt_insert) {
          const { data: srvDebt } = await supabase
            .from("customer_debts")
            .select("remaining_debt")
            .eq("id", p.debt_id)
            .maybeSingle();

          if (srvDebt) {
            const nextRemaining = Math.max(
              0,
              Number(srvDebt.remaining_debt || 0) - Number(p.payment_amount || 0),
            );
            const nextStatus = nextRemaining === 0 ? "paid" : "partially_paid";
            await supabase
              .from("customer_debts")
              .update({
                remaining_debt: nextRemaining,
                status: nextStatus,
                updated_at: new Date().toISOString(),
              })
              .eq("id", p.debt_id);

            localDebts = localDebts.map((item) =>
              item.id === p.debt_id
                ? { ...item, remaining_debt: nextRemaining, status: nextStatus }
                : item,
            );
            await saveLocalDebts(storeId, localDebts);
          }
        }

        syncedPayments += 1;
        localPays = localPays.map((item) =>
          item.id === p.id ? { ...item, pending_sync: false } : item,
        );
        await saveLocalPayments(storeId, localPays);
      } catch (err) {
        if (isMissingTableError(err)) {
          hasDebtTable = false;
        }
        break;
      }
    }

    return { syncedDebts, syncedPayments, remappedIds };
  }

  /**
   * Mengambil semua daftar kasbon / hutang pelanggan.
   * Mendukung filter: 'all', 'unpaid' (termasuk partially_paid), 'paid'
   */
  async getDebts(filter = "all") {
    const storeId = await resolveActiveStoreId();

    if (hasDebtTable !== false) {
      if (storeId) {
        await this.syncPendingDebts(storeId).catch(() => {});
      }
      try {
        let query = supabase
          .from("customer_debts")
          .select("*, debt_payments(*)")
          .order("created_at", { ascending: false });

        if (storeId) {
          query = query.eq("store_id", storeId);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          hasDebtTable = true;
          if (storeId) {
            const serverPayments = data.flatMap((d) =>
              Array.isArray(d.debt_payments) ? d.debt_payments : [],
            );
            const existingLocal = await getLocalDebts(storeId);
            const existingPays = await getLocalPayments(storeId);
            const unsyncedPays = existingPays.filter((p) => p?.pending_sync);

            const serverIds = new Set(data.map((d) => d.id));
            const pendingOffline = existingLocal.filter(
              (d) =>
                (isOfflineDebtId(d?.id) || d?.pending_sync) &&
                !serverIds.has(d.id),
            );

            const mergedPaymentsMap = new Map();
            for (const p of serverPayments) {
              if (p?.id) mergedPaymentsMap.set(p.id, p);
            }
            for (const p of unsyncedPays) {
              if (p?.id) mergedPaymentsMap.set(p.id, p);
            }
            const mergedPayments = Array.from(mergedPaymentsMap.values());

            const serverRowsWithLocalPending = data.map((row) => {
              const extraPays = unsyncedPays.filter(
                (p) => p.debt_id === row.id,
              );
              const unappliedSum = extraPays
                .filter((p) => !p.applied_in_debt_insert)
                .reduce((sum, p) => sum + Number(p.payment_amount || 0), 0);
              const adjustedRem = Math.max(
                0,
                Number(row.remaining_debt || 0) - unappliedSum,
              );
              const adjustedStatus =
                unappliedSum > 0
                  ? adjustedRem === 0
                    ? "paid"
                    : "partially_paid"
                  : row.status;
              return {
                ...row,
                remaining_debt: adjustedRem,
                status: adjustedStatus,
                debt_payments: [
                  ...extraPays,
                  ...(Array.isArray(row.debt_payments) ? row.debt_payments : []),
                ],
              };
            });

            const cachedDebts = [
              ...pendingOffline,
              ...serverRowsWithLocalPending.map(({ debt_payments, ...rest }) => rest),
            ];
            await saveLocalDebts(storeId, cachedDebts);
            await saveLocalPayments(storeId, mergedPayments);
            return applyDebtFilter(
              [
                ...pendingOffline.map((d) => ({
                  ...d,
                  debt_payments: mergedPayments.filter((p) => p.debt_id === d.id),
                })),
                ...serverRowsWithLocalPending,
              ],
              filter,
            );
          }
          return applyDebtFilter(data, filter);
        }
        if (error && isMissingTableError(error)) {
          hasDebtTable = false;
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          hasDebtTable = false;
        }
        // Error jaringan/timeout tidak boleh mengunci hasDebtTable = false selamanya
      }
    }

    // Fallback offline / local terisolasi per store_id
    const local = await getLocalDebts(storeId);
    const payments = await getLocalPayments(storeId);
    const merged = local.map((d) => ({
      ...d,
      debt_payments: payments.filter((p) => p.debt_id === d.id),
    }));
    return applyDebtFilter(merged, filter);
  }

  /**
   * Mendapatkan detail satu catatan kasbon beserta riwayat cicilan
   */
  async getDebtById(debtId) {
    const storeId = await resolveActiveStoreId();
    if (hasDebtTable !== false && !isOfflineDebtId(debtId)) {
      try {
        const { data, error } = await supabase
          .from("customer_debts")
          .select("*, debt_payments(*)")
          .eq("id", debtId)
          .maybeSingle();
        if (!error && data) return data;
        if (error && isMissingTableError(error)) {
          hasDebtTable = false;
        }
      } catch {
        // fallback ke lokal
      }
    }

    const local = await getLocalDebts(storeId);
    const found = local.find((d) => d.id === debtId);
    if (!found) return null;
    const payments = await getLocalPayments(storeId);
    return {
      ...found,
      debt_payments: payments.filter((p) => p.debt_id === debtId),
    };
  }

  /**
   * Mencatat kasbon baru saat checkout transaksi atau manual.
   * Mendukung `initial_dp` untuk DP di kasir tanpa pemotongan ganda.
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
    initial_dp = 0,
    dp_method = "cash",
  }) {
    const storeId = await resolveActiveStoreId();
    const numericTotal = Math.max(0, Number(total_debt) || 0);
    const dpAmount = Math.max(0, Number(initial_dp) || 0);
    const computedRemaining =
      dpAmount > 0
        ? Math.max(0, numericTotal - dpAmount)
        : Math.max(0, Number(remaining_debt) || 0);
    const derivedStatus =
      computedRemaining <= 0
        ? "paid"
        : dpAmount > 0 || computedRemaining < numericTotal
          ? "partially_paid"
          : "unpaid";

    const nowIso = new Date().toISOString();
    const debtObj = {
      id: "debt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      store_id: storeId,
      customer_name: String(customer_name || "").trim(),
      customer_phone: String(customer_phone || "").trim(),
      transaction_id,
      invoice_number: String(invoice_number || "").trim(),
      total_debt: numericTotal,
      remaining_debt: computedRemaining,
      due_date: due_date || null,
      notes: String(notes || "").trim(),
      status: derivedStatus,
      pending_sync: true,
      created_at: nowIso,
      updated_at: nowIso,
    };

    let debtSynced = false;
    let dpSynced = false;

    if (hasDebtTable !== false && storeId) {
      try {
        const { data, error } = await supabase
          .from("customer_debts")
          .insert({
            store_id: storeId,
            customer_name: debtObj.customer_name,
            customer_phone: debtObj.customer_phone,
            transaction_id: isValidUuid(debtObj.transaction_id)
              ? debtObj.transaction_id
              : null,
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
          debtSynced = true;
          debtObj.id = data.id;
          debtObj.pending_sync = false;
          debtObj.created_at = data.created_at || debtObj.created_at;
          debtObj.updated_at = data.updated_at || debtObj.updated_at;

          if (dpAmount > 0) {
            const { error: dpErr } = await supabase.from("debt_payments").insert({
              store_id: storeId,
              debt_id: debtObj.id,
              payment_amount: dpAmount,
              payment_method: dp_method || "cash",
              notes: "DP / Uang Muka di Kasir",
            });
            if (!dpErr) {
              dpSynced = true;
            } else {
              console.warn("Catat riwayat DP kasbon ke server gagal:", dpErr.message);
            }
          }
        } else if (error) {
          if (isMissingTableError(error)) {
            hasDebtTable = false;
          } else {
            throw error;
          }
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          hasDebtTable = false;
        } else {
          console.warn("Simpan hutang ke server gagal:", err?.message || err);
        }
      }
    }

    if (storeId) {
      const local = await getLocalDebts(storeId);
      await saveLocalDebts(storeId, [debtObj, ...local]);

      if (dpAmount > 0) {
        const localPays = await getLocalPayments(storeId);
        const dpObj = {
          id: "pay_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
          store_id: storeId,
          debt_id: debtObj.id,
          payment_amount: dpAmount,
          payment_method: dp_method || "cash",
          notes: "DP / Uang Muka di Kasir",
          pending_sync: !dpSynced,
          applied_in_debt_insert: !debtSynced,
          created_at: nowIso,
        };
        await saveLocalPayments(storeId, [dpObj, ...localPays]);
      }
    }

    return debtObj;
  }

  /**
   * Mencatat cicilan atau pelunasan kasbon tanpa pernah menimpa sisa hutang
   * secara membabi buta dengan angka 0 saat cache lokal perangkat kosong.
   */
  async recordPayment(
    debtId,
    { payment_amount, payment_method = "cash", notes = "" },
  ) {
    const amount = Number(payment_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Nominal pembayaran harus lebih dari Rp0.");
    }

    const storeId = await resolveActiveStoreId();
    let effectiveDebtId = debtId;
    if (isOfflineDebtId(effectiveDebtId) && storeId && hasDebtTable !== false) {
      const syncRes = await this.syncPendingDebts(storeId).catch(() => null);
      if (syncRes?.remappedIds?.[effectiveDebtId]) {
        effectiveDebtId = syncRes.remappedIds[effectiveDebtId];
      }
    }

    const localDebts = await getLocalDebts(storeId);
    const idx = localDebts.findIndex((d) => d.id === effectiveDebtId);
    let currentDebt = idx !== -1 ? localDebts[idx] : null;
    const isLocalOnlyDebt = isOfflineDebtId(effectiveDebtId);

    if (!isLocalOnlyDebt && hasDebtTable !== false) {
      try {
        const { data: serverDebt, error: fetchErr } = await supabase
          .from("customer_debts")
          .select("id, store_id, customer_name, remaining_debt, total_debt, status")
          .eq("id", effectiveDebtId)
          .maybeSingle();

        if (fetchErr) {
          if (isMissingTableError(fetchErr)) {
            hasDebtTable = false;
          } else if (!currentDebt || !isNetworkOrOfflineError(fetchErr)) {
            throw new Error(
              "Gagal memeriksa sisa hutang di server: " + fetchErr.message,
            );
          }
        } else if (serverDebt) {
          currentDebt = serverDebt;
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          hasDebtTable = false;
        } else if (!currentDebt || !isNetworkOrOfflineError(err)) {
          throw err;
        }
      }
    }

    if (!currentDebt) {
      throw new Error(
        "Catatan kasbon tidak ditemukan di perangkat ini. Muat ulang data kasbon saat online.",
      );
    }

    const currentRemaining = Math.max(0, Number(currentDebt.remaining_debt ?? 0));
    if (amount > currentRemaining) {
      throw new Error("Nominal pembayaran melebihi sisa tagihan saat ini.");
    }

    const updatedRemaining = Math.max(0, currentRemaining - amount);
    const newStatus = updatedRemaining === 0 ? "paid" : "partially_paid";
    const nowIso = new Date().toISOString();

    const payObj = {
      id: "pay_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      store_id: storeId,
      debt_id: effectiveDebtId,
      payment_amount: amount,
      payment_method,
      notes: String(notes || "").trim(),
      pending_sync: true,
      applied_in_debt_insert: isLocalOnlyDebt,
      created_at: nowIso,
    };

    let syncedToServer = false;

    if (!isLocalOnlyDebt && hasDebtTable !== false && storeId) {
      try {
        const { error: payErr } = await supabase.from("debt_payments").insert({
          store_id: storeId,
          debt_id: effectiveDebtId,
          payment_amount: amount,
          payment_method,
          notes: payObj.notes,
        });

        if (payErr) {
          if (isMissingTableError(payErr)) {
            hasDebtTable = false;
          } else if (!isNetworkOrOfflineError(payErr)) {
            throw new Error("Gagal mencatat cicilan ke server: " + payErr.message);
          }
        }

        if (hasDebtTable !== false && !payErr) {
          const { error: updErr } = await supabase
            .from("customer_debts")
            .update({
              remaining_debt: updatedRemaining,
              status: newStatus,
              updated_at: nowIso,
            })
            .eq("id", effectiveDebtId);

          if (updErr) {
            if (!isNetworkOrOfflineError(updErr)) {
              throw new Error(
                "Gagal memperbarui sisa hutang di server: " + updErr.message,
              );
            }
          } else {
            syncedToServer = true;
            payObj.pending_sync = false;
          }
        }
      } catch (err) {
        if (isMissingTableError(err)) {
          hasDebtTable = false;
        } else if (!isNetworkOrOfflineError(err)) {
          throw err;
        }
      }
    }

    if (storeId) {
      const updatedDebtRecord = {
        ...currentDebt,
        store_id: storeId,
        remaining_debt: updatedRemaining,
        status: newStatus,
        pending_sync: Boolean(currentDebt.pending_sync || isLocalOnlyDebt),
        updated_at: nowIso,
      };
      const nextDebts =
        idx !== -1
          ? localDebts.map((d, i) => (i === idx ? updatedDebtRecord : d))
          : [updatedDebtRecord, ...localDebts];
      await saveLocalDebts(storeId, nextDebts);

      const localPays = await getLocalPayments(storeId);
      await saveLocalPayments(storeId, [payObj, ...localPays]);
    }

    return {
      success: true,
      remaining: updatedRemaining,
      status: newStatus,
      offline: !syncedToServer,
    };
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
      const uniqueCustomers = new Set(
        activeDebts.map((d) => (d.customer_name || "").trim().toLowerCase()),
      );

      return {
        totalUnpaidDebt: totalAmount,
        customerCount: uniqueCustomers.size,
      };
    } catch {
      return { totalUnpaidDebt: 0, customerCount: 0 };
    }
  }
}

export default new DebtRepository();
