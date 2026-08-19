import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
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
      return "Provider Email belum aktif. Di Supabase: Authentication → Sign In / Providers → klik Email → Enable → Save.";
    if (low.includes("failed to fetch") || low.includes("network"))
      return "Tidak bisa terhubung ke internet. Periksa koneksi Anda.";
    if (low.includes("register_store") || low.includes("does not exist"))
      return "Skema database belum terpasang. Jalankan isi supabase/schema.sql di SQL Editor Supabase, lalu coba lagi.";
    return "Terjadi kesalahan: " + msg;
  };

  const handleSubmit = async () => {
    setError("");
    const u = username.trim().toLowerCase();
    if (u.length < 3) {
      setError("Username minimal 3 karakter.");
      return;
    }
    if (!/^[a-z0-9_.]+$/.test(u)) {
      setError("Username hanya boleh huruf kecil, angka, titik, underscore.");
      return;
    }
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await signIn({ username: u, password });
      } else {
        await signUp({ username: u, password, storeName });
      }
      // Sesi tersimpan → gate navigator otomatis pindah ke aplikasi utama.
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      {/* ─── Hero Header ─── */}
      <View style={styles.hero}>
        <View style={styles.heroCircleA} />
        <View style={styles.heroCircleB} />
        <View style={styles.heroIcon}>
          <MaterialCommunityIcons
            name="storefront-outline"
            size={30}
            color="#FFFFFF"
          />
        </View>
        <Text style={styles.heroTitle}>MarketPos</Text>
        <Text style={styles.heroSub}>Point of Sale untuk toko kelontong</Text>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.centerWrap}>
          {/* ─── Card Form ─── */}
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
                  size={15}
                  color={mode === "login" ? "#FFFFFF" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    mode === "login" && styles.tabTextActive,
                  ]}
                >
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
                  size={15}
                  color={mode === "register" ? "#FFFFFF" : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    mode === "register" && styles.tabTextActive,
                  ]}
                >
                  Daftar Toko
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Username</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="account-outline"
                size={18}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="misal: rafi_rachmawan"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            {mode === "register" && (
              <>
                <Text style={styles.fieldLabel}>Nama Toko</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons
                    name="storefront-outline"
                    size={18}
                    color={colors.textSecondary}
                  />
                  <TextInput
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="misal: Toko Berkah Jaya"
                    placeholderTextColor="#94A3B8"
                    editable={!loading}
                  />
                </View>
              </>
            )}

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons
                name="lock-outline"
                size={18}
                color={colors.textSecondary}
              />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={
                  mode === "register" ? "Minimal 6 karakter" : "Password"
                }
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {error !== "" && (
              <View style={styles.errorBox}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={16}
                  color={colors.error}
                />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={mode === "login" ? "login" : "store-plus-outline"}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitText}>
                    {mode === "login" ? "Masuk" : "Daftar & Buat Toko"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              {mode === "login"
                ? "1 akun dipakai bersama di semua HP toko ini."
                : ""}
            </Text>
          </View>

          <Text style={styles.footer}>MarketPos • Sinkronisasi Realtime</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, marginTop: -48 },
  bodyContent: { flexGrow: 1, paddingBottom: 28 },
  centerWrap: { marginVertical: "auto" },

  // ── Hero header ──
  hero: {
    backgroundColor: colors.primary,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 28 : 60,
    paddingBottom: 64,
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  heroCircleA: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -70,
    right: -60,
  },
  heroCircleB: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -50,
    left: -45,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  heroSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    marginTop: 6,
    textAlign: "center",
    paddingHorizontal: 44,
    lineHeight: 18,
  },

  // ── Card form (menimpa hero) ──
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    marginHorizontal: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 18,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: colors.primary,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: { color: "#FFFFFF" },
  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    textTransform: "uppercase",
    color: colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
    borderRadius: 14,
    padding: 12,
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
    borderRadius: 16,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  submitText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 16,
  },
  footer: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 18,
    letterSpacing: 0.4,
  },
});
