import { db } from './db';

export const transactionRepository = {
  createTransaction: (invoiceNumber, discountAmount, cashReceived, items) => {
    // items = [{ id, product_id, quantity, price_at_sale, capital_at_sale }]
    try {
      db.withTransactionSync(() => {
        // Calculate totals
        let subtotal = 0;
        items.forEach(item => {
          subtotal += (item.price_at_sale * item.quantity);
        });
        
        const grandTotal = subtotal - discountAmount;
        const cashReturn = cashReceived - grandTotal;

        // Insert Transaction
        const txResult = db.runSync(
          `INSERT INTO transactions (invoice_number, total_price, discount_amount, grand_total, cash_received, cash_return) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [invoiceNumber, subtotal, discountAmount, grandTotal, cashReceived, cashReturn]
        );
        const transactionId = txResult.lastInsertRowId;

        // Insert details and update stock
        const stmtInsertDetail = db.prepareSync(
          `INSERT INTO transaction_details (transaction_id, product_id, quantity, price_at_sale, capital_at_sale) 
           VALUES (?, ?, ?, ?, ?)`
        );
        
        const stmtUpdateStock = db.prepareSync(
          `UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?`
        );

        items.forEach(item => {
          stmtInsertDetail.executeSync([
            transactionId, item.product_id, item.quantity, item.price_at_sale, item.capital_at_sale
          ]);
          stmtUpdateStock.executeSync([item.quantity, item.product_id]);
        });

        stmtInsertDetail.finalizeSync();
        stmtUpdateStock.finalizeSync();
      });
      return { success: true };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  },

  getTransactionsByDate: (dateString) => {
    // dateString format YYYY-MM-DD
    return db.getAllSync(
      `SELECT * FROM transactions WHERE date(created_at) = date(?) ORDER BY created_at DESC`,
      [dateString]
    );
  },

  getMonthlyTransactions: (yearMonthString) => {
    // yearMonthString format YYYY-MM
    return db.getAllSync(
      `SELECT * FROM transactions WHERE strftime('%Y-%m', created_at) = ? ORDER BY created_at DESC`,
      [yearMonthString]
    );
  },

  getFullReportForExport: () => {
    return db.getAllSync(`
      SELECT 
        date(t.created_at) as Tanggal,
        t.invoice_number as 'No Nota',
        p.product_name as 'Nama Barang',
        td.quantity as Qty,
        td.capital_at_sale as 'Harga Modal',
        td.price_at_sale as 'Harga Jual',
        (td.quantity * td.price_at_sale) as 'Total Penjualan',
        (td.quantity * (td.price_at_sale - td.capital_at_sale)) as Keuntungan
      FROM transactions t
      JOIN transaction_details td ON t.id = td.transaction_id
      JOIN products p ON td.product_id = p.id
      ORDER BY t.created_at DESC
    `);
  }
};
