import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

const HeaderBadgeRight = ({ label, icon }) => () => (
  <View style={headerStyles.badgeRightContainer}>
    {icon && (
      <MaterialCommunityIcons
        name={icon}
        size={14}
        color={colors.textSecondary}
        style={{ marginRight: 5 }}
      />
    )}
    <Text style={headerStyles.badgeRightText}>{label}</Text>
  </View>
);

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
    fontWeight: '700',
    color: colors.text,
  },
  headerTitleAlign: 'left',
  headerBackTitleVisible: false,
};

const headerStyles = StyleSheet.create({
  badgeRightContainer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  badgeRightText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.text,
  },
});

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
      
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Dashboard', icon: 'view-dashboard-outline' }),
        }}
      />
      
      <Stack.Screen
        name="Kasir"
        component={KasirScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Kasir', icon: 'cash-register' }),
        }}
      />
      
      <Stack.Screen
        name="Gudang"
        component={GudangScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Gudang Stok', icon: 'warehouse' }),
        }}
      />
      
      <Stack.Screen
        name="AddProductScreen"
        component={AddProductScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Form Barang', icon: 'package-variant-plus' }),
        }}
      />
      
      <Stack.Screen
        name="SettingNota"
        component={SettingNotaScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Pengaturan Nota', icon: 'receipt' }),
        }}
      />
      
      <Stack.Screen
        name="Laporan"
        component={LaporanScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Laporan Penjualan', icon: 'chart-bar' }),
        }}
      />
      
      <Stack.Screen
        name="Pengaturan"
        component={PengaturanScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Pengaturan', icon: 'cog-outline' }),
        }}
      />
      
      <Stack.Screen
        name="Panduan"
        component={PanduanScreen}
        options={{
          title: '',
          headerRight: HeaderBadgeRight({ label: 'Buku Panduan', icon: 'book-open-page-variant' }),
        }}
      />
      
      <Stack.Screen
        name="BarcodeScanner"
        component={BarcodeScannerScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
