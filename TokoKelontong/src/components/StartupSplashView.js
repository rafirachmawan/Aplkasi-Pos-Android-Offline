import React from "react";
import { View, Text, Image, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { colors } from "../theme/colors";

const APP_LOGO = require("../../assets/app-logo.png");

/**
 * Tampilan loading awal sederhana saat aplikasi menyiapkan font dan sesi toko.
 * Memakai latar belakang yang sama dengan native splash (#FFFDFB) agar transisi mulus.
 */
export default function StartupSplashView({ message = "Memuat aplikasi..." }) {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor={colors.background} />

      <View style={styles.centerBlock}>
        <View style={styles.logoCard}>
          <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.brandName}>MarketPos</Text>
        <Text style={styles.brandTagline}>Kasir &amp; Inventori Toko</Text>

        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>{message}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerBlock: {
    alignItems: "center",
  },
  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primaryBorderSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 2,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  logo: {
    width: 68,
    height: 68,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.textSecondary,
    marginTop: 4,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 28,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorderSoft,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryDark,
  },
});
