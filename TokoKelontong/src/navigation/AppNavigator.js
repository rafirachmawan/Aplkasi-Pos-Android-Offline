import React from 'react';
<<<<<<< HEAD
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

// Placeholder Screens
import { View, Text } from 'react-native';
const PlaceholderScreen = ({ name }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
    <Text style={{ color: colors.text, fontSize: 20 }}>{name} Screen</Text>
  </View>
);

const DashboardScreen = () => <PlaceholderScreen name="Dashboard" />;
const KasirScreen = () => <PlaceholderScreen name="Kasir" />;
const GudangScreen = () => <PlaceholderScreen name="Gudang" />;
const LaporanScreen = () => <PlaceholderScreen name="Laporan" />;
const PengaturanScreen = () => <PlaceholderScreen name="Pengaturan" />;

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Kasir"
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'Kasir') iconName = focused ? 'cart' : 'cart-outline';
          else if (route.name === 'Gudang') iconName = focused ? 'cube' : 'cube-outline';
          else if (route.name === 'Laporan') iconName = focused ? 'bar-chart' : 'bar-chart-outline';
          else if (route.name === 'Pengaturan') iconName = focused ? 'settings' : 'settings-outline';
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Kasir" component={KasirScreen} />
      <Tab.Screen name="Gudang" component={GudangScreen} />
      <Tab.Screen name="Laporan" component={LaporanScreen} />
      <Tab.Screen name="Pengaturan" component={PengaturanScreen} />
    </Tab.Navigator>
  );
};

export const AppNavigator = () => {
  return (
    <NavigationContainer theme={AppTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
=======
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
>>>>>>> f39751906b4f54e6c2a73e0045dabdb926a8e30f
