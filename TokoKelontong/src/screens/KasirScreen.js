import React, { useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { AppContext } from '../context/AppContext';
import ProductRepository from '../database/productRepository';
import TransactionRepository from '../database/transactionRepository';
import { formatRupiah } from '../utils/helpers';
import { printReceipt } from '../utils/printer';
import { colors } from '../theme/colors';

const KasirScreen = ({ navigation }) => {
  const { state, dispatch } = useContext(AppContext);
  const cart = state.cart;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [cashInput, setCashInput] = useState('');
  const [discountInput, setDiscountInput] = useState('0');

  // Refresh saat screen difokus
  useFocusEffect(
    useCallback(() => {
      if (searchQuery.trim()) handleSearch(searchQuery);
    }, [])
  );

  const openBarcodeScanner = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Fitur scan barcode hanya tersedia di build Android.');
      return;
    }
    navigation.navigate('BarcodeScanner', {
      onBarcodeScanned: (code) => {
        handleSearch(code);
        setTimeout(() => {
           setSearchResults(prev => {
             if (prev.length === 1) {
               addToCart(prev[0]);
               return [];
             }
             return prev;
           });
        }, 500);
      },
    });
  };

  const handleSearch = (text) => {
    setSearchQuery(text);
    if (text.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    try {
      const results = ProductRepository.searchProductByName(text);
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    }
  };

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      Alert.alert('Stok Habis', `${product.product_name} stoknya habis.`);
      return;
    }
    const cartItem = cart.find(i => i.product_id === product.id);
    const currentQtyInCart = cartItem ? cartItem.quantity : 0;
    if (currentQtyInCart >= product.stock_quantity) {
      Alert.alert('Stok Tidak Cukup', `Stok tersedia: ${product.stock_quantity}`);
      return;
    }
    dispatch({
      type: 'ADD_TO_CART',
      payload: {
        product_id: product.id,
        product_name: product.product_name,
        selling_price: product.selling_price,
        capital_price: product.capital_price,
        stock_quantity: product.stock_quantity,
      },
    });
    setSearchQuery('');
    setSearchResults([]);
  };

  const updateQty = (product_id, qty) => {
    if (qty <= 0) {
      dispatch({ type: 'REMOVE_FROM_CART', payload: { product_id } });
    } else {
      dispatch({ type: 'UPDATE_CART_QTY', payload: { product_id, quantity: qty } });
    }
  };

  const clearCart = () => {
    Alert.alert('Kosongkan Keranjang', 'Yakin ingin menghapus semua item?', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Ya, Kosongkan', style: 'destructive', onPress: () => dispatch({ type: 'CLEAR_CART' }) },
    ]);
  };

  // Kalkulasi
  const totalHarga = cart.reduce((sum, i) => sum + i.selling_price * i.quantity, 0);
  const diskon = parseInt(discountInput) || 0;
  const grandTotal = Math.max(0, totalHarga - diskon);
  const cashReceived = parseInt(cashInput) || 0;
  const kembalian = cashReceived - grandTotal;

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Keranjang Kosong', 'Tambahkan barang terlebih dahulu.');
      return;
    }
    setCashInput('');
    setDiscountInput('0');
    setShowCheckout(true);
  };

  const handleBayar = async () => {
    if (cashReceived < grandTotal) {
      Alert.alert('Uang Kurang', `Uang yang diterima kurang dari total belanja.`);
      return;
    }
    try {
      const txId = TransactionRepository.createTransaction(
        cart,
        totalHarga,
        diskon,
        grandTotal,
        cashReceived,
        kembalian
      );
      
      // Ambil invoice number dari transaksi terbaru
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTxs = TransactionRepository.getTransactionsByDate(todayStr);
      const fullTx = todayTxs.find(t => t.id === txId);
      const invoiceNum = fullTx ? fullTx.invoice_number : `INV-${txId}`;

      setShowCheckout(false);
      const cartItems = [...cart];
      dispatch({ type: 'CLEAR_CART' });
      
      // Cetak Struk
      if (Platform.OS !== 'web' && state.printerAddress) {
         const printRes = await printReceipt(
           state.storeName || 'Toko Kelontong',
           invoiceNum,
           cartItems,
           totalHarga,
           diskon,
           grandTotal,
           cashReceived,
           kembalian,
           state.printerAddress
         );
         if (!printRes.success) {
           Alert.alert('Info Printer', printRes.message);
         }
      }

      Alert.alert(
        '✅ Transaksi Berhasil!',
        `Kembalian: ${formatRupiah(kembalian)}`,
        [{ text: 'OK' }]
      );
    } catch (e) {
      Alert.alert('Error', e.message);
    }
  };

  // Render item keranjang
  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={1}>{item.product_name}</Text>
        <Text style={styles.cartItemPrice}>{formatRupiah(item.selling_price)} x {item.quantity}</Text>
      </View>
      <View style={styles.qtyControl}>
        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product_id, item.quantity - 1)}>
          <MaterialCommunityIcons name="minus" size={16} color={colors.error} />
        </TouchableOpacity>
        <Text style={styles.qtyText}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.qtyBtn}
          onPress={() => updateQty(item.product_id, item.quantity + 1)}
        >
          <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.cartItemTotal}>{formatRupiah(item.selling_price * item.quantity)}</Text>
    </View>
  );

  // Render hasil pencarian
  const renderSearchResult = ({ item }) => {
    const lowStock = item.stock_quantity <= item.min_stock_threshold;
    return (
      <TouchableOpacity style={styles.searchResult} onPress={() => addToCart(item)}>
        <View style={{ flex: 1 }}>
          <Text style={styles.searchName}>{item.product_name}</Text>
          <Text style={styles.searchPrice}>{formatRupiah(item.selling_price)}</Text>
        </View>
        <View style={styles.searchRight}>
          <Text style={[styles.searchStock, { color: lowStock ? colors.error : colors.primary }]}>
            Stok: {item.stock_quantity}
          </Text>
          {lowStock && <Text style={styles.lowStockBadge}>Menipis!</Text>}
        </View>
        <MaterialCommunityIcons name="plus-circle" size={24} color={colors.primary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={22} color={colors.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama barang atau scan barcode..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }} style={{ marginRight: 8 }}>
            <MaterialCommunityIcons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={openBarcodeScanner}>
           <MaterialCommunityIcons name="barcode-scan" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Dropdown Hasil Pencarian */}
      {searchResults.length > 0 && (
        <View style={styles.searchDropdown}>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderSearchResult}
            keyboardShouldPersistTaps="always"
            style={{ maxHeight: 220 }}
          />
        </View>
      )}

      {/* Keranjang Belanja */}
      <View style={styles.cartHeader}>
        <Text style={styles.cartTitle}>🛒 Keranjang ({cart.length} item)</Text>
        {cart.length > 0 && (
          <TouchableOpacity onPress={clearCart}>
            <Text style={styles.clearBtn}>Kosongkan</Text>
          </TouchableOpacity>
        )}
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyCart}>
          <MaterialCommunityIcons name="cart-outline" size={64} color={colors.border} />
          <Text style={styles.emptyText}>Keranjang masih kosong</Text>
          <Text style={styles.emptySubText}>Cari barang di atas untuk ditambahkan</Text>
        </View>
      ) : (
        <FlatList
          data={cart}
          keyExtractor={(item) => item.product_id.toString()}
          renderItem={renderCartItem}
          style={styles.cartList}
          contentContainerStyle={{ paddingBottom: 8 }}
        />
      )}

      {/* Footer Total + Checkout */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Belanja</Text>
            <Text style={styles.totalValue}>{formatRupiah(totalHarga)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={handleCheckout}>
            <MaterialCommunityIcons name="cash-register" size={20} color="#fff" />
            <Text style={styles.checkoutText}>PROSES PEMBAYARAN</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal Checkout */}
      <Modal visible={showCheckout} animationType="slide" transparent onRequestClose={() => setShowCheckout(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>💰 Proses Pembayaran</Text>
                <TouchableOpacity onPress={() => setShowCheckout(false)}>
                  <MaterialCommunityIcons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView>
                {/* Ringkasan item */}
                <View style={styles.modalSection}>
                  {cart.map((item) => (
                    <View key={item.product_id} style={styles.summaryRow}>
                      <Text style={styles.summaryName} numberOfLines={1}>{item.product_name} x{item.quantity}</Text>
                      <Text style={styles.summaryPrice}>{formatRupiah(item.selling_price * item.quantity)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.divider} />

                {/* Kalkulasi */}
                <View style={styles.modalSection}>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal</Text>
                    <Text style={styles.calcValue}>{formatRupiah(totalHarga)}</Text>
                  </View>

                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Diskon (Rp)</Text>
                    <TextInput
                      style={styles.calcInput}
                      value={discountInput}
                      onChangeText={setDiscountInput}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>

                  <View style={[styles.calcRow, styles.grandTotalRow]}>
                    <Text style={styles.grandTotalLabel}>GRAND TOTAL</Text>
                    <Text style={styles.grandTotalValue}>{formatRupiah(grandTotal)}</Text>
                  </View>

                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Uang Diterima</Text>
                    <TextInput
                      style={[styles.calcInput, styles.cashInput]}
                      value={cashInput}
                      onChangeText={setCashInput}
                      keyboardType="numeric"
                      placeholder="Masukkan nominal"
                      autoFocus
                    />
                  </View>

                  {cashReceived > 0 && (
                    <View style={[styles.calcRow, { backgroundColor: kembalian >= 0 ? '#D1FAE5' : '#FEE2E2', borderRadius: 8, padding: 8, marginTop: 4 }]}>
                      <Text style={{ fontWeight: 'bold', color: kembalian >= 0 ? colors.primary : colors.error }}>
                        {kembalian >= 0 ? 'Kembalian' : 'Kurang'}
                      </Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 18, color: kembalian >= 0 ? colors.primary : colors.error }}>
                        {formatRupiah(Math.abs(kembalian))}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Tombol bayar */}
                <View style={styles.modalSection}>
                  <TouchableOpacity
                    style={[styles.bayarBtn, { opacity: cashReceived >= grandTotal ? 1 : 0.5 }]}
                    onPress={handleBayar}
                    disabled={cashReceived < grandTotal}
                  >
                    <MaterialCommunityIcons name="check-circle" size={22} color="#fff" />
                    <Text style={styles.bayarText}>SELESAIKAN TRANSAKSI</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    margin: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  searchDropdown: {
    marginHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 6,
    zIndex: 10,
    overflow: 'hidden',
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchName: { fontSize: 14, fontWeight: '600', color: colors.text },
  searchPrice: { fontSize: 12, color: colors.primary, marginTop: 2 },
  searchRight: { alignItems: 'flex-end', marginRight: 10 },
  searchStock: { fontSize: 12, fontWeight: '600' },
  lowStockBadge: { fontSize: 10, color: '#fff', backgroundColor: colors.error, borderRadius: 4, paddingHorizontal: 4, marginTop: 2 },

  // Cart Header
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  clearBtn: { fontSize: 13, color: colors.error, fontWeight: '600' },

  // Empty Cart
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  emptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 12, fontWeight: '600' },
  emptySubText: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  // Cart Items
  cartList: { flex: 1 },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  cartItemInfo: { flex: 1, marginRight: 8 },
  cartItemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  cartItemPrice: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  qtyControl: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  qtyText: { fontSize: 15, fontWeight: 'bold', marginHorizontal: 10, color: colors.text },
  cartItemTotal: { fontSize: 14, fontWeight: 'bold', color: colors.primary, minWidth: 70, textAlign: 'right' },

  // Footer
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: 16,
    elevation: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 15, color: colors.textSecondary, fontWeight: '600' },
  totalValue: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  checkoutBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 4,
  },
  checkoutText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end', alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    width: '100%',
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  modalSection: { paddingHorizontal: 20, paddingVertical: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 },
  summaryName: { fontSize: 13, color: colors.text, flex: 1 },
  summaryPrice: { fontSize: 13, color: colors.text, fontWeight: '600' },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
  calcLabel: { fontSize: 14, color: colors.textSecondary },
  calcValue: { fontSize: 14, color: colors.text, fontWeight: '600' },
  calcInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, fontSize: 14,
    minWidth: 130, textAlign: 'right', color: colors.text,
  },
  cashInput: { borderColor: colors.primary, minWidth: 150 },
  grandTotalRow: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 10, padding: 12, marginVertical: 8,
  },
  grandTotalLabel: { fontSize: 16, fontWeight: 'bold', color: colors.primary },
  grandTotalValue: { fontSize: 20, fontWeight: 'bold', color: colors.primary },
  bayarBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: 16, borderRadius: 14, gap: 8, elevation: 4, marginTop: 8,
  },
  bayarText: { color: '#fff', fontWeight: 'bold', fontSize: 15, letterSpacing: 0.5 },
});

export default KasirScreen;
