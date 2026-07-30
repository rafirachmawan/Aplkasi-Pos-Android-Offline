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
import PanduanScreen from '../screens/PanduanScreen';

import { colors } from '../theme/colors';

const Stack = createStackNavigator();

// ── Reusable Header Title ─────────────────────────────────────────
  const makeHeaderTitle = (icon, title, subtitle) => () => (
    <View style={headerStyles.titleWrapper}>
      <View style={[headerStyles.iconBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
        <MaterialCommunityIcons name={icon} size={18} color="#FFFFFF" />
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
  const makeBadgeRight = (label) => () => (
    <View style={[headerStyles.rightWrapper, { justifyContent: 'center' }]}>
      <View style={[headerStyles.genericBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
        <Text style={[headerStyles.genericBadgeText, { color: '#F8FAFC' }]}>{label}</Text>
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
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
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
    fontWeight: '700',
    color: 'rgba(255,255,255,0.9)',
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
    headerBackground: () => (
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0F172A' }]} />
    ),
    headerTintColor: '#FFFFFF',
    headerTitleStyle: { fontWeight: '700' },
    headerStyle: { 
      elevation: 4, 
      shadowOpacity: 0.1,
      borderBottomWidth: 0,
    },
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
          headerTitle: makeHeaderTitle('view-dashboard', 'Dashboard', 'Ringkasan hari ini'),
          headerRight: makeBadgeRight('RINGKASAN'),
        }}
      />

      {/* Kasir POS */}
      <Stack.Screen
        name="Kasir"
        component={KasirScreen}
        options={{
          headerTitle: makeHeaderTitle('cash-register', 'Kasir', 'Point of Sale'),
          headerRight: () => <KasirHeaderRight />,
        }}
      />

      {/* Gudang */}
      <Stack.Screen
        name="Gudang"
        component={GudangScreen}
        options={{
          headerTitle: makeHeaderTitle('warehouse', 'Gudang Stok', 'Manajemen inventaris'),
          headerRight: makeBadgeRight('STOK'),
        }}
      />

      {/* Form Tambah/Edit Produk */}
      <Stack.Screen
        name="AddProductScreen"
        component={AddProductScreen}
        options={{
          headerTitle: makeHeaderTitle('package-variant-plus', 'Form Barang', 'Tambah / edit produk'),
          headerRight: makeBadgeRight('PRODUK'),
        }}
      />

      {/* Setting Nota */}
      <Stack.Screen
        name="SettingNota"
        component={SettingNotaScreen}
        options={{
          headerTitle: makeHeaderTitle('receipt-text-edit', 'Pengaturan Nota', 'Format struk cetak'),
          headerRight: makeBadgeRight('NOTA'),
        }}
      />

      {/* Laporan */}
      <Stack.Screen
        name="Laporan"
        component={LaporanScreen}
        options={{
          headerTitle: makeHeaderTitle('chart-bar', 'Laporan Penjualan', 'Analisis transaksi'),
          headerRight: makeBadgeRight('LAPORAN'),
        }}
      />

      {/* Pengaturan */}
      <Stack.Screen
        name="Pengaturan"
        component={PengaturanScreen}
        options={{
          headerTitle: makeHeaderTitle('cog', 'Pengaturan', 'Konfigurasi aplikasi'),
          headerRight: makeBadgeRight('SETTING'),
        }}
      />

      {/* Panduan */}
      <Stack.Screen
        name="Panduan"
        component={PanduanScreen}
        options={{
          headerTitle: makeHeaderTitle('book-open-page-variant', 'Buku Panduan', 'Cara penggunaan aplikasi'),
          headerRight: makeBadgeRight('INFO'),
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
