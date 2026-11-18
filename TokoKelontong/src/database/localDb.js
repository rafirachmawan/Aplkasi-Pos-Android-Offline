import * as SQLite from "expo-sqlite";

// Database lokal offline-first (SQLite di HP).
// - products_cache      : salinan katalog produk per toko (untuk kasir offline)
// - outbox_transactions : transaksi yang dibuat di HP, menunggu dikirim ke server
// - outbox_items        : rincian barang per transaksi di outbox
// - invoice_seq         : penghitung nomor nota lokal per toko per hari
// - meta                : pengaturan kecil (kode perangkat, waktu sinkron, dll.)
//
// Semua tabel membawa store_id sehingga data satu toko tidak pernah
// terkirim atau tampil di toko lain.

const DB_NAME = "marketpos_offline.db";
const SCHEMA_VERSION = 1;
const SYNCED_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export const TX_STATUS = {
  PENDING: "pending",
  SYNCED: "synced",
  NEEDS_REVIEW: "needs_review",
};

let dbPromise = null;
let writeChain = Promise.resolve();

async function migrate(db) {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  const row = await db.getFirstAsync("PRAGMA user_version");
  const current = row?.user_version || 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS products_cache (
        store_id TEXT NOT NULL,
        id TEXT NOT NULL,
        barcode TEXT,
        product_name TEXT NOT NULL,
        stock_snapshot INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL,
        rev INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (store_id, id)
      );
      CREATE INDEX IF NOT EXISTS products_cache_barcode_idx
        ON products_cache (store_id, barcode);
      CREATE TABLE IF NOT EXISTS outbox_transactions (
        client_tx_id TEXT PRIMARY KEY NOT NULL,
        store_id TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        created_at TEXT NOT NULL,
        total_price INTEGER NOT NULL DEFAULT 0,
        discount_amount INTEGER NOT NULL DEFAULT 0,
        grand_total INTEGER NOT NULL DEFAULT 0,
        cash_received INTEGER NOT NULL DEFAULT 0,
        cash_return INTEGER NOT NULL DEFAULT 0,
        payment_method TEXT NOT NULL DEFAULT 'cash',
        payment_notes TEXT NOT NULL DEFAULT '',
        order_type TEXT NOT NULL DEFAULT 'retail',
        table_number TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        server_tx_id TEXT,
        server_invoice TEXT,
        synced_at INTEGER,
        source TEXT NOT NULL DEFAULT 'app'
      );
      CREATE INDEX IF NOT EXISTS outbox_status_idx
        ON outbox_transactions (store_id, status, created_at);
      CREATE TABLE IF NOT EXISTS outbox_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_tx_id TEXT NOT NULL,
        product_id TEXT,
        product_name TEXT NOT NULL DEFAULT '',
        quantity INTEGER NOT NULL,
        price_at_sale INTEGER NOT NULL DEFAULT 0,
        capital_at_sale INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS outbox_items_tx_idx
        ON outbox_items (client_tx_id);
      CREATE TABLE IF NOT EXISTS invoice_seq (
        store_id TEXT NOT NULL,
        date_key TEXT NOT NULL,
        last_seq INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (store_id, date_key)
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })().catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

// Semua penulisan berjalan satu per satu agar transaksi SQLite tidak
// saling menyela (satu koneksi, banyak pemanggil async).
function writeTx(task) {
  const run = writeChain.then(async () => {
    const db = await getDb();
    let result;
    await db.withTransactionAsync(async () => {
      result = await task(db);
    });
    return result;
  });
  writeChain = run.catch(() => {});
  return run;
}

async function getMetaWith(db, key) {
  const row = await db.getFirstAsync(
    "SELECT value FROM meta WHERE key = ?",
    key,
  );
  return row ? row.value : null;
}

async function setMetaWith(db, key, value) {
  await db.runAsync(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value == null ? null : String(value),
  );
}

