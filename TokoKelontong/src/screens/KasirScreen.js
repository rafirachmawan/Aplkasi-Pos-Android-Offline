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
import {
  formatRupiah,
  formatToRpInput as formatToRpDisplay,
  parseRpInput as parseRpToNumber,
  parseFlexibleDueDate,
  formatDueDateDisplay,
} from "../utils/helpers";
import {
  generateReceiptHTML,
  generateWAMessage,
  generateKitchenWAMessage,
  generateKitchenReceiptHTML,
  resolveReceiptProfile,
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
import ConnectionStatusPill from "../components/ConnectionStatusPill";
import usePlan from "../hooks/usePlan";
import { ProLockModal } from "../components/ProLock";
import { useAuth } from "../context/AuthContext";
import {
  getScopedStoreProfile,
  getHeldOrdersKey,
  readScopedJsonArrayWithMigration,
} from "../services/sessionStore";
import {
  fetchActiveTableOrders,
  updateTableOrderStatus,
  subscribeToTableOrders,
} from "../services/tableOrderService";

const { width } = Dimensions.get("window");
const isTablet = width > 600;

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
  const [showCartModal, setShowCartModal] = useState(false);
  const [cashInput, setCashInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash"); // 'cash' | 'qris' | 'transfer' | 'debit' | 'kasbon'
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
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

  // Status langganan toko. Mode F&B dan Kasbon hanya aktif pada tier Pro.
  const plan = usePlan();
  const isFnbMode = state.businessMode === "fnb" && plan.isPro;
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockFeature, setLockFeature] = useState("kasbon");

  const [heldOrders, setHeldOrders] = useState([]);
  const [showHeldOrdersModal, setShowHeldOrdersModal] = useState(false);

  // F&B Realtime Table Orders State
  const { profile } = useAuth();
  const activeStoreId = profile?.store_id || profile?.stores?.id || null;
  const [pendingTableOrders, setPendingTableOrders] = useState([]);
  const [activeTableOrderId, setActiveTableOrderId] = useState(null);
  const [showTableOrdersModal, setShowTableOrdersModal] = useState(false);
  const [selectedProofModal, setSelectedProofModal] = useState(null);
  const [processingOrderId, setProcessingOrderId] = useState(null);

  const pendingNewCount = pendingTableOrders.filter(
    (o) => o.status === "pending",
  ).length;
  const parsedKasbonDue = parseFlexibleDueDate(kasbonDueDate);

  const loadPendingOrders = useCallback(async () => {
    const storeId = activeStoreId;
    if (!storeId || !isFnbMode) return;
    try {
      const orders = await fetchActiveTableOrders(storeId);
      setPendingTableOrders(orders);
    } catch (err) {
      console.warn("Gagal memuat pesanan meja:", err);
    }
  }, [activeStoreId, isFnbMode]);

  useEffect(() => {
    const storeId = activeStoreId;
    if (!storeId || !isFnbMode) return;
    loadPendingOrders();
    const unsub = subscribeToTableOrders(storeId, () => {
      loadPendingOrders();
    });
    const interval = setInterval(loadPendingOrders, 12000);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, [activeStoreId, isFnbMode, loadPendingOrders]);

  const handleAcceptTableOrder = async (order) => {
    setProcessingOrderId(order.id);
    try {
      const res = await updateTableOrderStatus(order.id, "accepted");
      if (!res.success) {
        throw new Error(res.error || "Gagal mengubah status pesanan");
      }

      // Pastikan profil toko terkini sudah dimuat sebelum cetak struk dapur
      let currentProfile = storeProfile;
      try {
        const scoped = await getScopedStoreProfile(activeStoreId);
        currentProfile = resolveReceiptProfile(scoped, plan.isPro);
        setStoreProfile(currentProfile);
      } catch {
        currentProfile = resolveReceiptProfile(storeProfile, plan.isPro);
      }

      // Cetak Struk Dapur Bluetooth jika printer sudah terhubung
      try {
        await printKitchenTicketViaBluetooth(
          {
            invoice_number: `MEJA-${order.table_number}-${Date.now().toString().slice(-4)}`,
            created_at: order.created_at,
            table_number: order.table_number,
            order_type: "dine_in",
            payment_notes: `${order.payment_method === "qris" ? "QRIS" : "Bayar di Kasir"} • Pemesan: ${order.customer_name}${order.notes ? " • " + order.notes : ""}`,
          },
          (order.items || []).map((it) => ({
            product_name: it.name || it.product_name,
            quantity: it.quantity,
          })),
          currentProfile
        );
      } catch (printErr) {
        console.warn("Cetak dapur otomatis tidak aktif:", printErr.message);
      }

      Alert.alert(
        "Pesanan Diterima",
        `Pesanan Meja ${order.table_number} berhasil diterima dan dikirim ke dapur.`,
        [
          { text: "Tutup", style: "cancel" },
          {
            text: "Muat ke Kasir",
            onPress: () => handleLoadOrderToKasir(order),
          },
        ]
      );

      await loadPendingOrders();
    } catch (err) {
      Alert.alert("Gagal Memproses", err.message);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleCancelTableOrder = (order) => {
    Alert.alert(
      "Tolak Pesanan",
      `Apakah Anda yakin ingin membatalkan pesanan dari Meja ${order.table_number}?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya, Batalkan",
          style: "destructive",
          onPress: async () => {
            setProcessingOrderId(order.id);
            try {
              await updateTableOrderStatus(order.id, "cancelled");
              if (activeTableOrderId === order.id) {
                setActiveTableOrderId(null);
              }
              await loadPendingOrders();
            } catch (err) {
              Alert.alert("Gagal", err.message);
            } finally {
              setProcessingOrderId(null);
            }
          },
        },
      ]
    );
  };

  const handleLoadOrderToKasir = (order) => {
    dispatch({ type: "CLEAR_CART" });
    (order.items || []).forEach((item) => {
      const prod = allProducts.find((p) => p.id === item.product_id);
      const qty = Math.max(1, Number(item.quantity) || 1);
      const productId = prod?.id || item.product_id;
      const sellingPrice = Number(prod?.selling_price ?? item.price ?? 0) || 0;
      const capitalPrice = Number(prod?.capital_price ?? 0) || 0;

      dispatch({
        type: "ADD_TO_CART",
        payload: {
          product_id: productId,
          product_name:
            prod?.product_name || item.name || item.product_name || "Menu",
          selling_price: sellingPrice,
          capital_price: capitalPrice,
          stock_quantity: prod?.stock_quantity ?? 999,
          category: prod?.category || "",
          image_uri: prod?.image_uri || null,
          wholesale_rules: prod?.wholesale_rules || [],
        },
      });
      if (qty > 1) {
        dispatch({
          type: "UPDATE_CART_QTY",
          payload: { product_id: productId, quantity: qty },
        });
      }
    });

    setActiveTableOrderId(order.id);
    setTableNumber(String(order.table_number || ""));
    setOrderType("dine_in");
    setPaymentMethod(order.payment_method === "qris" ? "qris" : "cash");
    setPaymentNotes(`Pesanan Meja ${order.table_number} (${order.customer_name})`);

    setShowTableOrdersModal(false);
    setShowCartModal(true);
  };
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastTx, setLastTx] = useState(null);
  const [lastTxDetails, setLastTxDetails] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [storeProfile, setStoreProfile] = useState({});
  const [btPrinterReady, setBtPrinterReady] = useState(false);

  const loadHeldOrders = useCallback(async () => {
    try {
      const heldKey = getHeldOrdersKey(activeStoreId);
      if (!heldKey) {
        setHeldOrders([]);
        return;
      }
      const list = await readScopedJsonArrayWithMigration(
        heldKey,
        "@TokoKelontong:HeldOrders",
      );
      setHeldOrders(list);
    } catch {
      setHeldOrders([]);
    }
  }, [activeStoreId]);

  const saveHeldOrders = async (newList) => {
    setHeldOrders(newList);
    const heldKey = getHeldOrdersKey(activeStoreId);
    if (!heldKey) return;
    await AsyncStorage.setItem(heldKey, JSON.stringify(newList));
  };

  // Indikator status Online / Offline di header Kasir POS
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ConnectionStatusPill
          offline={!!syncStatus.offline}
          syncing={!!syncStatus.syncing}
          style={{ marginRight: 16 }}
          onPress={() => {
            if (offlineQueueCount > 0) {
              navigation.navigate("TransaksiPending");
            } else {
              refreshSyncCounts();
            }
          }}
        />
      ),
    });
  }, [navigation, syncStatus.offline, syncStatus.syncing, offlineQueueCount]);

  // Refresh saat screen difokus.
  // Catatan: keranjang TIDAK di-reset saat kehilangan fokus (misal buka
  // scanner barcode) agar belanjaan kasir tidak hilang. Keranjang hanya
  // dikosongkan setelah transaksi sukses atau lewat tombol "Kosongkan".
  useFocusEffect(
    useCallback(() => {
      loadProducts();
      loadHeldOrders();
      refreshSyncCounts();
      getScopedStoreProfile(activeStoreId)
        .then((data) => setStoreProfile(resolveReceiptProfile(data, plan.isPro)))
        .catch(() => {});
      // Cek apakah printer Bluetooth sudah diatur (untuk tombol cetak langsung)
      if (isBluetoothPrintingSupported()) {
        isPrinterConfigured()
          .then(setBtPrinterReady)
          .catch(() => setBtPrinterReady(false));
      } else {
        setBtPrinterReady(false);
      }
    }, [loadHeldOrders, activeStoreId, plan.isPro]),
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

    syncNow({ forceCatalog: true })
      .then(async () => {
        const fresh = await ProductRepository.getCachedProducts();
        applyProducts(fresh);
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
      String(p.product_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      (p.barcode &&
        String(p.barcode).toLowerCase().includes(searchQuery.toLowerCase()));
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
      multiScan: true,
      onBarcodeScanned: async (code) => {
        try {
          const product = await ProductRepository.getProductByBarcode(code, {
            localFirst: true,
          });
          if (product) {
            addToCart(product);
            return { status: "added", product };
          }
          return {
            status: "not_found",
            code,
            message: `Barcode ${code} belum terdaftar di gudang.`,
          };
        } catch (e) {
          return {
            status: "error",
            code,
            message: "Gagal mencari produk: " + (e?.message || "Kesalahan tidak diketahui"),
          };
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
          setActiveTableOrderId(null);
          setShowCartModal(false);
        },
      },
    ]);
  };

  // ── Helper: Cek Aturan Harga Grosir / Bertingkat ──
  const getCartItemPriceInfo = (item) => {
    const product = allProducts.find((p) => p.id === item.product_id);
    // Harga grosir hanya aktif pada tier Pro.
    const rules = plan.isPro
      ? (product?.wholesale_rules || item.wholesale_rules || [])
          .filter((r) => r && r.min_qty && r.price)
          .sort((a, b) => b.min_qty - a.min_qty)
      : [];

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
    if (grandTotal <= 0) {
      Alert.alert(
        "Total Tagihan Rp0",
        "Total belanja harus lebih dari Rp0. Kurangi nominal diskon terlebih dahulu.",
      );
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
      if (!parsedKasbonDue.valid) {
        Alert.alert(
          "Jatuh Tempo Tidak Valid",
          parsedKasbonDue.error ||
            "Periksa kembali format tanggal jatuh tempo atau kosongkan.",
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

      let prefetchedTx = null;
      // Jika kasbon, simpan ke buku kasbon tanpa pemotongan DP ganda
      if (paymentMethod === "kasbon") {
        try {
          try {
            prefetchedTx = await TransactionRepository.getTransactionById(txId);
          } catch (_) {
            prefetchedTx = null;
          }
          const dp = parseRpToNumber(kasbonDpInput);
          await debtRepository.createDebt({
            customer_name: kasbonCustomerName.trim(),
            customer_phone: kasbonCustomerPhone.trim(),
            transaction_id: txId,
            invoice_number: prefetchedTx?.invoice_number || "",
            total_debt: grandTotal,
            initial_dp: dp,
            due_date: parsedKasbonDue.iso,
            notes: kasbonNotes.trim() || "Transaksi Kasir POS",
          });
        } catch (debtErr) {
          console.warn("Gagal simpan kasbon ke debtRepository:", debtErr);
          Alert.alert(
            "Transaksi Tersimpan — Cek Buku Kasbon",
            "Transaksi penjualan berhasil dicatat, namun pencatatan ke Buku Kasbon mengalami kendala. Periksa Buku Kasbon untuk memastikan catatan tercatat.",
          );
        }
      }

      // Selesaikan status pesanan meja F&B jika checkout berasal dari QR self-order
      const completedTableOrderId = activeTableOrderId;
      if (completedTableOrderId) {
        setActiveTableOrderId(null);
        updateTableOrderStatus(completedTableOrderId, "completed")
          .then(() => loadPendingOrders())
          .catch((e) => console.warn("Gagal selesaikan order meja:", e));
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
        const fullTx =
          prefetchedTx || (await TransactionRepository.getTransactionById(txId));
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
      const currentProfile = await getStoreProfile();
      await printKitchenTicketViaBluetooth(lastTx, lastTxDetails, currentProfile);
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
    setActiveTableOrderId(null);
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
      const storeId = profile?.store_id || profile?.stores?.id || null;
      const data = await getScopedStoreProfile(storeId);
      return resolveReceiptProfile(data, plan.isPro);
    } catch {
      return resolveReceiptProfile({}, plan.isPro);
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
    return colors.categorySwatches?.[category.toLowerCase()] || colors.textSecondary;
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
    if (category === "Semua") return colors.text;
    return colors.categoryCardSwatches?.[category.toLowerCase()] || colors.textSecondary;
  };

  // Render POS Grid Item
  const renderProductGrid = ({ item }) => {
    const isUnlimitedStock = Number(item.min_stock_threshold) < 0;
    const lowStock =
      !isUnlimitedStock &&
      item.stock_quantity <= (item.min_stock_threshold ?? 5);
    const isOutOfStock = !isUnlimitedStock && item.stock_quantity <= 0;

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
                <Text style={styles.productCardInitialText}>
                  {(item.product_name || "P").slice(0, 2).toUpperCase()}
                </Text>
              </View>
            )}
            {/* Badge Stok di Sudut Foto */}
            <View
              style={[
                styles.gridStockFloatingBadge,
                lowStock && styles.gridStockFloatingBadgeLow,
              ]}
            >
              <Text
                style={[
                  styles.gridStockFloatingText,
                  lowStock && styles.gridStockFloatingTextLow,
                ]}
              >
                {isUnlimitedStock
                  ? "Tak Terbatas"
                  : isOutOfStock
                    ? "Habis"
                    : lowStock
                      ? `Sisa ${item.stock_quantity}`
                      : `Stok ${item.stock_quantity}`}
              </Text>
            </View>
            {qtyInCart > 0 && (
              <View style={styles.gridQtyBadge}>
                <Text style={styles.gridQtyBadgeText}>{qtyInCart}x</Text>
              </View>
            )}
          </View>

          <View style={styles.productCardInfo}>
            {item.category ? (
              <Text style={styles.productCardCategoryText} numberOfLines={1}>
                {item.category}
              </Text>
            ) : null}
            <Text style={styles.productCardName} numberOfLines={2}>
              {item.product_name}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.productCardBottomRow}>
          <Text style={styles.productCardPrice} numberOfLines={1}>
            {formatRupiah(item.selling_price)}
          </Text>

          {qtyInCart === 0 ? (
            <TouchableOpacity
              style={styles.cardAddBtn}
              onPress={() => addToCart(item)}
              activeOpacity={0.75}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={`Tambah ${item.product_name} ke keranjang`}
            >
              <MaterialCommunityIcons
                name="plus"
                size={18}
                color={colors.onPrimary}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.qtyControl}>
              <TouchableOpacity
                style={styles.qtyBtnSmall}
                onPress={() => updateQty(item.id, qtyInCart - 1)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Kurangi jumlah ${item.product_name}`}
              >
                <MaterialCommunityIcons
                  name="minus"
                  size={14}
                  color={colors.text}
                />
              </TouchableOpacity>
              <Text style={styles.qtyTextSmall}>{qtyInCart}</Text>
              <TouchableOpacity
                style={styles.qtyBtnSmallPlus}
                onPress={() => updateQty(item.id, qtyInCart + 1)}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                accessibilityRole="button"
                accessibilityLabel={`Tambah jumlah ${item.product_name}`}
              >
                <MaterialCommunityIcons
                  name="plus"
                  size={14}
                  color={colors.onPrimary}
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
            style={{ flex: 1, paddingRight: 10 }}
            onPress={() => navigation.navigate("TransaksiPending")}
            activeOpacity={0.7}
          >
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
          <View style={{ flex: 1 }}>
            <Text style={styles.heldBannerTitle}>
              {heldOrders.length} Pesanan Sedang Ditahan
            </Text>
            <Text style={styles.heldBannerSub}>
              Ketuk untuk membuka kembali transaksi tertunda
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.primaryTextDark}
          />
        </TouchableOpacity>
      )}

      {/* ── Banner Pesanan Meja Masuk (F&B Realtime Table Orders) ── */}
      {isFnbMode && pendingTableOrders.length > 0 && (
        <TouchableOpacity
          style={styles.tableOrdersBanner}
          onPress={() => setShowTableOrdersModal(true)}
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
            <View style={{ flex: 1 }}>
              <Text style={styles.tableBannerTitle}>
                {pendingTableOrders.length} Pesanan Meja Menunggu Konfirmasi
              </Text>
              <Text style={styles.tableBannerSub}>
                Ketuk untuk periksa pesanan, bukti bayar & cetak dapur
              </Text>
            </View>
            <View style={styles.tableCountBadge}>
              <Text style={styles.tableCountBadgeText}>{pendingTableOrders.length}</Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.primaryDark}
          />
        </TouchableOpacity>
      )}

      {/* ── Search Bar Modern & Barcode Quick Scan ── */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={colors.textSecondary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama produk atau scan barcode..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          accessibilityLabel="Cari nama produk atau scan barcode"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery("")}
            style={{ marginRight: 8 }}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Hapus pencarian"
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.searchScanBtn}
          onPress={openBarcodeScanner}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Scan barcode produk"
        >
          <MaterialCommunityIcons
            name="barcode-scan"
            size={18}
            color={colors.onPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* ── Filter Kategori: Clean Horizontal Pills ── */}
      <View style={styles.categoryContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {/* Tombol Cepat Pesanan Meja (Mode F&B) */}
          {isFnbMode && (
            <TouchableOpacity
              style={[
                styles.categoryPill,
                {
                  backgroundColor: pendingTableOrders.length > 0 ? colors.primaryContainer : colors.surface,
                  borderColor: pendingTableOrders.length > 0 ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setShowTableOrdersModal(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text
                style={[
                  styles.categoryPillText,
                  {
                    color: pendingNewCount > 0 ? colors.primaryDark : colors.textBodySecondary,
                    fontFamily: fonts.bold,
                  },
                ]}
              >
                Pesanan Meja
              </Text>
              {pendingTableOrders.length > 0 && (
                <View
                  style={{
                    backgroundColor:
                      pendingNewCount > 0 ? colors.primaryDark : colors.infoText,
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 1,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.bold,
                      fontSize: 12,
                      color: colors.onPrimary,
                    }}
                  >
                    {pendingTableOrders.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}

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
                color={colors.textSecondary}
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
                ? Math.max(insets.bottom, 36) + 12
                : Math.max(insets.bottom, 20),
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
          accessibilityRole={cart.length > 0 ? "button" : "text"}
          accessibilityLabel={
            cart.length === 0
              ? "Keranjang masih kosong. Pilih produk di atas untuk memulai transaksi."
              : `Total ${formatRupiah(grandTotal || totalHarga)} dari ${cart.length} jenis produk. Ketuk untuk rincian dan bayar`
          }
        >
          <View style={styles.dockedBarLeft}>
            {cart.length > 0 && (
              <View style={styles.dockedCartBadgeActive}>
                <Text style={styles.dockedCountText}>
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </Text>
              </View>
            )}

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
                  ? "Ketuk produk di atas untuk mulai transaksi"
                  : `${cart.length} jenis produk • Ketuk untuk rincian & bayar`}
              </Text>
            </View>
          </View>

          {cart.length > 0 && (
            <View style={[styles.dockedActionPill, styles.dockedActionPillActive]}>
              <Text style={[styles.dockedActionText, styles.dockedActionTextActive]}>
                Bayar →
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Modal Keranjang & Checkout (Modern Clean Bottom Sheet) ── */}
      <Modal
        visible={showCartModal}
        animationType="slide"
        transparent={true}
        statusBarTranslucent={true}
        navigationBarTranslucent={true}
        onRequestClose={() => setShowCartModal(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlayCart}>
            <View style={styles.cartBottomSheet}>
              {/* Handle Bar */}
              <View style={styles.modalSheetHandle} />

              {/* Header */}
              <View style={styles.modalHeaderBottomSheet}>
                <View>
                  <Text style={styles.modalTitleBottomSheet}>
                    Rincian Pesanan
                  </Text>
                  <Text style={styles.modalSubBottomSheet}>
                    {cart.length} produk • {cart.reduce((s, i) => s + i.quantity, 0)} unit
                  </Text>
                </View>

                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity
                    onPress={() => setShowCartModal(false)}
                    style={styles.modalCloseBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Tutup rincian pesanan"
                  >
                    <MaterialCommunityIcons
                      name="close"
                      size={18}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Scrollable Content Body */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 }}
              >
                {/* Daftar Item Keranjang */}
                <View style={styles.cartItemListContainer}>
                  {cart.map((item, index) => (
                    <View
                      key={item.product_id}
                      style={[
                        styles.cartItem,
                        index === cart.length - 1 && styles.cartItemLast,
                      ]}
                    >
                      {item.image_uri ? (
                        <Image
                          source={{ uri: item.image_uri }}
                          style={styles.cartItemImage}
                        />
                      ) : (
                        <View style={styles.cartItemImagePlaceholder}>
                          <MaterialCommunityIcons
                            name={getPlaceholderIcon(item.category)}
                            size={22}
                            color={getCategoryColor(item.category)}
                            style={{ opacity: 0.4 }}
                          />
                        </View>
                      )}
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName} numberOfLines={2}>
                          {item.product_name}
                        </Text>
                        {(() => {
                          const { unitPrice, isWholesale, ruleMinQty } =
                            getCartItemPriceInfo(item);
                          return (
                            <View style={styles.cartItemMetaRow}>
                              <Text
                                style={[
                                  styles.cartItemPrice,
                                  isWholesale && { color: colors.successDark },
                                ]}
                              >
                                {formatRupiah(unitPrice)}
                              </Text>
                              {item.quantity > 1 && (
                                <Text style={styles.cartItemLineTotal}>
                                  • {formatRupiah(unitPrice * item.quantity)}
                                </Text>
                              )}
                              {isWholesale && (
                                <View style={styles.cartWholesaleBadge}>
                                  <Text style={styles.cartWholesaleBadgeText}>
                                    Grosir ≥{ruleMinQty}
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
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Kurangi ${item.product_name}`}
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
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Tambah ${item.product_name}`}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={14}
                            color={colors.primaryDark}
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
                        color={colors.textSecondary}
                      />
                      <Text style={styles.calcLabelBreakdown}>Diskon (Rp)</Text>
                    </View>
                    <TextInput
                      style={styles.diskonInputBox}
                      value={discountInput}
                      onChangeText={(text) => setDiscountInput(formatToRpDisplay(text))}
                      keyboardType="numeric"
                      placeholder="Rp0"
                      placeholderTextColor={colors.textSecondary}
                      accessibilityLabel="Nominal diskon dalam Rupiah"
                    />
                  </View>

                  <View style={styles.calcDividerLine} />

                  <View style={styles.grandTotalHighlightRow}>
                    <View>
                      <Text style={styles.grandTotalHighlightTitle}>Total Tagihan</Text>
                      {diskon > 0 && (
                        <Text style={styles.grandTotalDiscountSub}>
                          Hemat {formatRupiah(diskon)}
                        </Text>
                      )}
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
                        color={colors.successDark}
                      />
                      <Text style={styles.fnbCardTitle}>
                        Informasi Meja & Pesanan
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
                          color={orderType === "dine_in" ? colors.onPrimary : colors.textBodySecondary}
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
                          color={orderType === "take_away" ? colors.onPrimary : colors.textBodySecondary}
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
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                )}

                {/* Panel Pembayaran Terpadu (Metode + Nominal / Detail) */}
                <View style={styles.paymentSectionCard}>
                  <Text style={styles.fieldLabelModal}>Metode Pembayaran</Text>
                  {(() => {
                    const PAYMENT_OPTIONS = [
                      { key: "cash", label: "Tunai", desc: "Pembayaran uang tunai di kasir", icon: "cash-multiple" },
                      { key: "qris", label: "QRIS", desc: "Scan kode QRIS toko", icon: "qrcode-scan" },
                      { key: "transfer", label: "Transfer Bank", desc: "Transfer antar rekening bank", icon: "bank-transfer" },
                      { key: "debit", label: "Debit / EDC", desc: "Gesek kartu di mesin EDC", icon: "credit-card-outline" },
                      { key: "kasbon", label: "Kasbon / Hutang", desc: "Catat ke Buku Kasbon pelanggan", icon: "book-account-outline" },
                    ];
                    const activeOption =
                      PAYMENT_OPTIONS.find((m) => m.key === paymentMethod) || PAYMENT_OPTIONS[0];

                    return (
                      <View style={styles.paymentDropdownWrapper}>
                        <TouchableOpacity
                          style={[
                            styles.paymentDropdownTrigger,
                            showPaymentDropdown && styles.paymentDropdownTriggerOpen,
                          ]}
                          onPress={() => setShowPaymentDropdown((prev) => !prev)}
                          activeOpacity={0.75}
                          accessibilityRole="button"
                          accessibilityLabel={`Metode pembayaran ${activeOption.label}. Ketuk untuk ganti`}
                        >
                          <View style={styles.paymentDropdownTriggerLeft}>
                            <View style={styles.paymentDropdownIconBox}>
                              <MaterialCommunityIcons
                                name={activeOption.icon}
                                size={18}
                                color={colors.primaryDark}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.paymentDropdownSelectedLabel}>
                                {activeOption.label}
                              </Text>
                              <Text style={styles.paymentDropdownSelectedDesc} numberOfLines={1}>
                                {activeOption.desc}
                              </Text>
                            </View>
                          </View>
                          <MaterialCommunityIcons
                            name={showPaymentDropdown ? "chevron-up" : "chevron-down"}
                            size={22}
                            color={colors.textSecondary}
                          />
                        </TouchableOpacity>

                        {showPaymentDropdown && (
                          <View style={styles.paymentDropdownList}>
                            {PAYMENT_OPTIONS.map((m, idx) => {
                              const isActive = paymentMethod === m.key;
                              const isLockedKasbon = m.key === "kasbon" && !plan.isPro;
                              return (
                                <TouchableOpacity
                                  key={m.key}
                                  style={[
                                    styles.paymentDropdownItem,
                                    idx === PAYMENT_OPTIONS.length - 1 && { borderBottomWidth: 0 },
                                    isActive && styles.paymentDropdownItemActive,
                                  ]}
                                  onPress={() => {
                                    if (isLockedKasbon) {
                                      setShowPaymentDropdown(false);
                                      setLockFeature("kasbon");
                                      setShowLockModal(true);
                                      return;
                                    }
                                    setPaymentMethod(m.key);
                                    setShowPaymentDropdown(false);
                                    if (m.key !== "cash" && m.key !== "kasbon") {
                                      setCashInput(formatToRpDisplay(grandTotal));
                                    }
                                  }}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.paymentDropdownItemLeft}>
                                    <MaterialCommunityIcons
                                      name={m.icon}
                                      size={18}
                                      color={isActive ? colors.primaryDark : colors.textSecondary}
                                    />
                                    <View style={{ flex: 1 }}>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                        <Text
                                          style={[
                                            styles.paymentDropdownItemText,
                                            isActive && styles.paymentDropdownItemTextActive,
                                          ]}
                                        >
                                          {m.label}
                                        </Text>
                                        {isLockedKasbon && (
                                          <View style={styles.paymentProTag}>
                                            <Text style={styles.paymentProTagText}>PRO</Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text style={styles.paymentDropdownItemDesc} numberOfLines={1}>
                                        {m.desc}
                                      </Text>
                                    </View>
                                  </View>
                                  <MaterialCommunityIcons
                                    name={isActive ? "radiobox-marked" : "radiobox-blank"}
                                    size={20}
                                    color={isActive ? colors.primary : colors.borderStrong}
                                  />
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  <View style={styles.paymentSectionDivider} />

                  {/* Konten Sesuai Metode Pembayaran */}
                  {paymentMethod === "cash" ? (
                    <View>
                      <Text style={styles.fieldLabelModal}>Uang Tunai Diterima</Text>
                      <TextInput
                        style={styles.cashInputLarge}
                        value={cashInput}
                        onChangeText={(text) => setCashInput(formatToRpDisplay(text))}
                        keyboardType="numeric"
                        placeholder="Rp0"
                        placeholderTextColor={colors.textSecondary}
                        accessibilityLabel="Nominal uang tunai diterima"
                      />

                      {/* Quick Cash Buttons */}
                      <View style={styles.quickCashGrid}>
                        <TouchableOpacity
                          style={[styles.quickCashBtn, styles.quickCashBtnPrimary]}
                          onPress={() => setCashInput(formatToRpDisplay(grandTotal))}
                          hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                        >
                          <Text style={[styles.quickCashText, { color: colors.primaryDark }]}>
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
                          hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                        >
                          <Text style={styles.quickCashText}>
                            {grandTotal <= 20000 ? "20 Ribu" : "50 Ribu"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickCashBtn}
                          onPress={() => setCashInput(formatToRpDisplay(100000))}
                          hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                        >
                          <Text style={styles.quickCashText}>100 Ribu</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickCashBtn}
                          onPress={() => setCashInput(formatToRpDisplay(200000))}
                          hitSlop={{ top: 4, bottom: 4, left: 0, right: 0 }}
                        >
                          <Text style={styles.quickCashText}>200 Ribu</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Kembalian Status Box */}
                      {cashReceived >= grandTotal && grandTotal > 0 ? (
                        <View style={styles.kembalianBoxSuccess}>
                          <View>
                            <Text style={styles.kembalianLabelSuccess}>
                              {kembalian === 0 ? "Status Pembayaran" : "Kembalian Kasir"}
                            </Text>
                            <Text style={styles.kembalianValueSuccess}>
                              {kembalian === 0 ? "Uang Pas (Lunas)" : formatRupiah(kembalian)}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name="check-circle"
                            size={22}
                            color={colors.successAltDark}
                          />
                        </View>
                      ) : cashReceived > 0 ? (
                        <View style={styles.kembalianBoxError}>
                          <View>
                            <Text style={styles.kembalianLabelError}>Uang Kurang</Text>
                            <Text style={styles.kembalianValueError}>
                              {formatRupiah(grandTotal - cashReceived)}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name="alert-circle"
                            size={22}
                            color={colors.errorTextDark}
                          />
                        </View>
                      ) : (
                        <View style={styles.kembalianBoxNeutral}>
                          <MaterialCommunityIcons
                            name="information-outline"
                            size={18}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.kembalianTextNeutral}>
                            Ketik nominal tunai atau ketuk Uang Pas.
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : paymentMethod === "qris" ? (
                    <View style={styles.nonCashCard}>
                      <View style={styles.nonCashIconRow}>
                        <MaterialCommunityIcons
                          name="qrcode-scan"
                          size={26}
                          color={colors.infoText}
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
                        <Text style={styles.nonCashAmountLabel}>Total Tagihan</Text>
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
                          size={18}
                          color={colors.warningTextDark}
                        />
                        <Text style={styles.kasbonTitle}>
                          Pencatatan Kasbon / Hutang
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
                        placeholderTextColor={colors.textSecondary}
                      />

                      <Text style={styles.fieldLabelModal}>No. WhatsApp / HP (Opsional)</Text>
                      <TextInput
                        style={styles.fnbTableInput}
                        value={kasbonCustomerPhone}
                        onChangeText={setKasbonCustomerPhone}
                        keyboardType="phone-pad"
                        placeholder="08123456789"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <Text style={styles.fieldLabelModal}>
                        DP / Uang Muka Dibayar Sekarang (Rp)
                      </Text>
                      <TextInput
                        style={styles.fnbTableInput}
                        value={kasbonDpInput}
                        onChangeText={(t) => setKasbonDpInput(formatToRpDisplay(t))}
                        keyboardType="numeric"
                        placeholder="Rp0"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <Text style={styles.fieldLabelModal}>
                        Jatuh Tempo (Opsional)
                      </Text>
                      <TextInput
                        style={styles.fnbTableInput}
                        value={kasbonDueDate}
                        onChangeText={setKasbonDueDate}
                        autoCapitalize="none"
                        placeholder="Misal: 12 Januari atau 12-01 (boleh kosong)"
                        placeholderTextColor={colors.textSecondary}
                      />
                      {kasbonDueDate.trim() &&
                      parsedKasbonDue.valid &&
                      parsedKasbonDue.display ? (
                        <Text
                          style={{
                            fontFamily: fonts.medium,
                            fontSize: 12,
                            color: colors.successText,
                            marginTop: -4,
                            marginBottom: 8,
                          }}
                        >
                          Terjadwal jatuh tempo: {parsedKasbonDue.display}
                        </Text>
                      ) : null}

                      <Text style={styles.fieldLabelModal}>
                        Catatan Kasbon (Opsional)
                      </Text>
                      <TextInput
                        style={styles.fnbTableInput}
                        value={kasbonNotes}
                        onChangeText={setKasbonNotes}
                        placeholder="Misal: Janji bayar minggu depan"
                        placeholderTextColor={colors.textSecondary}
                      />

                      <View style={styles.sisaKasbonRow}>
                        <Text style={styles.sisaKasbonLabel}>
                          Sisa Masuk Buku Hutang
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
                          size={26}
                          color={colors.infoText}
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
                        style={[styles.fnbTableInput, { marginTop: 10, marginBottom: 0, fontSize: 13, height: 44 }]}
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
                </View>

                {/* Aksi Sekunder Keranjang (Ditempatkan di Bawah agar Aman & Tidak Memotong Alur Hitung) */}
                <View style={styles.cartSecondaryActionsRow}>
                  <TouchableOpacity
                    onPress={handleHoldOrder}
                    style={styles.cartSecondaryBtnHold}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons
                      name="pause-circle-outline"
                      size={16}
                      color={colors.warningTextDark}
                    />
                    <Text style={styles.cartSecondaryTextHold}>
                      Tahan Pesanan
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={clearCart}
                    style={styles.cartSecondaryBtnClear}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <MaterialCommunityIcons
                      name="trash-can-outline"
                      size={16}
                      color={colors.errorDark}
                    />
                    <Text style={styles.cartSecondaryTextClear}>
                      Hapus Semua
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* ── Docked Bottom Action Button ── */}
              <View
                style={[
                  styles.modalFooterDock,
                  {
                    paddingBottom:
                      Platform.OS === "android"
                        ? Math.max(insets.bottom, 36) + 14
                        : Math.max(insets.bottom, 20),
                  },
                ]}
              >
                {(() => {
                  const isCashValid = paymentMethod !== "cash" || cashReceived >= grandTotal;
                  const isKasbonValid =
                    paymentMethod !== "kasbon" || kasbonCustomerName.trim().length > 0;
                  const canSubmit = cart.length > 0 && isCashValid && isKasbonValid && !submitting;
                  const PAYMENT_SUBMIT_LABELS = {
                    cash: "Selesaikan Transaksi",
                    qris: "Bayar QRIS",
                    transfer: "Bayar Transfer",
                    debit: "Bayar Debit",
                    kasbon: "Simpan Kasbon",
                  };

                  return (
                    <TouchableOpacity
                      style={[
                        styles.modalBayarBtn,
                        !canSubmit && styles.modalBayarBtnDisabled,
                      ]}
                      onPress={handleBayar}
                      disabled={!canSubmit}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                    >
                      {submitting ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                      ) : (
                        <>
                          <MaterialCommunityIcons
                            name={canSubmit ? "check-circle" : "alert-circle-outline"}
                            size={20}
                            color={colors.onPrimary}
                          />
                          <Text style={styles.modalBayarText}>
                            {!isCashValid
                              ? `Uang Kurang (${formatRupiah(grandTotal - cashReceived)})`
                              : !isKasbonValid
                                ? "Isi Nama Pelanggan Kasbon"
                                : `${PAYMENT_SUBMIT_LABELS[paymentMethod] || "Selesaikan Transaksi"} (${formatRupiah(grandTotal)})`}
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
                backgroundColor: lastTx?.is_offline ? colors.warningText : colors.primary,
                paddingVertical: 14,
                alignItems: "center",
              }}
            >
              <MaterialCommunityIcons
                name={lastTx?.is_offline ? "cloud-off-outline" : "check-circle"}
                size={36}
                color={colors.onPrimary}
              />
              <Text
                style={[
                  styles.successTitle,
                  { color: colors.onPrimary, marginTop: 6, fontSize: 18 },
                ]}
              >
                {lastTx?.is_offline ? "Disimpan Offline!" : "Transaksi Berhasil!"}
              </Text>
              {lastTx?.is_offline && (
                <Text
                  style={{
                    color: colors.warningTextMuted,
                    fontSize: 12,
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
                  {storeProfile.storeName || "MarketPos"}
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
                    <Text style={[styles.receiptMeta, { color: colors.errorDark }]}>
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
                          { fontWeight: "bold", color: colors.successText },
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
                      color={colors.onPrimary}
                    />
                    <Text style={styles.successBtnText}>Cetak</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.successBtn, { backgroundColor: colors.successButtonDark }]}
                    onPress={handleShareFromKasir}
                  >
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={20}
                      color={colors.onPrimary}
                    />
                    <Text style={styles.successBtnText}>Kirim WA</Text>
                  </TouchableOpacity>
                </View>
              )}

              {btPrinterReady && Platform.OS === "android" && (
                <TouchableOpacity
                  style={[
                    styles.successBtn,
                    { backgroundColor: colors.text, marginTop: 10 },
                  ]}
                  onPress={handlePrintBluetooth}
                >
                  <MaterialCommunityIcons
                    name="bluetooth"
                    size={20}
                    color={colors.onPrimary}
                  />
                  <Text style={styles.successBtnText}>
                    Cetak Langsung (Printer Bluetooth)
                  </Text>
                </TouchableOpacity>
              )}

              {isFnbMode && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[styles.successBtn, { flex: 1, backgroundColor: colors.warningText }]}
                    onPress={handlePrintKitchenBluetooth}
                  >
                    <MaterialCommunityIcons
                      name="silverware-fork-knife"
                      size={18}
                      color={colors.onPrimary}
                    />
                    <Text style={styles.successBtnText}>Struk Dapur</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.successBtn, { flex: 1, backgroundColor: colors.successButtonDark }]}
                    onPress={handleShareKitchenWA}
                  >
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={18}
                      color={colors.onPrimary}
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
                    { backgroundColor: colors.warningBannerBg },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="pause-circle-outline"
                    size={22}
                    color={colors.warningText}
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

      {/* ── Modal Pesanan Meja Masuk (Self-Order F&B) ── */}
      <Modal
        visible={showTableOrdersModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowTableOrdersModal(false)}
      >
        <TouchableOpacity
          style={styles.catModalOverlay}
          activeOpacity={1}
          onPress={() => setShowTableOrdersModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.catModalCard, { maxHeight: "88%" }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <View style={styles.catModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    backgroundColor: colors.warningBannerBg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name="table-chair"
                    size={22}
                    color={colors.warningText}
                  />
                </View>
                <View>
                  <Text style={styles.catModalTitle}>Pesanan Meja</Text>
                  <Text style={styles.catModalSubtitle}>
                    {pendingNewCount} baru •{" "}
                    {pendingTableOrders.length - pendingNewCount} diproses dapur
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <TouchableOpacity
                  onPress={loadPendingOrders}
                  style={styles.catModalCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="refresh" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowTableOrdersModal(false)}
                  style={styles.catModalCloseBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* List Pesanan Meja */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 10, gap: 12 }}
            >
              {pendingTableOrders.length === 0 ? (
                <View style={{ padding: 36, alignItems: "center" }}>
                  <MaterialCommunityIcons
                    name="silverware-fork-knife"
                    size={48}
                    color={colors.borderStrong}
                  />
                  <Text style={{ fontFamily: fonts.bold, color: colors.textBodySecondary, fontSize: 16, marginTop: 12 }}>
                    Belum Ada Pesanan Aktif
                  </Text>
                  <Text style={{ fontFamily: fonts.regular, color: colors.textSecondary, fontSize: 12, textAlign: "center", marginTop: 4, paddingHorizontal: 20 }}>
                    Pesanan yang dikirim pelanggan setelah memindai QR code di meja akan muncul di sini sampai selesai dibayar.
                  </Text>
                </View>
              ) : (
                pendingTableOrders.map((order) => {
                  const isProcessing = processingOrderId === order.id;
                  const isAccepted = order.status === "accepted";
                  const orderDate = new Date(order.created_at).toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <View key={order.id} style={styles.tableOrderCard}>
                      {/* Top Header Card */}
                      <View style={styles.tableOrderCardHeader}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 }}>
                          <View style={styles.tableNumBadge}>
                            <Text style={styles.tableNumBadgeText}>MEJA {order.table_number}</Text>
                          </View>
                          {isAccepted ? (
                            <View
                              style={[
                                styles.payMethodBadge,
                                { backgroundColor: colors.warningContainer, borderWidth: 1, borderColor: colors.warningBorder },
                              ]}
                            >
                              <Text style={[styles.payMethodBadgeText, { color: colors.warningTextDark }]}>
                                Diproses Dapur
                              </Text>
                            </View>
                          ) : null}
                          <Text style={styles.orderTimeText}>{orderDate}</Text>
                        </View>

                        <View
                          style={[
                            styles.payMethodBadge,
                            order.payment_method === "qris" ? styles.payMethodQris : styles.payMethodCash,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={order.payment_method === "qris" ? "qrcode-scan" : "cash"}
                            size={12}
                            color={order.payment_method === "qris" ? colors.infoBadgeText : colors.successText}
                          />
                          <Text
                            style={[
                              styles.payMethodBadgeText,
                              { color: order.payment_method === "qris" ? colors.infoBadgeText : colors.successText },
                            ]}
                          >
                            {order.payment_method === "qris" ? "QRIS Toko" : "Bayar di Kasir"}
                          </Text>
                        </View>
                      </View>

                      {/* Info Pemesan */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginVertical: 6 }}>
                        <MaterialCommunityIcons name="account" size={14} color={colors.textSecondary} />
                        <Text style={styles.customerNameText}>
                          {order.customer_name} {order.customer_phone ? `(${order.customer_phone})` : ""}
                        </Text>
                      </View>

                      {/* Items List */}
                      <View style={styles.orderItemsContainer}>
                        {(order.items || []).map((it, iIdx) => (
                          <View key={iIdx} style={styles.orderItemRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.orderItemName}>
                                <Text style={{ fontFamily: fonts.bold }}>{it.quantity}x </Text>
                                {it.name || it.product_name}
                              </Text>
                              {!!it.notes && (
                                <Text style={styles.orderItemNote}>Catatan: "{it.notes}"</Text>
                              )}
                            </View>
                            <Text style={styles.orderItemSubtotal}>
                              {formatRupiah((it.price || 0) * it.quantity)}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Catatan Keseluruhan */}
                      {!!order.notes && (
                        <View style={styles.orderGeneralNoteBox}>
                          <Text style={styles.orderGeneralNoteText}>
                            Pesan: {order.notes}
                          </Text>
                        </View>
                      )}

                      {/* Foto Bukti Transfer QRIS */}
                      {order.payment_method === "qris" && (
                        <View style={styles.proofSection}>
                          {order.payment_proof_url ? (
                            <TouchableOpacity
                              style={styles.proofPreviewBtn}
                              onPress={() => setSelectedProofModal(order.payment_proof_url)}
                              activeOpacity={0.8}
                            >
                              <Image
                                source={{ uri: order.payment_proof_url }}
                                style={styles.proofThumb}
                                resizeMode="cover"
                              />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.proofBtnTitle}>Bukti Pembayaran QRIS</Text>
                                <Text style={styles.proofBtnSub}>Ketuk untuk perbesar & verifikasi</Text>
                              </View>
                              <MaterialCommunityIcons name="arrow-expand" size={18} color={colors.infoText} />
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.noProofWarning}>
                              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.errorDark} />
                              <Text style={styles.noProofWarningText}>
                                Pelanggan belum mengunggah foto bukti pembayaran.
                              </Text>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Total Bar */}
                      <View style={styles.orderTotalRow}>
                        <Text style={styles.orderTotalLabel}>Total Pesanan:</Text>
                        <Text style={styles.orderTotalValue}>{formatRupiah(order.total_amount)}</Text>
                      </View>

                      {/* Action Buttons */}
                      <View style={styles.orderActionsRow}>
                        <TouchableOpacity
                          style={styles.btnCancelOrder}
                          onPress={() => handleCancelTableOrder(order)}
                          disabled={isProcessing}
                        >
                          <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.errorDark} />
                          <Text style={styles.btnCancelOrderText}>
                            {isAccepted ? "Batalkan" : "Tolak"}
                          </Text>
                        </TouchableOpacity>

                        {isAccepted ? (
                          <TouchableOpacity
                            style={[styles.btnAcceptOrder, { backgroundColor: colors.primaryDark }]}
                            onPress={() => handleLoadOrderToKasir(order)}
                            disabled={isProcessing}
                          >
                            <MaterialCommunityIcons name="cart-arrow-down" size={18} color={colors.onPrimary} />
                            <Text style={styles.btnAcceptOrderText}>
                              Muat ke Kasir & Bayar
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.btnAcceptOrder}
                            onPress={() => handleAcceptTableOrder(order)}
                            disabled={isProcessing}
                          >
                            <MaterialCommunityIcons name="printer" size={18} color={colors.onPrimary} />
                            <Text style={styles.btnAcceptOrderText}>
                              {isProcessing ? "Memproses..." : "Terima & Cetak Dapur"}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Zoom Bukti Pembayaran ── */}
      <Modal
        visible={!!selectedProofModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setSelectedProofModal(null)}
      >
        <View style={styles.proofModalBackdrop}>
          <TouchableOpacity
            style={styles.proofModalCloseBtn}
            onPress={() => setSelectedProofModal(null)}
          >
            <MaterialCommunityIcons name="close" size={24} color={colors.onPrimary} />
          </TouchableOpacity>
          {selectedProofModal && (
            <Image
              source={{ uri: selectedProofModal }}
              style={styles.proofModalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* ── Panel Kunci Fitur (tier Gratis) ── */}
      <ProLockModal
        visible={showLockModal}
        feature={lockFeature}
        onClose={() => setShowLockModal(false)}
      />
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
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.text,
    paddingVertical: 0,
  },
  searchScanBtn: {
    width: 36,
    height: 36,
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
    minHeight: 38,
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
    fontFamily: fonts.semiBold,
    color: colors.textBodySecondary,
  },
  categoryPillTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },
  categoryCountBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: "center",
  },
  categoryCountBadgeActive: {
    backgroundColor: colors.heroMetricBg,
  },
  categoryCountText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textBodySecondary,
  },
  categoryCountTextActive: {
    color: colors.onPrimary,
  },

  // Category Grid Modal (Centered Card)
  catModalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayBackdrop,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  catModalCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    width: "92%",
    maxWidth: 420,
    maxHeight: "75%",
    paddingBottom: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: colors.text,
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
    borderBottomColor: colors.cardBorder,
  },
  catModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  catModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  catModalSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  catModalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    position: "relative",
  },
  catGridItemActive: {
    backgroundColor: colors.infoSurfaceActive,
    borderColor: colors.primary,
    borderWidth: 2,
  },
  catGridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.border,
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
    color: colors.primaryDark,
  },
  catGridCount: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  catGridCountActive: {
    color: colors.primaryDark,
  },
  catGridCheckmark: {
    position: "absolute",
    top: 6,
    right: 6,
  },

  // Grid Produk
  productGrid: {
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 24,
  },
  productCard: {
    flex: 1,
    margin: 6,
    backgroundColor: colors.surface,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxWidth: isTablet ? "31%" : "48%",
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  productCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 3,
  },
  productCardImg: {
    height: 118,
    width: "100%",
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  productCardImgPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  productCardInitialText: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: colors.primaryPlaceholder,
    letterSpacing: 1,
  },
  gridStockFloatingBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.stockBadgeOverlay,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  gridStockFloatingBadgeLow: {
    backgroundColor: colors.stockBadgeLowOverlay,
  },
  gridStockFloatingText: {
    fontSize: 12,
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },
  gridStockFloatingTextLow: {
    color: colors.onPrimary,
  },
  gridQtyBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  gridQtyBadgeText: {
    fontSize: 12,
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },
  productCardTouchArea: {
    width: "100%",
  },
  productCardInfo: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 2,
  },
  productCardCategoryText: {
    fontSize: 12,
    fontFamily: fonts.bold,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  productCardName: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 2,
    lineHeight: 18,
    minHeight: 36,
  },
  productCardPrice: {
    fontSize: 14,
    fontFamily: fonts.extraBold,
    color: colors.text,
    flex: 1,
    paddingRight: 6,
  },
  productCardBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    minHeight: 42,
  },
  cardAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  qtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: 2,
  },
  qtyBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  qtyBtnSmallPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTextSmall: {
    fontSize: 12.5,
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
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
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
    fontSize: 12.5,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 18,
  },

  // Docked Bottom Checkout Bar (Modern POS Standard)
  dockedBottomBar: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  dockedBarBtn: {
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dockedBarBtnEmpty: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dockedBarBtnActive: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 5,
  },
  dockedBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  dockedCartBadgeActive: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: colors.heroMetricBg,
    alignItems: "center",
    justifyContent: "center",
  },
  dockedCountText: {
    color: colors.onPrimary,
    fontSize: 14,
    fontFamily: fonts.extraBold,
  },
  dockedBarTotal: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  dockedBarTotalMuted: {
    color: colors.text,
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  dockedBarTotalActive: {
    color: colors.onPrimary,
  },
  dockedBarSub: {
    fontSize: 12,
    marginTop: 2,
  },
  dockedBarSubMuted: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
  },
  dockedBarSubActive: {
    color: colors.onPrimarySoft,
    fontFamily: fonts.medium,
  },
  dockedActionPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  dockedActionPillActive: {
    backgroundColor: colors.surface,
  },
  dockedActionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  dockedActionTextActive: {
    color: colors.primaryDark,
  },

  // Modal Keranjang Bottom Sheet
  modalOverlayCart: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlayBackdrop,
  },
  cartBottomSheet: {
    backgroundColor: colors.surfaceMuted,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    maxHeight: "92%",
    overflow: "hidden",
    elevation: 16,
    shadowColor: colors.text,
    shadowOpacity: 0.2,
    shadowRadius: 24,
  },
  modalSheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
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
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalTitleBottomSheet: {
    fontSize: 16,
    fontFamily: fonts.extraBold,
    color: colors.text,
  },
  modalSubBottomSheet: {
    fontSize: 12,
    fontFamily: fonts.medium,
    color: colors.textSecondary,
    marginTop: 1,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  cartItemListContainer: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  cartSecondaryActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  cartSecondaryBtnHold: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  cartSecondaryTextHold: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: colors.warningTextDark,
  },
  cartSecondaryBtnClear: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 44,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  cartSecondaryTextClear: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: colors.errorDark,
  },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  cartItemLast: {
    borderBottomWidth: 0,
  },
  cartItemImage: {
    width: 40,
    height: 40,
    borderRadius: 9,
    marginRight: 10,
  },
  cartItemImagePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 9,
    marginRight: 10,
    backgroundColor: colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  cartItemInfo: {
    flex: 1,
    marginRight: 8,
  },
  cartItemName: {
    fontSize: 13.5,
    fontFamily: fonts.semiBold,
    color: colors.text,
    marginBottom: 2,
  },
  cartItemMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    rowGap: 2,
    columnGap: 6,
  },
  cartItemPrice: {
    fontSize: 13,
    color: colors.primaryDark,
    fontFamily: fonts.bold,
  },
  cartItemLineTotal: {
    fontSize: 12,
    color: colors.textBodySecondary,
    fontFamily: fonts.semiBold,
  },
  qtyControlModal: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
  },
  qtyBtnModal: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  qtyTextModal: {
    fontSize: 13,
    fontFamily: fonts.bold,
    marginHorizontal: 8,
    color: colors.text,
  },

  // Breakdown Card
  calcBreakdownCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  calcRowBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  calcLabelBreakdown: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  calcValueBreakdown: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  diskonRowBreakdown: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  diskonInputBox: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.primaryDark,
    backgroundColor: colors.surfaceMuted,
    width: 120,
    textAlign: "right",
  },
  calcDividerLine: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginBottom: 8,
  },
  grandTotalHighlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  grandTotalHighlightTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.text,
  },
  grandTotalDiscountSub: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.successText,
    marginTop: 1,
  },
  grandTotalHighlightAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 19,
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },

  fieldLabelModal: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBodySecondary,
    marginBottom: 6,
  },
  fnbTableInput: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBottom: 10,
  },

  // Payment Section & Dropdown
  paymentSectionCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
  },
  paymentSectionDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 10,
  },
  paymentDropdownWrapper: {
    marginBottom: 0,
  },
  paymentDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  paymentDropdownTriggerOpen: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  paymentDropdownTriggerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  paymentDropdownIconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorderSoft,
    justifyContent: "center",
    alignItems: "center",
  },
  paymentDropdownSelectedLabel: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.text,
  },
  paymentDropdownSelectedDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  paymentDropdownList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  paymentDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  paymentDropdownItemActive: {
    backgroundColor: colors.primaryContainer,
  },
  paymentDropdownItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  paymentDropdownItemText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textDark,
  },
  paymentDropdownItemTextActive: {
    fontFamily: fonts.bold,
    color: colors.primaryDark,
  },
  paymentDropdownItemDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  paymentProTag: {
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  paymentProTagText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryDark,
    letterSpacing: 0.3,
  },

  // Cash Section (inside paymentSectionCard)
  cashInputLarge: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.primaryDark,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 8,
  },
  quickCashGrid: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  quickCashBtn: {
    flex: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  quickCashBtnPrimary: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primaryBorder,
  },
  quickCashText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textDark,
  },

  kembalianBoxSuccess: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.successContainer,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 10,
    padding: 10,
  },
  kembalianLabelSuccess: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.successAltDark,
  },
  kembalianValueSuccess: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.successAltDark,
    marginTop: 1,
  },
  kembalianBoxError: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.errorSoftBg,
    borderWidth: 1,
    borderColor: colors.errorSoftBorder,
    borderRadius: 10,
    padding: 10,
  },
  kembalianLabelError: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.errorTextDark,
  },
  kembalianValueError: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.errorTextDark,
    marginTop: 1,
  },
  kembalianBoxNeutral: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
  },
  kembalianTextNeutral: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Modal Footer
  modalFooterDock: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    backgroundColor: colors.textSecondary,
    elevation: 0,
    shadowOpacity: 0,
  },
  modalBayarText: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.2,
  },

  // Success Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.modalBackdrop,
    justifyContent: "center",
    padding: 16,
  },
  successModal: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surfaceMuted,
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
  successBtnText: { color: colors.onPrimary, fontWeight: "700", fontSize: 14 },
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
    backgroundColor: colors.surface,
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
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMetaCenter: {
    fontSize: 12,
    lineHeight: 17,
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
    borderBottomColor: colors.receiptDash,
    borderStyle: "dashed",
    marginVertical: 10,
  },
  receiptItem: {
    marginBottom: 8,
  },
  receiptItemName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptItemTotal: {
    fontSize: 12,
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
    fontSize: 12,
    lineHeight: 17,
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
    backgroundColor: colors.warningBannerBg,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: -4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  heldBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.warningTextDark,
  },
  heldBannerSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warningText,
    marginTop: 1,
  },
  heldOrderItemCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
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
    color: colors.primaryDark,
    marginTop: 4,
  },
  heldOrderDeleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.errorBannerBg,
    justifyContent: "center",
    alignItems: "center",
  },
  heldOrderRestoreBtn: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  heldOrderRestoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.onPrimary,
  },

  // Non-Cash & Payment Info Cards
  nonCashCard: {
    backgroundColor: colors.infoContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    padding: 12,
    marginTop: 0,
  },
  nonCashIconRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  nonCashCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.infoText,
  },
  nonCashCardSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.infoText,
    marginTop: 2,
    lineHeight: 17,
  },
  nonCashAmountBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.infoBorderSoft,
  },
  nonCashAmountLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.infoText,
  },
  nonCashAmountValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.infoText,
  },

  // Wholesale badge in cart
  cartWholesaleBadge: {
    backgroundColor: colors.successBadgeBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  cartWholesaleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.successDark,
  },

  // Kasbon form box
  kasbonBox: {
    backgroundColor: colors.warningContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    padding: 12,
    marginTop: 0,
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
    color: colors.warningTextDark,
    letterSpacing: 0.4,
  },
  kasbonSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warningText,
    marginBottom: 8,
  },
  sisaKasbonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  sisaKasbonLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.warningTextDark,
  },
  sisaKasbonVal: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.errorDark,
  },

  // Offline banner Kasir
  offlineBannerKasir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.warningContainer,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: -2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  offlineBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.warningTextDark,
  },
  offlineBannerSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warningText,
    marginTop: 1,
  },
  offlineSyncBtnKasir: {
    backgroundColor: colors.warningText,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  offlineSyncBtnKasirText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
  },

  // F&B box in Cart Modal
  fnbCardBox: {
    backgroundColor: colors.successSoftBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.successSoftBorder,
    padding: 12,
    marginTop: 0,
    marginBottom: 10,
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
    color: colors.successDark,
    letterSpacing: 0.4,
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
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  fnbTypeBtnActive: {
    backgroundColor: colors.successButtonDark,
    borderColor: colors.successButtonDark,
  },
  fnbTypeBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.textBodySecondary,
  },
  fnbTypeBtnTextActive: {
    color: colors.onPrimary,
    fontFamily: fonts.bold,
  },

  // ─── Realtime Table Orders Styles (F&B) ───
  tableOrdersBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.warningContainer,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: -2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.warningBannerBorder,
  },
  tableBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.warningTextDark,
  },
  tableBannerSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warningText,
    marginTop: 1,
  },
  tableCountBadge: {
    backgroundColor: colors.errorDark,
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  tableCountBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  tableOrderCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 4,
    elevation: 1,
    shadowColor: colors.text,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  tableOrderCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingBottom: 8,
    marginBottom: 6,
  },
  tableNumBadge: {
    backgroundColor: colors.warningBannerBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  tableNumBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.warningTextDark,
    letterSpacing: 0.5,
  },
  orderTimeText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  payMethodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payMethodQris: {
    backgroundColor: colors.infoBadgeBg,
  },
  payMethodCash: {
    backgroundColor: colors.successPillBg,
  },
  payMethodBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
  customerNameText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.secondary,
  },
  orderItemsContainer: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginVertical: 6,
  },
  orderItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  orderItemName: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: colors.secondary,
  },
  orderItemNote: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warningText,
    fontStyle: "italic",
    marginTop: 2,
  },
  orderItemSubtotal: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.textDark,
    marginLeft: 10,
  },
  orderGeneralNoteBox: {
    backgroundColor: colors.warningContainer,
    borderWidth: 1,
    borderColor: colors.warningBannerBg,
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
  },
  orderGeneralNoteText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.warningTextDark,
  },
  proofSection: {
    marginVertical: 8,
  },
  proofPreviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.infoContainer,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    borderRadius: 10,
    padding: 8,
  },
  proofThumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  proofBtnTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.infoText,
  },
  proofBtnSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.infoText,
  },
  noProofWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.errorSoftBg,
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: colors.errorBannerBg,
  },
  noProofWarningText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.errorDark,
    flex: 1,
  },
  orderTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  orderTotalLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: colors.textSecondary,
  },
  orderTotalValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
  },
  orderActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  btnCancelOrder: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.errorBorderStrong,
    backgroundColor: colors.errorSoftBg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  btnCancelOrderText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.errorDark,
  },
  btnAcceptOrder: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.successButtonDark,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  btnAcceptOrderText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.onPrimary,
  },
  proofModalBackdrop: {
    flex: 1,
    backgroundColor: colors.proofBackdrop,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  proofModalCloseBtn: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: colors.proofCloseBg,
    padding: 10,
    borderRadius: 22,
  },
  proofModalImage: {
    width: "100%",
    height: "80%",
  },
});

export default KasirScreen;
