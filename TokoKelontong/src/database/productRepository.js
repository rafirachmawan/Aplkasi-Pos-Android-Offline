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