export async function getMeta(key) {
  const db = await getDb();
  return getMetaWith(db, key);
}

export function setMeta(key, value) {
  return writeTx((db) => setMetaWith(db, key, value));
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

async function getDeviceCodeWith(db) {
  let code = await getMetaWith(db, "device_code");
  if (!code) {
    code = "";
    for (let i = 0; i < 2; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    await setMetaWith(db, "device_code", code);
  }
  return code;
}

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function newClientTxId() {
  const rand = Math.random().toString(36).substring(2, 10);
  return `off_${Date.now().toString(36)}_${rand}`;
}

// ───────────────────────── Katalog produk ─────────────────────────

// Menyegarkan cache produk dari respons server. Mengembalikan false bila
// penyegaran DILEWATI (respons kosong padahal cache berisi) agar tidak ada
// baris yang ditulis/dihapus sama sekali.
export function replaceCatalog(storeId, products) {
  return writeTx(async (db) => {
    // Saring hanya produk yang valid dan benar-benar milik toko ini
    const list = (products || []).filter(
      (p) => p && p.id && (!p.store_id || p.store_id === storeId),
    );

    // Penjaga: server boleh sukses tapi mengembalikan daftar kosong
    // (RLS/auth bermasalah, dsb). Cache lokal jangan pernah dihapus karenanya —
    // kasir offline bergantung pada cache ini. `catalog_synced_at` sengaja tidak
    // diperbarui supaya siklus berikutnya mencoba menyegarkan lagi.
    if (list.length === 0) {
      const cached = await db.getFirstAsync(
        "SELECT COUNT(*) AS n FROM products_cache WHERE store_id = ?",
        storeId,
      );
      if ((cached?.n || 0) > 0) return false;
    }

    const rev = Date.now();
    for (const p of list) {
      await db.runAsync(
        `INSERT INTO products_cache (store_id, id, barcode, product_name, stock_snapshot, data, rev)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(store_id, id) DO UPDATE SET
           barcode = excluded.barcode,
           product_name = excluded.product_name,
           stock_snapshot = excluded.stock_snapshot,
           data = excluded.data,
           rev = excluded.rev`,
        storeId,
        String(p.id),
        p.barcode || null,
        p.product_name || "",
        Number(p.stock_quantity) || 0,
        JSON.stringify(p),
        rev,
      );
    }
    await db.runAsync(
      "DELETE FROM products_cache WHERE store_id = ? AND rev <> ?",
      storeId,
      rev,
    );
    await setMetaWith(db, `catalog_synced_at:${storeId}`, rev);
    return true;
  });
}

async function getPendingQtyMap(db, storeId) {
  const rows = await db.getAllAsync(
    `SELECT i.product_id AS product_id, SUM(i.quantity) AS qty
     FROM outbox_items i
     JOIN outbox_transactions t ON t.client_tx_id = i.client_tx_id
     WHERE t.store_id = ? AND t.status IN ('pending', 'needs_review')
       AND i.product_id IS NOT NULL
     GROUP BY i.product_id`,
    storeId,
  );
  const map = {};
  for (const r of rows) map[r.product_id] = r.qty || 0;
  return map;
}

/**
 * Mengurangi stok produk server dengan transaksi outbox lokal yang belum
 * tersinkron (pending / needs_review) agar stok di Gudang selaras dengan Kasir.
 */
export async function applyPendingStockDeductions(storeId, products) {
  if (!storeId || !Array.isArray(products) || products.length === 0) {
    return products || [];
  }
  try {
    const db = await getDb();
    const pendingMap = await getPendingQtyMap(db, storeId);
    if (Object.keys(pendingMap).length === 0) return products;
    return products.map((p) => {
      if (!p || Number(p.min_stock_threshold) < 0) return p;
      const pendingQty = pendingMap[p.id] || 0;
      if (!pendingQty) return p;
      return {
        ...p,
        stock_quantity: (Number(p.stock_quantity) || 0) - pendingQty,
      };
    });
  } catch {
    return products;
  }
}

function rowToProduct(row, pendingMap) {
  let p;
  try {
    p = JSON.parse(row.data);
  } catch {
    p = { id: row.id, product_name: row.product_name, barcode: row.barcode };
  }
  if (Number(p.min_stock_threshold) < 0) {
    return {
      ...p,
      stock_quantity: 999999,
    };
  }
  // Stok efektif = stok server terakhir - penjualan yang belum terkirim
  return {
    ...p,
    stock_quantity: (row.stock_snapshot || 0) - (pendingMap[row.id] || 0),
  };
}

export async function getCatalog(storeId) {
  const db = await getDb();
  const pendingMap = await getPendingQtyMap(db, storeId);
  const rows = await db.getAllAsync(
    "SELECT id, barcode, product_name, stock_snapshot, data FROM products_cache WHERE store_id = ? ORDER BY product_name COLLATE NOCASE ASC",
    storeId,
  );
  const result = [];
  const invalidIds = [];
  for (const r of rows) {
    const prod = rowToProduct(r, pendingMap);
    if (prod.store_id && prod.store_id !== storeId) {
      invalidIds.push(r.id);
    } else {
      result.push(prod);
    }
  }

  // Bersihkan produk toko lain yang sempat tersimpan secara otomatis
  if (invalidIds.length > 0) {
    writeTx(async (txDb) => {
      for (const badId of invalidIds) {
        await txDb.runAsync(
          "DELETE FROM products_cache WHERE store_id = ? AND id = ?",
          storeId,
          badId,
        );
      }
    }).catch(() => {});
  }

  return result;
}

export async function getCatalogProductByBarcode(storeId, barcode) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT id, barcode, product_name, stock_snapshot, data FROM products_cache WHERE store_id = ? AND barcode = ?",
    storeId,
    barcode,
  );
  if (!row) return null;
  const pendingMap = await getPendingQtyMap(db, storeId);
  const prod = rowToProduct(row, pendingMap);
  if (prod.store_id && prod.store_id !== storeId) return null;
  return prod;
}

