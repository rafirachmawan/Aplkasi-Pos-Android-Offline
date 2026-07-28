import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import KasirScreen from '../screens/KasirScreen';

import GudangScreen from '../screens/GudangScreen';
import LaporanScreen from '../screens/LaporanScreen';
import PengaturanScreen from '../screens/PengaturanScreen';
import AddProductScreen from '../screens/AddProductScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';
import SettingNotaScreen from '../screens/SettingNotaScreen';

import { colors } from '../theme/colors';

const Stack = createStackNavigator();

// ── Reusable Header Title ─────────────────────────────────────────
const makeHeaderTitle = (icon, iconColor, iconBg, title, subtitle) => () => (
  <View style={headerStyles.titleWrapper}>
    <View style={[headerStyles.iconBox, { backgroundColor: iconBg }]}>
      <MaterialCommunityIcons name={icon} size={18} color={iconColor} />
    </View>
    <View>
      <Text style={headerStyles.title}>{title}</Text>
      <Text style={headerStyles.subtitle}>{subtitle}</Text>
    </View>
  </View>
);

// ── Kasir Right (LIVE + jam) ──────────────────────────────────────
const KasirHeaderRight = () => {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  return (
    <View style={headerStyles.rightWrapper}>
      <View style={headerStyles.liveBadge}>
        <View style={headerStyles.liveDot} />
        <Text style={headerStyles.liveText}>LIVE</Text>
      </View>
      <Text style={headerStyles.clock}>{time}</Text>
    </View>
  );
};

// ── Badge kanan generik ────────────────────────────────────────────
const makeBadgeRight = (label, badgeBg, badgeColor) => () => (
  <View style={[headerStyles.rightWrapper, { justifyContent: 'center' }]}>
    <View style={[headerStyles.genericBadge, { backgroundColor: badgeBg }]}>
      <Text style={[headerStyles.genericBadgeText, { color: badgeColor }]}>{label}</Text>
    </View>
  </View>
);

const headerStyles = StyleSheet.create({
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 1,
  },
  // Kasir right
  rightWrapper: {
    alignItems: 'flex-end',
    marginRight: 12,
    gap: 3,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.8,
  },
  clock: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  // Generic badge
  genericBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  genericBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
// ─────────────────────────────────────────────────────────────────

const defaultHeaderOptions = {
  headerStyle: { 
    backgroundColor: colors.background, 
    elevation: 0, 
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border
  },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' },
};

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={defaultHeaderOptions}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />

      {/* Dashboard */}
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'view-dashboard', '#fff', '#4F46E5',
            'Dashboard', 'Ringkasan hari ini'
          ),
          headerRight: makeBadgeRight('RINGKASAN', '#EDE9FE', '#6D28D9'),
        }}
      />

      {/* Kasir POS */}
      <Stack.Screen
        name="Kasir"
        component={KasirScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'cash-register', '#fff', '#4F46E5',
            'Kasir', 'Point of Sale'
          ),
          headerRight: () => <KasirHeaderRight />,
        }}
      />

      {/* Gudang */}
      <Stack.Screen
        name="Gudang"
        component={GudangScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'warehouse', '#fff', '#0EA5E9',
            'Gudang Stok', 'Manajemen inventaris'
          ),
          headerRight: makeBadgeRight('STOK', '#E0F2FE', '#0369A1'),
        }}
      />

      {/* Form Tambah/Edit Produk */}
      <Stack.Screen
        name="AddProductScreen"
        component={AddProductScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'package-variant-plus', '#fff', '#10B981',
            'Form Barang', 'Tambah / edit produk'
          ),
          headerRight: makeBadgeRight('PRODUK', '#D1FAE5', '#065F46'),
        }}
      />

      {/* Setting Nota */}
      <Stack.Screen
        name="SettingNota"
        component={SettingNotaScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'receipt-text-edit', '#fff', '#F59E0B',
            'Pengaturan Nota', 'Format struk cetak'
          ),
          headerRight: makeBadgeRight('NOTA', '#FEF3C7', '#92400E'),
        }}
      />

      {/* Laporan */}
      <Stack.Screen
        name="Laporan"
        component={LaporanScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'chart-bar', '#fff', '#8B5CF6',
            'Laporan Penjualan', 'Analisis transaksi'
          ),
          headerRight: makeBadgeRight('LAPORAN', '#EDE9FE', '#6D28D9'),
        }}
      />

      {/* Pengaturan */}
      <Stack.Screen
        name="Pengaturan"
        component={PengaturanScreen}
        options={{
          headerTitle: makeHeaderTitle(
            'cog', '#fff', '#64748B',
            'Pengaturan', 'Konfigurasi aplikasi'
          ),
          headerRight: makeBadgeRight('SETTING', '#F1F5F9', '#475569'),
        }}
      />

      {/* Barcode Scanner — tanpa header */}
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
