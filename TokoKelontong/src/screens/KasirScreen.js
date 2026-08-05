import React, { useState, useContext, useCallback } from "react";
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
  ActivityIndicator,
  Linking,
  Image,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import ProductRepository from "../database/productRepository";
import TransactionRepository from "../database/transactionRepository";
import { formatRupiah } from "../utils/helpers";
import {
  generateReceiptHTML,
  generateWAMessage,
} from "../utils/receiptGenerator";
import { colors, fonts } from "../theme/colors";

const { width } = Dimensions.get("window");
const isTablet = width > 600;

// ── Helper: Format angka ke tampilan Rp (Rp 50.000) ──
const formatToRpDisplay = (raw) => {
  const num = String(raw).replace(/\D/g, '').replace(/^0+/, '');
  if (!num) return '';
  return 'Rp ' + num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// ── Helper: Ambil angka murni dari string Rp (Rp 50.000 → 50000) ──
const parseRpToNumber = (formatted) => {
  const num = String(formatted).replace(/\D/g, '');
  return parseInt(num) || 0;
};

const KasirScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const floatingBottom = Platform.OS === 'android'
    ? Math.max(insets.bottom + 24, 32)
    : Math.max(insets.bottom + 16, 24);

  const { state, dispatch } = useContext(AppContext);
  const cart = state.cart;

  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState(["Semua"]);
  const [selectedCategory, setSelectedCategory] = useState("Semua");

  const [searchQuery, setSearchQuery] = useState("");
  const [showCartModal, setShowCartModal] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [lastTxDetails, setLastTxDetails] = useState([]);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  // Refresh saat screen difokus
  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, []),
  );

  const loadProducts = () => {
    try {
      const products = ProductRepository.getAllProducts();
      setAllProducts(products);

      const uniqueCats = Array.from(
        new Set(products.map((p) => p.category).filter(Boolean)),
      );
      setCategories(["Semua", ...uniqueCats]);
    } catch (e) {
      console.log("Error loading products", e);
    }
  };

  const displayedProducts = allProducts.filter((p) => {
    const matchCategory =
      selectedCategory === "Semua" || p.category === selectedCategory;
    const matchSearch =
      p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode &&
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const openBarcodeScanner = () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Info",
        "Fitur scan barcode hanya tersedia di build Android.",
      );
      return;
    }
    navigation.navigate("BarcodeScanner", {
      onBarcodeScanned: (code) => {
        const product = ProductRepository.getProductByBarcode(code);
        if (product) {
          addToCart(product);
        } else {
          Alert.alert(
            "Tidak Ditemukan",
            `Produk dengan barcode ${code} belum terdaftar di gudang.`,
          );
        }
      },
    });
  };

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      Alert.alert("Stok Habis", `${product.product_name} stoknya habis.`);
      return;
    }
    const cartItem = cart.find((i) => i.product_id === product.id);
    const currentQtyInCart = cartItem ? cartItem.quantity : 0;
    if (currentQtyInCart >= product.stock_quantity) {
      Alert.alert(
        "Stok Tidak Cukup",
        `Stok tersedia: ${product.stock_quantity}`,
      );
      return;
    }
    dispatch({
      type: "ADD_TO_CART",
      payload: {
        product_id: product.id,
        product_name: product.product_name,
        selling_price: product.selling_price,
        capital_price: product.capital_price,
        stock_quantity: product.stock_quantity,
        category: product.category,
        image_uri: product.image_uri,
      },
    });
    setSearchQuery("");
  };

  const updateQty = (product_id, qty) => {
    if (qty <= 0) {
      dispatch({ type: "REMOVE_FROM_CART", payload: { product_id } });
    } else {
      dispatch({
        type: "UPDATE_CART_QTY",
        payload: { product_id, quantity: qty },
      });
    }
  };

  const clearCart = () => {
    Alert.alert("Kosongkan Keranjang", "Yakin ingin menghapus semua item?", [
      { text: "Batal", style: "cancel" },
      {
        text: "Ya, Kosongkan",
        style: "destructive",
        onPress: () => {
          dispatch({ type: "CLEAR_CART" });
          setShowCartModal(false);
        },
      },
    ]);
  };

  // Kalkulasi
  const totalHarga = cart.reduce(
    (sum, i) => sum + i.selling_price * i.quantity,
    0,
  );
  const diskon = parseRpToNumber(discountInput);
  const grandTotal = Math.max(0, totalHarga - diskon);
  const cashReceived = parseRpToNumber(cashInput);
  const kembalian = cashReceived - grandTotal;

  const handleBayar = async () => {
    if (cashReceived < grandTotal) {
      Alert.alert(
        "Uang Kurang",
        `Uang yang diterima kurang dari total belanja.`,
      );
      return;
    }
    try {
      const txId = TransactionRepository.createTransaction(
        cart,
        totalHarga,
        diskon,
        grandTotal,
        cashReceived,
        kembalian,
      );

      const todayStr = new Date().toISOString().split("T")[0];
      const todayTxs = TransactionRepository.getTransactionsByDate(todayStr);
      const fullTx = todayTxs.find((t) => t.id === txId);

      setShowCartModal(false);
      setCashInput("");
      setDiscountInput("");
      dispatch({ type: "CLEAR_CART" });

      try {
        const details = TransactionRepository.getTransactionDetails(txId);
        setLastTxDetails(details);
      } catch (_) {
        setLastTxDetails([]);
      }

      if (fullTx) {
        setLastTx(fullTx);
        setShowSuccessModal(true);
      } else {
        Alert.alert(
          "✅ Transaksi Berhasil!",
          `Kembalian: ${formatRupiah(kembalian)}`,
        );
      }

      // Refresh stok di tampilan
      loadProducts();
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const getStoreProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem("@TokoKelontong:StoreProfile");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const handlePrintFromKasir = async () => {
    if (Platform.OS === "web" || !lastTx) return;
    setIsLoadingReceipt(true);
    try {
      const storeProfile = await getStoreProfile();
      const html = generateReceiptHTML(lastTx, lastTxDetails, storeProfile);
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert("Error", "Gagal cetak: " + e.message);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handleShareFromKasir = async () => {
    if (Platform.OS === "web" || !lastTx) return;
    setIsLoadingReceipt(true);
    try {
      const storeProfile = await getStoreProfile();
      const waText = generateWAMessage(lastTx, lastTxDetails, storeProfile);
      const waUrl = `whatsapp://send?text=${encodeURIComponent(waText)}`;
      const canOpenWA = await Linking.canOpenURL(waUrl);
      if (canOpenWA) {
        await Linking.openURL(waUrl);
      } else {
        const html = generateReceiptHTML(lastTx, lastTxDetails, storeProfile);
        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: "Kirim Nota via...",
          });
        }
      }
    } catch (e) {
      Alert.alert("Error", "Gagal kirim: " + e.message);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  // Render POS Grid Item
  const renderProductGrid = ({ item }) => {
    const lowStock = item.stock_quantity <= item.min_stock_threshold;
    const isOutOfStock = item.stock_quantity <= 0;

    const cartItem = cart.find((i) => i.product_id === item.id);
    const qtyInCart = cartItem ? cartItem.quantity : 0;

    return (
      <TouchableOpacity
        style={[styles.productCard, isOutOfStock && { opacity: 0.5 }]}
        onPress={() => addToCart(item)}
        disabled={isOutOfStock}
        activeOpacity={0.7}
      >
        <View style={styles.productCardImg}>
          {item.image_uri ? (
            <Image
              source={{ uri: item.image_uri }}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
            />
          ) : (
            <MaterialCommunityIcons
              name="image-outline"
              size={32}
              color={colors.textSecondary}
            />
          )}
          {item.category && (
            <View style={styles.gridCategoryBadge}>
              <Text style={styles.gridCategoryBadgeText}>{item.category}</Text>
            </View>
          )}
          {qtyInCart > 0 && (
            <View style={styles.gridQtyBadge}>
              <Text style={styles.gridQtyBadgeText}>{qtyInCart}</Text>
            </View>
          )}
        </View>
        <View style={styles.productCardInfo}>
          <Text style={styles.productCardName} numberOfLines={2}>
            {item.product_name}
          </Text>
          <Text style={styles.productCardPrice}>
            {formatRupiah(item.selling_price)}
          </Text>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 6,
              minHeight: 24,
            }}
          >
            <Text
              style={[
                styles.productCardStock,
                {
                  color: lowStock ? colors.error : colors.textSecondary,
                  marginTop: 0,
                },
              ]}
            >
              Stok: {item.stock_quantity}
            </Text>

            {qtyInCart > 0 && (
              <View style={[styles.qtyControl, { marginRight: 0 }]}>
                <TouchableOpacity
                  style={[styles.qtyBtn, { width: 24, height: 24 }]}
                  onPress={() => updateQty(item.id, qtyInCart - 1)}
                >
                  <MaterialCommunityIcons
                    name="minus"
                    size={14}
                    color={colors.error}
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.qtyText,
                    { marginHorizontal: 6, fontSize: 13 },
                  ]}
                >
                  {qtyInCart}
                </Text>
                <TouchableOpacity
                  style={[styles.qtyBtn, { width: 24, height: 24 }]}
                  onPress={() => updateQty(item.id, qtyInCart + 1)}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={14}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={colors.textSecondary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama barang atau scan barcode..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={{ marginRight: 8 }}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={openBarcodeScanner}>
          <MaterialCommunityIcons
            name="barcode-scan"
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Filter Kategori ── */}
      <View style={styles.categoryScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {categories.map((cat, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.categoryPill,
                selectedCategory === cat && styles.categoryPillActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === cat && styles.categoryPillTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Grid Produk ── */}
      <FlatList
        data={displayedProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProductGrid}
        numColumns={isTablet ? 3 : 2}
        contentContainerStyle={[styles.productGrid, { paddingBottom: floatingBottom + 70 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 50 }}>
            <MaterialCommunityIcons
              name="package-variant"
              size={64}
              color={colors.border}
            />
            <Text style={{ marginTop: 12, color: colors.textSecondary }}>
              Tidak ada produk ditemukan.
            </Text>
          </View>
        }
      />

      {/* ── Floating Cart Footer ── */}
      {cart.length > 0 && (
        <View style={[styles.floatingCart, { bottom: floatingBottom }]}>
          <View style={styles.floatingCartInfo}>
            <Text style={styles.floatingCartTotal}>
              {formatRupiah(totalHarga)}
            </Text>
            <Text style={styles.floatingCartItems}>
              {cart.length} item dipilih
            </Text>
          </View>
          <TouchableOpacity
            style={styles.floatingCartBtn}
            onPress={() => setShowCartModal(true)}
          >
            <Text style={styles.floatingCartBtnText}>LIHAT KERANJANG</Text>
            <MaterialCommunityIcons name="cart" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modal Keranjang & Checkout – Centered Card ── */}
      <Modal
        visible={showCartModal}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlayCart}>
            <View style={styles.cartBottomSheet}>

              {/* Header */}
              <View style={styles.modalHeaderBottomSheet}>
                <Text style={styles.modalTitleBottomSheet}>🛒 Keranjang</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <TouchableOpacity onPress={clearCart} style={styles.modalIconBtn}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCartModal(false)} style={styles.modalIconBtn}>
                    <MaterialCommunityIcons name="close" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>

                {/* Daftar Item Keranjang */}
                <View style={{ padding: 12 }}>
                  {cart.map((item) => (
                    <View key={item.product_id} style={styles.cartItem}>
                      {item.image_uri ? (
                        <Image source={{ uri: item.image_uri }} style={styles.cartItemImage} />
                      ) : (
                        <View style={[styles.cartItemImage, { backgroundColor: colors.surfaceVariant, alignItems: 'center', justifyContent: 'center' }]}>
                          <MaterialCommunityIcons name="image-outline" size={18} color={colors.textSecondary} />
                        </View>
                      )}
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName} numberOfLines={1}>{item.product_name}</Text>
                        <Text style={styles.cartItemPrice}>{formatRupiah(item.selling_price)}</Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product_id, item.quantity - 1)}>
                          <MaterialCommunityIcons name="minus" size={14} color={colors.error} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => updateQty(item.product_id, item.quantity + 1)}>
                          <MaterialCommunityIcons name="plus" size={14} color={colors.primary} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Divider */}
                <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 12, marginBottom: 12 }} />

                {/* Kalkulasi */}
                <View style={{ paddingHorizontal: 14, gap: 8 }}>

                  {/* Subtotal */}
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal</Text>
                    <Text style={styles.calcValue}>{formatRupiah(totalHarga)}</Text>
                  </View>

                  {/* Total Tagihan */}
                  <View style={styles.grandTotalContainer}>
                    <Text style={styles.grandTotalLabel}>TOTAL TAGIHAN</Text>
                    <Text style={styles.grandTotalValue}>{formatRupiah(grandTotal)}</Text>
                  </View>

                  {/* Diskon */}
                  <Text style={[styles.calcLabel, { fontWeight: '700', marginTop: 4 }]}>Diskon (Rp)</Text>
                  <TextInput
                    style={styles.cashInputBig}
                    value={discountInput}
                    onChangeText={(text) => setDiscountInput(formatToRpDisplay(text))}
                    keyboardType="numeric"
                    placeholder="Rp 0"
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Pembayaran */}
                  <Text style={[styles.calcLabel, { fontWeight: '700', marginTop: 8 }]}>Pembayaran (Uang Diterima)</Text>
                  <TextInput
                    style={styles.cashInputBig}
                    value={cashInput}
                    onChangeText={(text) => setCashInput(formatToRpDisplay(text))}
                    keyboardType="numeric"
                    placeholder="Rp 50.000"
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Quick Amount */}
                  <View style={styles.quickAmountRow}>
                    <TouchableOpacity style={styles.quickAmountBtn} onPress={() => setCashInput(formatToRpDisplay(grandTotal))}>
                      <Text style={styles.quickAmountText}>Uang Pas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAmountBtn} onPress={() => setCashInput(formatToRpDisplay(50000))}>
                      <Text style={styles.quickAmountText}>50 Ribu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.quickAmountBtn} onPress={() => setCashInput(formatToRpDisplay(100000))}>
                      <Text style={styles.quickAmountText}>100 Ribu</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Kembalian */}
                  {cashReceived > 0 && (
                    <View style={[styles.kembalianBox, { backgroundColor: kembalian >= 0 ? '#D1FAE5' : '#FEE2E2' }]}>
                      <Text style={{ fontWeight: 'bold', fontSize: 13, color: kembalian >= 0 ? '#065F46' : '#991B1B' }}>
                        {kembalian >= 0 ? 'KEMBALIAN' : 'UANG KURANG'}
                      </Text>
                      <Text style={{ fontWeight: 'bold', fontSize: 20, color: kembalian >= 0 ? '#065F46' : '#991B1B' }}>
                        {formatRupiah(Math.abs(kembalian))}
                      </Text>
                    </View>
                  )}

                  {/* Tombol Bayar */}
                  <TouchableOpacity
                    style={[styles.bayarBtn, { opacity: cashReceived >= grandTotal ? 1 : 0.5, marginTop: 12 }]}
                    onPress={handleBayar}
                    disabled={cashReceived < grandTotal}
                  >
                    <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                    <Text style={styles.bayarText}>SELESAIKAN TRANSAKSI</Text>
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Success Modal - Print/Share ── */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.successModal, { padding: 0, overflow: "hidden" }]}
          >
            <View
              style={{
                backgroundColor: colors.primary,
                padding: 20,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={48}
                color="#fff"
              />
              <Text
                style={[styles.successTitle, { color: "#fff", marginTop: 8 }]}
              >
                Transaksi Berhasil!
              </Text>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
                {lastTx?.invoice_number}
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 300 }}
              contentContainerStyle={{ padding: 20 }}
            >
              {lastTx &&
                lastTxDetails.map((item, index) => (
                  <View
                    key={index}
                    style={{
                      marginBottom: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#F3F4F6",
                      paddingBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "600",
                        color: colors.text,
                      }}
                    >
                      {item.product_name}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        marginTop: 4,
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        {item.quantity} x {formatRupiah(item.price_at_sale)}
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "bold",
                          color: colors.text,
                        }}
                      >
                        {formatRupiah(item.quantity * item.price_at_sale)}
                      </Text>
                    </View>
                  </View>
                ))}

              {lastTx && (
                <View style={{ marginTop: 8, gap: 6 }}>
                  {lastTx.discount_amount > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        Subtotal
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.text }}>
                        {formatRupiah(lastTx.total_price)}
                      </Text>
                    </View>
                  )}
                  {lastTx.discount_amount > 0 && (
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        Diskon
                      </Text>
                      <Text style={{ fontSize: 13, color: "#EF4444" }}>
                        -{formatRupiah(lastTx.discount_amount)}
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 4,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: "#E5E7EB",
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: "bold",
                        color: colors.primary,
                      }}
                    >
                      TOTAL
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: colors.primary,
                      }}
                    >
                      {formatRupiah(lastTx.grand_total)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      marginTop: 8,
                    }}
                  >
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                      Tunai
                    </Text>
                    <Text style={{ fontSize: 13, color: colors.text }}>
                      {formatRupiah(lastTx.cash_received)}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      backgroundColor: "#ECFDF5",
                      padding: 10,
                      borderRadius: 8,
                      marginTop: 4,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: "bold",
                        color: "#059669",
                      }}
                    >
                      Kembalian
                    </Text>
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "bold",
                        color: "#059669",
                      }}
                    >
                      {formatRupiah(lastTx.cash_return)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              {isLoadingReceipt ? (
                <ActivityIndicator
                  size="large"
                  color={colors.primary}
                  style={{ marginVertical: 12 }}
                />
              ) : (
                <View style={styles.successActions}>
                  <TouchableOpacity
                    style={styles.successBtn}
                    onPress={handlePrintFromKasir}
                  >
                    <MaterialCommunityIcons
                      name="printer"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.successBtnText}>Cetak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.successBtn, { backgroundColor: "#25D366" }]}
                    onPress={handleShareFromKasir}
                  >
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.successBtnText}>Kirim WA</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.successClose}
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.successCloseText}>Tutup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    elevation: 0,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },

  // Categories
  categoryScrollWrapper: { marginBottom: 12 },
  categoryPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    marginRight: 10,
    elevation: 0,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  categoryPillTextActive: { color: "#fff" },

  // Grid
  productGrid: { paddingHorizontal: 8, paddingBottom: 100 },
  productCard: {
    flex: 1,
    margin: 8,
    backgroundColor: colors.surface,
    borderRadius: 20,
    overflow: "hidden",
    elevation: 0,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    maxWidth: isTablet ? "31%" : "47%",
  },
  productCardImg: {
    height: 120,
    width: "100%",
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  gridCategoryBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridCategoryBadgeText: {
    fontSize: 9,
    color: colors.primary,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  gridQtyBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: colors.error,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  gridQtyBadgeText: { fontSize: 12, color: "#fff", fontWeight: "bold" },
  productCardInfo: { padding: 10 },
  productCardName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 4,
  },
  productCardPrice: { fontSize: 14, color: colors.primary, fontWeight: "700" },
  productCardStock: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },

  // Floating Cart
  floatingCart: {
    position: "absolute",
    bottom: 60,
    left: 16,
    right: 16,
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  },
  floatingCartInfo: { flex: 1 },
  floatingCartTotal: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
  },
  floatingCartItems: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  floatingCartBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    gap: 8,
  },
  floatingCartBtnText: { color: "#fff", fontWeight: "bold", fontSize: 13 },

  // Modal Keranjang Centered Card
  modalOverlayCart: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
  },
  cartBottomSheet: {
    backgroundColor: colors.background, borderRadius: 24, width: '92%',
    maxHeight: '75%', elevation: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20,
  },
  modalIconBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#F8FAFC',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border,
  },
  modalHeaderBottomSheet: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  modalTitleBottomSheet: { fontSize: 16, fontWeight: '800', color: colors.text },
  cartListContainer: { padding: 12 },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginBottom: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cartItemImage: { width: 50, height: 50, borderRadius: 8, marginRight: 12 },
  cartItemInfo: { flex: 1, marginRight: 8 },
  cartItemName: { fontSize: 14, fontWeight: "600", color: colors.text },
  cartItemPrice: {
    fontSize: 13,
    color: colors.primary,
    marginTop: 4,
    fontWeight: "600",
  },
  qtyControl: { flexDirection: "row", alignItems: "center" },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: "bold",
    marginHorizontal: 10,
    color: colors.text,
  },
  dividerFullScreen: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  calcSection: { padding: 16 },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 6,
  },
  calcLabel: { fontSize: 14, color: colors.textSecondary },
  calcValue: { fontSize: 14, color: colors.text, fontWeight: "600" },
  calcInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 14,
    minWidth: 130,
    textAlign: "right",
    color: colors.text,
    backgroundColor: "#fff",
  },
  grandTotalContainer: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalLabel: { fontSize: 14, fontWeight: "bold", color: colors.primary },
  grandTotalValue: { fontSize: 18, fontWeight: "bold", color: colors.primary },
  cashInputBig: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    backgroundColor: "#fff",
    fontWeight: "bold",
  },
  quickAmountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  quickAmountBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAmountText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  kembalianBox: {
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bayarBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    gap: 8,
    elevation: 4,
    marginTop: 24,
  },
  bayarText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },

  // Success Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 380,
    alignSelf: "center",
    elevation: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  successActions: { flexDirection: "row", gap: 10, marginBottom: 12 },
  successBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  successBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  successClose: {
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 4,
  },
  successCloseText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default KasirScreen;
