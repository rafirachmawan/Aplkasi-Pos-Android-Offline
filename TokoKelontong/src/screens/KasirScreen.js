import React, { useState, useContext, useCallback, useRef, useEffect } from "react";
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import ProductRepository from "../database/productRepository";
import TransactionRepository from "../database/transactionRepository";
import { formatRupiah } from "../utils/helpers";
import {
  generateReceiptHTML,
  generateWAMessage,
} from "../utils/receiptGenerator";
import {
  isPrinterConfigured,
  isBluetoothPrintingSupported,
  printReceiptViaBluetooth,
} from "../utils/bluetoothPrinter";
import { colors, fonts } from "../theme/colors";

const { width } = Dimensions.get("window");
const isTablet = width > 600;

// ── Helper: Format angka ke tampilan Rp (Rp 50.000) ──
const formatToRpDisplay = (raw) => {
  const num = String(raw).replace(/\D/g, "").replace(/^0+/, "");
  if (!num) return "";
  return "Rp " + num.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// ── Helper: Ambil angka murni dari string Rp (Rp 50.000 → 50000) ──
const parseRpToNumber = (formatted) => {
  const num = String(formatted).replace(/\D/g, "");
  return parseInt(num) || 0;
};

const KasirScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const floatingBottom =
    Platform.OS === "android"
      ? Math.max(insets.bottom + 24, 32)
      : Math.max(insets.bottom + 16, 24);

  const { state, dispatch } = useContext(AppContext);
  const cart = state.cart;

  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState(["Semua"]);
  const [selectedCategory, setSelectedCategory] = useState("Semua");

  const [searchQuery, setSearchQuery] = useState("");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [lastTxDetails, setLastTxDetails] = useState([]);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [storeProfile, setStoreProfile] = useState({});
  const [btPrinterReady, setBtPrinterReady] = useState(false);

  // Refresh saat screen difokus.
  // Catatan: keranjang TIDAK di-reset saat kehilangan fokus (misal buka
  // scanner barcode) agar belanjaan kasir tidak hilang. Keranjang hanya
  // dikosongkan setelah transaksi sukses atau lewat tombol "Kosongkan".
  useFocusEffect(
    useCallback(() => {
      loadProducts();
      // Cek apakah printer Bluetooth sudah diatur (untuk tombol cetak langsung)
      if (isBluetoothPrintingSupported()) {
        isPrinterConfigured()
          .then(setBtPrinterReady)
          .catch(() => setBtPrinterReady(false));
      } else {
        setBtPrinterReady(false);
      }
    }, []),
  );

  const loadProducts = async () => {
    try {
      const products = await ProductRepository.getAllProducts();
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

  // Ref keranjang agar callback scan barcode selalu melihat isi terbaru
  // (closure yang dikirim ke layar scanner tidak boleh menyimpan foto lama).
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const openBarcodeScanner = () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Info",
        "Fitur scan barcode hanya tersedia di build Android.",
      );
      return;
    }
    navigation.navigate("BarcodeScanner", {
      onBarcodeScanned: async (code) => {
        try {
          const product = await ProductRepository.getProductByBarcode(code);
          if (product) {
            addToCart(product);
          } else {
            Alert.alert(
              "Tidak Ditemukan",
              `Produk dengan barcode ${code} belum terdaftar di gudang.`,
            );
          }
        } catch (e) {
          Alert.alert("Error", "Gagal mencari produk: " + e.message);
        }
      },
    });
  };

  const addToCart = (product) => {
    if (product.stock_quantity <= 0) {
      Alert.alert("Stok Habis", `${product.product_name} stoknya habis.`);
      return;
    }
    const cartItem = cartRef.current.find((i) => i.product_id === product.id);
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
      return;
    }
    // Validasi stok saat qty dinaikkan (tombol + di grid & modal keranjang)
    const product = allProducts.find((p) => p.id === product_id);
    const cartItem = cart.find((i) => i.product_id === product_id);
    const maxStock =
      product != null ? product.stock_quantity : cartItem?.stock_quantity;
    if (maxStock != null && qty > maxStock) {
      Alert.alert(
        "Stok Tidak Cukup",
        `Stok tersedia: ${maxStock}`,
      );
      return;
    }
    dispatch({
      type: "UPDATE_CART_QTY",
      payload: { product_id, quantity: qty },
    });
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

  // Tanggal/waktu transaksi untuk pratinjau nota
  const receiptDateStr = lastTx
    ? new Date(lastTx.created_at).toLocaleString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const handleBayar = async () => {
    if (cashReceived < grandTotal) {
      Alert.alert(
        "Uang Kurang",
        `Uang yang diterima kurang dari total belanja.`,
      );
      return;
    }
    try {
      const txId = await TransactionRepository.createTransaction(
        cart,
        totalHarga,
        diskon,
        grandTotal,
        cashReceived,
        kembalian,
      );

      // Transaksi sudah tercatat di server: amankan UI dulu supaya
      // kegagalan query lanjutan tidak meninggalkan keranjang (double-simpan).
      setShowCartModal(false);
      setCashInput("");
      setDiscountInput("");
      dispatch({ type: "CLEAR_CART" });

      try {
        const nowDate = new Date();
        const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;
        const todayTxs =
          await TransactionRepository.getTransactionsByDate(todayStr);
        const fullTx = todayTxs.find((t) => t.id === txId);

        setStoreProfile(await getStoreProfile());

        try {
          const details = await TransactionRepository.getTransactionDetails(txId);
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
      } catch (_) {
        // Bukti transaksi gagal dimuat (mis. jaringan putus sesaat),
        // tetapi penjualan sudah sah tercatat.
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
      if (!saved) return {};
      const data = JSON.parse(saved);
      // Migrasi format lama dari menu Pengaturan ({name, printerAddress, logo})
      // ke format nota baku ({storeName, storeAddress, ...})
      if (data.name && !data.storeName) {
        data.storeName = data.name;
      }
      return data;
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

  // Cetak nota langsung ke printer thermal Bluetooth (tanpa dialog print)
  const handlePrintBluetooth = async () => {
    if (!lastTx) return;
    setIsLoadingReceipt(true);
    try {
      const profile = await getStoreProfile();
      await printReceiptViaBluetooth(lastTx, lastTxDetails, profile);
      Alert.alert("Berhasil", "Nota dikirim ke printer Bluetooth.");
    } catch (e) {
      Alert.alert(
        "Gagal Cetak",
        e.message || "Terjadi kesalahan saat mencetak ke printer.",
      );
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

  // Helper: Get icon name based on category
  const getPlaceholderIcon = (category) => {
    if (!category) return "package-variant";

    const categoryIcons = {
      makanan: "apple",
      minuman: "glass-wine",
      kebersihan: "sparkles",
      batik: "shirt-tank-top",
      baju: "t-shirt-outlined",
      aksesoris: "ring",
      sepatu: "shoe-formal",
      tas: "bag-personal",
      elektronik: "monitor",
      "alat tulis": "pencil-box",
      lainnya: "cube-outline",
    };

    return categoryIcons[category.toLowerCase()] || "package-variant";
  };

  // Helper: Get color tint based on category
  const getCategoryColor = (category) => {
    if (!category) return colors.textSecondary;

    const categoryColors = {
      makanan: "#EF4444", // Red
      minuman: "#3B82F6", // Blue
      kebersihan: "#10B981", // Green
      batik: "#F59E0B", // Orange
      baju: "#EC4899", // Pink
      aksesoris: "#8B5CF6", // Purple
      sepatu: "#06B6D4", // Cyan
      tas: "#84CC16", // Lime
      elektronik: "#6366F1", // Indigo
      "alat tulis": "#14B8A6", // Teal
      lainnya: "#64748B", // Slate
    };

    return categoryColors[category.toLowerCase()] || colors.textSecondary;
  };

  // Helper: Get icon for category card
  const getCategoryIconForCard = (category) => {
    const cardIcons = {
      Semua: "apps",
      makanan: "apple",
      minuman: "glass-wine",
      kebersihan: "sparkles",
      batik: "hanger",
      baju: "t-shirt",
      aksesoris: "ring",
      sepatu: "shoe-heel",
      tas: "bag-marked",
      elektronik: "monitor",
      "alat tulis": "pen-tool",
      lainnya: "cube-outline",
    };
    return cardIcons[category] || "package-variant";
  };

  // Helper: Get color for category card icon
  const getCategoryColorForCard = (category) => {
    if (!category) return colors.textSecondary;

    const colorsMap = {
      makanan: "#DC2626", // Red-600
      minuman: "#2563EB", // Blue-600
      kebersihan: "#059669", // Green-600
      batik: "#D97706", // Orange-600
      baju: "#DB2777", // Pink-600
      aksesoris: "#7C3AED", // Purple-600
      sepatu: "#0891B2", // Cyan-600
      tas: "#65A30D", // Lime-600
      elektronik: "#4F46E5", // Indigo-600
      "alat tulis": "#0D9488", // Teal-600
      lainnya: "#475569", // Slate-600
      Semua: colors.text,
    };

    return colorsMap[category] || colors.textSecondary;
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
            <View style={styles.productCardImgPlaceholder}>
              <MaterialCommunityIcons
                name={getPlaceholderIcon(item.category)}
                size={56}
                color={getCategoryColor(item.category)}
                style={{ opacity: 0.4 }}
              />
            </View>
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

      {/* ── Filter Kategori: Simple Horizontal Pills ── */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {categories.map((cat, idx) => {
            const count =
              cat === "Semua"
                ? allProducts.length
                : allProducts.filter((p) => p.category === cat).length;

            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.categoryPill,
                  selectedCategory === cat && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategory === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
                <View
                  style={[
                    styles.categoryCountBadge,
                    selectedCategory === cat && styles.categoryCountBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryCountText,
                      selectedCategory === cat &&
                        styles.categoryCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Modal Kategori Grid (Centered Card) ── */}
      <Modal
        visible={showCategoryModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.catModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.catModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.catModalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.catModalIconWrap}>
                  <MaterialCommunityIcons
                    name="shape-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.catModalTitle}>Pilih Kategori</Text>
                  <Text style={styles.catModalSubtitle}>
                    {categories.length - 1} kategori • {allProducts.length}{" "}
                    produk
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.catModalCloseBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Grid */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.catModalGrid}
            >
              {categories.map((cat, idx) => {
                const count =
                  cat === "Semua"
                    ? allProducts.length
                    : allProducts.filter((p) => p.category === cat).length;
                const isActive = selectedCategory === cat;
                const iconName = cat === "Semua" ? "apps" : "tag-outline";

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.catGridItem,
                      isActive && styles.catGridItemActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setShowCategoryModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.catGridIconWrap,
                        isActive && styles.catGridIconWrapActive,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={iconName}
                        size={22}
                        color={isActive ? "#FFFFFF" : colors.iconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.catGridLabel,
                        isActive && styles.catGridLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {cat}
                    </Text>
                    <Text
                      style={[
                        styles.catGridCount,
                        isActive && styles.catGridCountActive,
                      ]}
                    >
                      {count} produk
                    </Text>
                    {isActive && (
                      <View style={styles.catGridCheckmark}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Grid Produk ── */}
      <FlatList
        data={displayedProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProductGrid}
        numColumns={isTablet ? 3 : 2}
        contentContainerStyle={[
          styles.productGrid,
          { paddingBottom: floatingBottom + 70 },
        ]}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlayCart}>
            <View style={styles.cartBottomSheet}>
              {/* Header */}
              <View style={styles.modalHeaderBottomSheet}>
                <Text style={styles.modalTitleBottomSheet}>🛒 Keranjang</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  <TouchableOpacity
                    onPress={clearCart}
                    style={styles.modalIconBtn}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={20}
                      color={colors.error}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowCartModal(false)}
                    style={styles.modalIconBtn}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={20}
                      color={colors.text}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {/* Daftar Item Keranjang */}
                <View style={{ padding: 12 }}>
                  {cart.map((item) => (
                    <View key={item.product_id} style={styles.cartItem}>
                      {item.image_uri ? (
                        <Image
                          source={{ uri: item.image_uri }}
                          style={styles.cartItemImage}
                        />
                      ) : (
                        <View
                          style={[
                            styles.cartItemImage,
                            styles.cartItemImagePlaceholder,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={getPlaceholderIcon(item.category)}
                            size={28}
                            color={getCategoryColor(item.category)}
                            style={{ opacity: 0.35 }}
                          />
                        </View>
                      )}
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName} numberOfLines={1}>
                          {item.product_name}
                        </Text>
                        <Text style={styles.cartItemPrice}>
                          {formatRupiah(item.selling_price)}
                        </Text>
                      </View>
                      <View style={styles.qtyControl}>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            updateQty(item.product_id, item.quantity - 1)
                          }
                        >
                          <MaterialCommunityIcons
                            name="minus"
                            size={14}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtn}
                          onPress={() =>
                            updateQty(item.product_id, item.quantity + 1)
                          }
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={14}
                            color={colors.primary}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Divider */}
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.border,
                    marginHorizontal: 12,
                    marginBottom: 12,
                  }}
                />

                {/* Kalkulasi */}
                <View style={{ paddingHorizontal: 14, gap: 8 }}>
                  {/* Subtotal */}
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal</Text>
                    <Text style={styles.calcValue}>
                      {formatRupiah(totalHarga)}
                    </Text>
                  </View>

                  {/* Total Tagihan */}
                  <View style={styles.grandTotalContainer}>
                    <Text style={styles.grandTotalLabel}>TOTAL TAGIHAN</Text>
                    <Text style={styles.grandTotalValue}>
                      {formatRupiah(grandTotal)}
                    </Text>
                  </View>

                  {/* Diskon */}
                  <Text
                    style={[
                      styles.calcLabel,
                      { fontWeight: "700", marginTop: 4 },
                    ]}
                  >
                    Diskon (Rp)
                  </Text>
                  <TextInput
                    style={styles.cashInputBig}
                    value={discountInput}
                    onChangeText={(text) =>
                      setDiscountInput(formatToRpDisplay(text))
                    }
                    keyboardType="numeric"
                    placeholder="Rp 0"
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Pembayaran */}
                  <Text
                    style={[
                      styles.calcLabel,
                      { fontWeight: "700", marginTop: 8 },
                    ]}
                  >
                    Pembayaran (Uang Diterima)
                  </Text>
                  <TextInput
                    style={styles.cashInputBig}
                    value={cashInput}
                    onChangeText={(text) =>
                      setCashInput(formatToRpDisplay(text))
                    }
                    keyboardType="numeric"
                    placeholder="Rp 50.000"
                    placeholderTextColor={colors.textSecondary}
                  />

                  {/* Quick Amount */}
                  <View style={styles.quickAmountRow}>
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() =>
                        setCashInput(formatToRpDisplay(grandTotal))
                      }
                    >
                      <Text style={styles.quickAmountText}>Uang Pas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setCashInput(formatToRpDisplay(50000))}
                    >
                      <Text style={styles.quickAmountText}>50 Ribu</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickAmountBtn}
                      onPress={() => setCashInput(formatToRpDisplay(100000))}
                    >
                      <Text style={styles.quickAmountText}>100 Ribu</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Kembalian */}
                  {cashReceived > 0 && (
                    <View
                      style={[
                        styles.kembalianBox,
                        {
                          backgroundColor:
                            kembalian >= 0 ? "#D1FAE5" : "#FEE2E2",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          fontWeight: "bold",
                          fontSize: 13,
                          color: kembalian >= 0 ? "#065F46" : "#991B1B",
                        }}
                      >
                        {kembalian >= 0 ? "KEMBALIAN" : "UANG KURANG"}
                      </Text>
                      <Text
                        style={{
                          fontWeight: "bold",
                          fontSize: 20,
                          color: kembalian >= 0 ? "#065F46" : "#991B1B",
                        }}
                      >
                        {formatRupiah(Math.abs(kembalian))}
                      </Text>
                    </View>
                  )}

                  {/* Tombol Bayar */}
                  <TouchableOpacity
                    style={[
                      styles.bayarBtn,
                      {
                        opacity: cashReceived >= grandTotal ? 1 : 0.5,
                        marginTop: 12,
                      },
                    ]}
                    onPress={handleBayar}
                    disabled={cashReceived < grandTotal}
                  >
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color="#fff"
                    />
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
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name="check-circle"
                size={36}
                color="#fff"
              />
              <Text
                style={[
                  styles.successTitle,
                  { color: "#fff", marginTop: 6, fontSize: 18 },
                ]}
              >
                Transaksi Berhasil!
              </Text>
            </View>

            <ScrollView
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            >
              {/* ── Pratinjau Nota (format struk termal) ── */}
              <View style={styles.receiptPaper}>
                <Text style={styles.receiptStoreName}>
                  {storeProfile.storeName || "Toko Kelontong"}
                </Text>
                {!!storeProfile.storeAddress && (
                  <Text style={styles.receiptMetaCenter}>
                    {storeProfile.storeAddress}
                  </Text>
                )}
                {!!storeProfile.storeContact && (
                  <Text style={styles.receiptMetaCenter}>
                    Telp: {storeProfile.storeContact}
                  </Text>
                )}

                <View style={styles.receiptDash} />

                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMeta}>
                    No : {lastTx?.invoice_number}
                  </Text>
                  <Text style={styles.receiptMeta}>{receiptDateStr}</Text>
                </View>

                <View style={styles.receiptDash} />

                {lastTxDetails.map((item, index) => (
                  <View key={index} style={styles.receiptItem}>
                    <Text style={styles.receiptItemName}>
                      {item.product_name}
                    </Text>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMeta}>
                        {item.quantity} x {formatRupiah(item.price_at_sale)}
                      </Text>
                      <Text style={styles.receiptItemTotal}>
                        {formatRupiah(item.quantity * item.price_at_sale)}
                      </Text>
                    </View>
                  </View>
                ))}

                <View style={styles.receiptDash} />

                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMeta}>Subtotal</Text>
                  <Text style={styles.receiptMeta}>
                    {formatRupiah(lastTx?.total_price || 0)}
                  </Text>
                </View>
                {lastTx?.discount_amount > 0 && (
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMeta}>Diskon</Text>
                    <Text style={[styles.receiptMeta, { color: "#DC2626" }]}>
                      -{formatRupiah(lastTx.discount_amount)}
                    </Text>
                  </View>
                )}
                <View style={[styles.receiptMetaRow, { marginTop: 6 }]}>
                  <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                  <Text style={styles.receiptTotalValue}>
                    {formatRupiah(lastTx?.grand_total || 0)}
                  </Text>
                </View>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMeta}>Tunai</Text>
                  <Text style={styles.receiptMeta}>
                    {formatRupiah(lastTx?.cash_received || 0)}
                  </Text>
                </View>
                <View style={styles.receiptMetaRow}>
                  <Text style={styles.receiptMeta}>Kembalian</Text>
                  <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                    {formatRupiah(lastTx?.cash_return || 0)}
                  </Text>
                </View>

                <View style={styles.receiptDash} />

                <Text style={styles.receiptFooter}>
                  {storeProfile.footerMessage ||
                    "Terima kasih telah berbelanja!"}
                </Text>
              </View>
            </ScrollView>

            <View style={styles.successActionsWrap}>
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

              {btPrinterReady && Platform.OS === "android" && (
                <TouchableOpacity
                  style={[
                    styles.successBtn,
                    { backgroundColor: "#0F172A", marginTop: 10 },
                  ]}
                  onPress={handlePrintBluetooth}
                >
                  <MaterialCommunityIcons
                    name="bluetooth"
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.successBtnText}>
                    Cetak Langsung (Printer Bluetooth)
                  </Text>
                </TouchableOpacity>
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

  // Categories - Simple Horizontal Pills
  categoryContainer: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    gap: 6,
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
  categoryPillTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  categoryCountBadge: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  categoryCountBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  categoryCountTextActive: {
    color: "#fff",
  },

  // Category Grid Modal (Centered Card)
  catModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  catModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: "92%",
    maxWidth: 420,
    maxHeight: "75%",
    paddingBottom: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  catModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  catModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  catModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  catModalSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  catModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  catGridItem: {
    width: (width - 32 - 20) / 3,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    position: "relative",
  },
  catGridItemActive: {
    backgroundColor: "#EFF6FF",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  catGridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catGridIconWrapActive: {
    backgroundColor: colors.primary,
  },
  catGridLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 2,
  },
  catGridLabelActive: {
    color: colors.primary,
  },
  catGridCount: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  catGridCountActive: {
    color: colors.primary,
  },
  catGridCheckmark: {
    position: "absolute",
    top: 6,
    right: 6,
  },

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
  productCardImgPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F1F5F9",
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 16,
  },
  cartBottomSheet: {
    backgroundColor: colors.background,
    borderRadius: 24,
    width: "92%",
    maxHeight: "75%",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  modalIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHeaderBottomSheet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalTitleBottomSheet: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
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
  cartItemImagePlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
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
  successActions: { flexDirection: "row", gap: 10 },
  successActionsWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
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
    paddingVertical: 10,
    marginTop: 6,
  },
  successCloseText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: "600",
  },

  // ── Pratinjau Nota (kertas struk termal) ──
  receiptPaper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
  },
  receiptStoreName: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    color: colors.text,
    letterSpacing: 0.5,
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMetaCenter: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  receiptDash: {
    borderBottomWidth: 1,
    borderBottomColor: "#9CA3AF",
    borderStyle: "dashed",
    marginVertical: 10,
  },
  receiptItem: {
    marginBottom: 8,
  },
  receiptItemName: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptItemTotal: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptTotalLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptFooter: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: 2,
    paddingHorizontal: 6,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});

export default KasirScreen;
