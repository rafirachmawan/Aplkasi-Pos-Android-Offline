import db from './db';
import { generateInvoiceNumber } from '../utils/helpers';

class TransactionRepository {
  /**
   * Membuat transaksi baru secara atomik (menggunakan SQLite transaction)
   * Menyimpan ke tabel `transactions` dan `transaction_details`, serta memotong `stock_quantity` di tabel `products`.
   */
  createTransaction(items, total_price, discount_amount, grand_total, cash_received, cash_return) {
    let transactionId = null;
    
    // expo-sqlite with runSync inside a transaction block
    // We can simulate transaction logic using BEGIN and COMMIT if needed, but modern expo-sqlite provides explicit transactions if available.
    // Assuming simple BEGIN / COMMIT.
    try {
      db.execSync('BEGIN TRANSACTION;');

      const invoice_number = generateInvoiceNumber();
      
      // 1. Insert ke transactions
      const txResult = db.runSync(
        `INSERT INTO transactions (invoice_number, total_price, discount_amount, grand_total, cash_received, cash_return)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [invoice_number, total_price, discount_amount, grand_total, cash_received, cash_return]
      );
      
      transactionId = txResult.lastInsertRowId;

      // 2. Loop per item untuk insert detail dan update stok
      for (const item of items) {
        db.runSync(
          `INSERT INTO transaction_details (transaction_id, product_id, quantity, price_at_sale, capital_at_sale)
           VALUES (?, ?, ?, ?, ?)`,
          [transactionId, item.product_id, item.quantity, item.selling_price, item.capital_price]
        );

        db.runSync(
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`,
          [item.quantity, item.product_id]
        );
      }

      db.execSync('COMMIT;');
      return transactionId;
    } catch (error) {
      db.execSync('ROLLBACK;');
      throw new Error(`Gagal menyimpan transaksi: ${error.message}`);
    }
  }

  /**
   * Mendapatkan transaksi berdasarkan tanggal tertentu
   */
  getTransactionsByDate(dateStr) { // dateStr format: YYYY-MM-DD
    const searchPattern = `${dateStr}%`;
    return db.getAllSync('SELECT * FROM transactions WHERE created_at LIKE ? ORDER BY created_at DESC', [searchPattern]);
  }

  /**
   * Mendapatkan transaksi untuk bulan tertentu
   */
  getMonthlyTransactions(yearMonthStr) { // yearMonthStr format: YYYY-MM
    const searchPattern = `${yearMonthStr}%`;
    return db.getAllSync('SELECT * FROM transactions WHERE created_at LIKE ? ORDER BY created_at DESC', [searchPattern]);
  }

  /**
   * Mengambil data lengkap untuk ekspor CSV (JOIN 3 tabel)
   */
  getFullReportForExport() {
    return db.getAllSync(`
      SELECT 
        date(t.created_at) as Tanggal,
        t.invoice_number as No_Nota,
        p.product_name as Nama_Barang,
        td.quantity as Qty,
        td.capital_at_sale as Harga_Modal,
        td.price_at_sale as Harga_Jual,
        (td.quantity * td.price_at_sale) as Total_Penjualan,
        (td.quantity * (td.price_at_sale - td.capital_at_sale)) as Total_Keuntungan
      FROM transactions t
      JOIN transaction_details td ON t.id = td.transaction_id
      JOIN products p ON td.product_id = p.id
      ORDER BY t.created_at DESC
    `);
  }

  /**
   * Mengambil detail item untuk satu transaksi
   */
  getTransactionDetails(transactionId) {
    return db.getAllSync(`
      SELECT td.*, p.product_name 
      FROM transaction_details td
      JOIN products p ON td.product_id = p.id
      WHERE td.transaction_id = ?
    `, [transactionId]);
  }
}

export default new TransactionRepository();
