import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TransactionRepository from "../database/transactionRepository";
import useSyncStatus from "../hooks/useSyncStatus";
import { formatRupiah } from "../utils/helpers";
import { exportToCSV } from "../utils/exportCSV";
import {
  generateReceiptHTML,
  generateWAMessage,
  generateDailyClosingWAMessage,
} from "../utils/receiptGenerator";
import {
  isPrinterConfigured,
  isBluetoothPrintingSupported,
  printReceiptViaBluetooth,
} from "../utils/bluetoothPrinter";
import { colors, fonts } from "../theme/colors";
import usePlan from "../hooks/usePlan";
import { ProLockModal } from "../components/ProLock";

const TABS = ["Harian", "Bulanan", "Riwayat"];

// Konversi filter dari Dashboard ('daily' | 'monthly' | 'all') ke tab lokal
const FILTER_TO_TAB = {
  daily: "Harian",
  monthly: "Bulanan",
  all: "Riwayat",
};

const parseYmd = (ymdStr) => {
  const parts = String(ymdStr).split("-").map(Number);
  if (parts.length >= 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (parts.length === 2 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, 1);
  }
  return null;
};

const LaporanScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const initialFilter = route?.params?.initialFilter;
  const dateFilter = route?.params?.dateFilter;

  const [activeTab, setActiveTab] = useState(
    FILTER_TO_TAB[initialFilter] || "Harian",
  );
  const [transactions, setTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState({
    omzet: 0,
    omzet_tunai: 0,
    omzet_non_tunai: 0,
    laba: 0,
    count: 0,
    top_products: [],
  });

  // Tier langganan toko. Gratis = hanya laporan hari ini, CSV dikunci.
  const plan = usePlan();
  const isReadOnly = !plan.isPro;
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockFeature, setLockFeature] = useState("laporanLanjutan");
  const [selectedDate, setSelectedDate] = useState(
    () => parseYmd(dateFilter) || new Date(),
  );
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState([]);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [storeProfile, setStoreProfile] = useState({});
  const [btPrinterReady, setBtPrinterReady] = useState(false);
  const [offlineError, setOfflineError] = useState(null);
  const syncStatus = useSyncStatus();
  const prevUnsyncedRef = useRef(syncStatus.unsynced);
  const prevOfflineRef = useRef(syncStatus.offline);

  // Deteksi printer Bluetooth
  useEffect(() => {
    if (isBluetoothPrintingSupported()) {
      isPrinterConfigured()
        .then(setBtPrinterReady)
        .catch(() => setBtPrinterReady(false));
    }
  }, []);

  // Terapkan ulang parameter filter bila Dashboard mengirim params baru
  useEffect(() => {
    const paramFilter = route?.params?.initialFilter;
    const paramDate = route?.params?.dateFilter;
    if (paramFilter && FILTER_TO_TAB[paramFilter]) {
      setActiveTab(FILTER_TO_TAB[paramFilter]);
    }
    if (paramDate) {
      const parsed = parseYmd(paramDate);
      if (parsed) setSelectedDate(parsed);
    }
  }, [route?.params?.initialFilter, route?.params?.dateFilter]);

  const today = new Date();

  const getDateStr = () => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const d = String(selectedDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getMonthStr = () => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  };

  const isCurrentPeriod = () => {
    const now = new Date();
    if (activeTab === "Harian") {
      return (
        selectedDate.getDate() === now.getDate() &&
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getFullYear() === now.getFullYear()
      );
    }
    if (activeTab === "Bulanan") {
      return (
        selectedDate.getMonth() === now.getMonth() &&
        selectedDate.getFullYear() === now.getFullYear()
      );
    }
    return true;
  };

  const loadData = useCallback(async () => {
    try {
      setOfflineError(null);
      let data = [];
      let datePattern = "";

      if (activeTab === "Harian") {
        datePattern = getDateStr();
        data = await TransactionRepository.getTransactionsByDate(datePattern);
      } else if (activeTab === "Bulanan") {
        datePattern = getMonthStr();
        data = await TransactionRepository.getMonthlyTransactions(datePattern);
      } else {
        datePattern = "";
        data = await TransactionRepository.getMonthlyTransactions("");
      }

      const summaryRes =
        await TransactionRepository.getSummaryByDatePattern(datePattern);

      setTransactions(data || []);
      setSummary({
        omzet: summaryRes?.omzet || 0,
        omzet_tunai: summaryRes?.omzet_tunai || 0,
        omzet_non_tunai: summaryRes?.omzet_non_tunai || 0,
        laba: summaryRes?.laba || 0,
        count: data?.length || 0,
        top_products: summaryRes?.top_products || [],
      });
    } catch (e) {
      console.error("Load laporan error:", e);
      setTransactions([]);
      setSummary({
        omzet: 0,
        omzet_tunai: 0,
        omzet_non_tunai: 0,
        laba: 0,
        count: 0,
        top_products: [],
      });
      setOfflineError(e?.message || "Gagal memuat laporan.");
    }
  }, [activeTab, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  // Muat ulang otomatis bila transaksi lokal baru selesai tersinkron atau HP kembali online
  useEffect(() => {
    const syncedSome = syncStatus.unsynced < prevUnsyncedRef.current;
    const cameOnline = prevOfflineRef.current && !syncStatus.offline;
    prevUnsyncedRef.current = syncStatus.unsynced;
    prevOfflineRef.current = syncStatus.offline;
    if (syncedSome || cameOnline) {
      loadData();
    }
  }, [syncStatus.unsynced, syncStatus.offline, loadData]);

  const changeDate = (direction) => {
    if (isReadOnly) {
      setLockFeature("laporanLanjutan");
      setShowLockModal(true);
      return;
    }
    const d = new Date(selectedDate);
    if (activeTab === "Harian") {
      d.setDate(d.getDate() + direction);
    } else {
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    }
    setSelectedDate(d);
  };

  const resetToToday = () => {
    setSelectedDate(new Date());
  };

  const formatDisplayDate = () => {
    if (activeTab === "Harian") {
      return selectedDate.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return selectedDate.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });
  };

  const handleExportCSV = async () => {
    if (isReadOnly) {
      setLockFeature("laporanLanjutan");
      setShowLockModal(true);
      return;
    }
    try {
      const data = await TransactionRepository.getFullReportForExport();
      if (!data || data.length === 0) {
        Alert.alert("Info", "Tidak ada data untuk diekspor.");
        return;
      }

      const filename = `Laporan_Semua_Transaksi_${getDateStr().replace(/-/g, "")}.csv`;
      const result = await exportToCSV(data, filename);

      if (result.success) {
        if (Platform.OS !== "web") {
          Alert.alert("Berhasil", "Ekspor CSV berhasil disimpan!");
        }
      } else {
        Alert.alert("Gagal", result.message);
      }
    } catch (e) {
      Alert.alert("Gagal", "Gagal ekspor: " + e.message);
    }
  };

  const openTransactionDetails = async (tx) => {
    try {
      const details = await TransactionRepository.getTransactionDetails(tx.id);
      setTxDetails(details);
      setStoreProfile(await getStoreProfile());
      setSelectedTx(tx);
    } catch (e) {
      Alert.alert("Error", "Gagal mengambil detail transaksi: " + e.message);
    }
  };

  const getStoreProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem("@TokoKelontong:StoreProfile");
      if (saved) {
        const data = JSON.parse(saved);
        if (data.name && !data.storeName) {
          data.storeName = data.name;
        }
        return data;
      }
      const storeName =
        (await AsyncStorage.getItem("storeName")) || "Toko Kelontong";
      const logo = await AsyncStorage.getItem("storeLogo");
      const printerAddress = await AsyncStorage.getItem("printerAddress");
      return { name: storeName, logo, printerAddress };
    } catch {
      return {};
    }
  };

  const handlePrintReceipt = async () => {
    if (!selectedTx) return;
    if (Platform.OS === "web") {
      Alert.alert("Info", "Cetak hanya tersedia di Android.");
      return;
    }
    setIsLoadingReceipt(true);
    try {
      const profile = await getStoreProfile();
      const html = generateReceiptHTML(selectedTx, txDetails, profile);
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert("Error", "Gagal mencetak nota: " + e.message);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handlePrintBluetooth = async () => {
    if (!selectedTx) return;
    setIsLoadingReceipt(true);
    try {
      const profile = await getStoreProfile();
      await printReceiptViaBluetooth(selectedTx, txDetails, profile);
      Alert.alert("Berhasil", "Nota berhasil dikirim ke printer Bluetooth.");
    } catch (e) {
      Alert.alert(
        "Gagal Cetak",
        e.message || "Terjadi kesalahan saat mencetak ke printer Bluetooth.",
      );
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handleSharePDF = async () => {
    if (!selectedTx) return;
    if (Platform.OS === "web") {
      Alert.alert("Info", "Bagikan PDF hanya tersedia di Android.");
      return;
    }
    setIsLoadingReceipt(true);
    try {
      const profile = await getStoreProfile();
      const waText = generateWAMessage(selectedTx, txDetails, profile);
      const waUrl = `whatsapp://send?text=${encodeURIComponent(waText)}`;
      const canOpenWA = await Linking.canOpenURL(waUrl);
      if (canOpenWA) {
        await Linking.openURL(waUrl);
      } else {
        const html = generateReceiptHTML(selectedTx, txDetails, profile);
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
      Alert.alert("Error", "Gagal mengirim: " + e.message);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handleShareWAClosing = async () => {
    try {
      const profile = await getStoreProfile();
      const dateText =
        activeTab === "Riwayat" ? "Semua Transaksi" : formatDisplayDate();
      const msg = generateDailyClosingWAMessage(summary, profile, dateText);
      const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        const webUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
        Linking.openURL(webUrl).catch(() => {
          Alert.alert(
            "WhatsApp Tidak Ditemukan",
            "Pastikan aplikasi WhatsApp sudah terpasang di HP ini.",
          );
        });
      }
    } catch (e) {
      Alert.alert("Gagal Kirim", "Tidak dapat membuka WhatsApp: " + e.message);
    }
  };

  // Filter pencarian live berdasarkan nomor nota atau metode bayar
  const filteredTransactions = transactions.filter((tx) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const matchInvoice = (tx.invoice_number || "").toLowerCase().includes(q);
    const matchMethod = (tx.payment_method || "").toLowerCase().includes(q);
    return matchInvoice || matchMethod;
  });

  const getMethodBadgeInfo = (method) => {
    const m = (method || "cash").toLowerCase();
    if (m === "qris") {
      return {
        label: "QRIS",
        icon: "qrcode",
        badgeBg: "#E0F2FE",
        textClr: "#0369A1",
        iconClr: "#0284C7",
      };
    }
    if (m === "transfer") {
      return {
        label: "TRANSFER",
        icon: "bank-transfer",
        badgeBg: "#F3E8FF",
        textClr: "#7E22CE",
        iconClr: "#9333EA",
      };
    }
    if (m === "kasbon" || m === "debt") {
      return {
        label: "KASBON",
        icon: "book-account-outline",
        badgeBg: "#FEE2E2",
        textClr: "#B91C1C",
        iconClr: "#DC2626",
      };
    }
    return {
      label: "TUNAI",
      icon: "cash",
      badgeBg: "#F1F5F9",
      textClr: "#334155",
      iconClr: "#059669",
    };
  };

  const renderTransaction = ({ item }) => {
    const date = new Date(item.created_at);
    const timeStr = date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateStr = date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
    const badge = getMethodBadgeInfo(item.payment_method);
    const isNeedsReview = item.sync_status === "needs_review";
    const isPendingSync =
      item.sync_status === "pending" || (!item.sync_status && item.is_offline);

    return (
      <TouchableOpacity
        style={styles.txCard}
        onPress={() => openTransactionDetails(item)}
        activeOpacity={0.78}
      >
        {/* Info Transaksi Kiri */}
        <View style={styles.txLeft}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            <Text style={styles.txInvoice}>{item.invoice_number}</Text>
            <View
              style={[
                styles.methodBadge,
                { backgroundColor: badge.badgeBg },
              ]}
            >
              <Text
                style={[
                  styles.methodBadgeText,
                  { color: badge.textClr },
                ]}
              >
                {badge.label}
              </Text>
            </View>
            {isNeedsReview ? (
              <View style={[styles.syncBadge, styles.syncBadgeReview]}>
                <Text style={[styles.syncBadgeText, styles.syncBadgeTextReview]}>
                  Perlu ditinjau
                </Text>
              </View>
            ) : isPendingSync ? (
              <View style={[styles.syncBadge, styles.syncBadgePending]}>
                <Text style={[styles.syncBadgeText, styles.syncBadgeTextPending]}>
                  Belum terkirim
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.txDate}>
            {dateStr} · {timeStr}
          </Text>

          {item.discount_amount > 0 && (
            <View style={styles.discountPill}>
              <Text style={styles.discountPillText}>
                Diskon: {formatRupiah(item.discount_amount)}
              </Text>
            </View>
          )}
        </View>

        {/* Info Transaksi Kanan */}
        <View style={styles.txRight}>
          <Text style={styles.txTotal}>{formatRupiah(item.grand_total)}</Text>
          <Text style={styles.txMetaText}>
            Bayar: {formatRupiah(item.cash_received)}
          </Text>
          <Text style={styles.txReturnText}>
            Kembali: {formatRupiah(item.cash_return)}
          </Text>
        </View>

        <MaterialCommunityIcons
          name="chevron-right"
          size={18}
          color="#CBD5E1"
          style={{ marginLeft: 4 }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Banner Mode Gratis (hanya laporan hari ini) ── */}
      {isReadOnly && (
        <TouchableOpacity
          style={styles.readOnlyBanner}
          activeOpacity={0.85}
          onPress={() => {
            setLockFeature("laporanLanjutan");
            setShowLockModal(true);
          }}
        >
          <Text style={styles.readOnlyBannerText}>
            Paket Starter: menampilkan laporan hari ini. Laporan bulanan,
            riwayat lengkap & ekspor CSV tersedia di paket Pro.
          </Text>
          <Text style={styles.readOnlyBannerAction}>Upgrade</Text>
        </TouchableOpacity>
      )}

      {/* ── Segmented Control Tab Bar (Modern iOS/Android Pill) ── */}
      <View style={styles.segmentedContainer}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          const isLocked = isReadOnly && tab !== "Harian";
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
              onPress={() => {
                if (isLocked) {
                  setLockFeature("laporanLanjutan");
                  setShowLockModal(true);
                  return;
                }
                setActiveTab(tab);
              }}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text
                  style={[
                    styles.segmentText,
                    isActive && styles.segmentTextActive,
                  ]}
                >
                  {tab}
                </Text>
                {isLocked && (
                  <MaterialCommunityIcons
                    name="lock"
                    size={11}
                    color="#94A3B8"
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Banner Transaksi Belum Terkirim ── */}
      {syncStatus.unsynced > 0 && (
        <TouchableOpacity
          style={styles.unsyncedBanner}
          onPress={() => navigation?.navigate("TransaksiPending")}
          activeOpacity={0.75}
        >
          <MaterialCommunityIcons
            name={
              syncStatus.needsReview > 0
                ? "alert-circle-outline"
                : "cloud-upload-outline"
            }
            size={18}
            color={syncStatus.needsReview > 0 ? "#B91C1C" : "#B45309"}
          />
          <Text style={styles.unsyncedBannerText} numberOfLines={2}>
            {syncStatus.unsynced} transaksi belum terkirim ke server
            {syncStatus.needsReview > 0
              ? ` (${syncStatus.needsReview} perlu ditinjau)`
              : ""}
          </Text>
          <Text style={styles.unsyncedBannerAction}>Lihat</Text>
        </TouchableOpacity>
      )}

      {/* ── Date Navigator Card (Harian & Bulanan) ── */}
      {activeTab !== "Riwayat" && (
        <View style={styles.dateNavCard}>
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={styles.dateNavArrowBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color="#0F172A"
            />
          </TouchableOpacity>

          <View style={styles.dateNavCenter}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MaterialCommunityIcons
                name={activeTab === "Harian" ? "calendar" : "calendar-month"}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.dateNavTitle}>{formatDisplayDate()}</Text>
            </View>
            {!isCurrentPeriod() && (
              <TouchableOpacity
                onPress={resetToToday}
                style={styles.badgeJumpToday}
                activeOpacity={0.7}
              >
                <Text style={styles.badgeJumpTodayText}>
                  {activeTab === "Harian" ? "Kembali ke Hari Ini" : "Bulan Ini"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={[
              styles.dateNavArrowBtn,
              isCurrentPeriod() && { opacity: 0.3 },
            ]}
            disabled={isCurrentPeriod()}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color="#0F172A"
            />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Ringkasan Finansial Utama (Warm Orange Hero Card) ── */}
      <View style={styles.heroSummaryCard}>
        {/* Atas: Total Omzet & Badge Transaksi */}
        <View style={styles.summaryTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryOmzetLabel}>TOTAL OMZET PENJUALAN</Text>
            <Text style={styles.summaryOmzetValue}>
              {formatRupiah(summary.omzet)}
            </Text>
          </View>
          <View style={styles.summaryTxBadge}>
            <Text style={styles.summaryTxBadgeText}>
              {summary.count} Transaksi
            </Text>
          </View>
        </View>

        {/* Tengah: Estimasi Laba Bersih */}
        <View style={styles.profitBannerRow}>
          <View style={styles.profitPill}>
            <Text style={styles.profitLabel}>Estimasi Laba Bersih:</Text>
            <Text style={styles.profitValue}>
              {formatRupiah(summary.laba)}
            </Text>
          </View>
        </View>

        <View style={styles.summaryDivider} />

        {/* Bawah: Rincian Tunai di Laci vs Non-Tunai */}
        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <Text style={styles.splitColLabel}>Tunai (Laci Kasir)</Text>
            <Text style={styles.splitColValue}>
              {formatRupiah(summary.omzet_tunai || 0)}
            </Text>
          </View>

          <View style={styles.splitVerticalLine} />

          <View style={styles.splitCol}>
            <Text style={styles.splitColLabel}>Non-Tunai (QRIS/TF)</Text>
            <Text style={styles.splitColValue}>
              {formatRupiah(summary.omzet_non_tunai || 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Subheader Riwayat & Tombol Aksi (Kirim WA Rekap & CSV) ── */}
      <View style={styles.listHeaderRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.listHeaderTitle}>Riwayat Transaksi</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {filteredTransactions.length}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.btnActionWA}
            onPress={handleShareWAClosing}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="whatsapp"
              size={15}
              color="#15803D"
            />
            <Text style={styles.btnActionWAText}>Rekap WA</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btnActionCSV,
              isReadOnly && { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" },
            ]}
            onPress={handleExportCSV}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name={isReadOnly ? "lock-outline" : "file-delimited-outline"}
              size={15}
              color={isReadOnly ? "#64748B" : "#0284C7"}
            />
            <Text
              style={[
                styles.btnActionCSVText,
                isReadOnly && { color: "#64748B" },
              ]}
            >
              {isReadOnly ? "CSV (Pro)" : "CSV"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Filter Pencarian Cepat jika transaksi banyak / Tab Riwayat ── */}
      {transactions.length > 5 && (
        <View style={styles.searchBarWrap}>
          <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchBarInput}
            placeholder="Cari nomor nota atau tunai/qris..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={16}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* ── List Transaksi ── */}
      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              offlineError && { backgroundColor: "#FEF3C7" },
            ]}
          >
            <MaterialCommunityIcons
              name={offlineError ? "wifi-off" : "receipt-text-outline"}
              size={42}
              color={offlineError ? "#D97706" : colors.primary}
            />
          </View>
          <Text style={styles.emptyTitle}>
            {offlineError ? "Koneksi Diperlukan" : "Belum Ada Transaksi"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {offlineError
              ? offlineError
              : activeTab === "Harian"
                ? "Tidak ada transaksi penjualan pada tanggal yang dipilih."
                : activeTab === "Bulanan"
                  ? "Belum ada transaksi yang tercatat pada bulan ini."
                  : "Belum ada riwayat transaksi di toko."}
          </Text>
          {offlineError && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={loadData}
              activeOpacity={0.8}
            >
              <Text style={styles.retryBtnText}>Coba Lagi</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTransaction}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── Modal Pratinjau Struk Termal ── */}
      <Modal
        visible={!!selectedTx}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.modalTitle}>Detail Struk Transaksi</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedTx?.invoice_number}
                  {selectedTx?.sync_status === "needs_review"
                    ? " • Perlu ditinjau"
                    : selectedTx?.sync_status === "pending" ||
                        (!selectedTx?.sync_status && selectedTx?.is_offline)
                      ? " • Belum terkirim"
                      : ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedTx(null)}
                style={styles.modalCloseBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              showsVerticalScrollIndicator={false}
            >
              {selectedTx && (
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
                      No : {selectedTx.invoice_number}
                    </Text>
                    <Text style={styles.receiptMeta}>
                      {new Date(selectedTx.created_at).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  <View style={styles.receiptDash} />

                  {txDetails.map((detail, index) => (
                    <View key={index} style={styles.receiptItem}>
                      <Text style={styles.receiptItemName}>
                        {detail.product_name}
                      </Text>
                      <View style={styles.receiptMetaRow}>
                        <Text style={styles.receiptMeta}>
                          {detail.quantity} x{" "}
                          {formatRupiah(detail.price_at_sale)}
                        </Text>
                        <Text style={styles.receiptItemTotal}>
                          {formatRupiah(detail.quantity * detail.price_at_sale)}
                        </Text>
                      </View>
                    </View>
                  ))}

                  <View style={styles.receiptDash} />

                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMeta}>Subtotal</Text>
                    <Text style={styles.receiptMeta}>
                      {formatRupiah(selectedTx.total_price)}
                    </Text>
                  </View>
                  {selectedTx.discount_amount > 0 && (
                    <View style={styles.receiptMetaRow}>
                      <Text style={styles.receiptMeta}>Diskon</Text>
                      <Text style={[styles.receiptMeta, { color: "#DC2626" }]}>
                        -{formatRupiah(selectedTx.discount_amount)}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.receiptMetaRow, { marginTop: 6 }]}>
                    <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                    <Text style={styles.receiptTotalValue}>
                      {formatRupiah(selectedTx.grand_total)}
                    </Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMeta}>Metode</Text>
                    <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                      {(selectedTx.payment_method || "tunai").toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMeta}>Bayar</Text>
                    <Text style={styles.receiptMeta}>
                      {formatRupiah(selectedTx.cash_received)}
                    </Text>
                  </View>
                  <View style={styles.receiptMetaRow}>
                    <Text style={styles.receiptMeta}>Kembalian</Text>
                    <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                      {formatRupiah(selectedTx.cash_return)}
                    </Text>
                  </View>

                  <View style={styles.receiptDash} />

                  <Text style={styles.receiptFooter}>
                    {storeProfile.footerMessage ||
                      "Terima kasih telah berbelanja!"}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Actions */}
            <View style={styles.modalActions}>
              {isLoadingReceipt ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginVertical: 12 }}
                />
              ) : (
                <View style={{ flexDirection: "column", gap: 8, width: "100%" }}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {btPrinterReady && Platform.OS === "android" && (
                      <TouchableOpacity
                        style={styles.modalBtBtn}
                        onPress={handlePrintBluetooth}
                        activeOpacity={0.88}
                      >
                        <MaterialCommunityIcons
                          name="bluetooth"
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={styles.modalBtBtnText}>
                          Printer Bluetooth
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.modalPrintBtn,
                        !btPrinterReady && { flex: 1 },
                      ]}
                      onPress={handlePrintReceipt}
                      activeOpacity={0.88}
                    >
                      <MaterialCommunityIcons
                        name="printer"
                        size={18}
                        color="#FFFFFF"
                      />
                      <Text style={styles.modalPrintBtnText}>Cetak Nota</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.modalWABtn}
                    onPress={handleSharePDF}
                    activeOpacity={0.88}
                  >
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.modalWABtnText}>Kirim Struk via WA</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Banner Mode Gratis (read-only) ──
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 12,
  },
  readOnlyBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: "#9A3412",
    lineHeight: 16,
  },
  readOnlyBannerAction: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.primary,
  },

  // ── Segmented Control Tab Bar ──
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: colors.primary,
    elevation: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  segmentText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#9A3412",
  },
  segmentTextActive: {
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },

  // ── Date Navigator ──
  dateNavCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dateNavArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  dateNavTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  badgeJumpToday: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 1,
    backgroundColor: "#FFF7ED",
    borderRadius: 8,
  },
  badgeJumpTodayText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
  },

  // ── Unified Financial Hero Card (Warm Orange) ──
  heroSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: colors.primary,
    padding: 18,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 4,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryOmzetLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "rgba(255,255,255,0.82)",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  summaryOmzetValue: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  summaryTxBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  summaryTxBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  profitBannerRow: {
    marginTop: 10,
  },
  profitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  profitLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.85)",
  },
  profitValue: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    marginVertical: 12,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  splitCol: {
    flex: 1,
  },
  splitColLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.82)",
  },
  splitColValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 2,
  },
  splitVerticalLine: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    marginHorizontal: 12,
  },

  // ── List Header & Action Buttons ──
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  listHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  countBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#475569",
  },
  btnActionWA: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnActionWAText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#15803D",
  },
  btnActionCSV: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  btnActionCSVText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#0284C7",
  },

  // ── Search Bar Filter ──
  searchBarWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    height: 38,
  },
  searchBarInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#0F172A",
    marginLeft: 6,
    padding: 0,
  },

  // ── Transaction Item Card ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txMethodIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  txLeft: {
    flex: 1,
    marginRight: 8,
  },
  txInvoice: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  methodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  methodBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  syncBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  syncBadgePending: {
    backgroundColor: "#FEF3C7",
  },
  syncBadgeReview: {
    backgroundColor: "#FEE2E2",
  },
  syncBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
  },
  syncBadgeTextPending: {
    color: "#B45309",
  },
  syncBadgeTextReview: {
    color: "#B91C1C",
  },
  unsyncedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  unsyncedBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#92400E",
  },
  unsyncedBannerAction: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#B45309",
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  txDate: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  discountPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF2F2",
    alignSelf: "flex-start",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginTop: 3,
  },
  discountPillText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#DC2626",
  },
  txRight: {
    alignItems: "flex-end",
  },
  txTotal: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: "#0F172A",
  },
  txMetaText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },
  txReturnText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: "#64748B",
    marginTop: 1,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 20,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
  },

  // ── Modal Struk Termal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    width: "100%",
    maxWidth: 440,
    maxHeight: "88%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  modalBody: {
    padding: 16,
  },
  receiptPaper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 16,
  },
  receiptStoreName: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    color: "#0F172A",
    letterSpacing: 0.5,
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMetaCenter: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  receiptMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: "#475569",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptDash: {
    borderBottomWidth: 1,
    borderBottomColor: "#CBD5E1",
    borderStyle: "dashed",
    marginVertical: 8,
  },
  receiptItem: {
    marginBottom: 6,
  },
  receiptItemName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptItemTotal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptFooter: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    color: "#94A3B8",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // Modal Actions
  modalActions: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    backgroundColor: "#F8FAFC",
  },
  modalBtBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0F172A",
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalBtBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  modalPrintBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalPrintBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  modalWABtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#16A34A",
    paddingVertical: 11,
    borderRadius: 10,
  },
  modalWABtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
});

export default LaporanScreen;
