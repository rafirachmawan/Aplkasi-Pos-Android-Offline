import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

const menuItems = [
  {
    name: 'Dashboard',
    icon: 'view-dashboard',
    color: '#10B981',
    bg: '#D1FAE5',
    desc: 'Ringkasan & Statistik',
    screen: 'Dashboard',
  },
  {
    name: 'Kasir',
    icon: 'cart',
    color: '#3B82F6',
    bg: '#DBEAFE',
    desc: 'Transaksi & POS',
    screen: 'Kasir',
  },
  {
    name: 'Gudang',
    icon: 'package-variant-closed',
    color: '#8B5CF6',
    bg: '#EDE9FE',
    desc: 'Stok & Produk',
    screen: 'Gudang',
  },
  {
    name: 'Laporan',
    icon: 'chart-box',
    color: '#F59E0B',
    bg: '#FEF3C7',
    desc: 'Laporan Penjualan',
    screen: 'Laporan',
  },
  {
    name: 'Pengaturan',
    icon: 'cog',
    color: '#EF4444',
    bg: '#FEE2E2',
    desc: 'Konfigurasi Toko',
    screen: 'Pengaturan',
  },
];

const HomeScreen = ({ navigation }) => {
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerGreeting}>Selamat Datang 👋</Text>
          <Text style={styles.headerTitle}>Toko Kelontong</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="store" size={38} color="#fff" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Subtitle */}
        <Text style={styles.subtitle}>Pilih Menu</Text>

        {/* Menu Grid */}
        <View style={styles.grid}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.name}
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => navigation.navigate(item.screen)}
            >
              <View style={[styles.iconCircle, { backgroundColor: item.bg }]}>
                <MaterialCommunityIcons name={item.icon} size={38} color={item.color} />
              </View>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer info */}
        <View style={styles.footerNote}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.footerText}>  Aplikasi berjalan secara offline</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 13,
    color: '#A7F3D0',
    fontWeight: '500',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.4,
  },
  headerDate: {
    fontSize: 11,
    color: '#D1FAE5',
    marginTop: 4,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    paddingBottom: 32,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  card: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  footerText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});

export default HomeScreen;
