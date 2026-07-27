import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import ProductRepository from '../database/productRepository';
import TransactionRepository from '../database/transactionRepository';
import { formatRupiah } from '../utils/helpers';
import { colors } from '../theme/colors';

const DashboardScreen = ({ navigation }) => {
  const [todaySummary, setTodaySummary] = useState({ omzet: 0, laba: 0, count: 0 });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [recentTx, setRecentTx] = useState([]);

  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  useFocusEffect(
    useCallback(() => {
      try {
        // Produk
        const products = ProductRepository.getAllProducts();
        setTotalProducts(products.length);
        const lowStock = ProductRepository.getLowStockProducts();
        setLowStockProducts(lowStock);

        // Transaksi hari ini
        const todayTx = TransactionRepository.getTransactionsByDate(getTodayStr());
        const omzet = todayTx.reduce((s, t) => s + t.grand_total, 0);

        // Laba
        let laba = 0;
        try {
          const full = TransactionRepository.getFullReportForExport();
          const today = getTodayStr();
          laba = full.filter(r => r.Tanggal === today).reduce((s, r) => s + (r.Total_Keuntungan || 0), 0);
        } catch (_) {}

        setTodaySummary({ omzet, laba, count: todayTx.length });
        setRecentTx(todayTx.slice(0, 5));
      } catch (e) {
        console.error('Dashboard load error:', e);
      }
    }, [])
  );

  const StatCard = ({ icon, label, value, color, bg }) => (
    <View style={[styles.statCard, { backgroundColor: bg }]}>
      <MaterialCommunityIcons name={icon} size={26} color={color} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}>
      {/* Greeting */}
      <View style={styles.greeting}>
        <View>
          <Text style={styles.greetSub}>Ringkasan Hari Ini</Text>
          <Text style={styles.greetDate}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>
        <MaterialCommunityIcons name="chart-line" size={32} color={colors.primary} />
      </View>

      {/* Stat Cards */}
      <View style={styles.statsRow}>
        <StatCard icon="cash" label="Omzet Hari Ini" value={formatRupiah(todaySummary.omzet)} color={colors.primary} bg="#D1FAE5" />
        <StatCard icon="trending-up" label="Laba Bersih" value={formatRupiah(todaySummary.laba)} color={colors.secondary} bg="#DBEAFE" />
      </View>
      <View style={styles.statsRow}>
        <StatCard icon="receipt" label="Transaksi" value={`${todaySummary.count}x`} color={colors.warning} bg="#FEF3C7" />
        <StatCard icon="package-variant" label="Total Produk" value={`${totalProducts} item`} color="#8B5CF6" bg="#EDE9FE" />
      </View>

      {/* Low Stock Alert */}
      {lowStockProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="alert-circle" size={18} color={colors.error} />
            <Text style={[styles.sectionTitle, { color: colors.error }]}>
              ⚠️ Stok Menipis ({lowStockProducts.length} barang)
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Gudang')}>
              <Text style={styles.seeAll}>Kelola →</Text>
            </TouchableOpacity>
          </View>
          {lowStockProducts.map(p => (
            <View key={p.id} style={styles.lowStockItem}>
              <Text style={styles.lowStockName} numberOfLines={1}>{p.product_name}</Text>
              <View style={styles.lowStockBadge}>
                <Text style={styles.lowStockQty}>Sisa: {p.stock_quantity}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Transaksi Terakhir */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="history" size={18} color={colors.text} />
          <Text style={styles.sectionTitle}>Transaksi Terakhir</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Laporan')}>
            <Text style={styles.seeAll}>Lihat Semua →</Text>
          </TouchableOpacity>
        </View>
        {recentTx.length === 0 ? (
          <View style={styles.emptyTx}>
            <Text style={styles.emptyTxText}>Belum ada transaksi hari ini</Text>
          </View>
        ) : (
          recentTx.map(tx => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txIcon}>
                <MaterialCommunityIcons name="receipt-text" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.txInvoice}>{tx.invoice_number}</Text>
                <Text style={styles.txTime}>
                  {new Date(tx.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <Text style={styles.txAmount}>{formatRupiah(tx.grand_total)}</Text>
            </View>
          ))
        )}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Kasir')}>
            <MaterialCommunityIcons name="cart-plus" size={24} color={colors.primary} />
            <Text style={styles.quickLabel}>Kasir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Gudang')}>
            <MaterialCommunityIcons name="package-variant-closed" size={24} color={colors.secondary} />
            <Text style={styles.quickLabel}>Gudang</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('Laporan')}>
            <MaterialCommunityIcons name="chart-box" size={24} color={colors.warning} />
            <Text style={styles.quickLabel}>Laporan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => navigation.navigate('SettingNota')}>
            <MaterialCommunityIcons name="receipt" size={24} color="#8B5CF6" />
            <Text style={styles.quickLabel}>Nota</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  greeting: {
    backgroundColor: colors.background,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  greetSub: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  greetDate: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 10 },
  statCard: {
    flex: 1, borderRadius: 14, padding: 14,
    alignItems: 'flex-start', elevation: 1,
  },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 6 },
  statValue: { fontSize: 15, fontWeight: 'bold', marginTop: 4 },

  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 12, marginTop: 14,
    borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: 12, color: colors.primary, fontWeight: '600' },

  // Low stock
  lowStockItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  lowStockName: { flex: 1, fontSize: 13, color: colors.text },
  lowStockBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  lowStockQty: { fontSize: 12, color: colors.error, fontWeight: '600' },

  // Transaction rows
  emptyTx: { alignItems: 'center', paddingVertical: 16 },
  emptyTxText: { fontSize: 13, color: colors.textSecondary },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  txIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  txInvoice: { fontSize: 13, fontWeight: '600', color: colors.text },
  txTime: { fontSize: 11, color: colors.textSecondary },
  txAmount: { fontSize: 14, fontWeight: 'bold', color: colors.primary },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  quickBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
    backgroundColor: colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  quickLabel: { fontSize: 12, color: colors.text, fontWeight: '600', marginTop: 6 },
});

export default DashboardScreen;
