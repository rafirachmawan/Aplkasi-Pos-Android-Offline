import React, { useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';

const menuItems = [
  {
    name: 'Dashboard',
    icon: 'view-dashboard',
    color: '#4F46E5', // Indigo
    bg: '#E0E7FF',
    desc: 'Ringkasan & Statistik',
    screen: 'Dashboard',
  },
  {
    name: 'Kasir',
    icon: 'cart',
    color: '#0EA5E9', // Sky
    bg: '#E0F2FE',
    desc: 'Transaksi & POS',
    screen: 'Kasir',
  },
  {
    name: 'Gudang',
    icon: 'package-variant-closed',
    color: '#8B5CF6', // Violet
    bg: '#EDE9FE',
    desc: 'Stok & Produk',
    screen: 'Gudang',
  },
  {
    name: 'Laporan',
    icon: 'chart-box',
    color: '#F59E0B', // Amber
    bg: '#FEF3C7',
    desc: 'Laporan Penjualan',
    screen: 'Laporan',
  },
  {
    name: 'Pengaturan',
    icon: 'cog',
    color: '#EC4899', // Pink
    bg: '#FCE7F3',
    desc: 'Konfigurasi Toko',
    screen: 'Pengaturan',
  },
];

const HomeScreen = ({ navigation }) => {
  const { state } = useContext(AppContext);
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerGreeting}>Selamat Datang 👋</Text>
          <Text style={styles.headerTitle}>{state.storeName || 'Toko Kelontong'}</Text>
          <Text style={styles.headerDate}>{today}</Text>
        </View>
        <View style={styles.headerIcon}>
          {state.storeLogo ? (
            <Image source={{ uri: state.storeLogo }} style={styles.storeLogoImage} />
          ) : (
            <MaterialCommunityIcons name="store" size={34} color={colors.primary} />
          )}
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
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.2,
  },
  headerDate: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginTop: 6,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  storeLogoImage: {
    width: '100%', height: '100%', borderRadius: 30,
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
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
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
