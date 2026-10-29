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
import debtRepository from "../database/debtRepository";
import { formatRupiah } from "../utils/helpers";
import {
  generateReceiptHTML,
  generateWAMessage,
  generateKitchenWAMessage,
  generateKitchenReceiptHTML,
} from "../utils/receiptGenerator";
import {
  isPrinterConfigured,
  isBluetoothPrintingSupported,
  printReceiptViaBluetooth,
  printKitchenTicketViaBluetooth,
} from "../utils/bluetoothPrinter";
import { getOfflineQueueCount } from "../utils/offlineQueue";
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
  const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash' | 'qris' | 'transfer' | 'debit' | 'kasbon'
  const [paymentNotes, setPaymentNotes] = useState("");
  // Kasbon Customer States
  const [kasbonCustomerName, setKasbonCustomerName] = useState("");
  const [kasbonCustomerPhone, setKasbonCustomerPhone] = useState("");
  const [kasbonDpInput, setKasbonDpInput] = useState("");
  const [kasbonDueDate, setKasbonDueDate] = useState("");
  const [kasbonNotes, setKasbonNotes] = useState("");

  // F&B (Kafe/Resto) & Offline Queue States
  const [orderType, setOrderType] = useState("dine_in"); // 'dine_in' | 'take_away'
  const [tableNumber, setTableNumber] = useState("");
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncingOffline, setSyncingOffline] = useState(false);
  const isFnbMode = state.businessMode === "fnb";

  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [lastTxDetails, setLastTxDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [storeProfile, setStoreProfile] = useState({});
  const [btPrinterReady, setBtPrinterReady] = useState(false);

  const loadHeldOrders = useCallback(async () => {
    try {
      const data = await AsyncStorage.getItem("@TokoKelontong:HeldOrders");
      if (data) {
        setHeldOrders(JSON.parse(data));
      } else {
        setHeldOrders([]);
      }
    } catch {
      setHeldOrders([]);
    }
  }, []);

  const saveHeldOrders = async (newList) => {
    setHeldOrders(newList);
    await AsyncStorage.setItem(
      "@TokoKelontong:HeldOrders",
      JSON.stringify(newList),
    );
  };

  // Refresh saat screen difokus.
  // Catatan: keranjang TIDAK di-reset saat kehilangan fokus (misal buka
  // scanner barcode) agar belanjaan kasir tidak hilang. Keranjang hanya
  // dikosongkan setelah transaksi sukses atau lewat tombol "Kosongkan".
  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadHeldOrders();
      getOfflineQueueCount().then(setOfflineQueueCount).catch(() => {});
      // Cek apakah printer Bluetooth sudah diatur (untuk tombol cetak langsung)
      if (isBluetoothPrintingSupported()) {
        isPrinterConfigured()
          .then(setBtPrinterReady)
          .catch(() => setBtPrinterReady(false));
      } else {
        setBtPrinterReady(false);
      }
    }, [loadHeldOrders]),
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
        wholesale_rules: product.wholesale_rules || [],
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

  // ── Helper: Cek Aturan Harga Grosir / Bertingkat ──
  const getCartItemPriceInfo = (item) => {
    const product = allProducts.find((p) => p.id === item.product_id);
    const rules = (product?.wholesale_rules || item.wholesale_rules || [])
      .filter((r) => r && r.min_qty && r.price)
      .sort((a, b) => b.min_qty - a.min_qty); // urutkan dari batas tertinggi

    const qty = item.quantity;
    const applicableRule = rules.find((r) => qty >= r.min_qty);

    if (applicableRule) {
      return {
        unitPrice: applicableRule.price,
        isWholesale: true,
        ruleMinQty: applicableRule.min_qty,
        originalPrice: item.selling_price,
      };
    }

    return {
      unitPrice: item.selling_price,
      isWholesale: false,
      ruleMinQty: 0,
      originalPrice: item.selling_price,
    };
  };

  // Kalkulasi
  const totalHarga = cart.reduce((sum, i) => {
    const { unitPrice } = getCartItemPriceInfo(i);
    return sum + unitPrice * i.quantity;
  }, 0);

  // Diskon dibatasi maksimal sebesar subtotal agar tidak ada nilai
  // diskon berlebihan yang ikut tersimpan dan tercetak di nota.
  const diskon = Math.min(parseRpToNumber(discountInput), totalHarga);
  const grandTotal = Math.max(0, totalHarga - diskon);

  // Logika penerimaan uang berdasarkan metode pembayaran
  const isNonCash = paymentMethod !== "cash" && paymentMethod !== "kasbon";
  const cashReceived =
    paymentMethod === "kasbon"
      ? parseRpToNumber(kasbonDpInput)
      : isNonCash
        ? grandTotal
        : parseRpToNumber(cashInput);
  const kembalian =
    paymentMethod === "kasbon" || isNonCash ? 0 : cashReceived - grandTotal;

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
    // Kunci ganda: cegah ketukan cepat menghasilkan dua transaksi.
    if (submitting) return;
    if (cart.length === 0) {
      Alert.alert("Keranjang Kosong", "Pilih produk terlebih dahulu.");
      return;
    }
    if (paymentMethod === "cash" && cashReceived < grandTotal) {
      Alert.alert(
        "Uang Kurang",
        `Uang yang diterima kurang dari total belanja.`,
      );
      return;
    }
    if (paymentMethod === "kasbon") {
      if (!kasbonCustomerName.trim()) {
        Alert.alert(
          "Nama Pelanggan Wajib",
          "Ketik nama pelanggan untuk mencatat hutang / kasbon.",
        );
        return;
      }
      const dp = parseRpToNumber(kasbonDpInput);
      if (dp > grandTotal) {
        Alert.alert(
          "DP Melebihi Total",
          "Uang muka tidak boleh lebih besar dari total tagihan.",
        );
        return;
      }
    }
    setSubmitting(true);
    try {
      // Pastikan data item transaksi memakai harga grosir yang berlaku
      const processedItems = cart.map((i) => {
        const { unitPrice } = getCartItemPriceInfo(i);
        return {
          ...i,
          selling_price: unitPrice,
        };
      });

      const noteToSave =
        paymentMethod === "kasbon"
          ? `Kasbon: ${kasbonCustomerName.trim()}${
              kasbonCustomerPhone ? ` (${kasbonCustomerPhone.trim()})` : ""
            }${paymentNotes ? ` • ${paymentNotes.trim()}` : ""}`
          : paymentNotes;

      const txId = await TransactionRepository.createTransaction(
        processedItems,
        totalHarga,
        diskon,
        grandTotal,
        cashReceived,
        kembalian,
        paymentMethod,
        noteToSave,
        isFnbMode ? orderType : "retail",
        isFnbMode ? tableNumber.trim() : "",
      );

      // Jika kasbon, simpan juga ke buku kasbon / debtRepository
      if (paymentMethod === "kasbon") {
        try {
          const dp = parseRpToNumber(kasbonDpInput);
          const remainingDebt = Math.max(0, grandTotal - dp);
          const createdDebt = await debtRepository.createDebt({
            customer_name: kasbonCustomerName.trim(),
            customer_phone: kasbonCustomerPhone.trim(),
            transaction_id: txId,
            total_debt: grandTotal,
            remaining_debt: remainingDebt,
            due_date: kasbonDueDate.trim() || null,
            notes: kasbonNotes.trim() || "Transaksi Kasir POS",
          });

          // Jika ada DP, catat langsung sebagai cicilan pertama
          if (dp > 0 && createdDebt?.id) {
            await debtRepository.recordPayment(createdDebt.id, {
              payment_amount: dp,
              payment_method: "cash",
              notes: "DP / Uang Muka di Kasir",
            });
          }
        } catch (debtErr) {
          console.warn("Gagal simpan kasbon ke debtRepository:", debtErr);
        }
      }

      // Transaksi sudah tercatat di server: amankan UI dulu
      setShowCartModal(false);
      setCashInput("");
      setDiscountInput("");
      setPaymentNotes("");
      setKasbonCustomerName("");
      setKasbonCustomerPhone("");
      setKasbonDpInput("");
      setKasbonDueDate("");
      setKasbonNotes("");
      setTableNumber("");
      const currentMethod = paymentMethod;
      setPaymentMethod("cash");
      dispatch({ type: "CLEAR_CART" });
      getOfflineQueueCount().then(setOfflineQueueCount).catch(() => {});

      try {
        const fullTx = await TransactionRepository.getTransactionById(txId);
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
            `Metode: ${currentMethod.toUpperCase()}${
              currentMethod === "cash"
                ? ` • Kembalian: ${formatRupiah(kembalian)}`
                : " • Lunas"
            }`,
          );
        }
      } catch (_) {
        Alert.alert(
          "✅ Transaksi Berhasil!",
          `Metode: ${currentMethod.toUpperCase()}${
            currentMethod === "cash"
              ? ` • Kembalian: ${formatRupiah(kembalian)}`
              : " • Lunas"
          }`,
        );
      }

      // Refresh stok di tampilan
      loadProducts();
    } catch (e) {
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSyncOffline = async () => {
    if (syncingOffline) return;
    setSyncingOffline(true);
    try {
      const res = await TransactionRepository.syncOfflineQueue();
      if (res.synced > 0) {
        Alert.alert(
          "✅ Sinkronisasi Berhasil",
          `${res.synced} dari ${res.total} transaksi offline berhasil diunggah ke cloud!`,
        );
      } else if (res.total === 0) {
        Alert.alert("Info", "Semua transaksi sudah tersinkron ke cloud.");
      } else {
        Alert.alert(
          "⚠️ Perhatian",
          `Gagal mengunggah transaksi (${res.failed} gagal). Pastikan koneksi internet stabil lalu coba lagi.`,
        );
      }
      const count = await getOfflineQueueCount();
      setOfflineQueueCount(count);
      loadProducts();
    } catch (e) {
      Alert.alert("Gagal Sinkronisasi", e.message || "Terjadi masalah jaringan.");
    } finally {
      setSyncingOffline(false);
    }
  };

  const handlePrintKitchenBluetooth = async () => {
    if (!lastTx) return;
    try {
      await printKitchenTicketViaBluetooth(lastTx, lastTxDetails, storeProfile);
      Alert.alert("✅ Berhasil", "Struk dapur berhasil dicetak ke printer Bluetooth.");
    } catch (err) {
      Alert.alert("Gagal Cetak Dapur", err.message || "Pastikan printer Bluetooth terhubung.");
    }
  };

  const handleShareKitchenWA = () => {
    if (!lastTx) return;
    const msg = generateKitchenWAMessage(lastTx, lastTxDetails, storeProfile);
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("WhatsApp Tidak Terpasang", "Aplikasi WhatsApp tidak ditemukan di perangkat ini.");
    });
  };

  const handleHoldOrder = () => {
    if (cart.length === 0) {
      Alert.alert("Keranjang Kosong", "Tidak ada barang untuk ditahan.");
      return;
    }
    const orderTitle = `Pesanan #${heldOrders.length + 1} (${cart.reduce((s, i) => s + i.quantity, 0)} item)`;
    const newHeld = {
      id: Date.now().toString(),
      title: orderTitle,
      cart: [...cart],
      discountInput,
      totalHarga,
      grandTotal,
      timestamp: new Date().toISOString(),
    };
    const updated = [newHeld, ...heldOrders];
    saveHeldOrders(updated);
    dispatch({ type: "CLEAR_CART" });
    setDiscountInput("");
    setCashInput("");
    setShowCartModal(false);
    Alert.alert(
      "📌 Pesanan Ditahan",
      `Pesanan berhasil disimpan sementara. Anda dapat memanggilnya kembali dari tombol "Pesanan Ditahan".`,
    );
  };

  const handleRestoreOrder = (order) => {
    const doRestore = () => {
      dispatch({ type: "CLEAR_CART" });
      order.cart.forEach((item) => {
        dispatch({ type: "ADD_TO_CART", payload: item });
        if (item.quantity > 1) {
          dispatch({
            type: "UPDATE_CART_QTY",
            payload: { product_id: item.product_id, quantity: item.quantity },
          });
        }
      });
      if (order.discountInput) {
        setDiscountInput(order.discountInput);
      }
      const updated = heldOrders.filter((o) => o.id !== order.id);
      saveHeldOrders(updated);
      setShowHeldOrdersModal(false);
      setShowCartModal(true);
    };

    if (cart.length > 0) {
      Alert.alert(
        "Ganti Keranjang Aktif?",
        "Keranjang aktif masih memiliki barang belanjaan. Melanjutkan akan menimpa keranjang saat ini.",
        [
          { text: "Batal", style: "cancel" },
          { text: "Lanjutkan", style: "destructive", onPress: doRestore },
        ],
      );
    } else {
      doRestore();
    }
  };

  const handleDeleteHeldOrder = (orderId) => {
    Alert.alert(
      "Hapus Pesanan Ditahan",
      "Apakah Anda yakin ingin membatalkan pesanan tertahan ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: () => {
            const updated = heldOrders.filter((o) => o.id !== orderId);
            saveHeldOrders(updated);
          },
        },
      ],
    );
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
      {/* ── Banner Transaksi Offline Menunggu Sinkron ── */}
      {offlineQueueCount > 0 && (
        <View style={styles.offlineBannerKasir}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={styles.offlineBadgeIcon}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={22} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitle}>
                {offlineQueueCount} Transaksi Offline Belum Terkirim
              </Text>
              <Text style={styles.offlineBannerSub}>
                Tersimpan di HP & siap disinkronkan ke cloud
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.offlineSyncBtnKasir}
            onPress={handleSyncOffline}
            disabled={syncingOffline}
          >
            <Text style={styles.offlineSyncBtnKasirText}>
              {syncingOffline ? "Sinkron..." : "Sinkronkan"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Banner Pesanan Tertahan (Hold Orders) ── */}
      {heldOrders.length > 0 && (
        <TouchableOpacity
          style={styles.heldOrdersBanner}
          onPress={() => setShowHeldOrdersModal(true)}
          activeOpacity={0.8}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              flex: 1,
            }}
          >
            <View style={styles.heldBadgeIcon}>
              <MaterialCommunityIcons
                name="pause-circle"
                size={22}
                color="#B45309"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heldBannerTitle}>
                {heldOrders.length} Pesanan Sedang Ditahan
              </Text>
              <Text style={styles.heldBannerSub}>
                Ketuk untuk membuka kembali transaksi tertunda
              </Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#B45309"
          />
        </TouchableOpacity>
      )}

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
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={handleHoldOrder}
                    style={[styles.modalIconBtn, { backgroundColor: "#FEF3C7" }]}
                    accessibilityLabel="Tahan Pesanan"
                  >
                    <MaterialCommunityIcons
                      name="pause-circle-outline"
                      size={20}
                      color="#B45309"
                    />
                  </TouchableOpacity>
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
                        {(() => {
                          const { unitPrice, isWholesale, ruleMinQty } =
                            getCartItemPriceInfo(item);
                          return (
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 6,
                              }}
                            >
                              <Text
                                style={[
                                  styles.cartItemPrice,
                                  isWholesale && { color: colors.success },
                                ]}
                              >
                                {formatRupiah(unitPrice)}
                              </Text>
                              {isWholesale && (
                                <View style={styles.cartWholesaleBadge}>
                                  <Text style={styles.cartWholesaleBadgeText}>
                                    GROSIR (≥{ruleMinQty})
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })()}
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

                  {/* Mode Kafe / F&B (Meja & Tipe Pesanan) */}
                  {isFnbMode && (
                    <View style={styles.fnbCardBox}>
                      <View style={styles.fnbHeaderRow}>
                        <MaterialCommunityIcons
                          name="silverware-fork-knife"
                          size={16}
                          color="#B45309"
                        />
                        <Text style={styles.fnbCardTitle}>
                          INFORMASI PESANAN RESTO / KAFE
                        </Text>
                      </View>

                      <View style={styles.fnbTypeRow}>
                        <TouchableOpacity
                          style={[
                            styles.fnbTypeBtn,
                            orderType === "dine_in" && styles.fnbTypeBtnActive,
                          ]}
                          onPress={() => setOrderType("dine_in")}
                        >
                          <MaterialCommunityIcons
                            name="table-chair"
                            size={16}
                            color={orderType === "dine_in" ? "#FFFFFF" : "#475569"}
                          />
                          <Text
                            style={[
                              styles.fnbTypeBtnText,
                              orderType === "dine_in" && styles.fnbTypeBtnTextActive,
                            ]}
                          >
                            Dine In (Makan di Tempat)
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.fnbTypeBtn,
                            orderType === "take_away" && styles.fnbTypeBtnActive,
                          ]}
                          onPress={() => setOrderType("take_away")}
                        >
                          <MaterialCommunityIcons
                            name="bag-personal-outline"
                            size={16}
                            color={orderType === "take_away" ? "#FFFFFF" : "#475569"}
                          />
                          <Text
                            style={[
                              styles.fnbTypeBtnText,
                              orderType === "take_away" && styles.fnbTypeBtnTextActive,
                            ]}
                          >
                            Take Away (Bungkus)
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text
                        style={[
                          styles.calcLabel,
                          { fontWeight: "700", marginTop: 10 },
                        ]}
                      >
                        Nomor / Nama Meja
                      </Text>
                      <TextInput
                        style={styles.cashInputBig}
                        value={tableNumber}
                        onChangeText={setTableNumber}
                        placeholder="Contoh: Meja 05 / VIP / Bar"
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  )}

                  {/* Pilihan Metode Pembayaran */}
                  <Text
                    style={[
                      styles.calcLabel,
                      { fontWeight: "700", marginTop: 12 },
                    ]}
                  >
                    Metode Pembayaran
                  </Text>
                  <View style={styles.paymentMethodRow}>
                    {[
                      { key: "cash", label: "Tunai", icon: "cash" },
                      { key: "qris", label: "QRIS", icon: "qrcode-scan" },
                      { key: "transfer", label: "Transfer", icon: "bank-transfer" },
                      { key: "debit", label: "Debit", icon: "credit-card-outline" },
                      { key: "kasbon", label: "Kasbon", icon: "book-account-outline" },
                    ].map((m) => {
                      const isActive = paymentMethod === m.key;
                      return (
                        <TouchableOpacity
                          key={m.key}
                          style={[
                            styles.paymentMethodBtn,
                            isActive && styles.paymentMethodBtnActive,
                          ]}
                          onPress={() => {
                            setPaymentMethod(m.key);
                            if (m.key !== "cash" && m.key !== "kasbon") {
                              setCashInput(formatToRpDisplay(grandTotal));
                            }
                          }}
                        >
                          <MaterialCommunityIcons
                            name={m.icon}
                            size={16}
                            color={isActive ? "#FFFFFF" : colors.text}
                          />
                          <Text
                            style={[
                              styles.paymentMethodText,
                              isActive && styles.paymentMethodTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Konten Sesuai Metode Pembayaran */}
                  {paymentMethod === "cash" ? (
                    <>
                      {/* Pembayaran Uang Tunai */}
                      <Text
                        style={[
                          styles.calcLabel,
                          { fontWeight: "700", marginTop: 10 },
                        ]}
                      >
                        Uang Tunai Diterima
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
                    </>
                  ) : paymentMethod === "qris" ? (
                    <View style={styles.nonCashCard}>
                      <View style={styles.nonCashIconRow}>
                        <MaterialCommunityIcons
                          name="qrcode-scan"
                          size={28}
                          color="#0284C7"
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.nonCashCardTitle}>
                            Pembayaran QRIS
                          </Text>
                          <Text style={styles.nonCashCardSub}>
                            Tunjukkan QRIS toko ke pembeli. Pastikan notifikasi dana masuk telah terverifikasi sebelum menyelesaikan transaksi.
                          </Text>
                        </View>
                      </View>
                      <View style={styles.nonCashAmountBadge}>
                        <Text style={styles.nonCashAmountLabel}>Total Tagihan:</Text>
                        <Text style={styles.nonCashAmountValue}>
                          {formatRupiah(grandTotal)}
                        </Text>
                      </View>
                    </View>
                  ) : paymentMethod === "kasbon" ? (
                    <View style={styles.kasbonBox}>
                      <View style={styles.kasbonHeader}>
                        <MaterialCommunityIcons
                          name="book-account-outline"
                          size={20}
                          color="#B45309"
                        />
                        <Text style={styles.kasbonTitle}>
                          PENCATATAN KASBON / HUTANG
                        </Text>
                      </View>
                      <Text style={styles.kasbonSub}>
                        Pesanan ini akan otomatis masuk ke Buku Kasbon pelanggan.
                      </Text>

                      <Text style={styles.calcLabel}>Nama Pelanggan *</Text>
                      <TextInput
                        style={styles.cashInputBig}
                        value={kasbonCustomerName}
                        onChangeText={setKasbonCustomerName}
                        placeholder="Contoh: Pak Budi / Bu Siti"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <Text style={styles.calcLabel}>No. WhatsApp / HP (Opsional)</Text>
                      <TextInput
                        style={styles.cashInputBig}
                        value={kasbonCustomerPhone}
                        onChangeText={setKasbonCustomerPhone}
                        keyboardType="phone-pad"
                        placeholder="08123456789"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <Text style={styles.calcLabel}>
                        DP / Uang Muka Dibayar Kasir (Rp)
                      </Text>
                      <TextInput
                        style={styles.cashInputBig}
                        value={kasbonDpInput}
                        onChangeText={(t) => setKasbonDpInput(formatToRpDisplay(t))}
                        keyboardType="numeric"
                        placeholder="Rp 0 (Jika belum bayar sama sekali)"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <View style={styles.sisaKasbonRow}>
                        <Text style={styles.sisaKasbonLabel}>
                          Sisa Masuk Buku Hutang:
                        </Text>
                        <Text style={styles.sisaKasbonVal}>
                          {formatRupiah(
                            Math.max(
                              0,
                              grandTotal - parseRpToNumber(kasbonDpInput),
                            ),
                          )}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.nonCashCard}>
                      <View style={styles.nonCashIconRow}>
                        <MaterialCommunityIcons
                          name={
                            paymentMethod === "transfer"
                              ? "bank-transfer"
                              : "credit-card-outline"
                          }
                          size={28}
                          color="#4F46E5"
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.nonCashCardTitle}>
                            {paymentMethod === "transfer"
                              ? "Transfer Bank"
                              : "Kartu Debit / Mesin EDC"}
                          </Text>
                          <Text style={styles.nonCashCardSub}>
                            Nominal transaksi pas: {formatRupiah(grandTotal)}
                          </Text>
                        </View>
                      </View>
                      <TextInput
                        style={[styles.cashInputBig, { marginTop: 10, fontSize: 13, height: 44 }]}
                        value={paymentNotes}
                        onChangeText={setPaymentNotes}
                        placeholder={
                          paymentMethod === "transfer"
                            ? "Catatan bank / nama pengirim (opsional)"
                            : "Nama bank / referensi EDC (opsional)"
                        }
                        placeholderTextColor={colors.textSecondary}
                      />
                    </View>
                  )}

                  {/* Tombol Bayar */}
                  <TouchableOpacity
                    style={[
                      styles.bayarBtn,
                      {
                        opacity:
                          (paymentMethod !== "cash" || cashReceived >= grandTotal) &&
                          !submitting
                            ? 1
                            : 0.5,
                        marginTop: 14,
                      },
                    ]}
                    onPress={handleBayar}
                    disabled={
                      (paymentMethod === "cash" && cashReceived < grandTotal) ||
                      submitting
                    }
                  >
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.bayarText}>
                      {paymentMethod === "cash"
                        ? "SELESAIKAN TRANSAKSI"
                        : `SELESAIKAN ${paymentMethod.toUpperCase()} (${formatRupiah(grandTotal)})`}
                    </Text>
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
                backgroundColor: lastTx?.is_offline ? "#D97706" : colors.primary,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name={lastTx?.is_offline ? "cloud-off-outline" : "check-circle"}
                size={36}
                color="#fff"
              />
              <Text
                style={[
                  styles.successTitle,
                  { color: "#fff", marginTop: 6, fontSize: 18 },
                ]}
              >
                {lastTx?.is_offline ? "Disimpan Offline!" : "Transaksi Berhasil!"}
              </Text>
              {lastTx?.is_offline && (
                <Text
                  style={{
                    color: "#FEF3C7",
                    fontSize: 11,
                    fontFamily: fonts.medium,
                    marginTop: 2,
                  }}
                >
                  Tersimpan di antrean lokal & siap dicetak
                </Text>
              )}
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
                {!!(lastTx?.table_number || (lastTx?.order_type && lastTx?.order_type !== "retail")) && (
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMeta}>
                      Meja : {lastTx?.table_number || "-"}
                    </Text>
                    <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                      {lastTx?.order_type === "dine_in" ? "Dine In" : "Take Away"}
                    </Text>
                  </View>
                )}

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
                {(!lastTx?.payment_method ||
                lastTx.payment_method === "cash" ||
                lastTx.payment_method === "tunai") ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMeta}>Metode Pembayaran</Text>
                      <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                        {lastTx.payment_method.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMeta}>Status</Text>
                      <Text
                        style={[
                          styles.receiptMeta,
                          { fontWeight: "bold", color: "#059669" },
                        ]}
                      >
                        LUNAS
                      </Text>
                    </View>
                  </>
                )}

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

              {isFnbMode && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.successBtn, { flex: 1, backgroundColor: "#D97706" }]}
                    onPress={handlePrintKitchenBluetooth}
                  >
                    <MaterialCommunityIcons
                      name="silverware-fork-knife"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.successBtnText}>Struk Dapur</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.successBtn, { flex: 1, backgroundColor: "#15803D" }]}
                    onPress={handleShareKitchenWA}
                  >
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.successBtnText}>WA Dapur</Text>
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

      {/* ── Modal Pesanan Ditahan (Held Orders Modal) ── */}
      <Modal
        visible={showHeldOrdersModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowHeldOrdersModal(false)}
      >
        <TouchableOpacity
          style={styles.catModalOverlay}
          activeOpacity={1}
          onPress={() => setShowHeldOrdersModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.catModalCard, { maxHeight: "80%" }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.catModalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={[
                    styles.catModalIconWrap,
                    { backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="pause-circle-outline"
                    size={22}
                    color="#B45309"
                  />
                </View>
                <View>
                  <Text style={styles.catModalTitle}>Pesanan Tertahan</Text>
                  <Text style={styles.catModalSubtitle}>
                    {heldOrders.length} transaksi tersimpan
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowHeldOrdersModal(false)}
                style={styles.catModalCloseBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* List */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380, marginTop: 4 }}
            >
              {heldOrders.length === 0 ? (
                <View style={{ padding: 28, alignItems: "center" }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    Tidak ada pesanan yang ditahan.
                  </Text>
                </View>
              ) : (
                heldOrders.map((order) => (
                  <View key={order.id} style={styles.heldOrderItemCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heldOrderCardTitle}>
                        {order.title}
                      </Text>
                      <Text style={styles.heldOrderCardSub}>
                        {new Date(order.timestamp).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        • {order.cart?.length || 0} barang
                      </Text>
                      <Text style={styles.heldOrderCardTotal}>
                        {formatRupiah(order.grandTotal || 0)}
                      </Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <TouchableOpacity
                        style={styles.heldOrderDeleteBtn}
                        onPress={() => handleDeleteHeldOrder(order.id)}
                      >
                        <MaterialCommunityIcons
                          name="trash-can-outline"
                          size={18}
                          color={colors.error}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.heldOrderRestoreBtn}
                        onPress={() => handleRestoreOrder(order)}
                      >
                        <Text style={styles.heldOrderRestoreText}>Buka</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
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

  // ─── Held Orders & Payment Method Styles ───
  heldOrdersBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: -4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  heldBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FDE68A",
    justifyContent: "center",
    alignItems: "center",
  },
  heldBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#92400E",
  },
  heldBannerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  heldOrderItemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  heldOrderCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  heldOrderCardSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  heldOrderCardTotal: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.primary,
    marginTop: 4,
  },
  heldOrderDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  heldOrderRestoreBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  heldOrderRestoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },

  // Payment Methods
  paymentMethodRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  paymentMethodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  paymentMethodBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentMethodText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.text,
  },
  paymentMethodTextActive: {
    color: "#FFFFFF",
  },
  nonCashCard: {
    backgroundColor: "#F0F9FF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAE6FD",
    padding: 14,
    marginTop: 10,
  },
  nonCashIconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  nonCashCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0369A1",
  },
  nonCashCardSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#0284C7",
    marginTop: 2,
    lineHeight: 16,
  },
  nonCashAmountBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E0F2FE",
  },
  nonCashAmountLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#0369A1",
  },
  nonCashAmountValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0369A1",
  },

  // Wholesale badge in cart
  cartWholesaleBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  cartWholesaleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#16A34A",
  },

  // Kasbon form box
  kasbonBox: {
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    marginTop: 10,
  },
  kasbonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  kasbonTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#92400E",
    letterSpacing: 0.5,
  },
  kasbonSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#B45309",
    marginBottom: 8,
  },
  sisaKasbonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  sisaKasbonLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#92400E",
  },
  sisaKasbonVal: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: "#DC2626",
  },

  // Offline banner Kasir
  offlineBannerKasir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: -2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  offlineBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF3C7",
    justifyContent: "center",
    alignItems: "center",
  },
  offlineBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#92400E",
  },
  offlineBannerSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  offlineSyncBtnKasir: {
    backgroundColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  offlineSyncBtnKasirText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#FFFFFF",
  },

  // F&B box in Cart Modal
  fnbCardBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    padding: 14,
    marginTop: 6,
    marginBottom: 4,
  },
  fnbHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  fnbCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#166534",
    letterSpacing: 0.5,
  },
  fnbTypeRow: {
    flexDirection: "row",
    gap: 8,
  },
  fnbTypeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  fnbTypeBtnActive: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A",
  },
  fnbTypeBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#475569",
  },
  fnbTypeBtnTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },
});

export default KasirScreen;
