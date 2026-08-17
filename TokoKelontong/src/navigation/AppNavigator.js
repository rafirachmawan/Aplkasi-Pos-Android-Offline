import React from "react";
import { View } from "react-native";
import { createStackNavigator } from "@react-navigation/stack";

import HomeScreen from "../screens/HomeScreen";
import DashboardScreen from "../screens/DashboardScreen";
import KasirScreen from "../screens/KasirScreen";
import GudangScreen from "../screens/GudangScreen";
import LaporanScreen from "../screens/LaporanScreen";
import PengaturanScreen from "../screens/PengaturanScreen";
import AddProductScreen from "../screens/AddProductScreen";
import BarcodeScannerScreen from "../screens/BarcodeScannerScreen";
import SettingNotaScreen from "../screens/SettingNotaScreen";
import PanduanScreen from "../screens/PanduanScreen";
import AuthScreen from "../screens/AuthScreen";

import { useAuth } from "../context/AuthContext";
import { colors, fonts } from "../theme/colors";

const Stack = createStackNavigator();

const defaultHeaderOptions = {
  headerStyle: {
    backgroundColor: "#FFFFFF",
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTintColor: colors.text,
  headerTitleStyle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.text,
  },
  headerTitleAlign: "left",
  headerBackTitleVisible: false,
  headerBackTitle: "",
};

export default function AppNavigator() {
  const { session, ready } = useAuth();

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <Stack.Navigator screenOptions={defaultHeaderOptions}>
      {!session ? (
        <Stack.Screen
          name="Auth"
          component={AuthScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: "Dashboard" }}
          />
          <Stack.Screen
            name="Kasir"
            component={KasirScreen}
            options={{ title: "Kasir POS" }}
          />
          <Stack.Screen
            name="Gudang"
            component={GudangScreen}
            options={{ title: "Gudang Stok" }}
          />
          <Stack.Screen
            name="AddProductScreen"
            component={AddProductScreen}
            options={{ title: "Form Barang" }}
          />
          <Stack.Screen
            name="SettingNota"
            component={SettingNotaScreen}
            options={{ title: "Pengaturan Nota" }}
          />
          <Stack.Screen
            name="Laporan"
            component={LaporanScreen}
            options={{ title: "Laporan Penjualan" }}
          />
          <Stack.Screen
            name="Pengaturan"
            component={PengaturanScreen}
            options={{ title: "Pengaturan" }}
          />
          <Stack.Screen
            name="Panduan"
            component={PanduanScreen}
            options={{ title: "Buku Panduan" }}
          />
          <Stack.Screen
            name="BarcodeScanner"
            component={BarcodeScannerScreen}
            options={{ headerShown: false, presentation: "modal" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
