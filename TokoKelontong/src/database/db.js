import * as SQLite from 'expo-sqlite';

// Buka koneksi database (akan membuat file jika belum ada)
export const db = SQLite.openDatabaseSync('toko_kelontong.db');

export const initDatabase = () => {
  try {
    // Jalankan PRAGMA untuk foreign keys
    db.execSync(`PRAGMA foreign_keys = ON;`);

    // Tabel Products
    db.execSync(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE,
        product_name TEXT NOT NULL,
        capital_price INTEGER NOT NULL,
        selling_price INTEGER NOT NULL,
        stock_quantity INTEGER NOT NULL,
        min_stock_threshold INTEGER DEFAULT 5
      );
    `);

    // Buat index untuk pencarian barcode lebih cepat
    db.execSync(`CREATE INDEX IF NOT EXISTS idx_product_barcode ON products (barcode);`);

    // Tabel Transactions
    db.execSync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        invoice_number TEXT UNIQUE NOT NULL,
        total_price INTEGER NOT NULL,
        discount_amount INTEGER DEFAULT 0,
        grand_total INTEGER NOT NULL,
        cash_received INTEGER NOT NULL,
        cash_return INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Tabel Transaction Details
    db.execSync(`
      CREATE TABLE IF NOT EXISTS transaction_details (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_sale INTEGER NOT NULL,
        capital_at_sale INTEGER NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE RESTRICT
      );
    `);
    
    console.log('Database terinisialisasi dengan sukses!');
  } catch (error) {
    console.error('Error saat inisialisasi database:', error);
  }
};
