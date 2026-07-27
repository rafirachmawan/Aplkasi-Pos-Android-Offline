import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/HomeScreen';
import DashboardScreen from '../screens/DashboardScreen';
import KasirScreen from '../screens/KasirScreen';

import GudangScreen from '../screens/GudangScreen';
import LaporanScreen from '../screens/LaporanScreen';
import PengaturanScreen from '../screens/PengaturanScreen';
import AddProductScreen from '../screens/AddProductScreen';
import BarcodeScannerScreen from '../screens/BarcodeScannerScreen';

import { colors } from '../theme/colors';

const Stack = createStackNavigator();

const defaultHeaderOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: 'bold' },
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
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Stack.Screen
        name="Kasir"
        component={KasirScreen}
        options={{ title: 'Kasir (POS)' }}
      />
      <Stack.Screen
        name="Gudang"
        component={GudangScreen}
        options={{ title: 'Gudang Stok' }}
      />
      <Stack.Screen
        name="AddProductScreen"
        component={AddProductScreen}
        options={{ title: 'Form Barang' }}
      />
      <Stack.Screen
        name="Laporan"
        component={LaporanScreen}
        options={{ title: 'Laporan Penjualan' }}
      />
      <Stack.Screen
        name="Pengaturan"
        component={PengaturanScreen}
        options={{ title: 'Pengaturan' }}
      />
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
