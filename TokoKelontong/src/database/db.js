import { Platform } from 'react-native';

let db;

if (Platform.OS === 'web') {
  // Mock sederhana untuk Web agar UI tidak crash
  db = {
    execSync: () => {},
    getAllSync: () => [],
    getFirstSync: () => null,
    runSync: () => ({ lastInsertRowId: Math.floor(Math.random() * 100), changes: 1 }),
  };
} else {
  const SQLite = require('expo-sqlite');
  db = SQLite.openDatabaseSync('toko_kelontong.db');
}

export const initDB = () => {
  if (Platform.OS === 'web') return;
  
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
    
    CREATE INDEX IF NOT EXISTS idx_barcode ON products(barcode);

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

    CREATE TABLE IF NOT EXISTS transaction_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      product_id INTEGER,
      quantity INTEGER NOT NULL,
      price_at_sale INTEGER NOT NULL,
      capital_at_sale INTEGER NOT NULL,
      FOREIGN KEY(transaction_id) REFERENCES transactions(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );
  `);
};

export default db;