export async function getCatalogCount(storeId) {
  const catalog = await getCatalog(storeId);
  return catalog.length;
}

export async function getCatalogSyncedAt(storeId) {
  const v = await getMeta(`catalog_synced_at:${storeId}`);
  return v ? Number(v) : 0;
}

// ───────────────────────── Outbox transaksi ─────────────────────────

export function enqueueTransaction(storeId, tx) {
  return writeTx(async (db) => {
    const now = new Date();
    const dateKey = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    await db.runAsync(
      `INSERT INTO invoice_seq (store_id, date_key, last_seq) VALUES (?, ?, 1)
       ON CONFLICT(store_id, date_key) DO UPDATE SET last_seq = last_seq + 1`,
      storeId,
      dateKey,
    );
    const seqRow = await db.getFirstAsync(
      "SELECT last_seq FROM invoice_seq WHERE store_id = ? AND date_key = ?",
      storeId,
      dateKey,
    );
    const device = await getDeviceCodeWith(db);
    const invoice = `INV/${dateKey}/${device}-${pad(seqRow.last_seq, 4)}`;
    const clientTxId = newClientTxId();
    const createdAt = now.toISOString();

    await db.runAsync(
      `INSERT INTO outbox_transactions (
         client_tx_id, store_id, invoice_number, created_at,
         total_price, discount_amount, grand_total, cash_received, cash_return,
         payment_method, payment_notes, order_type, table_number, status, source
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'app')`,
      clientTxId,
      storeId,
      invoice,
      createdAt,
      tx.total_price || 0,
      tx.discount_amount || 0,
      tx.grand_total || 0,
      tx.cash_received || 0,
      tx.cash_return || 0,
      tx.payment_method || "cash",
      tx.payment_notes || "",
      tx.order_type || "retail",
      tx.table_number || "",
    );

    for (const it of tx.items || []) {
      await db.runAsync(
        `INSERT INTO outbox_items (client_tx_id, product_id, product_name, quantity, price_at_sale, capital_at_sale)
         VALUES (?, ?, ?, ?, ?, ?)`,
        clientTxId,
        it.product_id ? String(it.product_id) : null,
        it.product_name || "",
        Number(it.quantity) || 0,
        Number(it.selling_price ?? it.price_at_sale) || 0,
        Number(it.capital_price ?? it.capital_at_sale) || 0,
      );
    }

    return {
      client_tx_id: clientTxId,
      invoice_number: invoice,
      created_at: createdAt,
    };
  });
}

