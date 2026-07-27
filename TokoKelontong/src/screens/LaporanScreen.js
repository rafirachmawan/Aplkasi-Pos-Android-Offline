import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TransactionRepository from '../database/transactionRepository';
import { formatRupiah } from '../utils/helpers';
import { exportToCSV } from '../utils/exportCSV';
import { generateReceiptHTML, generateWAMessage } from '../utils/receiptGenerator';
import { colors } from '../theme/colors';

const TABS = ['Harian', 'Bulanan', 'Riwayat'];

const LaporanScreen = () => {
  const [activeTab, setActiveTab] = useState('Harian');
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({ omzet: 0, laba: 0, count: 0 });
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState([]);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

  const today = new Date();

  const getDateStr = () => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getMonthStr = () => {
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const loadData = useCallback(() => {
    try {
      let data = [];
      if (activeTab === 'Harian') {
        data = TransactionRepository.getTransactionsByDate(getDateStr());
      } else if (activeTab === 'Bulanan') {
        data = TransactionRepository.getMonthlyTransactions(getMonthStr());
      } else {
        // Riwayat: ambil semua
        data = TransactionRepository.getMonthlyTransactions('');
      }

      const omzet = data.reduce((sum, t) => sum + t.grand_total, 0);
      // Laba dihitung dari grand_total - (harga modal * qty) — perlu join
      // Estimasi cepat: grand_total - (total_price - discount) * ratio modal
      // Untuk MVP: kita simpan sebagai grand_total saja, laba dari getFullReport
      let laba = 0;
      try {
        const fullReport = TransactionRepository.getFullReportForExport();
        // Filter sesuai tab
        const filtered = fullReport.filter(r => {
          if (activeTab === 'Harian') return r.Tanggal === getDateStr();
          if (activeTab === 'Bulanan') return r.Tanggal && r.Tanggal.startsWith(getMonthStr());
          return true;
        });
        laba = filtered.reduce((sum, r) => sum + (r.Total_Keuntungan || 0), 0);
      } catch (_) {}

      setTransactions(data);
      setSummary({ omzet, laba, count: data.length });
    } catch (e) {
      console.error('Load laporan error:', e);
    }
  }, [activeTab, selectedDate]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const changeDate = (direction) => {
    const d = new Date(selectedDate);
    if (activeTab === 'Harian') {
      d.setDate(d.getDate() + direction);
    } else {
      d.setMonth(d.getMonth() + direction);
    }
    setSelectedDate(d);
  };

  const formatDisplayDate = () => {
    if (activeTab === 'Harian') {
      return selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    return selectedDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  const handleExportCSV = async () => {
    try {
      const data = TransactionRepository.getFullReportForExport();
      if (data.length === 0) {
        alert('Tidak ada data untuk diekspor.');
        return;
      }
      
      const filename = `Laporan_Toko_${getDateStr().replace(/-/g, '')}.csv`;
      const result = await exportToCSV(data, filename);
      
      if (result.success) {
        if (Platform.OS !== 'web') {
           alert('Ekspor CSV berhasil!');
        }
      } else {
        alert(result.message);
      }
    } catch (e) {
      alert('Gagal ekspor: ' + e.message);
    }
  };

  const openTransactionDetails = (tx) => {
    try {
      const details = TransactionRepository.getTransactionDetails(tx.id);
      setTxDetails(details);
      setSelectedTx(tx);
    } catch (e) {
      alert('Gagal mengambil detail transaksi: ' + e.message);
    }
  };

  const getStoreProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem('@TokoKelontong:StoreProfile');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const handlePrintReceipt = async () => {
    if (!selectedTx) return;
    if (Platform.OS === 'web') { Alert.alert('Info', 'Cetak hanya tersedia di Android.'); return; }
    setIsLoadingReceipt(true);
    try {
      const storeProfile = await getStoreProfile();
      const html = generateReceiptHTML(selectedTx, txDetails, storeProfile);
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert('Error', 'Gagal mencetak nota: ' + e.message);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const handleSharePDF = async () => {
    if (!selectedTx) return;
    if (Platform.OS === 'web') { Alert.alert('Info', 'Bagikan PDF hanya tersedia di Android.'); return; }
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
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Kirim Nota via...' });
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal mengirim: ' + e.message);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  const renderTransaction = ({ item }) => {
    const date = new Date(item.created_at);
    const timeStr = date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const dateStr = date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return (
      <TouchableOpacity style={styles.txCard} onPress={() => openTransactionDetails(item)}>
        <View style={styles.txLeft}>
          <Text style={styles.txInvoice}>{item.invoice_number}</Text>
          <Text style={styles.txDate}>{dateStr} · {timeStr}</Text>
          {item.discount_amount > 0 && (
            <Text style={styles.txDiscount}>Diskon: {formatRupiah(item.discount_amount)}</Text>
          )}
        </View>
        <View style={styles.txRight}>
          <Text style={styles.txTotal}>{formatRupiah(item.grand_total)}</Text>
          <Text style={styles.txCash}>Bayar: {formatRupiah(item.cash_received)}</Text>
          <Text style={styles.txReturn}>Kembali: {formatRupiah(item.cash_return)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Navigator (hanya untuk Harian & Bulanan) */}
      {activeTab !== 'Riwayat' && (
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => changeDate(-1)} style={styles.navBtn}>
            <MaterialCommunityIcons name="chevron-left" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.dateText}>{formatDisplayDate()}</Text>
          <TouchableOpacity
            onPress={() => changeDate(1)}
            style={styles.navBtn}
            disabled={activeTab === 'Harian'
              ? getDateStr() >= today.toISOString().split('T')[0]
              : getMonthStr() >= `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
            }
          >
            <MaterialCommunityIcons name="chevron-right" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: '#D1FAE5' }]}>
          <MaterialCommunityIcons name="cash" size={28} color={colors.primary} />
          <Text style={styles.summaryLabel}>Omzet</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{formatRupiah(summary.omzet)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#DBEAFE' }]}>
          <MaterialCommunityIcons name="trending-up" size={28} color={colors.secondary} />
          <Text style={styles.summaryLabel}>Laba Bersih</Text>
          <Text style={[styles.summaryValue, { color: colors.secondary }]}>{formatRupiah(summary.laba)}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: '#FEF3C7' }]}>
          <MaterialCommunityIcons name="receipt" size={28} color={colors.warning} />
          <Text style={styles.summaryLabel}>Transaksi</Text>
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{summary.count}x</Text>
        </View>
      </View>

      {/* Daftar Transaksi */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Riwayat Transaksi</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV}>
          <MaterialCommunityIcons name="file-export" size={16} color={colors.secondary} />
          <Text style={styles.exportText}>Ekspor CSV</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="receipt-text-outline" size={60} color={colors.border} />
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
      <Modal visible={!!selectedTx} animationType="slide" transparent onRequestClose={() => setSelectedTx(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Detail Transaksi</Text>
              <TouchableOpacity onPress={() => setSelectedTx(null)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              {selectedTx && (
                <>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailInvoice}>{selectedTx.invoice_number}</Text>
                    <Text style={styles.detailDate}>
                      {new Date(selectedTx.created_at).toLocaleString('id-ID', {
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <View style={styles.divider} />
                  
                  <Text style={styles.sectionTitle}>Daftar Barang</Text>
                  {txDetails.map((detail, index) => (
                    <View key={index} style={styles.detailItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailItemName}>{detail.product_name}</Text>
                        <Text style={styles.detailItemSub}>{detail.quantity} x {formatRupiah(detail.price_at_sale)}</Text>
                      </View>
                      <Text style={styles.detailItemTotal}>{formatRupiah(detail.quantity * detail.price_at_sale)}</Text>
                    </View>
                  ))}
                  <View style={styles.divider} />
                  
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Subtotal</Text>
                    <Text style={styles.calcValue}>{formatRupiah(selectedTx.total_price)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Diskon</Text>
                    <Text style={styles.calcValue}>{formatRupiah(selectedTx.discount_amount)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={[styles.calcLabel, { fontWeight: 'bold', color: colors.primary }]}>Total Akhir</Text>
                    <Text style={[styles.calcValue, { fontWeight: 'bold', color: colors.primary, fontSize: 16 }]}>
                      {formatRupiah(selectedTx.grand_total)}
                    </Text>
                  </View>
                  <View style={[styles.calcRow, { marginTop: 12 }]}>
                    <Text style={styles.calcLabel}>Uang Masuk</Text>
                    <Text style={styles.calcValue}>{formatRupiah(selectedTx.cash_received)}</Text>
                  </View>
                  <View style={styles.calcRow}>
                    <Text style={styles.calcLabel}>Kembalian</Text>
                    <Text style={styles.calcValue}>{formatRupiah(selectedTx.cash_return)}</Text>
                  </View>
                </>
              )}
            </ScrollView>
            {/* Action Buttons */}
            <View style={styles.modalActions}>
              {isLoadingReceipt ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : (
                <>
                  <TouchableOpacity style={styles.actionBtn} onPress={handlePrintReceipt}>
                    <MaterialCommunityIcons name="printer" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Cetak Nota</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={handleSharePDF}>
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#fff" />
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
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 12, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  tabTextActive: { color: colors.primary },

  // Date Navigator
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  navBtn: { padding: 4 },
  dateText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center', flex: 1 },

  // Summary Cards
  summaryRow: { flexDirection: 'row', padding: 12, gap: 8 },
  summaryCard: {
    flex: 1, borderRadius: 14, padding: 12, alignItems: 'center',
    elevation: 1,
  },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
  summaryValue: { fontSize: 13, fontWeight: 'bold', marginTop: 4, textAlign: 'center' },

  // List Header
  listHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  listTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  exportText: { fontSize: 13, color: colors.secondary, fontWeight: '600' },

  // Transaction Card
  txCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 12, marginVertical: 4,
    padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    elevation: 1,
  },
  txLeft: { flex: 1 },
  txInvoice: { fontSize: 13, fontWeight: '700', color: colors.text },
  txDate: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  txDiscount: { fontSize: 11, color: colors.error, marginTop: 4, fontWeight: '600' },
  txTotal: { fontSize: 14, fontWeight: 'bold', color: colors.primary, textAlign: 'right' },
  txCash: { fontSize: 11, color: colors.textSecondary, marginTop: 4, textAlign: 'right' },
  txReturn: { fontSize: 11, color: colors.textSecondary, marginTop: 2, textAlign: 'right' },

  // Modal Detail
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    width: '100%',
    maxWidth: 450,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  modalBody: { padding: 20 },
  detailHeader: { alignItems: 'center', marginBottom: 16 },
  detailInvoice: { fontSize: 18, fontWeight: 'bold', color: colors.primary, marginBottom: 4 },
  detailDate: { fontSize: 13, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 8 },
  detailItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  detailItemName: { fontSize: 14, fontWeight: '600', color: colors.text },
  detailItemSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  detailItemTotal: { fontSize: 14, fontWeight: 'bold', color: colors.text },
  calcRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  calcLabel: { fontSize: 14, color: colors.textSecondary },
  calcValue: { fontSize: 14, fontWeight: '600', color: colors.text },

  // Modal Action Buttons
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Empty
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
});

export default LaporanScreen;
