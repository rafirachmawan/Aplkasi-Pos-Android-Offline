import React, { useState, useCallback, useEffect } from "react";
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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TransactionRepository from "../database/transactionRepository";
import { formatRupiah } from "../utils/helpers";
import { exportToCSV } from "../utils/exportCSV";
import {
  generateReceiptHTML,
  generateWAMessage,
} from "../utils/receiptGenerator";
import { colors, fonts } from "../theme/colors";

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

const LaporanScreen = ({ route }) => {
  // Terima parameter filter dari Dashboard (initialFilter & dateFilter)
  const initialFilter = route?.params?.initialFilter;
  const dateFilter = route?.params?.dateFilter;
  const [activeTab, setActiveTab] = useState(
    FILTER_TO_TAB[initialFilter] || "Harian",
  );
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ omzet: 0, laba: 0, count: 0 });
  const [selectedDate, setSelectedDate] = useState(
    () => parseYmd(dateFilter) || new Date(),
  );
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState([]);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const [storeProfile, setStoreProfile] = useState({});

  // Terapkan ulang parameter filter bila Dashboard mengirim params baru
  // saat layar Laporan sudah terbuka di stack navigasi
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

  const loadData = useCallback(async () => {
    try {
      let data = [];
      let datePattern = "";

      if (activeTab === "Harian") {
        datePattern = getDateStr();
        data = await TransactionRepository.getTransactionsByDate(datePattern);
      } else if (activeTab === "Bulanan") {
        datePattern = getMonthStr();
        data = await TransactionRepository.getMonthlyTransactions(datePattern);
      } else {
        // Riwayat: ambil semua
        datePattern = "";
        data = await TransactionRepository.getMonthlyTransactions("");
      }

      // Hitung Omzet & Laba Bersih presisi via agregasi di repository
      const summaryRes =
        await TransactionRepository.getSummaryByDatePattern(datePattern);

      setTransactions(data);
      setSummary({
        omzet: summaryRes.omzet,
        laba: summaryRes.laba,
        count: data.length,
      });
    } catch (e) {
      console.error("Load laporan error:", e);
    }
  }, [activeTab, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const changeDate = (direction) => {
    const d = new Date(selectedDate);
    if (activeTab === "Harian") {
      d.setDate(d.getDate() + direction);
    } else {
      // Setel ke tanggal 1 dulu agar tanggal 29-31 tidak "lompat"
      // ke bulan berikutnya saat bulan tujuan lebih pendek.
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    }
    setSelectedDate(d);
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
    try {
      const data = await TransactionRepository.getFullReportForExport();
      if (data.length === 0) {
        Alert.alert("Info", "Tidak ada data untuk diekspor.");
        return;
      }

      // Ekspor selalu mengambil seluruh riwayat transaksi
      const filename = `Laporan_Semua_Transaksi_${getDateStr().replace(/-/g, "")}.csv`;
      const result = await exportToCSV(data, filename);

      if (result.success) {
        if (Platform.OS !== "web") {
          Alert.alert("Berhasil", "Ekspor CSV berhasil!");
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
        // Migrasi format lama dari menu Pengaturan ({name, ...})
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
      const storeProfile = await getStoreProfile();
      const html = generateReceiptHTML(selectedTx, txDetails, storeProfile);
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert("Error", "Gagal mencetak nota: " + e.message);
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
      const storeProfile = await getStoreProfile();
      // Kirim pesan teks ke WhatsApp dulu
      const waText = generateWAMessage(selectedTx, txDetails, storeProfile);
      const waUrl = `whatsapp://send?text=${encodeURIComponent(waText)}`;
      const canOpenWA = await Linking.canOpenURL(waUrl);
      if (canOpenWA) {
        await Linking.openURL(waUrl);
      } else {
        // Fallback: share PDF jika WA tidak tersedia
        const html = generateReceiptHTML(selectedTx, txDetails, storeProfile);
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
    return (
      <TouchableOpacity
        style={styles.txCard}
        onPress={() => openTransactionDetails(item)}
      >
        <View style={styles.txLeft}>
          <Text style={styles.txInvoice}>{item.invoice_number}</Text>
          <Text style={styles.txDate}>
            {dateStr} · {timeStr}
          </Text>
          {item.discount_amount > 0 && (
            <Text style={styles.txDiscount}>
              Diskon: {formatRupiah(item.discount_amount)}
            </Text>
          )}
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txTotal}>{formatRupiah(item.grand_total)}</Text>
          <Text style={styles.txCash}>
            Bayar: {formatRupiah(item.cash_received)}
          </Text>
          <Text style={styles.txReturn}>
            Kembali: {formatRupiah(item.cash_return)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.tabTextActive,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Navigator (hanya untuk Harian & Bulanan) */}
      {activeTab !== "Riwayat" && (
        <View style={styles.dateNav}>
          <TouchableOpacity
            onPress={() => changeDate(-1)}
            style={styles.navBtn}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDisplayDate()}</Text>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={styles.navBtn}
            disabled={
              activeTab === "Harian"
                ? getDateStr() >=
                  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
                : getMonthStr() >=
                  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
            }
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <MaterialCommunityIcons
              name="cash"
              size={22}
              color={colors.iconColor}
            />
          </View>
          <Text style={styles.summaryLabel}>Omzet</Text>
          <Text style={styles.summaryValue}>{formatRupiah(summary.omzet)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <MaterialCommunityIcons
              name="trending-up"
              size={22}
              color={colors.iconColor}
            />
          </View>
          <Text style={styles.summaryLabel}>Laba Bersih</Text>
          <Text style={styles.summaryValue}>{formatRupiah(summary.laba)}</Text>
        </View>
        <View style={styles.summaryCard}>
          <View style={styles.summaryIconWrap}>
            <MaterialCommunityIcons
              name="receipt"
              size={22}
              color={colors.iconColor}
            />
          </View>
          <Text style={styles.summaryLabel}>Transaksi</Text>
          <Text style={styles.summaryValue}>{summary.count}x</Text>
        </View>
      </View>

      {/* Daftar Transaksi */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Riwayat Transaksi</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
          <MaterialCommunityIcons
            name="file-export"
            size={16}
            color={colors.secondary}
          />
          <Text style={styles.exportText}>Ekspor CSV</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons
            name="receipt-text-outline"
            size={60}
            color={colors.border}
          />
          <Text style={styles.emptyText}>Belum ada transaksi</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderTransaction}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}

      {/* Modal Detail Transaksi */}
      <Modal
        visible={!!selectedTx}
        animationType="slide"
        transparent
        statusBarTranslucent={true}
        onRequestClose={() => setSelectedTx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Transaksi</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedTx && (
                /* ── Pratinjau Nota (format struk termal, sama dgn Kasir) ── */
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
                      {new Date(selectedTx.created_at).toLocaleString(
                        "id-ID",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
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
                      <Text
                        style={[styles.receiptMeta, { color: "#DC2626" }]}
                      >
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
                    <Text style={styles.receiptMeta}>Tunai</Text>
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
            {/* Action Buttons */}
            <View style={styles.modalActions}>
              {isLoadingReceipt ? (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={{ marginVertical: 12 }}
                />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={handlePrintReceipt}
                  >
                    <MaterialCommunityIcons
                      name="printer"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.actionBtnText}>Cetak Nota</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: "#25D366" }]}
                    onPress={handleSharePDF}
                  >
                    <MaterialCommunityIcons
                      name="whatsapp"
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.actionBtnText}>Kirim PDF</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Tabs
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: "600" },
  tabTextActive: { color: colors.primary },

  // Date Navigator
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  navBtn: { padding: 4 },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    flex: 1,
  },

  // Summary Cards
  summaryRow: { flexDirection: "row", padding: 12, gap: 8 },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    elevation: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.iconBg,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 4,
    textAlign: "center",
    color: colors.text,
  },

  // List Header
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  exportText: { fontSize: 13, color: colors.secondary, fontWeight: "600" },

  // Transaction Card
  txCard: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
  },
  txLeft: { flex: 1 },
  txInvoice: { fontSize: 13, fontWeight: "700", color: colors.text },
  txDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txDiscount: {
    fontSize: 11,
    color: colors.error,
    marginTop: 4,
    fontWeight: "600",
  },
  txTotal: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.primary,
    textAlign: "right",
  },
  txCash: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: "right",
  },
  txReturn: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: "right",
  },

  // Modal Detail
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    width: "100%",
    maxWidth: 450,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: colors.text },
  modalBody: { padding: 20 },
  detailHeader: { alignItems: "center", marginBottom: 16 },
  detailInvoice: {
    fontSize: 18,
    fontWeight: "bold",
    color: colors.primary,
    marginBottom: 4,
  },
  detailDate: { fontSize: 13, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: colors.text,
    marginBottom: 8,
  },
  detailItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  detailItemName: { fontSize: 14, fontWeight: "600", color: colors.text },
  detailItemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  detailItemTotal: { fontSize: 14, fontWeight: "bold", color: colors.text },
  calcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  calcLabel: { fontSize: 14, color: colors.textSecondary },
  calcValue: { fontSize: 14, fontWeight: "600", color: colors.text },

  // Modal Action Buttons
  modalActions: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: "#F8FAFC",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  // Empty
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
  },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },

  // ── Pratinjau Nota (kertas struk termal, sama dgn Kasir) ──
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

export default LaporanScreen;