// Memasukkan antrean lama (AsyncStorage) ke outbox. Aman dipanggil berulang:
// INSERT OR IGNORE berdasarkan id lama sebagai client_tx_id.
export function importLegacyQueue(storeId, queue) {
  return writeTx(async (db) => {
    let imported = 0;
    for (const q of queue || []) {
      if (!q || !q.id) continue;
      const res = await db.runAsync(
        `INSERT OR IGNORE INTO outbox_transactions (
           client_tx_id, store_id, invoice_number, created_at,
           total_price, discount_amount, grand_total, cash_received, cash_return,
           payment_method, payment_notes, order_type, table_number, status, source
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'legacy')`,
        String(q.id),
        storeId,
        q.invoice_number || String(q.id),
        q.created_at || new Date().toISOString(),
        q.total_price || 0,
        q.discount_amount || 0,
        q.grand_total || 0,
        q.cash_received || 0,
        q.cash_return || 0,
        q.payment_method || "cash",
        q.payment_notes || "",
        q.order_type || "retail",
        q.table_number || "",
      );
      if (res.changes > 0) {
        imported++;
        for (const it of q.items || []) {
          await db.runAsync(
            `INSERT INTO outbox_items (client_tx_id, product_id, product_name, quantity, price_at_sale, capital_at_sale)
             VALUES (?, ?, ?, ?, ?, ?)`,
            String(q.id),
            it.product_id ? String(it.product_id) : null,
            it.product_name || "",
            Number(it.quantity) || 0,
            Number(it.selling_price ?? it.price_at_sale) || 0,
            Number(it.capital_price ?? it.capital_at_sale) || 0,
          );
        }
      }
    }
    return imported;
  });
}

export async function getOutboxTransaction(clientTxId) {
  const db = await getDb();
  return db.getFirstAsync(
    "SELECT * FROM outbox_transactions WHERE client_tx_id = ?",
    clientTxId,
  );
}

export async function getOutboxItems(clientTxId) {
  const db = await getDb();
  return db.getAllAsync(
    "SELECT product_id, product_name, quantity, price_at_sale, capital_at_sale FROM outbox_items WHERE client_tx_id = ? ORDER BY id ASC",
    clientTxId,
  );
}

