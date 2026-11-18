import React, { useState, useContext, useEffect, useCallback } from "react";
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
  Switch,
  Share,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import {
  getStoreLogoKey,
  getStoreNameKey,
  getStoreProfileKey,
  getBusinessModeKey,
  getFnbTablesKey,
  getFnbQrisKey,
  clearLegacyGlobalStoreKeys,
} from "../services/sessionStore";
import {
  changePassword,
  updateStoreName,
} from "../services/authService";
import { getDeviceId } from "../services/licenseService";
import usePlan from "../hooks/usePlan";
import { openUpgradeChat, ProLockModal } from "../components/ProLock";
import { SUPPORT_WHATSAPP } from "../config/planConfig";
import { refreshPlan } from "../services/planService";
import { getOfflineQueueCount } from "../utils/offlineQueue";
import { refreshSyncCounts } from "../services/syncService";
import useSyncStatus from "../hooks/useSyncStatus";
import TransactionRepository from "../database/transactionRepository";
import {
  getPairedPrinters,
  getSavedPrinter,
  savePrinterSelection,
  clearPrinterSelection,
  printTestViaBluetooth,
  isBluetoothPrintingSupported,
  normalizeMacAddress,
} from "../utils/bluetoothPrinter";
import {
  uploadProductImage,
  uploadImageToBucket,
  isCloudImageUri,
} from "../utils/imageStorage";
import {
  fetchStoreFnbConfig,
  updateStoreQrisImage,
  updateStoreActiveTables,
} from "../services/tableOrderService";
import {
  DEFAULT_ORDER_BASE_URL,
  getTableOrderUrl,
  printSingleTableBluetooth,
  generateAndShareTableQRPdf,
} from "../utils/tableQrGenerator";
import { colors, fonts } from "../theme/colors";
import PinModal from "../components/PinModal";
import {
  isPinProtected,
  setSecurityPin,
  removeSecurityPin,
  getLockedMenus,
  setLockedMenus,
  LOCKABLE_MENU_OPTIONS,
  DEFAULT_LOCKED_MENUS,
} from "../utils/securityPin";

const appVersion = Constants.expoConfig?.version || "1.0.0";

