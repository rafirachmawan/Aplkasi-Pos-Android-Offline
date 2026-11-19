import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Keyboard,
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollRef = useRef(null);
  const usernameRef = useRef(null);
  const storeNameRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e?.endCoordinates?.height || 280);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollInputIntoView = (yOffset = 140) => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: yOffset, animated: true });
    }, 120);
  };

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
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardHeight > 0 && {
            paddingTop:
              Platform.OS === "android"
                ? (StatusBar.currentHeight || 0) + 12
                : 32,
            paddingBottom: keyboardHeight + 36,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Hero Header Modern ─── */}
        <View
          style={[
            styles.heroSection,
            keyboardHeight > 0 && { marginBottom: 12 },
          ]}
        >
          <View
            style={[
              styles.heroBadge,
              keyboardHeight > 0 && {
                width: 56,
                height: 56,
                borderRadius: 16,
                marginBottom: 8,
              },
            ]}
          >
            <Image
              source={require("../../assets/app-logo.png")}
              style={[
                styles.heroLogo,
                keyboardHeight > 0 && { width: 38, height: 34 },
              ]}
              resizeMode="contain"
            />
          </View>
          <Text
            style={[
              styles.heroTitle,
              keyboardHeight > 0 && { fontSize: 21 },
            ]}
          >
            MarketPos
          </Text>
          {keyboardHeight === 0 && (
            <Text style={styles.heroTagline}>
              Sistem kasir toko & F&B yang cepat dan siap offline
            </Text>
          )}
        </View>

        {/* ─── Card Form Terpusat & Bersih ─── */}
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
                activeOpacity={0.85}
              >
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
                activeOpacity={0.85}
              >
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
              <TextInput
                ref={usernameRef}
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="Masukkan username toko"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                returnKeyType="next"
                onFocus={() => scrollInputIntoView(60)}
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
                <Text style={styles.fieldLabel}>Nama Toko / Usaha</Text>
                <Pressable
                  style={styles.inputWrap}
                  onPress={() => storeNameRef.current?.focus()}
                >
                  <TextInput
                    ref={storeNameRef}
                    style={styles.input}
                    value={storeName}
                    onChangeText={setStoreName}
                    placeholder="Contoh: Kedai Kopi Nusantara"
                    placeholderTextColor="#94A3B8"
                    editable={!loading}
                    returnKeyType="next"
                    onFocus={() => scrollInputIntoView(120)}
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
              <TextInput
                ref={passwordRef}
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder={mode === "register" ? "Minimal 6 karakter" : "Masukkan password"}
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                editable={!loading}
                returnKeyType="done"
                onFocus={() => scrollInputIntoView(mode === "register" ? 190 : 120)}
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
                <Text style={styles.submitText}>
                  {mode === "login" ? "Masuk" : "Buat Akun Toko"}
                </Text>
              )}
            </TouchableOpacity>

            {mode === "register" && (
              <Text style={styles.hint}>
                Pendaftaran awal memerlukan koneksi internet. Transaksi kasir tetap berjalan penuh saat offline.
              </Text>
            )}
          </View>

          <Text style={styles.footer}>MarketPos — Point of Sale</Text>
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
  topBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 270,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    overflow: "hidden",
  },
  backdropCircleA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -80,
    right: -60,
  },
  backdropCircleB: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(194,65,12,0.35)",
    bottom: -50,
    left: -40,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 24 : 56,
    paddingBottom: 36,
  },

  // ── Header Hero ──
  heroSection: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  heroBadge: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#7C2D12",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  heroLogo: {
    width: 54,
    height: 48,
  },
  heroTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 26,
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  heroTagline: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
  },

  // ── Card Form ──
  cardWrap: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4,
  },
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFEDD5",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
  },
  tabText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#9A3412",
  },
  tabTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },

  fieldLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.secondary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 11,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },

  errorBox: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
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
    marginTop: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  submitText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 14,
    lineHeight: 17,
  },

  footer: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 22,
  },
});
