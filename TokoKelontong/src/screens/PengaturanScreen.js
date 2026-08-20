import React, { useState, useContext, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  Platform,
  Linking,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import {
  changePassword,
  signOut,
  updateStoreName,
} from "../services/authService";
import {
  getPairedPrinters,
  isBluetoothPrintingSupported,
} from "../utils/bluetoothPrinter";
import { colors, fonts } from "../theme/colors";

const appVersion = Constants.expoConfig?.version || "1.0.0";

const SettingRow = ({
  icon,
  iconColor = colors.primary,
  iconBg = "#F1F5F9",
  label,
  children,
}) => (
  <View style={styles.settingRow}>
    <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingContent}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  </View>
);

const PengaturanScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useContext(AppContext);

  const [storeNameInput, setStoreNameInput] = useState(state.storeName || "");
  const [printerInput, setPrinterInput] = useState(state.printerAddress || "");
  const [logoUri, setLogoUri] = useState(state.storeLogo || null);
  const [saved, setSaved] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);

  // Account & security states
  const { profile, refreshProfile } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState("");

  // Pemilih printer Bluetooth (daftar perangkat terpairing)
  const [showPrinterPicker, setShowPrinterPicker] = useState(false);
  const [pairedDevices, setPairedDevices] = useState([]);
  const [loadingPaired, setLoadingPaired] = useState(false);

  // Update aplikasi OTA (tanpa install ulang)
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    setStoreNameInput(state.storeName || "");
    setPrinterInput(state.printerAddress || "");
    setLogoUri(state.storeLogo || null);
  }, [state.storeName, state.printerAddress, state.storeLogo]);

  useEffect(() => {
    if (profile?.stores?.store_name) {
      setStoreNameInput(profile.stores.store_name);
    }
  }, [profile?.stores?.store_name]);

  // ── Pilih printer dari daftar perangkat yang sudah dipairing ──
  const handleOpenPrinterPicker = async () => {
    if (!isBluetoothPrintingSupported()) {
      Alert.alert(
        "Tidak Tersedia",
        "Cetak Bluetooth tidak tersedia di Expo Go. Fitur ini aktif pada build APK / development build.",
      );
      return;
    }
    setShowPrinterPicker(true);
    setLoadingPaired(true);
    setPairedDevices([]);
    try {
      const devices = await getPairedPrinters();
      setPairedDevices(devices);
    } catch (e) {
      Alert.alert("Bluetooth", e.message || "Gagal membaca daftar perangkat.");
      setShowPrinterPicker(false);
    } finally {
      setLoadingPaired(false);
    }
  };

  // ── Cek & pasang update OTA (tanpa install ulang) ──
  const handleCheckUpdate = async () => {
    if (!Updates.isEnabled) {
      Alert.alert(
        "Tidak Tersedia",
        "Update otomatis hanya tersedia pada build APK, tidak di Expo Go.",
      );
      return;
    }
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (!check.isAvailable) {
        Alert.alert("Sudah Terbaru", "Aplikasi Anda sudah versi terbaru.");
        return;
      }
      Alert.alert(
        "Update Tersedia",
        "Versi baru aplikasi tersedia. Unduh sekarang? Aplikasi akan restart otomatis setelah update selesai.",
        [
          { text: "Nanti", style: "cancel" },
          {
            text: "Update",
            onPress: async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (e) {
                Alert.alert(
                  "Gagal Update",
                  "Gagal mengunduh update. Periksa koneksi internet lalu coba lagi.",
                );
              }
            },
          },
        ],
      );
    } catch (e) {
      Alert.alert(
        "Gagal Memeriksa",
        "Tidak dapat memeriksa update. Pastikan HP terhubung ke internet.",
      );
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handlePickLogo = () => {
    Alert.alert(
      "Foto Logo Toko",
      "Pilih lokasi pengambilan foto logo toko:",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Galeri Foto",
          onPress: () => executePicker("gallery"),
        },
        {
          text: "Kamera HP",
          onPress: () => executePicker("camera"),
        },
      ],
      { cancelable: true },
    );
  };

  const handleSelectSource = (source) => {
    setShowImageSourceModal(false);
    setTimeout(() => {
      executePicker(source);
    }, 400);
  };

  const executePicker = async (source) => {
    try {
      if (source === "gallery") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Akses Galeri Ditolak",
            "Izin akses galeri diperlukan. Silakan izinkan di Pengaturan HP Anda.",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Buka Pengaturan",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return;
        }

        // Tanpa layar crop: foto langsung dipakai agar user tidak bingung.
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
        });

        if (
          result &&
          !result.canceled &&
          result.assets &&
          result.assets.length > 0
        ) {
          setLogoUri(result.assets[0].uri);
        }
      } else if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Akses Kamera Ditolak",
            "Izin kamera diperlukan. Silakan izinkan di Pengaturan HP Anda.",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Buka Pengaturan",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return;
        }

        // Tanpa layar crop: foto langsung dipakai agar user tidak bingung.
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
        });

        if (
          result &&
          !result.canceled &&
          result.assets &&
          result.assets.length > 0
        ) {
          setLogoUri(result.assets[0].uri);
        }
      }
    } catch (e) {
      console.error("ImagePicker Error:", e);
      let errorMsg = e.message || "Gagal membuka media";
      if (
        errorMsg.toLowerCase().includes("camera is not available") ||
        errorMsg.toLowerCase().includes("simulator")
      ) {
        errorMsg =
          "Kamera tidak tersedia (misal di Simulator iOS). Gunakan HP fisik atau pilih dari Galeri.";
      }
      Alert.alert("Gagal Mengambil Foto", errorMsg);
    }
  };

  const handleSave = async () => {
    if (!storeNameInput.trim()) {
      Alert.alert("Error", "Nama toko tidak boleh kosong.");
      return;
    }
    try {
      await AsyncStorage.setItem("storeName", storeNameInput.trim());
      await AsyncStorage.setItem("printerAddress", printerInput.trim());
      if (logoUri) {
        await AsyncStorage.setItem("storeLogo", logoUri);
      } else {
        await AsyncStorage.removeItem("storeLogo");
      }

      // Selaraskan ke StoreProfile object (format baku nota: storeName, dst.)
      // Baca dulu profil lama agar field lain (alamat, kontak, footer,
      // printerAddress) tidak hilang saat disimpan ulang.
      let existingProfile = {};
      try {
        const savedProfile = await AsyncStorage.getItem(
          "@TokoKelontong:StoreProfile",
        );
        if (savedProfile) existingProfile = JSON.parse(savedProfile);
      } catch (_) {
        existingProfile = {};
      }

      const storeProfileObj = {
        ...existingProfile,
        storeName: storeNameInput.trim(),
        name: storeNameInput.trim(), // alias format lama, dijaga sementara
        printerAddress: printerInput.trim() || null,
        logo: logoUri || null,
      };
      await AsyncStorage.setItem(
        "@TokoKelontong:StoreProfile",
        JSON.stringify(storeProfileObj),
      );

      dispatch({ type: "SET_STORE_NAME", payload: storeNameInput.trim() });
      dispatch({
        type: "SET_PRINTER_ADDRESS",
        payload: printerInput.trim() || null,
      });
      dispatch({ type: "SET_STORE_LOGO", payload: logoUri || null });

      // Simpan nama toko ke cloud agar terbaca di semua HP toko yang sama
      try {
        await updateStoreName(storeNameInput.trim());
        await refreshProfile();
      } catch (cloudErr) {
        Alert.alert(
          "Peringatan",
          "Pengaturan tersimpan di HP ini, tetapi nama toko gagal diperbarui ke cloud: " +
            cloudErr.message,
        );
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert("Error", "Gagal menyimpan pengaturan: " + e.message);
    }
  };

  const handleResetData = () => {
    Alert.alert(
      "⚠️ Reset Database",
      "PERINGATAN: Semua data produk dan transaksi akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus Semua Data",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Info",
              "Fitur ini aman dikunci pada versi rilis untuk mencegah data terhapus tak sengaja.",
            ),
        },
      ],
    );
  };

  const openPasswordModal = () => {
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setPwError("");
    setShowPasswordModal(true);
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (pwNew.length < 6) {
      setPwError("Password baru minimal 6 karakter.");
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError("Konfirmasi password tidak sama.");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword(pwCurrent, pwNew);
      setShowPasswordModal(false);
      Alert.alert(
        "Berhasil",
        "Password sudah diganti. Gunakan password baru saat masuk di perangkat lain.",
      );
    } catch (e) {
      setPwError(
        e?.message === "wrong_password"
          ? "Password lama salah."
          : "Gagal mengganti password. Coba lagi.",
      );
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Keluar Akun",
      "Anda akan keluar dari akun di HP ini. Data toko tetap aman di cloud.",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => {
            // Kosongkan keranjang agar akun berikutnya tidak mewarisi
            // isi keranjang akun sebelumnya.
            dispatch({ type: "CLEAR_CART" });
            signOut();
          },
        },
      ],
    );
  };

  const bottomPadding =
    Platform.OS === "android"
      ? Math.max(insets.bottom + 24, 40)
      : Math.max(insets.bottom + 16, 28);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingBottom: bottomPadding },
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Store Profile Card ── */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={handlePickLogo}
            activeOpacity={0.8}
          >
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.avatarImg} />
            ) : (
              <MaterialCommunityIcons
                name="storefront-outline"
                size={32}
                color="#0F172A"
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.cameraBadge}
            onPress={handlePickLogo}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" />
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity
              style={styles.removeLogoBadge}
              onPress={() => setLogoUri(null)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#EF4444"
              />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileStoreName}>
            {profile?.stores?.store_name || state.storeName || "MarketPos"}
          </Text>
          <View style={styles.badgeRow}>
            <View style={styles.greenDot} />
            <Text style={styles.badgeText}>Sinkronisasi Cloud Aktif</Text>
          </View>
        </View>
      </View>

      {/* ── Informasi Toko ── */}
      <Text style={styles.sectionTitle}>INFORMASI TOKO</Text>
      <View style={styles.card}>
        <SettingRow
          icon="store-edit-outline"
          iconColor="#0F172A"
          iconBg="#F1F5F9"
          label="Nama Toko"
        >
          <TextInput
            style={styles.input}
            value={storeNameInput}
            onChangeText={setStoreNameInput}
            placeholder="Masukkan nama toko Anda"
            placeholderTextColor="#94A3B8"
          />
        </SettingRow>
      </View>

      {/* ── Akun & Keamanan ── */}
      <Text style={styles.sectionTitle}>AKUN & KEAMANAN</Text>
      <View style={styles.card}>
        <SettingRow
          icon="account-circle-outline"
          iconColor="#0F172A"
          iconBg="#F1F5F9"
          label="Username Akun"
        >
          <Text style={styles.accountValue}>{profile?.username || "-"}</Text>
        </SettingRow>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={openPasswordModal}
          activeOpacity={0.7}
        >
          <View
            style={[styles.settingIconWrap, { backgroundColor: "#FEF3C7" }]}
          >
            <MaterialCommunityIcons
              name="key-change"
              size={20}
              color="#D97706"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Ganti Password</Text>
            <Text style={styles.linkSubText}>Ubah password akun toko Anda</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View
            style={[styles.settingIconWrap, { backgroundColor: "#FEE2E2" }]}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.linkText, { color: "#DC2626" }]}>
              Keluar (Logout)
            </Text>
            <Text style={styles.linkSubText}>Data tetap aman di cloud</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>
      </View>

      {/* ── Hardware & Printer ── */}
      <Text style={styles.sectionTitle}>PRINTER BLUETOOTH</Text>
      <View style={styles.card}>
        <SettingRow
          icon="printer-pos-network-outline"
          iconColor="#0F172A"
          iconBg="#F1F5F9"
          label="Alamat MAC Printer (Opsional)"
        >
          <TextInput
            style={styles.input}
            value={printerInput}
            onChangeText={setPrinterInput}
            placeholder="Contoh: 00:11:22:33:44:55"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
        </SettingRow>

        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleOpenPrinterPicker}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: "#DBEAFE" }]}>
            <MaterialCommunityIcons
              name="printer-pos"
              size={20}
              color="#1D4ED8"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Pilih dari Printer Terpairing</Text>
            <Text style={styles.linkSubText}>
              Isi alamat MAC otomatis dari daftar perangkat HP
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => {
            if (Platform.OS === "android") {
              Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(
                () => {
                  Linking.openSettings();
                },
              );
            } else {
              Linking.openSettings();
            }
          }}
          activeOpacity={0.7}
        >
          <View
            style={[styles.settingIconWrap, { backgroundColor: "#F1F5F9" }]}
          >
            <MaterialCommunityIcons
              name="bluetooth-connect"
              size={20}
              color="#0F172A"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Buka Pengaturan Bluetooth HP</Text>
            <Text style={styles.linkSubText}>
              Pasangkan printer Bluetooth dari sini
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>
      </View>

      {/* ── Bantuan & Onboarding ── */}
      <Text style={styles.sectionTitle}>BANTUAN & INFORMASI</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate("Panduan")}
          activeOpacity={0.7}
        >
          <View
            style={[styles.settingIconWrap, { backgroundColor: "#FEF3C7" }]}
          >
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={20}
              color="#D97706"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Buku Panduan Kasir</Text>
            <Text style={styles.linkSubText}>
              Panduan operasional fitur & alur transaksi
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>
      </View>

      {/* ── Update Aplikasi ── */}
      <Text style={styles.sectionTitle}>UPDATE APLIKASI</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleCheckUpdate}
          activeOpacity={0.7}
          disabled={checkingUpdate}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: "#DBEAFE" }]}>
            <MaterialCommunityIcons
              name="cloud-download-outline"
              size={20}
              color="#1D4ED8"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>
              {checkingUpdate ? "Memeriksa Update..." : "Periksa Update"}
            </Text>
            <Text style={styles.linkSubText}>
              Versi terpasang v{appVersion} — update tanpa install ulang
            </Text>
          </View>
          {checkingUpdate ? (
            <MaterialCommunityIcons name="loading" size={20} color="#1D4ED8" />
          ) : (
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color="#94A3B8"
            />
          )}
        </TouchableOpacity>
      </View>

      {/* ── Tombol Simpan ── */}
      <TouchableOpacity
        style={[styles.saveBtn, saved && { backgroundColor: "#059669" }]}
        onPress={handleSave}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name={saved ? "check-circle-outline" : "content-save-outline"}
          size={20}
          color="#FFFFFF"
        />
        <Text style={styles.saveBtnText}>
          {saved ? "TERSIMPAN!" : "SIMPAN PENGATURAN"}
        </Text>
      </TouchableOpacity>

      {/* ── Zona Risiko ── */}
      <Text style={styles.sectionTitle}>ZONA RISIKO</Text>
      <View
        style={[
          styles.card,
          { borderColor: "#FEE2E2", backgroundColor: "#FEF2F2" },
        ]}
      >
        <TouchableOpacity
          style={styles.dangerRow}
          onPress={handleResetData}
          activeOpacity={0.7}
        >
          <View style={styles.dangerIconWrap}>
            <MaterialCommunityIcons
              name="delete-forever-outline"
              size={20}
              color="#DC2626"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerText}>Reset Semua Data Database</Text>
            <Text style={styles.dangerSubText}>
              Hapus seluruh produk & riwayat transaksi
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#DC2626"
          />
        </TouchableOpacity>
      </View>

      {/* ── Footer ── */}
      <Text style={styles.versionText}>
        MarketPos - Kasir Android • Sinkronisasi Realtime
      </Text>

      {/* ── Modal Pilih Foto Logo ── */}
      <Modal
        visible={showImageSourceModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowImageSourceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowImageSourceModal(false)}
        >
          <View style={styles.sourceModalCard}>
            <Text style={styles.sourceModalTitle}>Pilih Foto Logo Toko</Text>
            <Text style={styles.sourceModalDesc}>
              Foto akan ditampilkan di header aplikasi & nota cetak.
            </Text>

            <View style={styles.sourceOptionsRow}>
              <TouchableOpacity
                style={styles.sourceOptionBtn}
                onPress={() => handleSelectSource("gallery")}
              >
                <View style={styles.sourceIconWrap}>
                  <MaterialCommunityIcons
                    name="image-outline"
                    size={28}
                    color="#0F172A"
                  />
                </View>
                <Text style={styles.sourceOptionText}>Galeri HP</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sourceOptionBtn}
                onPress={() => handleSelectSource("camera")}
              >
                <View style={styles.sourceIconWrap}>
                  <MaterialCommunityIcons
                    name="camera-outline"
                    size={28}
                    color="#0F172A"
                  />
                </View>
                <Text style={styles.sourceOptionText}>Kamera HP</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sourceCancelBtn}
              onPress={() => setShowImageSourceModal(false)}
            >
              <Text style={styles.sourceCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* ── Modal Pilih Printer Bluetooth ── */}
      <Modal
        visible={showPrinterPicker}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowPrinterPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowPrinterPicker(false)}
        >
          <View style={styles.sourceModalCard}>
            <Text style={styles.sourceModalTitle}>Pilih Printer Bluetooth</Text>
            <Text style={styles.sourceModalDesc}>
              Perangkat yang sudah dipairing dengan HP ini. Ketuk salah satu
              untuk mengisi alamat MAC otomatis.
            </Text>

            {loadingPaired ? (
              <Text
                style={[
                  styles.sourceModalDesc,
                  { textAlign: "center", marginVertical: 16 },
                ]}
              >
                Membaca perangkat Bluetooth...
              </Text>
            ) : pairedDevices.length === 0 ? (
              <Text
                style={[
                  styles.sourceModalDesc,
                  { textAlign: "center", marginVertical: 16 },
                ]}
              >
                Belum ada perangkat terpairing. Pairing printer lewat menu
                "Buka Pengaturan Bluetooth HP" terlebih dahulu.
              </Text>
            ) : (
              pairedDevices.map((device) => (
                <TouchableOpacity
                  key={device.address}
                  style={styles.printerDeviceRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setPrinterInput(device.address);
                    setShowPrinterPicker(false);
                  }}
                >
                  <MaterialCommunityIcons
                    name="bluetooth"
                    size={20}
                    color="#1D4ED8"
                  />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.linkText}>{device.name}</Text>
                    <Text style={styles.linkSubText}>{device.address}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity
              style={styles.sourceCancelBtn}
              onPress={() => setShowPrinterPicker(false)}
            >
              <Text style={styles.sourceCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* ── Modal Ganti Password ── */}
      <Modal
        visible={showPasswordModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.restoreModalCard}>
            <View style={styles.modalHeaderRow}>
              <View
                style={[styles.settingIconWrap, { backgroundColor: "#FEF3C7" }]}
              >
                <MaterialCommunityIcons
                  name="key-change"
                  size={22}
                  color="#D97706"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restoreTitle}>Ganti Password</Text>
                <Text style={styles.restoreSub}>
                  Validasi password lama, lalu buat password baru
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={22}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.pwLabel}>Password Lama</Text>
            <TextInput
              style={styles.pwInput}
              value={pwCurrent}
              onChangeText={setPwCurrent}
              secureTextEntry
              placeholder="Password saat ini"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.pwLabel}>Password Baru</Text>
            <TextInput
              style={styles.pwInput}
              value={pwNew}
              onChangeText={setPwNew}
              secureTextEntry
              placeholder="Minimal 6 karakter"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.pwLabel}>Ulangi Password Baru</Text>
            <TextInput
              style={styles.pwInput}
              value={pwConfirm}
              onChangeText={setPwConfirm}
              secureTextEntry
              placeholder="Ketik ulang password baru"
              placeholderTextColor="#94A3B8"
            />

            {pwError !== "" && (
              <Text style={styles.pwErrorText}>{pwError}</Text>
            )}

            <View style={styles.restoreActions}>
              <TouchableOpacity
                style={styles.cancelRestoreBtn}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.cancelRestoreText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmRestoreBtn,
                  { backgroundColor: "#0F172A" },
                  pwSaving && { opacity: 0.6 },
                ]}
                onPress={handleChangePassword}
                disabled={pwSaving}
              >
                <Text style={styles.confirmRestoreText}>
                  {pwSaving ? "Menyimpan..." : "Simpan Password"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Profile Header Card
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  avatarWrap: {
    position: "relative",
  },
  avatarBtn: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  cameraBadge: {
    position: "absolute",
    bottom: -3,
    right: -3,
    backgroundColor: "#0F172A",
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  removeLogoBadge: {
    position: "absolute",
    top: -5,
    left: -5,
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
  },
  profileInfo: {
    flex: 1,
  },
  profileStoreName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: "#0F172A",
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  badgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#64748B",
  },

  // Section Headers
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Cards
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 56,
  },

  // Setting Row
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#64748B",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
  },

  // Link Row Button
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  linkText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  linkSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  // Primary Save Button
  saveBtn: {
    backgroundColor: "#0F172A",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.4,
  },

  // Danger Row
  dangerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  dangerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#DC2626",
  },
  dangerSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#EF4444",
    marginTop: 2,
  },

  accountValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  pwLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 6,
  },
  pwInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    marginBottom: 12,
  },
  pwErrorText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#EF4444",
    marginBottom: 10,
  },
  versionText: {
    textAlign: "center",
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 20,
    marginBottom: 10,
  },

  // Modal Source Options
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    padding: 24,
  },
  sourceModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  sourceModalTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: "#0F172A",
    marginBottom: 4,
  },
  sourceModalDesc: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 18,
  },
  sourceOptionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 28,
    width: "100%",
    marginBottom: 20,
  },
  sourceOptionBtn: {
    alignItems: "center",
  },
  sourceIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  sourceOptionText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  sourceCancelBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  sourceCancelText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#64748B",
  },

  // Restore Modal
  restoreModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  restoreTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: "#0F172A",
  },
  restoreSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
  },
  uploadDropZone: {
    borderWidth: 1.5,
    borderColor: "#93C5FD",
    borderStyle: "dashed",
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  uploadDropZoneActive: {
    borderColor: "#86EFAC",
    borderStyle: "solid",
    backgroundColor: "#F0FDF4",
  },
  emptyUploadWrap: {
    alignItems: "center",
  },
  cloudUploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  uploadBoxTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#1E40AF",
    marginBottom: 4,
  },
  uploadBoxSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  selectedFileWrap: {
    alignItems: "center",
    width: "100%",
  },
  selectedFileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  selectedFileName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 2,
    textAlign: "center",
  },
  selectedFileSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#16A34A",
    marginBottom: 10,
  },
  changeFileChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  changeFileChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#2563EB",
  },
  restoreActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelRestoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelRestoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#64748B",
  },
  confirmRestoreBtn: {
    flex: 1,
    backgroundColor: "#16A34A",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmRestoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  printerDeviceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
});

export default PengaturanScreen;