const SettingRow = ({
  icon,
  iconColor = colors.primary,
  iconBg = "#FFF7ED",
  label,
  children,
}) => (
  <View style={styles.settingRow}>
    {icon ? (
      <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
      </View>
    ) : null}
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
  const [printerNameInput, setPrinterNameInput] = useState(
    state.printerName || "",
  );
  const [logoUri, setLogoUri] = useState(state.storeLogo || null);
  const [saved, setSaved] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);

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
  const [printerError, setPrinterError] = useState("");
  const [printerFeedback, setPrinterFeedback] = useState("");
  const [testingPrinter, setTestingPrinter] = useState(false);

  // Update aplikasi OTA (tanpa install ulang)
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  // Security PIN states
  const [hasPin, setHasPin] = useState(false);
  const [pinFlow, setPinFlow] = useState(null); // 'verify_change' | 'verify_remove' | 'set_new' | 'confirm_new'
  const [newPinCandidate, setNewPinCandidate] = useState("");
  const [lockedMenus, setLockedMenusState] = useState(DEFAULT_LOCKED_MENUS);
  const [showLockedMenuConfig, setShowLockedMenuConfig] = useState(false);

  // Business Mode State (Retail vs F&B)
  const [businessMode, setBusinessModeState] = useState(state.businessMode || "retail");

  // License & Device States
  const [deviceId, setDeviceId] = useState("MPOS-DEV-8888");

  // Offline Sync State
  const syncStatus = useSyncStatus();
  const offlineCount = syncStatus.unsynced;
  const [syncingOffline, setSyncingOffline] = useState(false);

  // Status langganan (Gratis/Pro). Dihitung lokal sehingga tetap akurat offline.
  const plan = usePlan();
  const [showLockModal, setShowLockModal] = useState(false);
  const [lockFeature, setLockFeature] = useState("fnb");

  // F&B Table & QRIS States (Tier Pro)
  const storeId = profile?.store_id || profile?.stores?.id;
  const [qrisImageUrl, setQrisImageUrl] = useState("");
  const [activeTablesCount, setActiveTablesCount] = useState("10");
  const [uploadingQris, setUploadingQris] = useState(false);
  const [savingTables, setSavingTables] = useState(false);
  const [singleTableNumber, setSingleTableNumber] = useState("1");
  const [customWebBaseUrl, setCustomWebBaseUrl] = useState(DEFAULT_ORDER_BASE_URL);

  // Load config F&B dari local storage terisolasi per toko & cloud saat mode F&B aktif
  useEffect(() => {
    setActiveTablesCount("10");
    setQrisImageUrl("");
    if (businessMode === "fnb" && storeId) {
      const tablesKey = getFnbTablesKey(storeId);
      const qrisKey = getFnbQrisKey(storeId);
      if (tablesKey) {
        AsyncStorage.getItem(tablesKey).then((val) => {
          if (val) setActiveTablesCount(val);
        });
      }
      if (qrisKey) {
        AsyncStorage.getItem(qrisKey).then((val) => {
          if (val) setQrisImageUrl(val);
        });
      }

      fetchStoreFnbConfig(storeId)
        .then((cfg) => {
          if (cfg.qrisImageUrl) {
            setQrisImageUrl(cfg.qrisImageUrl);
            if (qrisKey) {
              AsyncStorage.setItem(qrisKey, cfg.qrisImageUrl).catch(() => {});
            }
          }
          if (cfg.activeTables) {
            setActiveTablesCount(String(cfg.activeTables));
            if (tablesKey) {
              AsyncStorage.setItem(tablesKey, String(cfg.activeTables)).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [storeId, businessMode]);

  const handlePickQrisImage = () => {
    Alert.alert(
      "Foto QRIS Toko",
      "Pilih sumber foto QRIS toko Anda untuk pelanggan:",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Galeri Foto",
          onPress: () => executeQrisPicker("gallery"),
        },
        {
          text: "Kamera HP",
          onPress: () => executeQrisPicker("camera"),
        },
      ],
      { cancelable: true }
    );
  };

  const executeQrisPicker = async (source) => {
    try {
      if (source === "gallery") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Izin Akses", "Izin akses galeri diperlukan.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
        });
        if (result && !result.canceled && result.assets && result.assets.length > 0) {
          await uploadAndSaveQris(result.assets[0].uri);
        }
      } else {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Izin Akses", "Izin akses kamera diperlukan.");
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
        });
        if (result && !result.canceled && result.assets && result.assets.length > 0) {
          await uploadAndSaveQris(result.assets[0].uri);
        }
      }
    } catch (err) {
      Alert.alert("Gagal Memilih Foto", err.message || "Terjadi kesalahan.");
    }
  };

  const uploadAndSaveQris = async (localUri) => {
    if (!storeId) {
      Alert.alert("Info", "ID Toko belum termuat. Silakan simpan pengaturan atau login ulang.");
      return;
    }
    setUploadingQris(true);
    try {
      const publicUrl = await uploadImageToBucket(localUri, "store_qris", "qris");
      setQrisImageUrl(publicUrl);
      const qrisKey = getFnbQrisKey(storeId);
      if (qrisKey) {
        await AsyncStorage.setItem(qrisKey, publicUrl);
      }

      const res = await updateStoreQrisImage(storeId, publicUrl);
      if (res && !res.success) {
        if (res.error && res.error.includes("qris_image_url")) {
          Alert.alert(
            "Tersimpan di HP (Perlu Migrasi Database)",
            "Foto QRIS berhasil tersimpan di HP ini.\n\nCatatan: Kolom 'qris_image_url' belum ada di Supabase. Harap jalankan file SQL 'migration_v10_fnb_self_order.sql' di Supabase SQL Editor agar tampil di web menu pelanggan."
          );
          return;
        }
      }
      Alert.alert("Sukses", "Foto QRIS toko berhasil disimpan dan siap tampil di web menu pelanggan.");
    } catch (err) {
      Alert.alert("Gagal Unggah", err.message || "Pastikan file SQL migration_v10 sudah dijalankan di Supabase.");
    } finally {
      setUploadingQris(false);
    }
  };

  const handleDeleteQris = () => {
    Alert.alert(
      "Hapus QRIS Toko",
      "Pelanggan tidak akan melihat opsi transfer QRIS di menu meja. Lanjutkan?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              setQrisImageUrl("");
              const qrisKey = getFnbQrisKey(storeId);
              if (qrisKey) {
                await AsyncStorage.removeItem(qrisKey);
              }
              if (storeId) {
                await updateStoreQrisImage(storeId, "");
              }
            } catch (err) {
              console.warn("Delete QRIS err:", err);
            }
          },
        },
      ]
    );
  };

  const handleSaveActiveTables = async () => {
    const count = parseInt(activeTablesCount, 10);
    if (isNaN(count) || count < 1 || count > 100) {
      Alert.alert("Jumlah Meja", "Masukkan jumlah meja yang valid (1 - 100).");
      return;
    }
    setSavingTables(true);
    try {
      // 1. Selalu simpan di cache lokal HP terisolasi per toko agar langsung aktif
      const tablesKey = getFnbTablesKey(storeId);
      if (tablesKey) {
        await AsyncStorage.setItem(tablesKey, String(count));
      }

      // 2. Simpan ke cloud jika terhubung
      if (storeId) {
        const res = await updateStoreActiveTables(storeId, count);
        if (res && !res.success) {
          if (res.error && res.error.includes("fnb_active_tables")) {
            Alert.alert(
              "Tersimpan di HP (Perlu Migrasi Database)",
              `Jumlah meja (${count} meja) sudah tersimpan di aplikasi ini.\n\nCatatan: Kolom 'fnb_active_tables' belum ada di database Supabase. Harap jalankan file SQL 'migration_v10_fnb_self_order.sql' di Supabase SQL Editor.`
            );
            return;
          }
        }
      }
      Alert.alert("Tersimpan", `Jumlah meja kafe berhasil diatur (${count} meja).`);
    } catch (err) {
      Alert.alert("Info", `Tersimpan di HP (${count} meja).`);
    } finally {
      setSavingTables(false);
    }
  };

  const handlePrintAllTablesPdf = async () => {
    const sId = storeId || "demo-store";
    await generateAndShareTableQRPdf({
      storeName: storeNameInput.trim() || state.storeName,
      storeId: sId,
      totalTables: activeTablesCount,
      baseUrl: customWebBaseUrl,
    });
  };

  const handlePrintSingleTableBt = async () => {
    const sId = storeId || "demo-store";
    const tableNum = singleTableNumber.trim() || "1";
    try {
      await printSingleTableBluetooth({
        storeName: storeNameInput.trim() || state.storeName,
        storeId: sId,
        tableNumber: tableNum,
        baseUrl: customWebBaseUrl,
      });
    } catch (err) {
      Alert.alert("Cetak Bluetooth Gagal", err.message || "Pastikan printer menyala & terhubung.");
    }
  };

  const handleShareTableUrl = async () => {
    const sId = storeId || "demo-store";
    const tableNum = singleTableNumber.trim() || "1";
    const url = getTableOrderUrl(sId, tableNum, customWebBaseUrl);
    try {
      await Share.share({
        message: `Pesan menu kami langsung dari HP di Meja ${tableNum}:\n${url}`,
        title: `Menu Meja ${tableNum}`,
      });
    } catch (err) {
      Alert.alert("Gagal Membagikan", err.message);
    }
  };

  useEffect(() => {
    isPinProtected().then(setHasPin);
    getLockedMenus().then(setLockedMenusState);
    getDeviceId().then(setDeviceId).catch(() => {});
    void refreshPlan({ force: true });
  }, []);

  useFocusEffect(
    useCallback(() => {
      getOfflineQueueCount()
        .then(() => refreshSyncCounts())
        .catch(() => {});
    }, []),
  );

  const handleToggleMenuLock = async (menuKey) => {
    const nextConfig = {
      ...lockedMenus,
      [menuKey]: !lockedMenus[menuKey],
    };
    setLockedMenusState(nextConfig);
    await setLockedMenus(nextConfig);
  };

  const handleLockAllMenus = async () => {
    const nextConfig = {};
    LOCKABLE_MENU_OPTIONS.forEach((item) => {
      nextConfig[item.key] = true;
    });
    setLockedMenusState(nextConfig);
    await setLockedMenus(nextConfig);
  };

  const handleUnlockAllMenus = async () => {
    const nextConfig = {};
    LOCKABLE_MENU_OPTIONS.forEach((item) => {
      nextConfig[item.key] = false;
    });
    setLockedMenusState(nextConfig);
    await setLockedMenus(nextConfig);
  };

  useEffect(() => {
    setStoreNameInput(state.storeName || "");
    setPrinterInput(state.printerAddress || "");
    setPrinterNameInput(state.printerName || "");
    setLogoUri(state.storeLogo || null);
    setBusinessModeState(state.businessMode || "retail");
  }, [
    state.storeName,
    state.printerAddress,
    state.printerName,
    state.storeLogo,
    state.businessMode,
  ]);

  useEffect(() => {
    if (profile?.stores?.store_name) {
      setStoreNameInput(profile.stores.store_name);
    }
  }, [profile?.stores?.store_name]);

  const syncPrinterProfileStorage = async (saved) => {
    try {
      const profileKey = getStoreProfileKey(storeId);
      if (!profileKey) return;
      const raw = await AsyncStorage.getItem(profileKey);
      const existing = raw ? JSON.parse(raw) : {};
      await AsyncStorage.setItem(
        profileKey,
        JSON.stringify({
          ...existing,
          printerAddress: saved?.address || null,
          printerName: saved?.name || null,
        }),
      );
    } catch {
      // Abaikan kegagalan sinkronisasi objek StoreProfile sekunder
    }
  };

  const persistPrinterToStateAndStorage = async (device) => {
    const saved = device
      ? await savePrinterSelection(device)
      : (await clearPrinterSelection(), { address: null, name: null });
    setPrinterInput(saved.address || "");
    setPrinterNameInput(saved.name || "");
    dispatch({ type: "SET_PRINTER_ADDRESS", payload: saved.address });
    dispatch({ type: "SET_PRINTER_NAME", payload: saved.name });
    await syncPrinterProfileStorage(saved);
    return saved;
  };

  const openPhoneBluetoothSettings = () => {
    if (Platform.OS === "android") {
      Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS").catch(() => {
        Linking.openSettings();
      });
    } else {
      Linking.openSettings();
    }
  };

  const loadPairedDevices = async () => {
    setLoadingPaired(true);
    setPrinterError("");
    setPairedDevices([]);
    try {
      const devices = await getPairedPrinters();
      setPairedDevices(devices);

      // Lengkapi nama printer tersimpan jika sebelumnya hanya menyimpan alamat MAC
      const currentSaved = await getSavedPrinter();
      const activeAddr = normalizeMacAddress(
        currentSaved?.address || printerInput,
      );
      if (activeAddr) {
        const matched = devices.find(
          (d) => normalizeMacAddress(d.address) === activeAddr,
        );
        if (matched && !currentSaved?.name) {
          await persistPrinterToStateAndStorage(matched);
        }
      }
    } catch (e) {
      setPrinterError(e.message || "Gagal membaca daftar perangkat Bluetooth.");
    } finally {
      setLoadingPaired(false);
    }
  };

  // ── Buka pengaturan Printer Bluetooth (1 menu terpadu) ──
  const handleOpenPrinterPicker = async () => {
    if (!isBluetoothPrintingSupported()) {
      Alert.alert(
        "Tidak Tersedia",
        "Cetak Bluetooth tidak tersedia di Expo Go. Fitur ini aktif pada build APK / development build.",
      );
      return;
    }
    setPrinterFeedback("");
    setPrinterError("");
    setShowPrinterPicker(true);
    await loadPairedDevices();
  };

  const handleSelectPrinter = async (device) => {
    try {
      const saved = await persistPrinterToStateAndStorage(device);
      setPrinterError("");
      setPrinterFeedback(
        `Printer "${saved.name}" tersimpan dan siap digunakan.`,
      );
    } catch (e) {
      setPrinterError(e.message || "Gagal menyimpan pilihan printer.");
    }
  };

  const handleClearPrinter = async () => {
    try {
      await persistPrinterToStateAndStorage(null);
      setPrinterError("");
      setPrinterFeedback("Pilihan printer dihapus.");
    } catch (e) {
      setPrinterError(e.message || "Gagal menghapus pilihan printer.");
    }
  };

  const handleTestPrint = async () => {
    if (testingPrinter) return;
    setTestingPrinter(true);
    setPrinterError("");
    setPrinterFeedback("");
    try {
      await printTestViaBluetooth({
        storeName: storeNameInput.trim() || state.storeName || "MarketPos",
        printerName: printerNameInput || "Printer Bluetooth",
      });
      setPrinterFeedback("Struk tes berhasil dicetak ke printer.");
    } catch (e) {
      setPrinterError(
        e.message ||
          "Gagal mencetak struk tes. Pastikan printer menyala dan dekat HP.",
      );
    } finally {
      setTestingPrinter(false);
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
      const activeStoreId = storeId || profile?.stores?.id || null;
      const nameKey = getStoreNameKey(activeStoreId);
      const logoKey = getStoreLogoKey(activeStoreId);
      const profileKey = getStoreProfileKey(activeStoreId);
      const modeKey = getBusinessModeKey(activeStoreId);

      if (nameKey) {
        await AsyncStorage.setItem(nameKey, storeNameInput.trim());
      }
      const normalizedAddr = normalizeMacAddress(printerInput);
      const savedPrinter = normalizedAddr
        ? await savePrinterSelection({
            address: normalizedAddr,
            name: printerNameInput,
          })
        : (await clearPrinterSelection(), { address: null, name: null });
      // Logo lokal diunggah dulu ke cloud agar tampil di semua HP toko ini
      // dan tidak hilang saat instal ulang / pembersihan cache.
      let finalLogoUri = logoUri;
      if (logoUri && !isCloudImageUri(logoUri)) {
        try {
          finalLogoUri = await uploadProductImage(
            logoUri,
            activeStoreId ? `logos/${activeStoreId}` : "logos",
          );
        } catch (uploadErr) {
          Alert.alert(
            "Peringatan",
            "Logo gagal diunggah ke cloud (" +
              uploadErr.message +
              "). Logo hanya tersimpan di HP ini.",
          );
        }
      }
      if (logoKey) {
        if (finalLogoUri) {
          await AsyncStorage.setItem(logoKey, finalLogoUri);
        } else {
          await AsyncStorage.removeItem(logoKey);
        }
      }

      // Selaraskan ke StoreProfile object terisolasi per toko (format baku nota: storeName, dst.)
      let existingProfile = {};
      if (profileKey) {
        try {
          const savedProfile = await AsyncStorage.getItem(profileKey);
          if (savedProfile) existingProfile = JSON.parse(savedProfile);
        } catch (_) {
          existingProfile = {};
        }

        const storeProfileObj = {
          ...existingProfile,
          storeName: storeNameInput.trim(),
          name: storeNameInput.trim(), // alias format lama, dijaga sementara
          printerAddress: savedPrinter.address,
          printerName: savedPrinter.name,
          logo: finalLogoUri || null,
        };
        await AsyncStorage.setItem(
          profileKey,
          JSON.stringify(storeProfileObj),
        );
      }

      if (modeKey) {
        await AsyncStorage.setItem(modeKey, businessMode);
      }
      await clearLegacyGlobalStoreKeys();

      dispatch({ type: "SET_STORE_NAME", payload: storeNameInput.trim() });
      dispatch({
        type: "SET_PRINTER_ADDRESS",
        payload: savedPrinter.address,
      });
      dispatch({
        type: "SET_PRINTER_NAME",
        payload: savedPrinter.name,
      });
      dispatch({ type: "SET_STORE_LOGO", payload: finalLogoUri || null });
      dispatch({ type: "SET_BUSINESS_MODE", payload: businessMode });

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

  const handleSelectBusinessMode = async (mode) => {
    if (mode === "fnb") {
      let isProActive = plan.isPro;
      if (!isProActive) {
        // Cek langsung ke server/cache terbaru bila belum terdeteksi Pro
        try {
          const fresh = await refreshPlan({ force: true });
          if (fresh.isPro) {
            isProActive = true;
          }
        } catch (_) {}
      }

      if (!isProActive) {
        setLockFeature("fnb");
        setShowLockModal(true);
        return;
      }
    }

    setBusinessModeState(mode);
    dispatch({ type: "SET_BUSINESS_MODE", payload: mode });
    const modeKey = getBusinessModeKey(storeId);
    if (modeKey) {
      await AsyncStorage.setItem(modeKey, mode);
    }
  };

  const handleUpgradePlan = async () => {
    if (!SUPPORT_WHATSAPP) {
      Alert.alert(
        "Paket Pro",
        "Nomor WhatsApp pengelola belum diatur. Hubungi pengelola MarketPos untuk mengaktifkan paket Pro.",
      );
      return;
    }
    await openUpgradeChat();
  };

  const handleRefreshPlan = async () => {
    try {
      const updated = await refreshPlan({ force: true });
      if (updated.isPro && updated.expiresAt) {
        Alert.alert(
          "Langganan Pro Aktif",
          `Paket Pro aktif sampai ${new Date(updated.expiresAt).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })} (sisa ${updated.daysRemaining} hari).`,
        );
      } else {
        Alert.alert(
          "Langganan",
          "Paket Anda saat ini: Gratis. Hubungi pengelola untuk mengaktifkan paket Pro.",
        );
      }
    } catch (err) {
      Alert.alert(
        "Gagal Memeriksa",
        err?.message || "Tidak dapat memeriksa status langganan ke server.",
      );
    }
  };

  const handleSyncOfflineInSettings = async () => {
    if (syncingOffline) return;
    setSyncingOffline(true);
    try {
      const res = await TransactionRepository.syncOfflineQueue();
      if (res.synced > 0) {
        Alert.alert(
          "✅ Sinkronisasi Berhasil",
          `${res.synced} dari ${res.total} transaksi offline berhasil diunggah ke cloud!`,
        );
      } else if (res.total === 0) {
        Alert.alert("Info", "Semua transaksi sudah tersinkron ke cloud.");
      } else {
        Alert.alert(
          "⚠️ Perhatian",
          `Gagal mengunggah transaksi (${res.failed} gagal). Pastikan koneksi internet stabil lalu coba lagi.`,
        );
      }
      await refreshSyncCounts();
    } catch (e) {
      Alert.alert("Gagal Sinkronisasi", e.message || "Terjadi kesalahan koneksi.");
    } finally {
      setSyncingOffline(false);
    }
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

  const handleOpenPinSettings = () => {
    if (hasPin) {
      Alert.alert(
        "Kelola PIN Keamanan",
        "Pilih tindakan untuk PIN pemilik toko Anda:",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Ubah PIN",
            onPress: () => setPinFlow("verify_change"),
          },
          {
            text: "Nonaktifkan",
            style: "destructive",
            onPress: () => setPinFlow("verify_remove"),
          },
        ],
      );
    } else {
      setPinFlow("set_new");
    }
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
                color={colors.primary}
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
            <View
              style={[
                styles.greenDot,
                syncStatus.offline && { backgroundColor: "#F59E0B" },
              ]}
            />
            <Text style={styles.badgeText}>
              {syncStatus.offline
                ? "Mode Offline (Sinkronisasi Tertunda)"
                : "Sinkronisasi Cloud Aktif"}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Informasi Toko ── */}
      <Text style={styles.sectionTitle}>INFORMASI TOKO</Text>
      <View style={styles.card}>
        <SettingRow label="Nama Toko">
          <TextInput
            style={styles.input}
            value={storeNameInput}
            onChangeText={setStoreNameInput}
            placeholder="Masukkan nama toko Anda"
            placeholderTextColor="#94A3B8"
          />
        </SettingRow>
      </View>

      {/* ── Mode Operasional Bisnis (Retail vs F&B) ── */}
      <Text style={styles.sectionTitle}>MODE OPERASIONAL BISNIS</Text>
      <View style={styles.card}>
        <View style={styles.modeSelectorRow}>
          <TouchableOpacity
            style={[
              styles.modeCardOption,
              businessMode === "retail" && styles.modeCardOptionActive,
            ]}
            onPress={() => handleSelectBusinessMode("retail")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.modeIconWrap,
                businessMode === "retail" && { backgroundColor: "#FFF7ED" },
              ]}
            >
              <MaterialCommunityIcons
                name="storefront-outline"
                size={22}
                color={businessMode === "retail" ? colors.primary : "#64748B"}
              />
            </View>
            <Text
              style={[
                styles.modeOptionTitle,
                businessMode === "retail" && {
                  color: colors.primary,
                  fontFamily: fonts.bold,
                },
              ]}
            >
              Retail / Toko
            </Text>
            <Text style={styles.modeOptionDesc}>
              Toko kelontong, minimarket, warung sembako
            </Text>
            {businessMode === "retail" && (
              <View style={styles.modeActiveBadge}>
                <Text style={styles.modeActiveBadgeText}>AKTIF</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeCardOption,
              businessMode === "fnb" && styles.modeCardOptionActive,
            ]}
            onPress={() => handleSelectBusinessMode("fnb")}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.modeIconWrap,
                businessMode === "fnb" && { backgroundColor: "#FFF7ED" },
              ]}
            >
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={22}
                color={businessMode === "fnb" ? colors.primary : "#64748B"}
              />
            </View>
            <Text
              style={[
                styles.modeOptionTitle,
                businessMode === "fnb" && {
                  color: colors.primary,
                  fontFamily: fonts.bold,
                },
              ]}
            >
              Resto / Kafe
            </Text>
            <Text style={styles.modeOptionDesc}>
              No. Meja, Dine-In / Take Away, Struk Dapur
            </Text>
            {!plan.isPro && (
              <View
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  backgroundColor: "#FFF7ED",
                  borderWidth: 1,
                  borderColor: "#FED7AA",
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 9,
                    letterSpacing: 0.5,
                    color: colors.primary,
                  }}
                >
                  PRO
                </Text>
              </View>
            )}
            {businessMode === "fnb" && (
              <View style={styles.modeActiveBadge}>
                <Text style={styles.modeActiveBadgeText}>AKTIF</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Pengaturan Khusus Mode F&B & Self-Order Meja (Pro) ── */}
      {businessMode === "fnb" && (
        <>
          <Text style={styles.sectionTitle}>FITUR F&B & SELF-ORDER MEJA (PRO)</Text>
          <View style={styles.card}>
            {/* 1. Pengaturan QRIS Toko */}
            <View style={styles.fnbSectionBlock}>
              <Text style={[styles.fnbBlockTitle, { marginBottom: 4 }]}>QRIS Pembayaran Pelanggan</Text>
              <Text style={styles.fnbBlockDesc}>
                Pelanggan di meja dapat memindai QRIS toko ini dan mengunggah foto bukti bayar saat checkout.
              </Text>

              {qrisImageUrl ? (
                <View style={styles.qrisPreviewContainer}>
                  <Image source={{ uri: qrisImageUrl }} style={styles.qrisPreviewImage} resizeMode="contain" />
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 12, color: "#16A34A" }}>
                      Foto QRIS Aktif
                    </Text>
                    <TouchableOpacity
                      style={[styles.btnOutlineSmall, { borderColor: colors.primary }]}
                      onPress={handlePickQrisImage}
                      disabled={uploadingQris}
                    >
                      <Text style={[styles.btnOutlineSmallText, { color: colors.primary }]}>
                        {uploadingQris ? "Mengunggah..." : "Ganti QRIS"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.btnOutlineSmall, { borderColor: "#EF4444" }]}
                      onPress={handleDeleteQris}
                    >
                      <Text style={[styles.btnOutlineSmallText, { color: "#EF4444" }]}>Hapus QRIS</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.qrisUploadBox}
                  onPress={handlePickQrisImage}
                  disabled={uploadingQris}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="cloud-upload-outline" size={26} color={colors.primary} />
                  <Text style={styles.qrisUploadBoxText}>
                    {uploadingQris ? "Sedang Mengunggah Foto..." : "Ketuk untuk Unggah Foto QRIS Toko"}
                  </Text>
                  <Text style={styles.qrisUploadBoxSub}>Mendukung file JPG, PNG dari galeri atau kamera</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.fnbDivider} />

            {/* 2. Pengaturan Meja & Cetak QR */}
            <View style={styles.fnbSectionBlock}>
              <Text style={[styles.fnbBlockTitle, { marginBottom: 4 }]}>Generator & Cetak QR Meja</Text>
              <Text style={styles.fnbBlockDesc}>
                Cetak kartu atau stiker QR meja pelanggan agar dapat memesan langsung dari HP mereka tanpa unduh aplikasi.
              </Text>

              <View style={styles.tableConfigRow}>
                <Text style={styles.tableConfigLabel}>Jumlah Meja Kafe:</Text>
                <View style={styles.tableInputWrap}>
                  <TextInput
                    style={styles.tableInputText}
                    value={String(activeTablesCount)}
                    onChangeText={(txt) => setActiveTablesCount(txt.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <TouchableOpacity
                    style={styles.tableSaveBtn}
                    onPress={handleSaveActiveTables}
                    disabled={savingTables}
                  >
                    <Text style={styles.tableSaveBtnText}>{savingTables ? "..." : "Simpan"}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Cetak Semua PDF */}
              <TouchableOpacity
                style={styles.fnbActionBtnPrimary}
                onPress={handlePrintAllTablesPdf}
                activeOpacity={0.8}
              >
                <Text style={styles.fnbActionBtnPrimaryText}>
                  Bagikan / Cetak Lembar QR Meja (PDF A4)
                </Text>
              </TouchableOpacity>

              {/* Action Cetak Satuan Bluetooth */}
              <View style={styles.singlePrintWrap}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.singlePrintLabel}>Meja Ke-</Text>
                  <TextInput
                    style={styles.singleTableInput}
                    value={singleTableNumber}
                    onChangeText={setSingleTableNumber}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
                <TouchableOpacity
                  style={styles.btnThermalTable}
                  onPress={handlePrintSingleTableBt}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnThermalTableText}>Cetak Thermal Bluetooth</Text>
                </TouchableOpacity>
              </View>

              {/* Tombol Bagikan Tautan Meja */}
              <TouchableOpacity
                style={styles.btnShareUrl}
                onPress={handleShareTableUrl}
                activeOpacity={0.8}
              >
                <Text style={styles.btnShareUrlText}>
                  Bagikan Tautan Meja {singleTableNumber || "1"} (WhatsApp / Browser)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}

      {/* ── Antrean Transaksi Offline ── */}
      <Text style={styles.sectionTitle}>ANTREAN TRANSAKSI OFFLINE</Text>
      <View style={styles.card}>
        <View style={styles.offlineSettingsRow}>
          <TouchableOpacity
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
            onPress={() => navigation.navigate("TransaksiPending")}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.settingIconWrap,
                {
                  backgroundColor:
                    syncStatus.needsReview > 0
                      ? "#FEE2E2"
                      : offlineCount > 0
                        ? "#FEF3C7"
                        : "#F1F5F9",
                },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  syncStatus.needsReview > 0
                    ? "alert-circle-outline"
                    : offlineCount > 0
                      ? "cloud-sync-outline"
                      : "cloud-check-outline"
                }
                size={22}
                color={
                  syncStatus.needsReview > 0
                    ? "#B91C1C"
                    : offlineCount > 0
                      ? "#D97706"
                      : "#16A34A"
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkText}>
                {offlineCount > 0
                  ? `${offlineCount} Transaksi Belum Terunggah`
                  : "Semua Transaksi Tersinkron"}
              </Text>
              <Text style={styles.linkSubText}>
                {syncStatus.needsReview > 0
                  ? `${syncStatus.needsReview} perlu ditinjau • ketuk untuk lihat`
                  : offlineCount > 0
                    ? "Tersimpan aman di HP • ketuk untuk lihat"
                    : syncStatus.offline
                      ? "Sedang offline • ketuk untuk lihat riwayat lokal"
                      : "Database lokal sinkron dengan cloud"}
              </Text>
            </View>
          </TouchableOpacity>
          {offlineCount > 0 ? (
            <TouchableOpacity
              style={styles.syncBtnSettings}
              onPress={handleSyncOfflineInSettings}
              disabled={syncingOffline}
            >
              <Text style={styles.syncBtnSettingsText}>
                {syncingOffline ? "..." : "Upload"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate("TransaksiPending")}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color="#94A3B8"
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Paket Langganan ── */}
      <Text style={styles.sectionTitle}>PAKET ANDA</Text>
      <View style={styles.card}>
        <View style={styles.licenseCardHeader}>
          <View
            style={[
              styles.licenseStatusPill,
              { backgroundColor: plan.isPro ? "#DCFCE7" : "#F1F5F9" },
            ]}
          >
            <Text
              style={[
                styles.licenseStatusPillText,
                { color: plan.isPro ? "#15803D" : "#475569" },
              ]}
            >
              {plan.isPro ? "★ PAKET PRO AKTIF" : "PAKET GRATIS"}
            </Text>
          </View>

          {plan.isPro ? (
            <View
              style={[
                styles.licenseStatusPill,
                {
                  backgroundColor:
                    plan.daysRemaining <= 7 ? "#FEF3C7" : "#EFF6FF",
                },
              ]}
            >
              <Text
                style={[
                  styles.licenseStatusPillText,
                  { color: plan.daysRemaining <= 7 ? "#92400E" : "#1D4ED8" },
                ]}
              >
                {plan.daysRemaining <= 0
                  ? "Berakhir hari ini"
                  : `Sisa ${plan.daysRemaining} hari`}
              </Text>
            </View>
          ) : null}
        </View>

        {plan.isPro ? (
          <View style={styles.planDatesRow}>
            <View style={styles.planDateBox}>
              <Text style={styles.planDateLabel}>Mulai aktif</Text>
              <Text style={styles.planDateValue}>
                {plan.startedAt
                  ? new Date(plan.startedAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </Text>
            </View>
            <View style={styles.planDateBox}>
              <Text style={styles.planDateLabel}>Berakhir</Text>
              <Text
                style={[
                  styles.planDateValue,
                  plan.daysRemaining <= 7 && { color: "#B45309" },
                ]}
              >
                {plan.expiresAt
                  ? new Date(plan.expiresAt).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.planFreeHint}>
            Jualan, struk, dan sinkronisasi tetap berjalan normal. Beberapa
            fitur manajemen terkunci pada paket Gratis.
          </Text>
        )}

        <View style={styles.deviceIdBox}>
          <Text style={styles.deviceIdLabel}>ID Perangkat Anda:</Text>
          <Text style={styles.deviceIdValue}>{deviceId}</Text>
          <Text style={styles.deviceIdHint}>
            Sebutkan ID ini saat menghubungi pengelola MarketPos
          </Text>
        </View>

        <View style={styles.licenseActionsRow}>
          <TouchableOpacity
            style={styles.licenseBtnOutline}
            onPress={() => void handleRefreshPlan()}
          >
            <Text style={styles.licenseBtnOutlineText}>Cek Ulang</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.licenseBtnPrimary,
              plan.isPro && { backgroundColor: "#15803D" },
            ]}
            onPress={() => void handleUpgradePlan()}
          >
            <Text style={styles.licenseBtnPrimaryText}>
              {plan.isPro ? "Perpanjang Pro" : "Upgrade ke Pro"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Akun & Keamanan ── */}
      <Text style={styles.sectionTitle}>AKUN & KEAMANAN</Text>
      <View style={styles.card}>
        <SettingRow label="Username Akun">
          <Text style={styles.accountValue}>{profile?.username || "-"}</Text>
        </SettingRow>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={openPasswordModal}
          activeOpacity={0.7}
        >
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

        {/* PIN Keamanan Pemilik Toko */}
        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleOpenPinSettings}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.linkText}>PIN Keamanan Pemilik</Text>
              <View
                style={{
                  backgroundColor: hasPin ? "#DCFCE7" : "#F1F5F9",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.bold,
                    fontSize: 10,
                    color: hasPin ? "#15803D" : "#475569",
                  }}
                >
                  {hasPin ? "AKTIF" : "NONAKTIF"}
                </Text>
              </View>
            </View>
            <Text style={styles.linkSubText}>
              {hasPin
                ? `${Object.values(lockedMenus).filter(Boolean).length} menu dilindungi PIN (Ketuk untuk ubah / nonaktifkan)`
                : "Lindungi menu sensitif toko dari akses staf/kasir"}
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>

        {/* Accordion Buka-Tutup: Menu yang Dikunci PIN */}
        {hasPin && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.accordionHeaderRow}
              onPress={() => setShowLockedMenuConfig(!showLockedMenuConfig)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={styles.linkText}>Menu yang Dikunci PIN</Text>
                  <View
                    style={[
                      styles.accordionBadge,
                      {
                        backgroundColor:
                          Object.values(lockedMenus).filter(Boolean).length > 0
                            ? "#FFF7ED"
                            : "#F1F5F9",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.accordionBadgeText,
                        {
                          color:
                            Object.values(lockedMenus).filter(Boolean).length > 0
                              ? colors.primary
                              : "#64748B",
                        },
                      ]}
                    >
                      {Object.values(lockedMenus).filter(Boolean).length > 0
                        ? `${Object.values(lockedMenus).filter(Boolean).length} Terkunci`
                        : "Semua Terbuka"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.linkSubText}>
                  {showLockedMenuConfig
                    ? "Ketuk untuk menutup sakelar menu"
                    : `${Object.values(lockedMenus).filter(Boolean).length} dari ${LOCKABLE_MENU_OPTIONS.length} menu dilindungi (Ketuk untuk buka)`}
                </Text>
              </View>

              <View style={styles.accordionChevronWrap}>
                <MaterialCommunityIcons
                  name={showLockedMenuConfig ? "chevron-up" : "chevron-down"}
                  size={22}
                  color="#64748B"
                />
              </View>
            </TouchableOpacity>

            {showLockedMenuConfig && (
              <View style={styles.pinConfigBox}>
                <View style={styles.pinAccordionActionsRow}>
                  <Text style={styles.pinConfigSubtitle}>
                    Pilih menu yang wajib memasukkan PIN pemilik sebelum dapat dibuka:
                  </Text>
                  <View style={styles.quickPillsRow}>
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={handleLockAllMenus}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.quickActionPillText, { color: colors.primary }]}>
                        Kunci Semua
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickActionPill}
                      onPress={handleUnlockAllMenus}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.quickActionPillText}>Buka Semua</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.pinMenuList}>
                  {LOCKABLE_MENU_OPTIONS.map((item, idx) => {
                    const isLocked = !!lockedMenus[item.key];
                    return (
                      <TouchableOpacity
                        key={item.key}
                        style={[
                          styles.pinMenuItem,
                          idx > 0 && styles.pinMenuBorder,
                        ]}
                        onPress={() => handleToggleMenuLock(item.key)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Text
                              style={[
                                styles.pinMenuName,
                                isLocked && {
                                  color: "#0F172A",
                                  fontFamily: fonts.bold,
                                },
                              ]}
                            >
                              {item.name}
                            </Text>
                            {isLocked && (
                              <View style={styles.lockedBadge}>
                                <Text style={styles.lockedBadgeText}>Terkunci</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.pinMenuDesc}>{item.desc}</Text>
                        </View>
                        <Switch
                          value={isLocked}
                          onValueChange={() => handleToggleMenuLock(item.key)}
                          trackColor={{ false: "#E2E8F0", true: "#FED7AA" }}
                          thumbColor={isLocked ? colors.primary : "#94A3B8"}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Hardware & Printer ── */}
      <Text style={styles.sectionTitle}>PRINTER BLUETOOTH</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={[styles.linkRow, { minHeight: 62 }]}
          onPress={handleOpenPrinterPicker}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Atur Printer Bluetooth"
        >
          <View
            style={[
              styles.settingIconWrap,
              {
                backgroundColor: printerInput
                  ? colors.primaryContainer
                  : colors.infoSurfaceActive,
              },
            ]}
          >
            <MaterialCommunityIcons
              name={printerInput ? "printer-check" : "bluetooth"}
              size={20}
              color={printerInput ? colors.primaryDark : colors.infoBadgeText}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.linkText, { fontSize: 14 }]}>
              Printer Bluetooth
            </Text>
            <Text style={[styles.linkSubText, { fontSize: 12 }]}>
              {printerInput
                ? `${printerNameInput || "Printer Bluetooth Terpilih"} — ketuk untuk ganti atau tes cetak`
                : "Belum dipilih — ketuk untuk pilih printer thermal"}
            </Text>
          </View>
          {printerInput ? (
            <View style={styles.printerActiveBadge}>
              <Text style={styles.printerActiveBadgeText}>Terpilih</Text>
            </View>
          ) : null}
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
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>
              {checkingUpdate ? "Memeriksa Update..." : "Periksa Update"}
            </Text>
            <Text style={styles.linkSubText}>
              Versi terpasang v{appVersion} — update tanpa install ulang
            </Text>
          </View>
          {checkingUpdate ? (
            <MaterialCommunityIcons name="loading" size={20} color={colors.primary} />
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
        <View style={styles.modalOverlayCenter}>
          <View style={styles.restoreModalCard}>
            <View style={styles.modalHeaderRow}>
              <View
                style={[
                  styles.settingIconWrap,
                  { backgroundColor: colors.infoSurfaceActive },
                ]}
              >
                <MaterialCommunityIcons
                  name="bluetooth"
                  size={22}
                  color={colors.infoBadgeText}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restoreTitle}>Printer Bluetooth</Text>
                <Text style={styles.printerModalSubtitle}>
                  Pilih printer thermal yang terpasang di HP
                </Text>
              </View>
              <TouchableOpacity
                style={styles.printerModalCloseBtn}
                onPress={() => setShowPrinterPicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Tutup pilihan printer Bluetooth"
              >
                <MaterialCommunityIcons
                  name="close"
                  size={22}
                  color="#475569"
                />
              </TouchableOpacity>
            </View>

            {printerError ? (
              <View style={styles.printerErrorBox}>
                <Text style={styles.printerErrorText}>{printerError}</Text>
                <View style={styles.printerInlineActions}>
                  <TouchableOpacity
                    style={styles.printerUtilityBtn}
                    onPress={loadPairedDevices}
                    disabled={loadingPaired}
                    accessibilityRole="button"
                    accessibilityLabel="Coba baca daftar Bluetooth lagi"
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={16}
                      color={colors.textDark}
                    />
                    <Text style={styles.printerUtilityText}>Coba Lagi</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.printerUtilityBtn}
                    onPress={openPhoneBluetoothSettings}
                    accessibilityRole="button"
                    accessibilityLabel="Buka pengaturan Bluetooth HP"
                  >
                    <MaterialCommunityIcons
                      name="bluetooth-settings"
                      size={16}
                      color={colors.textDark}
                    />
                    <Text style={styles.printerUtilityText}>Bluetooth HP</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {printerFeedback ? (
              <View style={styles.printerFeedbackBox}>
                <MaterialCommunityIcons
                  name="check-circle"
                  size={18}
                  color={colors.successDark}
                />
                <Text style={styles.printerFeedbackText}>
                  {printerFeedback}
                </Text>
              </View>
            ) : null}

            {loadingPaired ? (
              <View style={styles.printerStateBox}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.printerStateText}>
                  Menyiapkan Bluetooth & memuat perangkat...
                </Text>
              </View>
            ) : !printerError && pairedDevices.length === 0 ? (
              <View style={styles.printerStateBox}>
                <MaterialCommunityIcons
                  name="printer-off-outline"
                  size={28}
                  color="#64748B"
                />
                <Text style={styles.printerStateText}>
                  Belum ada printer terpasang di Bluetooth HP. Pasangkan printer
                  di Bluetooth HP (PIN umum: 0000 atau 1234), lalu ketuk Muat
                  Ulang.
                </Text>
                <View style={styles.printerInlineActions}>
                  <TouchableOpacity
                    style={styles.printerUtilityBtn}
                    onPress={openPhoneBluetoothSettings}
                    accessibilityRole="button"
                    accessibilityLabel="Buka pengaturan Bluetooth HP"
                  >
                    <MaterialCommunityIcons
                      name="bluetooth-settings"
                      size={16}
                      color={colors.textDark}
                    />
                    <Text style={styles.printerUtilityText}>Bluetooth HP</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.printerUtilityBtn}
                    onPress={loadPairedDevices}
                    accessibilityRole="button"
                    accessibilityLabel="Muat ulang daftar printer Bluetooth"
                  >
                    <MaterialCommunityIcons
                      name="refresh"
                      size={16}
                      color={colors.textDark}
                    />
                    <Text style={styles.printerUtilityText}>Muat Ulang</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : pairedDevices.length > 0 ? (
              <ScrollView
                style={styles.printerDeviceScroll}
                showsVerticalScrollIndicator={true}
              >
                {pairedDevices.map((device, index) => {
                  const isSelected =
                    normalizeMacAddress(printerInput) ===
                    normalizeMacAddress(device.address);
                  return (
                    <TouchableOpacity
                      key={device.address || String(index)}
                      style={[
                        styles.printerDeviceRow,
                        isSelected && styles.printerDeviceRowActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectPrinter(device)}
                      accessibilityRole="button"
                      accessibilityLabel={`Pilih printer ${device.name}`}
                    >
                      <View
                        style={[
                          styles.printerDeviceIconWrap,
                          isSelected && {
                            backgroundColor: colors.primaryContainer,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isSelected ? "printer-check" : "printer"}
                          size={20}
                          color={
                            isSelected
                              ? colors.primaryDark
                              : colors.infoBadgeText
                          }
                        />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text
                          style={[
                            styles.printerDeviceName,
                            isSelected && { color: colors.primaryTextDark },
                          ]}
                        >
                          {device.name}
                        </Text>
                        <Text style={styles.printerDeviceHint}>
                          {isSelected
                            ? "Printer aktif untuk cetak nota"
                            : "Ketuk untuk pilih printer ini"}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.printerActiveBadge}>
                          <Text style={styles.printerActiveBadgeText}>
                            Terpilih
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}

            {printerInput ? (
              <TouchableOpacity
                style={[
                  styles.printerTestBtn,
                  testingPrinter && { opacity: 0.7 },
                ]}
                onPress={handleTestPrint}
                disabled={testingPrinter || loadingPaired}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Tes cetak struk ke printer Bluetooth"
              >
                {testingPrinter ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons
                    name="printer-pos"
                    size={18}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.printerTestBtnText}>
                  {testingPrinter ? "Mencetak Struk Tes..." : "Tes Cetak Struk"}
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.printerModalFooterRow}>
              {pairedDevices.length > 0 ? (
                <TouchableOpacity
                  style={styles.printerFooterSmallBtn}
                  onPress={loadPairedDevices}
                  disabled={loadingPaired}
                  accessibilityRole="button"
                  accessibilityLabel="Muat ulang daftar perangkat Bluetooth"
                >
                  <Text style={styles.printerFooterSmallText}>Muat Ulang</Text>
                </TouchableOpacity>
              ) : null}
              {pairedDevices.length > 0 ? (
                <TouchableOpacity
                  style={styles.printerFooterSmallBtn}
                  onPress={openPhoneBluetoothSettings}
                  accessibilityRole="button"
                  accessibilityLabel="Buka Bluetooth HP untuk pasangkan printer baru"
                >
                  <Text style={styles.printerFooterSmallText}>Bluetooth HP</Text>
                </TouchableOpacity>
              ) : null}
              {printerInput ? (
                <TouchableOpacity
                  style={styles.printerFooterDangerBtn}
                  onPress={handleClearPrinter}
                  accessibilityRole="button"
                  accessibilityLabel="Hapus pilihan printer Bluetooth"
                >
                  <Text style={styles.printerFooterDangerText}>Hapus</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.printerDoneBtn}
                onPress={() => setShowPrinterPicker(false)}
                accessibilityRole="button"
                accessibilityLabel="Tutup"
              >
                <Text style={styles.printerDoneText}>Selesai</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
                  { backgroundColor: colors.primary },
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

      {/* ── Pin Modal Handlers ── */}
      <PinModal
        visible={pinFlow !== null}
        title={
          pinFlow === "verify_change" || pinFlow === "verify_remove"
            ? "Masukkan PIN Lama"
            : pinFlow === "set_new"
              ? "Atur 4 Digit PIN Baru"
              : "Konfirmasi PIN Baru"
        }
        subtitle={
          pinFlow === "verify_change" || pinFlow === "verify_remove"
            ? "Verifikasi identitas pemilik toko"
            : pinFlow === "set_new"
              ? "Ketik 4 angka PIN yang mudah Anda ingat"
              : "Ketik ulang 4 angka PIN untuk konfirmasi"
        }
        targetPin={
          pinFlow === "set_new"
            ? "ANY"
            : pinFlow === "confirm_new"
              ? newPinCandidate
              : null
        }
        onCancel={() => {
          setPinFlow(null);
          setNewPinCandidate("");
        }}
        onSuccess={async (enteredPin) => {
          if (pinFlow === "verify_change") {
            setPinFlow("set_new");
          } else if (pinFlow === "verify_remove") {
            await removeSecurityPin();
            setHasPin(false);
            setPinFlow(null);
            Alert.alert("✅ Berhasil", "PIN keamanan toko telah dinonaktifkan.");
          } else if (pinFlow === "set_new") {
            setNewPinCandidate(enteredPin);
            setPinFlow("confirm_new");
          } else if (pinFlow === "confirm_new") {
            await setSecurityPin(newPinCandidate);
            setHasPin(true);
            setPinFlow(null);
            setNewPinCandidate("");
            Alert.alert("✅ Sukses", "PIN keamanan toko berhasil diaktifkan.");
          }
        }}
      />

      {/* ── Panel Kunci Fitur (tier Gratis) ── */}
      <ProLockModal
        visible={showLockModal}
        feature={lockFeature}
        onClose={() => setShowLockModal(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
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
    backgroundColor: colors.primary,
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
    marginHorizontal: 14,
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
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
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

  // PIN Config Styles
  accordionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  accordionBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accordionBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
  },
  accordionChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  pinAccordionActionsRow: {
    flexDirection: "column",
    gap: 8,
    marginBottom: 10,
  },
  quickPillsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickActionPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#475569",
  },
  pinConfigBox: {
    backgroundColor: "#F8FAFC",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pinConfigHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  pinConfigTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  pinConfigSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 10,
    lineHeight: 16,
  },
  pinMenuList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  pinMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pinMenuBorder: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  pinMenuIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  pinMenuName: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#334155",
  },
  pinMenuDesc: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 1,
  },
  lockedBadge: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  lockedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#DC2626",
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
    minHeight: 54,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  printerDeviceRowActive: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryContainer,
  },
  printerDeviceScroll: {
    maxHeight: 240,
    marginBottom: 12,
  },
  printerDeviceIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.infoSurfaceActive,
    alignItems: "center",
    justifyContent: "center",
  },
  printerDeviceName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  printerDeviceHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textBodySecondary,
    marginTop: 2,
  },
  printerActiveBadge: {
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
  },
  printerActiveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryTextDark,
  },
  printerModalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textBodySecondary,
    marginTop: 2,
  },
  printerModalCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  printerStateBox: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    marginBottom: 14,
    gap: 10,
  },
  printerStateText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textBodySecondary,
    textAlign: "center",
    lineHeight: 19,
  },
  printerErrorBox: {
    backgroundColor: colors.errorSoftBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.errorSoftBorder,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  printerErrorText: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
    color: colors.errorTextDark,
    lineHeight: 18,
  },
  printerFeedbackBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.successContainer,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  printerFeedbackText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12.5,
    color: colors.successDark,
  },
  printerInlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  printerUtilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  printerUtilityText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.textDark,
  },
  printerTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 11,
    marginBottom: 10,
  },
  printerTestBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.onPrimary,
  },
  printerModalFooterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 2,
  },
  printerFooterSmallBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  printerFooterSmallText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.textDark,
  },
  printerFooterDangerBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.errorSoftBorder,
    backgroundColor: colors.errorSoftBg,
    alignItems: "center",
    justifyContent: "center",
  },
  printerFooterDangerText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.errorTextDark,
  },
  printerDoneBtn: {
    flex: 1,
    minWidth: 88,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  printerDoneText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },

  // ── Mode Bisnis & Operasional Styles ──
  modeSelectorRow: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  modeCardOption: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
  },
  modeCardOptionActive: {
    borderColor: colors.primary,
    backgroundColor: "#FFF7ED",
  },
  modeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  modeOptionTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 2,
  },
  modeOptionDesc: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 14,
    minHeight: 28,
  },
  modeActiveBadge: {
    marginTop: 8,
    backgroundColor: "#FED7AA",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modeActiveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
  },

  // ── Antrean Offline Styles ──
  offlineSettingsRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  syncBtnSettings: {
    backgroundColor: "#D97706",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  syncBtnSettingsText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Paket Langganan Styles ──
  licenseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  licenseStatusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  licenseStatusPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  planDatesRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  planDateBox: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  planDateLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 3,
  },
  planDateValue: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: "#0F172A",
  },
  planFreeHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    paddingHorizontal: 14,
    marginTop: 10,
  },
  deviceIdBox: {
    marginHorizontal: 14,
    marginTop: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  deviceIdLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 2,
  },
  deviceIdValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
    letterSpacing: 1,
  },
  deviceIdHint: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 4,
  },
  licenseActionsRow: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
  },
  licenseBtnOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingVertical: 10,
    borderRadius: 10,
  },
  licenseBtnOutlineText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#475569",
  },
  licenseBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    borderRadius: 10,
  },
  licenseBtnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Mode F&B & QRIS Meja Styles ──
  fnbSectionBlock: {
    padding: 14,
  },
  fnbBlockTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  fnbBlockDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 12,
  },
  fnbDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginHorizontal: 14,
  },
  qrisPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
  },
  qrisPreviewImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  btnOutlineSmall: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  btnOutlineSmallText: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },
  qrisUploadBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#FED7AA",
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  qrisUploadBoxText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.primary,
    marginTop: 6,
  },
  qrisUploadBoxSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  tableConfigRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  tableConfigLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#334155",
  },
  tableInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tableInputText: {
    width: 50,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 14,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  tableSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tableSaveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  fnbActionBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  fnbActionBtnPrimaryText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },
  singlePrintWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  singlePrintLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#475569",
  },
  singleTableInput: {
    width: 44,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    textAlign: "center",
    fontFamily: fonts.bold,
    fontSize: 13,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
  },
  btnThermalTable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnThermalTableText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: colors.primary,
  },
  btnShareUrl: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnShareUrlText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#334155",
  },
});

export default PengaturanScreen;
