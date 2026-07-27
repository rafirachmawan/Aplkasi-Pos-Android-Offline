<<<<<<< HEAD
import { db } from './db';

export const productRepository = {
  getAllProducts: () => {
    return db.getAllSync('SELECT * FROM products ORDER BY product_name ASC');
  },

  getProductByBarcode: (barcode) => {
    return db.getFirstSync('SELECT * FROM products WHERE barcode = ?', [barcode]);
  },

  searchProductByName: (keyword) => {
    return db.getAllSync('SELECT * FROM products WHERE product_name LIKE ?', [`%${keyword}%`]);
  },

  getLowStockProducts: () => {
    return db.getAllSync('SELECT * FROM products WHERE stock_quantity <= min_stock_threshold');
  },

  addProduct: (data) => {
    const { barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold } = data;
    try {
      const result = db.runSync(
        `INSERT INTO products (barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [barcode || null, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold || 5]
      );
      return { success: true, id: result.lastInsertRowId };
    } catch (error) {
      // Handle barcode duplicate error
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'DUPLICATE_BARCODE' };
      }
      throw error;
    }
  },

  updateProduct: (id, data) => {
    const { barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold } = data;
    try {
      db.runSync(
        `UPDATE products SET 
         barcode = ?, product_name = ?, capital_price = ?, selling_price = ?, 
         stock_quantity = ?, min_stock_threshold = ? 
         WHERE id = ?`,
        [barcode || null, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold || 5, id]
      );
      return { success: true };
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return { success: false, error: 'DUPLICATE_BARCODE' };
      }
      throw error;
    }
  },

  updateStock: (id, quantityChange) => {
    db.runSync(`UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?`, [quantityChange, id]);
  },

  deleteProduct: (id) => {
    db.runSync('DELETE FROM products WHERE id = ?', [id]);
  }
};
=======
import db from './db';

class ProductRepository {
  /**
   * Mengambil semua produk dari database, diurutkan berdasarkan nama (A-Z)
   */
  getAllProducts() {
    return db.getAllSync('SELECT * FROM products ORDER BY product_name ASC');
  }

  /**
   * Mencari produk berdasarkan barcode
   */
  getProductByBarcode(barcode) {
    return db.getFirstSync('SELECT * FROM products WHERE barcode = ?', [barcode]);
  }

  /**
   * Mencari produk berdasarkan nama (sebagian atau penuh)
   */
  searchProductByName(keyword) {
    const searchPattern = `%${keyword}%`;
    return db.getAllSync('SELECT * FROM products WHERE product_name LIKE ? ORDER BY product_name ASC', [searchPattern]);
  }

  /**
   * Mengambil produk yang stoknya menipis
   */
  getLowStockProducts() {
    return db.getAllSync('SELECT * FROM products WHERE stock_quantity <= min_stock_threshold ORDER BY stock_quantity ASC');
  }

  /**
   * Menambahkan produk baru
   */
  addProduct(product) {
    const { barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold = 5 } = product;
    
    // Validasi barcode unik
    if (barcode) {
      const existing = this.getProductByBarcode(barcode);
      if (existing) {
        throw new Error(`Barcode sudah terdaftar untuk produk: ${existing.product_name}.`);
      }
    }

    const result = db.runSync(
      `INSERT INTO products (barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold]
    );
    return result.lastInsertRowId;
  }

  /**
   * Memperbarui data produk berdasarkan ID
   */
  updateProduct(id, product) {
    const { barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold } = product;
    
    const result = db.runSync(
      `UPDATE products 
       SET barcode = ?, product_name = ?, capital_price = ?, selling_price = ?, stock_quantity = ?, min_stock_threshold = ?
       WHERE id = ?`,
      [barcode, product_name, capital_price, selling_price, stock_quantity, min_stock_threshold, id]
    );
    return result.changes > 0;
  }

  /**
   * Menghapus produk berdasarkan ID
   */
  deleteProduct(id) {
    const result = db.runSync('DELETE FROM products WHERE id = ?', [id]);
    return result.changes > 0;
  }
}

export default new ProductRepository();
>>>>>>> f39751906b4f54e6c2a73e0045dabdb926a8e30f
