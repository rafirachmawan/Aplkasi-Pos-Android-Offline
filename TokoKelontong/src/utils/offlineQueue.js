import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_QUEUE_KEY = "@TokoKelontong:OfflineQueue";

/**
 * Format nomor nota offline darurat: OFF-YYYYMMDD-HHmmss
 */
export function generateOfflineInvoice() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.floor(100 + Math.random() * 900);
  return `OFF-${dateStr}-${timeStr}-${rand}`;
}

/**
 * Mengambil semua antrean transaksi offline yang belum tersinkron.
 */
export async function getOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Gagal membaca antrean offline:", err);
    return [];
  }
}

/**
 * Menghitung jumlah transaksi offline yang tertunda.
 */
export async function getOfflineQueueCount() {
  const queue = await getOfflineQueue();
  return queue.length;
}

/**
 * Menyimpan transaksi kasir ke antrean offline lokal.
 */
export async function enqueueOfflineTransaction(payload) {
  try {
    const queue = await getOfflineQueue();
    const offlineInvoice = generateOfflineInvoice();
    const queueItem = {
      id: `off_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      invoice_number: offlineInvoice,
      items: payload.items || [],
      total_price: payload.total_price || 0,
      discount_amount: payload.discount_amount || 0,
      grand_total: payload.grand_total || 0,
      cash_received: payload.cash_received || 0,
      cash_return: payload.cash_return || 0,
      payment_method: payload.payment_method || "cash",
      payment_notes: payload.payment_notes || "",
      order_type: payload.order_type || "retail",
      table_number: payload.table_number || "",
      created_at: new Date().toISOString(),
      is_offline: true,
    };

    queue.push(queueItem);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return queueItem;
  } catch (err) {
    console.error("Gagal enqueue offline transaction:", err);
    throw new Error("Gagal menyimpan transaksi ke antrean lokal.");
  }
}

/**
 * Menghapus transaksi yang sudah berhasil diunggah dari antrean.
 */
export async function removeOfflineTransaction(id) {
  try {
    const queue = await getOfflineQueue();
    const filtered = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Gagal menghapus antrean offline:", err);
  }
}

/**
 * Mengosongkan seluruh antrean offline (misal setelah sinkronisasi massal).
 */
export async function clearOfflineQueue() {
  try {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch (err) {
    console.warn("Gagal membersihkan antrean offline:", err);
  }
}