export async function listDueTransactions(storeId, nowMs) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM outbox_transactions
     WHERE store_id = ? AND status = 'pending' AND next_retry_at <= ?
     ORDER BY created_at ASC, rowid ASC`,
    storeId,
    nowMs,
  );
}

export async function listOutbox(storeId, statuses) {
  const db = await getDb();
  const list = statuses && statuses.length ? statuses : ["pending", "needs_review"];
  const marks = list.map(() => "?").join(",");
  return db.getAllAsync(
    `SELECT * FROM outbox_transactions
     WHERE store_id = ? AND status IN (${marks})
     ORDER BY created_at ASC, rowid ASC`,
    storeId,
    ...list,
  );
}

export async function getOutboxCounts(storeId) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    "SELECT status, COUNT(*) AS n FROM outbox_transactions WHERE store_id = ? GROUP BY status",
    storeId,
  );
  const counts = { pending: 0, needsReview: 0, synced: 0 };
  for (const r of rows) {
    if (r.status === TX_STATUS.PENDING) counts.pending = r.n;
    else if (r.status === TX_STATUS.NEEDS_REVIEW) counts.needsReview = r.n;
    else if (r.status === TX_STATUS.SYNCED) counts.synced = r.n;
  }
  return counts;
}

// Total semua toko, dipakai untuk peringatan saat logout.
export async function getUnsyncedCountAll() {
  const db = await getDb();
  const row = await db.getFirstAsync(
    "SELECT COUNT(*) AS n FROM outbox_transactions WHERE status IN ('pending', 'needs_review')",
  );
  return row?.n || 0;
}

export function markSynced(clientTxId, serverTxId, serverInvoice) {
  return writeTx(async (db) => {
    const tx = await db.getFirstAsync(
      "SELECT store_id, status FROM outbox_transactions WHERE client_tx_id = ?",
      clientTxId,
    );
    if (!tx || tx.status === TX_STATUS.SYNCED) return;
    await db.runAsync(
      `UPDATE outbox_transactions
       SET status = 'synced', synced_at = ?, server_tx_id = ?, server_invoice = ?,
           last_error = NULL
       WHERE client_tx_id = ?`,
      Date.now(),
      serverTxId ? String(serverTxId) : null,
      serverInvoice || null,
      clientTxId,
    );
    // Server sudah mengurangi stok: samakan snapshot lokal supaya stok
    // yang tampil tidak melompat sebelum katalog di-refresh.
    const items = await db.getAllAsync(
      "SELECT product_id, quantity FROM outbox_items WHERE client_tx_id = ? AND product_id IS NOT NULL",
      clientTxId,
    );
    for (const it of items) {
      await db.runAsync(
        "UPDATE products_cache SET stock_snapshot = stock_snapshot - ? WHERE store_id = ? AND id = ?",
        it.quantity,
        tx.store_id,
        it.product_id,
      );
    }
  });
}

export function markRetry(clientTxId, errorMessage, nextRetryAt) {
  return writeTx(async (db) => {
    await db.runAsync(
      `UPDATE outbox_transactions
       SET attempts = attempts + 1, next_retry_at = ?, last_error = ?
       WHERE client_tx_id = ? AND status = 'pending'`,
      nextRetryAt,
      String(errorMessage || "").slice(0, 300),
      clientTxId,
    );
  });
}

export function markNeedsReview(clientTxId, errorMessage) {
  return writeTx(async (db) => {
    await db.runAsync(
      `UPDATE outbox_transactions
       SET status = 'needs_review', attempts = attempts + 1, last_error = ?
       WHERE client_tx_id = ? AND status = 'pending'`,
      String(errorMessage || "").slice(0, 300),
      clientTxId,
    );
  });
}

// Coba kirim lagi transaksi yang butuh ditinjau (tidak pernah menghapus data).
export function resetForRetry(storeId) {
  return writeTx(async (db) => {
    await db.runAsync(
      `UPDATE outbox_transactions
       SET status = 'pending', next_retry_at = 0
       WHERE store_id = ? AND status = 'needs_review'`,
      storeId,
    );
    await db.runAsync(
      "UPDATE outbox_transactions SET next_retry_at = 0 WHERE store_id = ? AND status = 'pending'",
      storeId,
    );
  });
}

export function pruneSynced() {
  return writeTx(async (db) => {
    const cutoff = Date.now() - SYNCED_RETENTION_MS;
    await db.runAsync(
      `DELETE FROM outbox_items WHERE client_tx_id IN (
         SELECT client_tx_id FROM outbox_transactions
         WHERE status = 'synced' AND synced_at < ?)`,
      cutoff,
    );
    await db.runAsync(
      "DELETE FROM outbox_transactions WHERE status = 'synced' AND synced_at < ?",
      cutoff,
    );
  });
}
