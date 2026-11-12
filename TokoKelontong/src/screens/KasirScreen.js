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
import { refreshSyncCounts, syncNow } from "../services/syncService";
import useSyncStatus from "../hooks/useSyncStatus";
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
  const syncStatus = useSyncStatus();
  const offlineQueueCount = syncStatus.unsynced;
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
      refreshSyncCounts();
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

  const applyProducts = (products) => {
    setAllProducts(products);
    const uniqueCats = Array.from(
      new Set(products.map((p) => p.category).filter(Boolean)),
    );
    setCategories(["Semua", ...uniqueCats]);
  };

  // Cache-first: katalog lokal tampil seketika (tanpa menunggu internet),
  // lalu sinkronisasi di latar belakang menyegarkan stok & produk.
  const loadProducts = async () => {
    try {
      const cached = await ProductRepository.getCachedProducts();
      if (cached.length > 0) {
        applyProducts(cached);
      } else {
        // Belum ada katalog lokal (pertama kali): ambil dari server
        applyProducts(await ProductRepository.getAllProducts());
      }
    } catch (e) {
      console.log("Error loading products", e);
    }

    syncNow({ catalogMaxAgeMs: 60000 })
      .then(async () => {
        const fresh = await ProductRepository.getCachedProducts();
        if (fresh.length > 0) applyProducts(fresh);
      })
      .catch(() => {});
  };

  // Muat ulang stok dari penyimpanan lokal (tanpa unduh dari server).
  const reloadProductsFromCache = async () => {
    const cached = await ProductRepository.getCachedProducts();
    if (cached.length > 0) applyProducts(cached);
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
    // K-03: stok minus selalu diizinkan, penjualan tidak ditolak karena stok.
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
    // K-03: stok minus diizinkan, tidak ada batas qty berdasarkan stok.
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
      refreshSyncCounts();

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

      // Refresh stok di tampilan. Penjualan lokal sudah mengurangi stok efektif
      // di penyimpanan lokal; kasbon (langsung ke server) perlu unduh ulang.
      if (currentMethod === "kasbon") {
        syncNow({ forceCatalog: true })
          .then(reloadProductsFromCache)
          .catch(() => {});
      } else {
        reloadProductsFromCache().catch(() => {});
      }
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
      await refreshSyncCounts();
      reloadProductsFromCache().catch(() => {});
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
      <View
        style={[
          styles.productCard,
          qtyInCart > 0 && styles.productCardActive,
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => addToCart(item)}
          style={styles.productCardTouchArea}
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
                  size={48}
                  color={getCategoryColor(item.category)}
                  style={{ opacity: 0.35 }}
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
                <Text style={styles.gridQtyBadgeText}>{qtyInCart}x</Text>
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
          </View>
        </TouchableOpacity>

        <View style={styles.productCardBottomRow}>
          <Text
            style={[
              styles.productCardStock,
              { color: lowStock ? colors.error : colors.textSecondary },
            ]}
          >
            {isOutOfStock
              ? `Stok: ${item.stock_quantity}`
              : lowStock
                ? `Sisa ${item.stock_quantity}`
                : `Stok: ${item.stock_quantity}`}
          </Text>

          {qtyInCart === 0 ? (
            <TouchableOpacity
              style={styles.cardAddBtn}
              onPress={() => addToCart(item)}
              activeOpacity={0.7}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialCommunityIcons
                name="plus"
                size={16}
                color={colors.primary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={styles.qtyBtnSmall}
                onPress={() => updateQty(item.id, qtyInCart - 1)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={13}
                  color={colors.error}
                />
              </TouchableOpacity>
              <Text style={styles.qtyTextSmall}>{qtyInCart}</Text>
              <TouchableOpacity
                style={styles.qtyBtnSmallPlus}
                onPress={() => updateQty(item.id, qtyInCart + 1)}
                activeOpacity={0.7}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={13}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Banner Transaksi Offline Menunggu Sinkron ── */}
      {offlineQueueCount > 0 && !syncStatus.syncing && (
        <View style={styles.offlineBannerKasir}>
          <TouchableOpacity
            style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}
            onPress={() => navigation.navigate("TransaksiPending")}
            activeOpacity={0.7}
          >
            <View style={styles.offlineBadgeIcon}>
              <MaterialCommunityIcons name="cloud-sync-outline" size={22} color="#B45309" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.offlineBannerTitle}>
                {offlineQueueCount} Transaksi Belum Terkirim
              </Text>
              <Text style={styles.offlineBannerSub}>
                {syncStatus.needsReview > 0
                  ? `${syncStatus.needsReview} perlu ditinjau • tetap aman di HP`
                  : syncStatus.offline
                    ? "Tidak ada internet • tersimpan aman di HP"
                    : "Tersimpan di HP & akan dikirim otomatis"}
              </Text>
            </View>
          </TouchableOpacity>
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

      {/* ── Search Bar Modern & Barcode Quick Scan ── */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color="#64748B"
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama barang atau barcode..."
          placeholderTextColor="#94A3B8"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={{ marginRight: 8 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color="#94A3B8"
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.searchScanBtn}
          onPress={openBarcodeScanner}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="barcode-scan"
            size={18}
            color="#FFFFFF"
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

      {/* ── Grid Produk Responsif ── */}
      <FlatList
        key={isTablet ? "tablet-grid" : "phone-grid"}
        style={{ flex: 1 }}
        data={displayedProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderProductGrid}
        numColumns={isTablet ? 3 : 2}
        contentContainerStyle={[
          styles.productGrid,
          { paddingBottom: 16 },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <MaterialCommunityIcons
                name="package-variant"
                size={48}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.emptyTitle}>Tidak ada produk ditemukan</Text>
            <Text style={styles.emptySub}>
              Coba cari dengan kata kunci lain atau pilih kategori Semua.
            </Text>
          </View>
        }
      />

      {/* ── Docked Bottom Checkout Bar (Aman dari Tombol Navigasi Android Back/Home) ── */}
      <View
        style={[
          styles.dockedBottomBar,
          {
            paddingBottom:
              Platform.OS === "android"
                ? Math.max(insets.bottom, 16) + 10
                : Math.max(insets.bottom, 14),
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.dockedBarBtn,
            cart.length === 0 ? styles.dockedBarBtnEmpty : styles.dockedBarBtnActive,
          ]}
          onPress={() => cart.length > 0 && setShowCartModal(true)}
          disabled={cart.length === 0}
          activeOpacity={0.88}
        >
          <View style={styles.dockedBarLeft}>
            <View
              style={[
                styles.dockedCartBadge,
                cart.length > 0 ? styles.dockedCartBadgeActive : styles.dockedCartBadgeEmpty,
              ]}
            >
              <MaterialCommunityIcons
                name="cart-outline"
                size={22}
                color={cart.length > 0 ? "#FFFFFF" : "#475569"}
              />
              {cart.length > 0 && (
                <View style={styles.dockedCountBubble}>
                  <Text style={styles.dockedCountText}>
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </Text>
                </View>
              )}
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text
                style={[
                  styles.dockedBarTotal,
                  cart.length === 0 ? styles.dockedBarTotalMuted : styles.dockedBarTotalActive,
                ]}
                numberOfLines={1}
              >
                {cart.length === 0
                  ? "Keranjang Kosong"
                  : formatRupiah(grandTotal || totalHarga)}
              </Text>
              <Text
                style={[
                  styles.dockedBarSub,
                  cart.length === 0 ? styles.dockedBarSubMuted : styles.dockedBarSubActive,
                ]}
                numberOfLines={1}
              >
                {cart.length === 0
                  ? "Pilih produk di atas untuk memulai"
                  : `${cart.length} item • Ketuk untuk bayar`}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.dockedActionPill,
              cart.length > 0 ? styles.dockedActionPillActive : styles.dockedActionPillEmpty,
            ]}
          >
            <Text
              style={[
                styles.dockedActionText,
                cart.length > 0 ? styles.dockedActionTextActive : styles.dockedActionTextEmpty,
              ]}
            >
              {cart.length === 0 ? "Pilih Menu" : "Bayar"}
            </Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={18}
              color={cart.length > 0 ? "#FFFFFF" : "#64748B"}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Modal Keranjang & Checkout (Modern Clean Bottom Sheet) ── */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlayCart}>
            <View style={styles.cartBottomSheet}>
              {/* Handle Bar */}
              <View style={styles.modalSheetHandle} />

              {/* Header */}
              <View style={styles.modalHeaderBottomSheet}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={styles.modalHeaderIconBadge}>
                    <MaterialCommunityIcons
                      name="cart-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View>
                    <Text style={styles.modalTitleBottomSheet}>
                      Keranjang Belanja
                    </Text>
                    <Text style={styles.modalSubBottomSheet}>
                      {cart.length} macam barang • {cart.reduce((s, i) => s + i.quantity, 0)} item
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={handleHoldOrder}
                    style={styles.modalHeaderActionBtnAmber}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="pause-circle-outline"
                      size={16}
                      color="#B45309"
                    />
                    <Text style={styles.modalHeaderActionTextAmber}>Tahan</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={clearCart}
                    style={styles.modalHeaderActionBtnRed}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={16}
                      color="#EF4444"
                    />
                    <Text style={styles.modalHeaderActionTextRed}>Hapus</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowCartModal(false)}
                    style={styles.modalCloseBtn}
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Scrollable Content Body */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24 }}
              >
                {/* Daftar Item Keranjang */}
                <View style={styles.cartItemListContainer}>
                  {cart.map((item) => (
                    <View key={item.product_id} style={styles.cartItem}>
                      {item.image_uri ? (
                        <Image
                          source={{ uri: item.image_uri }}
                          style={styles.cartItemImage}
                        />
                      ) : (
                        <View style={styles.cartItemImagePlaceholder}>
                          <MaterialCommunityIcons
                            name={getPlaceholderIcon(item.category)}
                            size={24}
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
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                              <Text
                                style={[
                                  styles.cartItemPrice,
                                  isWholesale && { color: "#059669" },
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
                      <View style={styles.qtyControlModal}>
                        <TouchableOpacity
                          style={styles.qtyBtnModal}
                          onPress={() => updateQty(item.product_id, item.quantity - 1)}
                        >
                          <MaterialCommunityIcons
                            name="minus"
                            size={14}
                            color={colors.error}
                          />
                        </TouchableOpacity>
                        <Text style={styles.qtyTextModal}>{item.quantity}</Text>
                        <TouchableOpacity
                          style={styles.qtyBtnModal}
                          onPress={() => updateQty(item.product_id, item.quantity + 1)}
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

                {/* Card Kalkulasi (Subtotal → Diskon → Total Tagihan) */}
                <View style={styles.calcBreakdownCard}>
                  <View style={styles.calcRowBreakdown}>
                    <Text style={styles.calcLabelBreakdown}>Subtotal Belanja</Text>
                    <Text style={styles.calcValueBreakdown}>
                      {formatRupiah(totalHarga)}
                    </Text>
                  </View>

                  <View style={styles.diskonRowBreakdown}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MaterialCommunityIcons
                        name="ticket-percent-outline"
                        size={16}
                        color="#64748B"
                      />
                      <Text style={styles.calcLabelBreakdown}>Diskon (Rp)</Text>
                    </View>
                    <TextInput
                      style={styles.diskonInputBox}
                      value={discountInput}
                      onChangeText={(text) => setDiscountInput(formatToRpDisplay(text))}
                      keyboardType="numeric"
                      placeholder="Rp 0"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={styles.calcDividerLine} />

                  <View style={styles.grandTotalHighlightRow}>
                    <View>
                      <Text style={styles.grandTotalHighlightTitle}>TOTAL TAGIHAN</Text>
                      <Text style={styles.grandTotalHighlightSub}>
                        {cart.length} item • Bebas biaya admin
                      </Text>
                    </View>
                    <Text style={styles.grandTotalHighlightAmount}>
                      {formatRupiah(grandTotal)}
                    </Text>
                  </View>
                </View>

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
                        INFORMASI MEJA RESTO / KAFE
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

                    <Text style={[styles.fieldLabelModal, { marginTop: 10 }]}>
                      Nomor / Nama Meja
                    </Text>
                    <TextInput
                      style={styles.fnbTableInput}
                      value={tableNumber}
                      onChangeText={setTableNumber}
                      placeholder="Contoh: Meja 05 / VIP / Bar"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}

                {/* Pilihan Metode Pembayaran (Segmented Pills 2 Baris Rapi) */}
                <Text style={styles.fieldLabelModal}>Metode Pembayaran</Text>
                <View style={styles.paymentMethodGrid}>
                  {[
                    { key: "cash", label: "Tunai", icon: "cash-multiple" },
                    { key: "qris", label: "QRIS", icon: "qrcode-scan" },
                    { key: "transfer", label: "Transfer", icon: "bank-transfer" },
                    { key: "debit", label: "Debit/EDC", icon: "credit-card-outline" },
                    { key: "kasbon", label: "Kasbon", icon: "book-account-outline" },
                  ].map((m) => {
                    const isActive = paymentMethod === m.key;
                    return (
                      <TouchableOpacity
                        key={m.key}
                        style={[
                          styles.paymentMethodPill,
                          isActive && styles.paymentMethodPillActive,
                        ]}
                        onPress={() => {
                          setPaymentMethod(m.key);
                          if (m.key !== "cash" && m.key !== "kasbon") {
                            setCashInput(formatToRpDisplay(grandTotal));
                          }
                        }}
                        activeOpacity={0.8}
                      >
                        <MaterialCommunityIcons
                          name={m.icon}
                          size={17}
                          color={isActive ? "#FFFFFF" : "#475569"}
                        />
                        <Text
                          style={[
                            styles.paymentMethodPillText,
                            isActive && styles.paymentMethodPillTextActive,
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
                  <View style={styles.cashSectionBox}>
                    <Text style={styles.fieldLabelModal}>Uang Tunai Diterima</Text>
                    <TextInput
                      style={styles.cashInputLarge}
                      value={cashInput}
                      onChangeText={(text) => setCashInput(formatToRpDisplay(text))}
                      keyboardType="numeric"
                      placeholder="Rp 0"
                      placeholderTextColor="#94A3B8"
                    />

                    {/* Quick Cash Buttons */}
                    <View style={styles.quickCashGrid}>
                      <TouchableOpacity
                        style={[styles.quickCashBtn, { backgroundColor: "#F1F5F9" }]}
                        onPress={() => setCashInput(formatToRpDisplay(grandTotal))}
                      >
                        <Text style={[styles.quickCashText, { color: colors.primary }]}>
                          Uang Pas
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickCashBtn}
                        onPress={() =>
                          setCashInput(
                            formatToRpDisplay(
                              grandTotal <= 20000 ? 20000 : 50000,
                            ),
                          )
                        }
                      >
                        <Text style={styles.quickCashText}>
                          {grandTotal <= 20000 ? "20 Ribu" : "50 Ribu"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickCashBtn}
                        onPress={() => setCashInput(formatToRpDisplay(100000))}
                      >
                        <Text style={styles.quickCashText}>100 Ribu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.quickCashBtn}
                        onPress={() => setCashInput(formatToRpDisplay(200000))}
                      >
                        <Text style={styles.quickCashText}>200 Ribu</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Kembalian Status Box */}
                    {cashReceived >= grandTotal && grandTotal > 0 ? (
                      <View style={styles.kembalianBoxSuccess}>
                        <View>
                          <Text style={styles.kembalianLabelSuccess}>
                            {kembalian === 0 ? "STATUS PEMBAYARAN" : "KEMBALIAN KASIR"}
                          </Text>
                          <Text style={styles.kembalianValueSuccess}>
                            {kembalian === 0 ? "UANG PAS (LUNAS)" : formatRupiah(kembalian)}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={24}
                          color="#059669"
                        />
                      </View>
                    ) : cashReceived > 0 ? (
                      <View style={styles.kembalianBoxError}>
                        <View>
                          <Text style={styles.kembalianLabelError}>UANG KURANG</Text>
                          <Text style={styles.kembalianValueError}>
                            {formatRupiah(grandTotal - cashReceived)}
                          </Text>
                        </View>
                        <MaterialCommunityIcons
                          name="alert-circle"
                          size={24}
                          color="#DC2626"
                        />
                      </View>
                    ) : (
                      <View style={styles.kembalianBoxNeutral}>
                        <MaterialCommunityIcons
                          name="information-outline"
                          size={18}
                          color="#64748B"
                        />
                        <Text style={styles.kembalianTextNeutral}>
                          Ketik uang diterima atau tekan tombol Uang Pas di atas.
                        </Text>
                      </View>
                    )}
                  </View>
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
                          Tunjukkan QRIS toko ke pembeli. Pastikan notifikasi dana masuk telah terverifikasi.
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

                    <Text style={styles.fieldLabelModal}>Nama Pelanggan *</Text>
                    <TextInput
                      style={styles.fnbTableInput}
                      value={kasbonCustomerName}
                      onChangeText={setKasbonCustomerName}
                      placeholder="Contoh: Pak Budi / Bu Siti"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={styles.fieldLabelModal}>No. WhatsApp / HP (Opsional)</Text>
                    <TextInput
                      style={styles.fnbTableInput}
                      value={kasbonCustomerPhone}
                      onChangeText={setKasbonCustomerPhone}
                      keyboardType="phone-pad"
                      placeholder="08123456789"
                      placeholderTextColor="#94A3B8"
                    />

                    <Text style={styles.fieldLabelModal}>
                      DP / Uang Muka Dibayar Sekarang (Rp)
                    </Text>
                    <TextInput
                      style={styles.fnbTableInput}
                      value={kasbonDpInput}
                      onChangeText={(t) => setKasbonDpInput(formatToRpDisplay(t))}
                      keyboardType="numeric"
                      placeholder="Rp 0"
                      placeholderTextColor="#94A3B8"
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
                      style={[styles.fnbTableInput, { marginTop: 10, fontSize: 13, height: 44 }]}
                      value={paymentNotes}
                      onChangeText={setPaymentNotes}
                      placeholder={
                        paymentMethod === "transfer"
                          ? "Catatan bank / nama pengirim (opsional)"
                          : "Nama bank / referensi EDC (opsional)"
                      }
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                )}
              </ScrollView>

              {/* ── Docked Bottom Action Button ── */}
              <View style={styles.modalFooterDock}>
                {(() => {
                  const isCashValid = paymentMethod !== "cash" || cashReceived >= grandTotal;
                  const isKasbonValid =
                    paymentMethod !== "kasbon" || kasbonCustomerName.trim().length > 0;
                  const canSubmit = cart.length > 0 && isCashValid && isKasbonValid && !submitting;

                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalBayarBtn,
                        !canSubmit && styles.modalBayarBtnDisabled,
                      ]}
                      onPress={handleBayar}
                      disabled={!canSubmit}
                      activeOpacity={0.9}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={20}
                            color="#FFFFFF"
                          />
                          <Text style={styles.modalBayarText}>
                            {!isCashValid
                              ? `Uang Kurang (${formatRupiah(grandTotal - cashReceived)})`
                              : paymentMethod === "cash"
                                ? `SELESAIKAN TRANSAKSI (${formatRupiah(grandTotal)})`
                                : `BAYAR ${paymentMethod.toUpperCase()} (${formatRupiah(grandTotal)})`}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </View>
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
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    paddingVertical: 0,
  },
  searchScanBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },
  categoryCountBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  categoryCountBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  categoryCountText: {
    fontSize: 10,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
  },
  categoryCountTextActive: {
    color: "#FFFFFF",
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

  // Grid Produk
  productGrid: {
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 110,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    maxWidth: isTablet ? "31%" : "48%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  productCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  productCardImg: {
    height: 114,
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
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridCategoryBadgeText: {
    fontSize: 9,
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  gridQtyBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  gridQtyBadgeText: {
    fontSize: 10,
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },
  productCardTouchArea: {
    width: "100%",
  },
  productCardInfo: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 2,
  },
  productCardName: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 17,
    minHeight: 34,
  },
  productCardPrice: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: colors.primary,
  },
  productCardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingBottom: 10,
    paddingTop: 4,
    minHeight: 34,
  },
  productCardStock: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
  },
  cardAddBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    padding: 2,
  },
  qtyBtnSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  qtyBtnSmallPlus: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTextSmall: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.text,
    minWidth: 20,
    textAlign: "center",
    paddingHorizontal: 3,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    marginTop: 48,
    paddingHorizontal: 32,
  },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    textAlign: "center",
    marginBottom: 4,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },

  // Docked Bottom Checkout Bar (Modern POS Standard)
  dockedBottomBar: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  dockedBarBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dockedBarBtnEmpty: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  dockedBarBtnActive: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  dockedBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  dockedCartBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  dockedCartBadgeEmpty: {
    backgroundColor: "#EDF2F7",
  },
  dockedCartBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  dockedCountBubble: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  dockedCountText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  dockedBarTotal: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  dockedBarTotalMuted: {
    color: "#1E293B",
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  dockedBarTotalActive: {
    color: "#FFFFFF",
  },
  dockedBarSub: {
    fontSize: 11,
    marginTop: 2,
  },
  dockedBarSubMuted: {
    color: "#64748B",
    fontFamily: fonts.medium,
  },
  dockedBarSubActive: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fonts.medium,
  },
  dockedActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  dockedActionPillEmpty: {
    backgroundColor: "#E2E8F0",
  },
  dockedActionPillActive: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dockedActionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  dockedActionTextEmpty: {
    color: "#475569",
  },
  dockedActionTextActive: {
    color: "#FFFFFF",
  },

  // Modal Keranjang Bottom Sheet
  modalOverlayCart: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.65)",
  },
  cartBottomSheet: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    maxHeight: "92%",
    overflow: "hidden",
    elevation: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  modalSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  modalHeaderBottomSheet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  modalHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitleBottomSheet: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: "#0F172A",
  },
  modalSubBottomSheet: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: "#64748B",
    marginTop: 1,
  },
  modalHeaderActionBtnAmber: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalHeaderActionTextAmber: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: "#B45309",
  },
  modalHeaderActionBtnRed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalHeaderActionTextRed: {
    fontSize: 11,
    fontFamily: fonts.bold,
    color: "#EF4444",
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  cartItemListContainer: {
    marginBottom: 10,
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cartItemImage: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
  },
  cartItemImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  cartItemName: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: "#0F172A",
    marginBottom: 2,
  },
  cartItemPrice: {
    fontSize: 13,
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  qtyControlModal: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 3,
  },
  qtyBtnModal: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  qtyTextModal: {
    fontSize: 13,
    fontFamily: fonts.bold,
    marginHorizontal: 8,
    color: colors.text,
  },

  // Breakdown Card
  calcBreakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  calcRowBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  calcLabelBreakdown: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#64748B",
  },
  calcValueBreakdown: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  diskonRowBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  diskonInputBox: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primary,
    backgroundColor: "#F8FAFC",
    width: 120,
    textAlign: "right",
  },
  calcDividerLine: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 10,
  },
  grandTotalHighlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalHighlightTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: "#0F172A",
    letterSpacing: 0.3,
  },
  grandTotalHighlightSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  grandTotalHighlightAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.primary,
    letterSpacing: -0.3,
  },

  fieldLabelModal: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#475569",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fnbTableInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: "#FFFFFF",
    marginBottom: 10,
  },

  // Payment Method Grid
  paymentMethodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  paymentMethodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  paymentMethodPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  paymentMethodPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#334155",
  },
  paymentMethodPillTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },

  // Cash Section
  cashSectionBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 14,
  },
  cashInputLarge: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.primary,
    backgroundColor: "#F8FAFC",
    marginBottom: 10,
  },
  quickCashGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 12,
  },
  quickCashBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  quickCashText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#334155",
  },

  kembalianBoxSuccess: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 12,
  },
  kembalianLabelSuccess: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#065F46",
    letterSpacing: 0.4,
  },
  kembalianValueSuccess: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: "#065F46",
    marginTop: 1,
  },
  kembalianBoxError: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 12,
  },
  kembalianLabelError: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#991B1B",
    letterSpacing: 0.4,
  },
  kembalianValueError: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: "#991B1B",
    marginTop: 1,
  },
  kembalianBoxNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  kembalianTextNeutral: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
  },

  // Modal Footer
  modalFooterDock: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalBayarBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalBayarBtnDisabled: {
    backgroundColor: "#94A3B8",
    elevation: 0,
    shadowOpacity: 0,
  },
  modalBayarText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.3,
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
