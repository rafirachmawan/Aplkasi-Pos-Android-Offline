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
    if (low.includes("already registered"))
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={styles.brandWrap}>
          <View style={styles.brandIcon}>
            <MaterialCommunityIcons
              name="storefront-outline"
              size={34}
              color={colors.primary}
            />
          </View>
          <Text style={styles.brandTitle}>MarketPos</Text>
          <Text style={styles.brandSub}>
            Kasir & stok toko kelontong, realtime antar perangkat
          </Text>
        </View>

        {/* Card form */}
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
              placeholder="misal: rafi"
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
              <Text style={styles.submitText}>
                {mode === "login" ? "Masuk" : "Daftar & Buat Toko"}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            {mode === "login"
              ? "1 akun dipakai bersama di semua HP toko ini."
              : "Butuh internet sekali saat daftar. Setelah itu sesi tersimpan di HP ini."}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 20, paddingBottom: 40 },
  brandWrap: { alignItems: "center", marginTop: 36, marginBottom: 28 },
  brandIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  brandTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 30,
    color: colors.text,
    letterSpacing: 0.3,
  },
  brandSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.07)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: colors.iconBg,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: "center",
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
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
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
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#FFFFFF",
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
    lineHeight: 16,
  },
});
