import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
import OnboardingScreen from '../screens/OnboardingScreen';

import { colors, fonts } from '../theme/colors';

const Stack = createStackNavigator();
const ONBOARDING_COMPLETED_KEY = '@TokoKelontong:HasCompletedOnboarding';

const defaultHeaderOptions = {
  headerStyle: {
    backgroundColor: '#FFFFFF',
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
  headerTitleAlign: 'left',
  headerBackTitleVisible: false,
  headerBackTitle: '',
};

export default function AppNavigator() {
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        setInitialRoute(completed === 'true' ? 'Home' : 'Onboarding');
      } catch (e) {
        setInitialRoute('Home');
      }
    };
    checkOnboarding();
  }, []);

  if (!initialRoute) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={defaultHeaderOptions}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Kasir" component={KasirScreen} options={{ title: 'Kasir POS' }} />
      <Stack.Screen name="Gudang" component={GudangScreen} options={{ title: 'Gudang Stok' }} />
      <Stack.Screen name="AddProductScreen" component={AddProductScreen} options={{ title: 'Form Barang' }} />
      <Stack.Screen name="SettingNota" component={SettingNotaScreen} options={{ title: 'Pengaturan Nota' }} />
      <Stack.Screen name="Laporan" component={LaporanScreen} options={{ title: 'Laporan Penjualan' }} />
      <Stack.Screen name="Pengaturan" component={PengaturanScreen} options={{ title: 'Pengaturan' }} />
      <Stack.Screen name="Panduan" component={PanduanScreen} options={{ title: 'Buku Panduan' }} />
      <Stack.Screen name="BarcodeScanner" component={BarcodeScannerScreen} options={{ headerShown: false, presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
