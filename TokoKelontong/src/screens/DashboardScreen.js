import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ProductRepository from '../database/productRepository';
import TransactionRepository from '../database/transactionRepository';
import { formatRupiah } from '../utils/helpers';
import { colors, fonts } from '../theme/colors';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030];

const DashboardScreen = ({ navigation }) => {
  // Date selection states
  const [filterMode, setFilterMode] = useState('daily'); // 'daily' | 'monthly' | 'all'
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [isPickerVisible, setIsPickerVisible] = useState(false);

  // Summary state
  const [summary, setSummary] = useState({ omzet: 0, laba: 0, count: 0 });
  const [dateSubTitleText, setDateSubTitleText] = useState('');
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [recentTx, setRecentTx] = useState([]);

  // Helper formatting YYYY-MM-DD
  const formatYMD = (year, monthIndex, day) => {
    const y = year;
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const loadDashboardData = useCallback(() => {
    try {
      // 1. Data Produk & Stok
      const products = ProductRepository.getAllProducts();
      setTotalProducts(products.length);
      const lowStock = ProductRepository.getLowStockProducts();
      setLowStockProducts(lowStock);

      // 2. Filter transaksi sesuai mode yang dipilih
      let filteredTx = [];
      let subtitle = '';

      if (filterMode === 'daily') {
        const dateStr = formatYMD(selectedYear, selectedMonth, selectedDay);
        filteredTx = TransactionRepository.getTransactionsByDate(dateStr);

        const dateObj = new Date(selectedYear, selectedMonth, selectedDay);
        subtitle = dateObj.toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      } else if (filterMode === 'monthly') {
        const yearMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
        filteredTx = TransactionRepository.getMonthlyTransactions(yearMonthStr);
        subtitle = `Bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
      } else if (filterMode === 'all') {
        filteredTx = TransactionRepository.getMonthlyTransactions(''); // Semua
        subtitle = 'Semua Transaksi';
      }

      setDateSubTitleText(subtitle);

      // 3. Hitung Omzet & Laba Bersih
      const omzet = filteredTx.reduce((sum, t) => sum + (t.grand_total || 0), 0);
      let laba = 0;

      try {
        const fullReport = TransactionRepository.getFullReportForExport();
        const invoiceSet = new Set(filteredTx.map((t) => t.invoice_number));
        laba = fullReport
          .filter((r) => invoiceSet.has(r.No_Nota))
          .reduce((sum, r) => sum + (r.Total_Keuntungan || 0), 0);
      } catch (e) {
        console.error('Calculated laba error:', e);
      }

      setSummary({ omzet, laba, count: filteredTx.length });
      setRecentTx(filteredTx.slice(0, 5));
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  }, [filterMode, selectedDay, selectedMonth, selectedYear]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  // Set to today shortcut
  const handleSetToday = () => {
    const today = new Date();
    setSelectedDay(today.getDate());
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
    setFilterMode('daily');
  };

  // Days count in selected month/year
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const StatCard = ({ icon, label, value, subtext }) => (
    <View style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <View style={styles.statIconWrap}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.iconColor} />
        </View>
        <MaterialCommunityIcons name="arrow-up-right" size={16} color="#94A3B8" />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      {subtext && <Text style={styles.statSubtext}>{subtext}</Text>}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
      
      {/* ── Top Selector Card ── */}
      <View style={styles.topSelectorCard}>
        <View style={styles.topSelectorInfo}>
          <Text style={styles.topSelectorSub}>PERIODE DASHBOARD</Text>
          <Text style={styles.topSelectorTitle}>{dateSubTitleText}</Text>
        </View>

        <TouchableOpacity
          style={styles.changeDateBtn}
          onPress={() => setIsPickerVisible(true)}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="calendar-edit" size={18} color="#FFFFFF" />
          <Text style={styles.changeDateBtnText}>Pilih Tanggal</Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick Shortcut Chips ── */}
      <View style={styles.shortcutRow}>
        <TouchableOpacity
          style={[styles.shortcutChip, filterMode === 'daily' && isToday(selectedDay, selectedMonth, selectedYear) && styles.shortcutChipActive]}
          onPress={handleSetToday}
        >
          <MaterialCommunityIcons
            name="calendar-today"
            size={14}
            color={filterMode === 'daily' && isToday(selectedDay, selectedMonth, selectedYear) ? '#FFFFFF' : '#64748B'}
          />
          <Text style={[styles.shortcutChipText, filterMode === 'daily' && isToday(selectedDay, selectedMonth, selectedYear) && styles.shortcutChipTextActive]}>
            Hari Ini
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shortcutChip, filterMode === 'monthly' && styles.shortcutChipActive]}
          onPress={() => {
            setFilterMode('monthly');
          }}
        >
          <MaterialCommunityIcons
            name="calendar-month"
            size={14}
            color={filterMode === 'monthly' ? '#FFFFFF' : '#64748B'}
          />
          <Text style={[styles.shortcutChipText, filterMode === 'monthly' && styles.shortcutChipTextActive]}>
            Bulanan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.shortcutChip, filterMode === 'all' && styles.shortcutChipActive]}
          onPress={() => {
            setFilterMode('all');
          }}
        >
          <MaterialCommunityIcons
            name="calendar-range"
            size={14}
            color={filterMode === 'all' ? '#FFFFFF' : '#64748B'}
          />
          <Text style={[styles.shortcutChipText, filterMode === 'all' && styles.shortcutChipTextActive]}>
            Semua Transaksi
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Metric Cards Grid (2x2) ── */}
      <View style={styles.gridContainer}>
        <View style={styles.gridRow}>
          <StatCard
            icon="cash-multiple"
            label="Total Omzet"
            value={formatRupiah(summary.omzet)}
            subtext={`${summary.count} Transaksi`}
          />
          <StatCard
            icon="trending-up"
            label="Laba Bersih"
            value={formatRupiah(summary.laba)}
            subtext="Keuntungan kotor - modal"
          />
        </View>
        <View style={styles.gridRow}>
          <StatCard
            icon="receipt-text-outline"
            label="Total Transaksi"
            value={`${summary.count} Transaksi`}
            subtext="Struk berhasil"
          />
          <StatCard
            icon="package-variant-closed"
            label="Total Produk"
            value={`${totalProducts} Barang`}
            subtext="Aktif di katalog"
          />
        </View>
      </View>

      {/* ── Peringatan Stok Menipis ── */}
      {lowStockProducts.length > 0 && (
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.warningHeaderLeft}>
              <View style={styles.warningIconSquircle}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" />
              </View>
              <Text style={styles.warningTitle}>
                Stok Menipis ({lowStockProducts.length})
              </Text>
            </View>
            <TouchableOpacity
              style={styles.actionBtnPill}
              onPress={() => navigation.navigate('Gudang')}
            >
              <Text style={styles.actionBtnText}>Kelola →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.warningList}>
            {lowStockProducts.slice(0, 3).map((p) => (
              <View key={p.id} style={styles.lowStockRow}>
                <Text style={styles.lowStockName} numberOfLines={1}>
                  {p.product_name}
                </Text>
                <View style={styles.lowStockBadge}>
                  <Text style={styles.lowStockBadgeText}>
                    Sisa: {p.stock_quantity} {p.unit || 'pcs'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Transaksi Terakhir ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionIconSquircle}>
              <MaterialCommunityIcons name="history" size={18} color={colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Laporan')}>
            <Text style={styles.seeAllText}>Lihat Semua →</Text>
          </TouchableOpacity>
        </View>

        {recentTx.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="text-box-remove-outline" size={40} color="#CBD5E1" />
            <Text style={styles.emptyText}>Tidak ada transaksi pada periode ini</Text>
          </View>
        ) : (
          recentTx.map((tx) => (
            <View key={tx.id} style={styles.txCardRow}>
              <View style={styles.txIconBox}>
                <MaterialCommunityIcons name="receipt" size={18} color={colors.primary} />
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txInvoice}>{tx.invoice_number}</Text>
                <Text style={styles.txTime}>
                  {tx.created_at ? tx.created_at.slice(0, 16) : ''}
                </Text>
              </View>
              <Text style={styles.txAmount}>{formatRupiah(tx.grand_total)}</Text>
            </View>
          ))
        )}
      </View>

      {/* ── MODAL PILIH TANGGAL / BULAN / TAHUN ── */}
      <Modal
        visible={isPickerVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconSquircle}>
                  <MaterialCommunityIcons name="calendar-search" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Pilih Periode Tanggal</Text>
                  <Text style={styles.modalSub}>Tentukan Tanggal, Bulan, dan Tahun</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setIsPickerVisible(false)}>
                <MaterialCommunityIcons name="close-circle" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher inside Modal */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, filterMode === 'daily' && styles.modeTabActive]}
                onPress={() => setFilterMode('daily')}
              >
                <Text style={[styles.modeTabText, filterMode === 'daily' && styles.modeTabTextActive]}>
                  Per Tanggal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, filterMode === 'monthly' && styles.modeTabActive]}
                onPress={() => setFilterMode('monthly')}
              >
                <Text style={[styles.modeTabText, filterMode === 'monthly' && styles.modeTabTextActive]}>
                  Per Bulan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, filterMode === 'all' && styles.modeTabActive]}
                onPress={() => setFilterMode('all')}
              >
                <Text style={[styles.modeTabText, filterMode === 'all' && styles.modeTabTextActive]}>
                  Semua
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
              {filterMode !== 'all' && (
                <>
                  {/* 1. SELEKTOR TAHUN */}
                  <Text style={styles.pickerSectionLabel}>TAHUN</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                    {YEARS.map((yr) => (
                      <TouchableOpacity
                        key={yr}
                        style={[styles.pickerItem, selectedYear === yr && styles.pickerItemActive]}
                        onPress={() => setSelectedYear(yr)}
                      >
                        <Text style={[styles.pickerItemText, selectedYear === yr && styles.pickerItemTextActive]}>
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* 2. SELEKTOR BULAN */}
                  <Text style={styles.pickerSectionLabel}>BULAN</Text>
                  <View style={styles.monthGrid}>
                    {MONTH_NAMES.map((mName, mIdx) => (
                      <TouchableOpacity
                        key={mIdx}
                        style={[styles.monthGridItem, selectedMonth === mIdx && styles.monthGridItemActive]}
                        onPress={() => setSelectedMonth(mIdx)}
                      >
                        <Text style={[styles.monthGridText, selectedMonth === mIdx && styles.monthGridTextActive]}>
                          {mName.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 3. SELEKTOR TANGGAL (Jika Mode Daily) */}
                  {filterMode === 'daily' && (
                    <>
                      <Text style={styles.pickerSectionLabel}>TANGGAL ({MONTH_NAMES[selectedMonth]} {selectedYear})</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                        {daysArray.map((dNum) => (
                          <TouchableOpacity
                            key={dNum}
                            style={[styles.dayItem, selectedDay === dNum && styles.dayItemActive]}
                            onPress={() => setSelectedDay(dNum)}
                          >
                            <Text style={[styles.dayItemText, selectedDay === dNum && styles.dayItemTextActive]}>
                              {dNum}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </>
              )}

              {filterMode === 'all' && (
                <View style={styles.allInfoBox}>
                  <MaterialCommunityIcons name="information-outline" size={24} color={colors.primary} />
                  <Text style={styles.allInfoText}>
                    Menampilkan total omset, laba, dan riwayat transaksi dari seluruh periode tanpa batasan tanggal.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={() => {
                  handleSetToday();
                }}
              >
                <Text style={styles.modalResetText}>Hari Ini</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => {
                  setIsPickerVisible(false);
                }}
              >
                <Text style={styles.modalApplyText}>Terapkan Filter</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

// Helper check isToday
const isToday = (day, month, year) => {
  const t = new Date();
  return t.getDate() === day && t.getMonth() === month && t.getFullYear() === year;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Top Selector Card
  topSelectorCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 10,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  topSelectorInfo: {
    flex: 1,
    marginRight: 10,
  },
  topSelectorSub: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  topSelectorTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.text,
  },
  changeDateBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  changeDateBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
  },

  // Shortcut chips
  shortcutRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  shortcutChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  shortcutChipText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748B',
  },
  shortcutChipTextActive: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },

  // Grid Stats
  gridContainer: {
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.07)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  statValue: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 2,
  },
  statSubtext: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: '#94A3B8',
  },

  // Section Cards
  sectionCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.07)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  seeAllText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.primary,
  },

  // Warning Section
  warningHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#DC2626',
  },
  actionBtnPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  actionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#DC2626',
  },
  warningList: {
    gap: 8,
  },
  lowStockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lowStockName: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  lowStockBadge: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lowStockBadgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: '#DC2626',
  },

  // Transactions list
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#94A3B8',
  },
  txCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  txIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
  },
  txInvoice: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  txTime: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
  },
  txAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalIconSquircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.text,
  },
  modalSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
  },

  // Mode Tabs inside Modal
  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 3,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 11,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  modeTabText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748B',
  },
  modeTabTextActive: {
    fontFamily: fonts.bold,
    color: colors.text,
  },

  // Picker Labels & Rows
  pickerSectionLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.8,
    marginTop: 10,
    marginBottom: 8,
  },
  pickerRow: {
    gap: 8,
    paddingBottom: 4,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pickerItemActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  pickerItemText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#64748B',
  },
  pickerItemTextActive: {
    color: '#FFFFFF',
  },

  // Month Grid
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  monthGridItem: {
    width: '31%',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  monthGridItemActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  monthGridText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#64748B',
  },
  monthGridTextActive: {
    color: '#FFFFFF',
  },

  // Day Selector
  dayItem: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dayItemActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  dayItemText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#64748B',
  },
  dayItemTextActive: {
    color: '#FFFFFF',
  },

  allInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 14,
    gap: 12,
    marginVertical: 10,
  },
  allInfoText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Modal Footer Actions
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalResetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalResetText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalApplyText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

export default DashboardScreen;
