import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../theme/colors";
import { signIn, signUp } from "../services/authService";

export default function AuthScreen() {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [storeName, setStoreName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const usernameRef = useRef(null);
  const storeNameRef = useRef(null);
  const passwordRef = useRef(null);

  const friendlyError = (e) => {
    const msg = e?.message || "";
    const low = msg.toLowerCase();
    if (low.includes("invalid login credentials"))
      return "Username atau password salah.";
    if (low.includes("username_taken"))
      return "Username sudah dipakai, pilih yang lain.";
    if (low.includes("already_registered") || low.includes("already registered"))
      return "Username sudah terdaftar. Silakan masuk.";
    if (low.includes("at least 6")) return "Password minimal 6 karakter.";
    if (msg === "email_confirmation_still_on")
      return "Matikan 'Confirm email' di dashboard Supabase (Authentication → Providers → Email).";
    if (low.includes("signups are disabled") || low.includes("email signups"))
      return "Provider Email belum aktif di Supabase.";
    if (low.includes("failed to fetch") || low.includes("network"))
      return "Tidak bisa terhubung ke internet. Periksa koneksi Anda.";
    if (low.includes("register_store") || low.includes("does not exist"))
      return "Skema database belum terpasang. Jalankan migrasi SQL Supabase.";
    return "Terjadi kesalahan: " + msg;
  };

  const handleSubmit = async () => {
    setError("");
    const u = username.trim().toLowerCase();
    if (u.length < 3) {
      setError("Username minimal 3 karakter.");
      usernameRef.current?.focus();
      return;
    }
    if (!/^[a-z0-9_.]+$/.test(u)) {
      setError("Username hanya boleh huruf kecil, angka, titik, underscore.");
      usernameRef.current?.focus();
      return;
    }
    if (mode === "register" && storeName.trim().length === 0) {
      setError("Nama toko wajib diisi.");
      storeNameRef.current?.focus();
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await signIn({ username: u, password });
      } else {
        await signUp({ username: u, password, storeName });
      }
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  const ContainerComponent = Platform.OS === "ios" ? KeyboardAvoidingView : View;
  const containerProps =
    Platform.OS === "ios"
      ? { behavior: "padding", style: styles.root }
      : { style: styles.root };

  return (
    <ContainerComponent {...containerProps}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* Background Banner Atas - Solid tanpa menyebabkan layout jump */}
      <View pointerEvents="none" style={styles.topBackdrop}>
        <View style={styles.backdropCircleA} />
        <View style={styles.backdropCircleB} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero Header Elegan ─── */}
        <View style={styles.heroSection}>
          <View style={styles.heroBadge}>
            <Image
              source={require("../../assets/app-logo.png")}
              style={styles.heroLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.heroTitle}>MarketPos</Text>
          <Text style={styles.heroTagline}>
            Point of Sale cerdas & offline-ready untuk usaha Anda
          </Text>
        </View>

        {/* ─── Card Form Terpusat & Responsif ─── */}
        <View style={styles.cardWrap}>
          <View style={styles.card}>
            {/* Tab Masuk / Daftar */}
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, mode === "login" && styles.tabActive]}
                onPress={() => {
                  setMode("login");
                  setError("");
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="login"
                  size={16}
                  color={mode === "login" ? "#FFFFFF" : colors.textSecondary}
                />
                <Text style={[styles.tabText, mode === "login" && styles.tabTextActive]}>
                  Masuk
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.tab, mode === "register" && styles.tabActive]}
                onPress={() => {
                  setMode("register");
                  setError("");
                }}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="store-plus-outline"
                  size={16}
                  color={mode === "register" ? "#FFFFFF" : colors.textSecondary}
                />
                <Text style={[styles.tabText, mode === "register" && styles.tabTextActive]}>
                  Daftar Toko
                </Text>
              </TouchableOpacity>
            </View>

            {/* Input Username */}
            <Text style={styles.fieldLabel}>Username</Text>
            <Pressable
              style={styles.inputWrap}
              onPress={() => usernameRef.current?.focus()}
            >
              <MaterialCommunityIcons
                name="account-outline"
                size={20}
                color="#64748B"
                style={styles.inputIcon}
              />
              <TextInput
                ref={usernameRef}
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="misal: rafi_rachmawan"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
                onSubmitEditing={() => {
                  if (mode === "register") {
                    storeNameRef.current?.focus();
                  } else {
                    passwordRef.current?.focus();
                  }
                }}
              />
            </Pressable>

            {/* Input Nama Toko (Khusus Mode Daftar) */}
            {mode === "register" && (
              <>
                <Text style={styles.fieldLabel}>Nama Toko</Text>
                <Pressable
                  style={styles.inputWrap}
                  onPress={() => storeNameRef.current?.focus()}
                >
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={20}
                    color="#64748B"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    ref={storeNameRef}
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="misal: Toko Berkah Jaya"
                    placeholderTextColor="#94A3B8"
                    editable={!loading}
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                </Pressable>
              </>
            )}

            {/* Input Password */}
            <Text style={styles.fieldLabel}>Password</Text>
            <Pressable
              style={styles.inputWrap}
              onPress={() => passwordRef.current?.focus()}
            >
              <MaterialCommunityIcons
                name="lock-outline"
                size={20}
                color="#64748B"
                style={styles.inputIcon}
              />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? "Minimal 6 karakter" : "Password akun"}
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </Pressable>

            {/* Pesan Error */}
            {error !== "" && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.error}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Tombol Submit */}
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={mode === "login" ? "login" : "store-plus-outline"}
                    size={19}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitText}>
                    {mode === "login" ? "Masuk ke Kasir" : "Daftar & Buat Toko"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              {mode === "login"
                ? "1 akun dipakai bersama di seluruh HP kasir toko ini."
                : "Bisa digunakan offline & online secara otomatis."}
            </Text>
          </View>

          {/* Fitur Highlights Mini */}
          <View style={styles.miniFeaturesRow}>
            <View style={styles.miniFeaturePill}>
              <MaterialCommunityIcons name="cloud-check-outline" size={14} color="#0284C7" />
              <Text style={styles.miniFeatureText}>Cloud Sync</Text>
            </View>
            <View style={styles.miniFeaturePill}>
              <MaterialCommunityIcons name="wifi-off" size={14} color="#059669" />
              <Text style={styles.miniFeatureText}>Offline Ready</Text>
            </View>
            <View style={styles.miniFeaturePill}>
              <MaterialCommunityIcons name="printer-outline" size={14} color="#D97706" />
              <Text style={styles.miniFeatureText}>Bluetooth Thermal</Text>
            </View>
          </View>

          <Text style={styles.footer}>MarketPos • Solusi Kasir Modern</Text>
        </View>
      </ScrollView>
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Background dekorasi atas independen tanpa merusak hit-testing form
  topBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  backdropCircleA: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
    top: -60,
    right: -50,
  },
  backdropCircleB: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "rgba(255,255,255,0.05)",
    bottom: -40,
    left: -40,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 16 : 48,
    paddingBottom: 36,
  },

  // ── Header Hero ──
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  heroBadge: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  heroLogo: {
    width: 52,
    height: 46,
  },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  heroTagline: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 320,
  },

  // ── Card Form ──
  cardWrap: {
    width: "100%",
    maxWidth: 440,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.07)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: "#FFFFFF",
  },

  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    textTransform: "uppercase",
    color: colors.textSecondary,
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.2,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 50,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 10,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.error,
    lineHeight: 18,
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },

  // ── Footer & Fitur Mini ──
  miniFeaturesRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 18,
    flexWrap: "wrap",
    paddingHorizontal: 8,
  },
  miniFeaturePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  miniFeatureText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  footer: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 14,
    letterSpacing: 0.3,
  },
});
