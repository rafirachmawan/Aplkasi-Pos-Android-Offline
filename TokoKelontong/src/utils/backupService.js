import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import db from '../database/db';

export class BackupService {
  /**
   * Ekspor seluruh data (Produk, Transaksi, Detail Transaksi, & Pengaturan Toko) ke file JSON
   */
  static async exportBackup() {
    try {
      // 1. Ambil data dari SQLite
      const products = db.getAllSync('SELECT * FROM products;');
      const transactions = db.getAllSync('SELECT * FROM transactions;');
      const transactionDetails = db.getAllSync('SELECT * FROM transaction_details;');

      // 2. Ambil data Pengaturan Toko dari AsyncStorage
      const storeName = (await AsyncStorage.getItem('storeName')) || 'Toko Kelontong';
      const printerAddress = await AsyncStorage.getItem('printerAddress');
      const storeLogo = await AsyncStorage.getItem('storeLogo');

      // 3. Susun Payload Backup
      const now = new Date();
      const timeStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      
      const backupData = {
        app: 'TokoKelontongPOS',
        version: '1.0',
        exportedAt: now.toISOString(),
        storeProfile: {
          storeName,
          printerAddress,
          storeLogo,
        },
        counts: {
          products: products.length,
          transactions: transactions.length,
          transactionDetails: transactionDetails.length,
        },
        products,
        transactions,
        transactionDetails,
      };

      const jsonString = JSON.stringify(backupData, null, 2);

      // 4. Tulis ke file JSON lokal
      const fileName = `TokoKelontong_Backup_${timeStr}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(fileUri, jsonString, {
        encoding: 'utf8',
      });

      // 5. Buka Menu Share HP (Bisa kirim ke WA, Save to Drive, Simpan ke File HP)
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Simpan / Bagikan Backup Data Kasir',
          UTI: 'public.json',
        });
      }

      return { success: true, fileName, fileUri, counts: backupData.counts };
    } catch (error) {
      console.error('Export Backup Error:', error);
      throw new Error(`Gagal membuat backup: ${error.message}`);
    }
  }

  /**
   * Mengembalikan / Restore data dari JSON string
   */
  static async restoreBackupFromJson(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      // Validasi struktur data
      if (!data.app || data.app !== 'TokoKelontongPOS') {
        throw new Error('Format file backup tidak valid atau tidak cocok dengan aplikasi TokoKelontong.');
      }

      const products = data.products || [];
      const transactions = data.transactions || [];
      const transactionDetails = data.transactionDetails || [];
      const storeProfile = data.storeProfile || {};

      // Jalankan SQLite Transaction untuk memulihkan data
      db.execSync('BEGIN TRANSACTION;');

      try {
        // Hapus data lama agar tidak terjadi duplikasi ID
        db.execSync('DELETE FROM transaction_details;');
        db.execSync('DELETE FROM transactions;');
        db.execSync('DELETE FROM products;');

        // 1. Insert Products
        for (const p of products) {
          db.runSync(
            `INSERT INTO products (id, barcode, product_name, capital_price, selling_price, stock_quantity, unit, min_stock_threshold, image_uri, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              p.id,
              p.barcode || null,
              p.product_name,
              p.capital_price || 0,
              p.selling_price || 0,
              p.stock_quantity || 0,
              p.unit || 'pcs',
              p.min_stock_threshold || 5,
              p.image_uri || null,
              p.created_at || new Date().toISOString(),
              p.updated_at || new Date().toISOString(),
            ]
          );
        }

        // 2. Insert Transactions
        for (const t of transactions) {
          db.runSync(
            `INSERT INTO transactions (id, invoice_number, total_price, discount_amount, grand_total, cash_received, cash_return, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              t.id,
              t.invoice_number,
              t.total_price || 0,
              t.discount_amount || 0,
              t.grand_total || 0,
              t.cash_received || 0,
              t.cash_return || 0,
              t.created_at || new Date().toISOString(),
            ]
          );
        }

        // 3. Insert Transaction Details
        for (const td of transactionDetails) {
          db.runSync(
            `INSERT INTO transaction_details (id, transaction_id, product_id, quantity, price_at_sale, capital_at_sale)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              td.id,
              td.transaction_id,
              td.product_id,
              td.quantity || 1,
              td.price_at_sale || 0,
              td.capital_at_sale || 0,
            ]
          );
        }

        db.execSync('COMMIT;');
      } catch (err) {
        db.execSync('ROLLBACK;');
        throw err;
      }

      // Restore Pengaturan Toko ke AsyncStorage
      if (storeProfile.storeName) {
        await AsyncStorage.setItem('storeName', storeProfile.storeName);
      }
      if (storeProfile.printerAddress) {
        await AsyncStorage.setItem('printerAddress', storeProfile.printerAddress);
      }
      if (storeProfile.storeLogo) {
        await AsyncStorage.setItem('storeLogo', storeProfile.storeLogo);
      }

      return {
        success: true,
        restoredProducts: products.length,
        restoredTransactions: transactions.length,
      };
    } catch (error) {
      console.error('Restore Backup Error:', error);
      throw new Error(`Gagal memulihkan backup: ${error.message}`);
    }
  }
}
