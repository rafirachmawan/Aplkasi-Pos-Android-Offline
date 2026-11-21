import React, { useState, useEffect, useContext, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Print from "expo-print";
import { colors, fonts } from "../theme/colors";
import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { updateStoreName } from "../services/authService";
import {
  getStoreNameKey,
  getStoreProfileKey,
} from "../services/sessionStore";
import {
  FREE_RECEIPT_DEFAULTS,
  generateReceiptHTML,
  resolveReceiptProfile,
} from "../utils/receiptGenerator";
import {
  PAPER_SIZE_OPTIONS,
  getPaperSpec,
  normalizePaperSize,
} from "../utils/helpers";
import {
  isPrinterConfigured,
  isBluetoothPrintingSupported,
  printReceiptViaBluetooth,
  getSavedPaperSize,
  savePaperSize,
} from "../utils/bluetoothPrinter";
import usePlan from "../hooks/usePlan";
import useKeyboardVisible from "../hooks/useKeyboardVisible";
import { ProLockModal } from "../components/ProLock";

const getCustomPresetsKey = (storeId) =>
  `@TokoKelontong:FooterPresets:${storeId || "default"}`;

const DEFAULT_FOOTER_PRESETS = [
  "Terima kasih telah berbelanja!",
  "Barang yang dibeli tidak dapat ditukar",
  "Terima kasih atas kunjungan Anda",
  "Selamat Berbelanja Kembali!",
];

function LockedFieldBox({ isReadOnly, onLockedPress, children }) {
  if (!isReadOnly) return children;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onLockedPress}
      accessibilityRole="button"
      accessibilityLabel="Fitur paket Pro, ketuk untuk informasi upgrade"
    >
      <View pointerEvents="none">{children}</View>
    </TouchableOpacity>
  );
}

const SettingNotaScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { dispatch } = useContext(AppContext);
  const { profile, refreshProfile } = useAuth();
  const activeStoreId = profile?.store_id || profile?.stores?.id || "default";

  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeContact, setStoreContact] = useState("");
  const [footerMessage, setFooterMessage] = useState(
    "Terima kasih telah berbelanja!",
  );
  const [customPresets, setCustomPresets] = useState([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const [showAddPresetInput, setShowAddPresetInput] = useState(false);
  const [newPresetText, setNewPresetText] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [btPrinterReady, setBtPrinterReady] = useState(false);
  const [paperSize, setPaperSize] = useState("58mm");
  const [paperSaveNotice, setPaperSaveNotice] = useState(false);
  const paperTimerRef = useRef(null);

  // Tier langganan toko. Gratis = template nota standar (MarketPos, tanpa alamat/telepon/custom footer).
  const plan = usePlan();
  const isReadOnly = !plan.isPro;
  const [showLockModal, setShowLockModal] = useState(false);
  const keyboardVisible = useKeyboardVisible();

  useEffect(() => {
    if (isReadOnly) {
      setShowPresetDropdown(false);
      setShowAddPresetInput(false);
    }
  }, [isReadOnly]);

  const effectivePreviewProfile = resolveReceiptProfile(
    { storeName, storeAddress, storeContact, footerMessage, paperSize },
    plan.isPro,
  );
  const activePaperSpec = getPaperSpec(paperSize);

  const handleLockedTap = () => {
    if (isReadOnly) setShowLockModal(true);
  };

  const handleSelectPaperSize = async (nextId) => {
    const normalized = normalizePaperSize(nextId);
    setPaperSize(normalized);
    try {
      await savePaperSize(normalized);
      setPaperSaveNotice(true);
      if (paperTimerRef.current) clearTimeout(paperTimerRef.current);
      paperTimerRef.current = setTimeout(() => setPaperSaveNotice(false), 2200);
    } catch (e) {
      Alert.alert(
        "Gagal Menyimpan",
        "Ukuran kertas printer gagal disimpan: " + (e?.message || ""),
      );
    }
  };

  useEffect(() => {
    getSavedPaperSize()
      .then(setPaperSize)
      .catch(() => setPaperSize("58mm"));
    if (isBluetoothPrintingSupported()) {
      isPrinterConfigured()
        .then(setBtPrinterReady)
        .catch(() => setBtPrinterReady(false));
    }
    return () => {
      if (paperTimerRef.current) clearTimeout(paperTimerRef.current);
    };
  }, []);

  useEffect(() => {
    loadSettings(activeStoreId);
    loadCustomPresets(activeStoreId);
  }, [activeStoreId]);

  const loadCustomPresets = async (storeId) => {
    try {
      const raw = await AsyncStorage.getItem(getCustomPresetsKey(storeId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCustomPresets(parsed);
          return;
        }
      }
      setCustomPresets([]);
    } catch (e) {
      console.warn("Gagal memuat pilihan cepat toko:", e);
      setCustomPresets([]);
    }
  };

  const handleAddCustomPreset = async () => {
    if (isReadOnly) {
      setShowLockModal(true);
      return;
    }
    const trimmed = newPresetText.trim();
    if (!trimmed) {
      Alert.alert("Perhatian", "Tulis teks pilihan cepat terlebih dahulu.");
      return;
    }
    const allExisting = [...DEFAULT_FOOTER_PRESETS, ...customPresets];
    if (allExisting.some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
      setFooterMessage(trimmed);
      setNewPresetText("");
      setShowAddPresetInput(false);
      setShowPresetDropdown(false);
      return;
    }
    try {
      const updated = [...customPresets, trimmed];
      setCustomPresets(updated);
      await AsyncStorage.setItem(
        getCustomPresetsKey(activeStoreId),
        JSON.stringify(updated),
      );
      setFooterMessage(trimmed);
      setNewPresetText("");
      setShowAddPresetInput(false);
      setShowPresetDropdown(false);
    } catch (e) {
      Alert.alert("Gagal", "Tidak dapat menyimpan pilihan cepat baru.");
    }
  };

  const handleDeleteCustomPreset = (presetToDelete) => {
    if (isReadOnly) {
      setShowLockModal(true);
      return;
    }
    Alert.alert(
      "Hapus Pilihan Cepat",
      `Hapus "${presetToDelete}" dari daftar pilihan toko ini?`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              const updated = customPresets.filter((p) => p !== presetToDelete);
              setCustomPresets(updated);
              await AsyncStorage.setItem(
                getCustomPresetsKey(activeStoreId),
                JSON.stringify(updated),
              );
              if (footerMessage === presetToDelete) {
                setFooterMessage(DEFAULT_FOOTER_PRESETS[0]);
              }
            } catch (e) {
              console.warn("Gagal menghapus pilihan cepat:", e);
            }
          },
        },
      ],
    );
  };

  const loadSettings = async (targetStoreId = activeStoreId) => {
    try {
      const profileKey = getStoreProfileKey(targetStoreId);
      const nameKey = getStoreNameKey(targetStoreId);
      const savedProfile = profileKey
        ? await AsyncStorage.getItem(profileKey)
        : null;
      if (savedProfile !== null) {
        const data = JSON.parse(savedProfile);
        setStoreName(data.storeName || data.name || "");
        setStoreAddress(data.storeAddress || "");
        setStoreContact(data.storeContact || "");
        setFooterMessage(
          data.footerMessage || "Terima kasih telah berbelanja!",
        );
      } else {
        setStoreAddress("");
        setStoreContact("");
        setFooterMessage("Terima kasih telah berbelanja!");
        const scopedName = nameKey ? await AsyncStorage.getItem(nameKey) : null;
        setStoreName(scopedName || profile?.stores?.store_name || "");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleSave = async () => {
    if (isReadOnly) {
      setShowLockModal(true);
      return;
    }
    setSaving(true);
    try {
      const profileKey = getStoreProfileKey(activeStoreId);
      const nameKey = getStoreNameKey(activeStoreId);
      let existing = {};
      if (profileKey) {
        try {
          const savedExisting = await AsyncStorage.getItem(profileKey);
          if (savedExisting) existing = JSON.parse(savedExisting);
        } catch (_) {
          existing = {};
        }
      }

      const trimmedName = storeName.trim();
      const data = {
        ...existing,
        storeName: trimmedName,
        storeAddress: storeAddress.trim(),
        storeContact: storeContact.trim(),
        footerMessage: footerMessage.trim(),
        name: trimmedName,
        paperSize: normalizePaperSize(paperSize),
      };

      if (profileKey) {
        await AsyncStorage.setItem(profileKey, JSON.stringify(data));
      }

      if (trimmedName) {
        if (nameKey) {
          await AsyncStorage.setItem(nameKey, trimmedName);
        }
        dispatch({ type: "SET_STORE_NAME", payload: trimmedName });
        try {
          await updateStoreName(trimmedName);
          await refreshProfile();
        } catch (cloudErr) {
          console.warn("Sync store name to cloud:", cloudErr);
        }
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      Alert.alert("✅ Sukses", "Format dan informasi nota berhasil disimpan.");
    } catch (error) {
      Alert.alert("Error", "Gagal menyimpan pengaturan nota: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Cetak Struk Percobaan Langsung
  const handleTestPrint = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Info", "Cetak hanya didukung di perangkat Android.");
      return;
    }

    const sampleTx = {
      invoice_number: "INV/SAMPLE/001",
      created_at: new Date().toISOString(),
      grand_total: 35000,
      total_price: 35000,
      discount_amount: 0,
      cash_received: 50000,
      cash_return: 15000,
      payment_method: "cash",
    };

    const sampleDetails = [
      { product_name: "Contoh Produk A", quantity: 1, price_at_sale: 15000 },
      { product_name: "Contoh Produk B", quantity: 2, price_at_sale: 10000 },
    ];

    const profile = resolveReceiptProfile(
      { storeName, storeAddress, storeContact, footerMessage, paperSize },
      plan.isPro,
    );

    if (btPrinterReady && Platform.OS === "android") {
      try {
        await printReceiptViaBluetooth(sampleTx, sampleDetails, profile);
        Alert.alert("Berhasil", "Nota percobaan dikirim ke printer Bluetooth.");
        return;
      } catch (e) {
        console.warn("Bluetooth print failed, fallback to system:", e);
      }
    }

    try {
      const html = generateReceiptHTML(sampleTx, sampleDetails, profile);
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert("Error", "Gagal mencetak nota percobaan: " + e.message);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: keyboardVisible ? 28 : 152,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banner Mode Gratis (kustomisasi nota Pro) ── */}
        {isReadOnly && (
          <TouchableOpacity
            style={styles.readOnlyBanner}
            activeOpacity={0.85}
            onPress={() => setShowLockModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Informasi paket Gratis untuk pengaturan nota"
          >
            <MaterialCommunityIcons
              name="lock-outline"
              size={18}
              color={colors.warningTextDark}
            />
            <Text style={styles.readOnlyBannerText}>
              Paket Gratis: ukuran kertas printer bebas diatur gratis. Nama toko
              (MarketPos), alamat, no. telepon, & pesan khusus tersedia di
              paket Pro.
            </Text>
            <Text style={styles.readOnlyBannerAction}>Upgrade</Text>
          </TouchableOpacity>
        )}

        {/* ── KARTU 0: UKURAN KERTAS PRINTER (GRATIS UNTUK SEMUA PAKET) ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRowBetween}>
            <Text style={styles.cardHeaderTitle}>UKURAN KERTAS PRINTER</Text>
            <View style={styles.freeChip}>
              <MaterialCommunityIcons
                name={paperSaveNotice ? "check-circle" : "check-circle-outline"}
                size={13}
                color={colors.successDark}
              />
              <Text style={styles.freeChipText}>
                {paperSaveNotice ? "Tersimpan" : "Gratis"}
              </Text>
            </View>
          </View>

          <Text style={styles.paperHelperText}>
            Pilih lebar kertas printer thermal atau dokumen A4/PDF. Otomatis
            tersimpan di perangkat untuk Kasir & Laporan.
          </Text>

          <View style={styles.paperOptionRow} accessibilityRole="radiogroup">
            {PAPER_SIZE_OPTIONS.map((opt) => {
              const isSelected = paperSize === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.paperOptionBtn,
                    isSelected && styles.paperOptionBtnActive,
                  ]}
                  onPress={() => handleSelectPaperSize(opt.id)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`Pilih ukuran kertas ${opt.shortLabel} (${opt.colLabel})`}
                >
                  <Text
                    style={[
                      styles.paperOptionLabel,
                      isSelected && styles.paperOptionLabelActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  <Text
                    style={[
                      styles.paperOptionCol,
                      isSelected && styles.paperOptionColActive,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.colLabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View
            style={[
              styles.paperDetailBox,
              paperSaveNotice && styles.paperDetailBoxSaved,
            ]}
          >
            <MaterialCommunityIcons
              name={paperSaveNotice ? "check-circle" : "printer-pos"}
              size={18}
              color={paperSaveNotice ? colors.successDark : colors.primaryDark}
            />
            <Text
              style={[
                styles.paperDetailText,
                paperSaveNotice && styles.paperDetailTextSaved,
              ]}
            >
              {paperSaveNotice
                ? `Ukuran ${activePaperSpec.shortLabel} tersimpan & langsung aktif.`
                : `${activePaperSpec.shortLabel} — ${activePaperSpec.desc}`}
            </Text>
          </View>
        </View>

        {/* ── KARTU 1: IDENTITAS TOKO ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRowBetween}>
            <Text style={styles.cardHeaderTitle}>IDENTITAS TOKO DI STRUK</Text>
            {isReadOnly && (
              <View style={styles.proLockChip}>
                <MaterialCommunityIcons
                  name="lock"
                  size={12}
                  color={colors.warningTextDark}
                />
                <Text style={styles.proLockChipText}>Pro</Text>
              </View>
            )}
          </View>

          {/* Nama Toko */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>NAMA TOKO *</Text>
            <LockedFieldBox isReadOnly={isReadOnly} onLockedPress={handleLockedTap}>
              <TextInput
                style={[
                  styles.textInputClean,
                  isReadOnly && styles.textInputLocked,
                ]}
                value={isReadOnly ? FREE_RECEIPT_DEFAULTS.storeName : storeName}
                onChangeText={setStoreName}
                editable={!isReadOnly}
                placeholder="Misal: Toko Berkah Jaya"
                placeholderTextColor={colors.textMuted}
              />
            </LockedFieldBox>
            {isReadOnly && (
              <Text style={styles.lockedFieldHint}>
                Default paket Gratis menggunakan nama MarketPos.
              </Text>
            )}
          </View>

          {/* Alamat Toko */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>ALAMAT TOKO</Text>
            <LockedFieldBox isReadOnly={isReadOnly} onLockedPress={handleLockedTap}>
              <TextInput
                style={[
                  styles.textInputClean,
                  styles.textAreaClean,
                  isReadOnly && styles.textInputLocked,
                ]}
                value={isReadOnly ? "" : storeAddress}
                onChangeText={setStoreAddress}
                editable={!isReadOnly}
                placeholder={
                  isReadOnly
                    ? "Hanya dapat diisi di paket Pro"
                    : "Misal: Jl. Pandean No. 13, Kota"
                }
                placeholderTextColor={colors.textMuted}
                multiline
              />
            </LockedFieldBox>
          </View>

          {/* Nomor Telepon / WA */}
          <View style={[styles.formGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>NOMOR TELEPON / WA (OPSIONAL)</Text>
            <LockedFieldBox isReadOnly={isReadOnly} onLockedPress={handleLockedTap}>
              <TextInput
                style={[
                  styles.textInputClean,
                  isReadOnly && styles.textInputLocked,
                ]}
                value={isReadOnly ? "" : storeContact}
                onChangeText={setStoreContact}
                editable={!isReadOnly}
                placeholder={
                  isReadOnly
                    ? "Hanya dapat diisi di paket Pro"
                    : "Misal: 085196221716"
                }
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
              />
            </LockedFieldBox>
          </View>
        </View>

        {/* ── KARTU 2: FORMAT PESAN STRUK ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRowBetween}>
            <Text style={styles.cardHeaderTitle}>PESAN PENUTUP STRUK</Text>
            {isReadOnly && (
              <View style={styles.proLockChip}>
                <MaterialCommunityIcons
                  name="lock"
                  size={12}
                  color={colors.warningTextDark}
                />
                <Text style={styles.proLockChipText}>Pro</Text>
              </View>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>PESAN FOOTER STRUK</Text>
            <LockedFieldBox isReadOnly={isReadOnly} onLockedPress={handleLockedTap}>
              <TextInput
                style={[
                  styles.textInputClean,
                  isReadOnly && styles.textInputLocked,
                ]}
                value={
                  isReadOnly ? FREE_RECEIPT_DEFAULTS.footerMessage : footerMessage
                }
                onChangeText={setFooterMessage}
                editable={!isReadOnly}
                placeholder="Misal: Terima kasih telah berbelanja!"
                placeholderTextColor={colors.textMuted}
              />
            </LockedFieldBox>
          </View>

          {/* Preset Cepat Pesan Footer (Dropdown + Tambah Pilihan Per Toko) */}
          <View style={styles.presetHeaderRow}>
            <Text style={styles.presetLabel}>PILIHAN CEPAT:</Text>
            <TouchableOpacity
              style={[
                styles.addPresetBtnMini,
                isReadOnly && styles.addPresetBtnLocked,
              ]}
              onPress={() => {
                if (isReadOnly) {
                  handleLockedTap();
                  return;
                }
                setShowAddPresetInput((prev) => !prev);
                setShowPresetDropdown(false);
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={
                isReadOnly
                  ? "Tambah pilihan cepat terkunci untuk paket Pro"
                  : "Tambah pilihan cepat baru"
              }
            >
              <Text
                style={[
                  styles.addPresetBtnMiniText,
                  isReadOnly && { color: colors.textSecondary },
                ]}
              >
                {isReadOnly
                  ? "Khusus Pro"
                  : showAddPresetInput
                    ? "Batal"
                    : "+ Tambah Pilihan"}
              </Text>
            </TouchableOpacity>
          </View>

          {!isReadOnly && showAddPresetInput && (
            <View style={styles.addPresetBox}>
              <TextInput
                style={styles.addPresetInput}
                value={newPresetText}
                onChangeText={setNewPresetText}
                placeholder="Ketik pilihan cepat baru untuk toko ini..."
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                style={styles.addPresetSaveBtn}
                onPress={handleAddCustomPreset}
                activeOpacity={0.82}
              >
                <Text style={styles.addPresetSaveBtnText}>Simpan</Text>
              </TouchableOpacity>
            </View>
          )}

          {(() => {
            const allPresets = [
              ...DEFAULT_FOOTER_PRESETS.map((text) => ({ text, isCustom: false })),
              ...customPresets.map((text) => ({ text, isCustom: true })),
            ];
            return (
              <View style={styles.presetDropdownWrapper}>
                <TouchableOpacity
                  style={[
                    styles.presetDropdownTrigger,
                    isReadOnly && styles.textInputLocked,
                    !isReadOnly && showPresetDropdown && styles.presetDropdownTriggerOpen,
                  ]}
                  onPress={() => {
                    if (isReadOnly) {
                      handleLockedTap();
                      return;
                    }
                    setShowPresetDropdown((prev) => !prev);
                  }}
                  activeOpacity={0.78}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isReadOnly
                      ? "Pilihan cepat pesan footer terkunci untuk paket Pro"
                      : "Pilih pesan footer cepat"
                  }
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text
                      style={[
                        styles.presetDropdownTriggerLabel,
                        isReadOnly && { color: colors.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {isReadOnly
                        ? FREE_RECEIPT_DEFAULTS.footerMessage
                        : footerMessage.trim() || "Pilih pesan cepat..."}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={
                      isReadOnly
                        ? "lock-outline"
                        : showPresetDropdown
                          ? "chevron-up"
                          : "chevron-down"
                    }
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {!isReadOnly && showPresetDropdown && (
                  <View style={styles.presetDropdownList}>
                    {allPresets.map((item, idx) => {
                      const isActive = footerMessage === item.text;
                      return (
                        <View
                          key={`${item.text}-${idx}`}
                          style={[
                            styles.presetDropdownItemRow,
                            idx === allPresets.length - 1 && { borderBottomWidth: 0 },
                            isActive && styles.presetDropdownItemActive,
                          ]}
                        >
                          <TouchableOpacity
                            style={styles.presetDropdownSelectArea}
                            onPress={() => {
                              setFooterMessage(item.text);
                              setShowPresetDropdown(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons
                              name={isActive ? "radiobox-marked" : "radiobox-blank"}
                              size={19}
                              color={isActive ? colors.primary : "#CBD5E1"}
                            />
                            <Text
                              style={[
                                styles.presetDropdownItemText,
                                isActive && styles.presetDropdownItemTextActive,
                              ]}
                            >
                              {item.text}
                            </Text>
                            {item.isCustom && (
                              <View style={styles.customPresetBadge}>
                                <Text style={styles.customPresetBadgeText}>Toko</Text>
                              </View>
                            )}
                          </TouchableOpacity>

                          {item.isCustom && (
                            <TouchableOpacity
                              style={styles.deleteCustomPresetBtn}
                              onPress={() => handleDeleteCustomPreset(item.text)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MaterialCommunityIcons
                                name="trash-can-outline"
                                size={17}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })()}

          <View style={styles.infoNoteBox}>
            <Text style={styles.infoNoteText}>
              Pesan ini akan tercetak otomatis di bagian paling bawah setiap
              struk kasir dan file PDF yang dibagikan.
            </Text>
          </View>
        </View>

        {/* ── KARTU 3: PRATINJAU STRUK LIVE (TERMAL) ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRowBetween}>
            <Text style={styles.cardHeaderTitle}>PRATINJAU STRUK LIVE</Text>

            <TouchableOpacity
              style={styles.btnTestPrintMini}
              onPress={handleTestPrint}
              activeOpacity={0.8}
            >
              <Text style={styles.btnTestPrintMiniText}>Tes Cetak</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.previewSubtext}>
            Tampilan nyata struk kasir · Ukuran aktif:{" "}
            <Text style={styles.previewPaperTag}>
              {activePaperSpec.shortLabel} ({activePaperSpec.colLabel})
            </Text>
          </Text>

          <View
            style={[
              styles.receiptPaper,
              paperSize === "58mm" && styles.receiptPaper58,
              paperSize === "80mm" && styles.receiptPaper80,
              paperSize === "a4" && styles.receiptPaperA4,
            ]}
          >
            <Text style={styles.receiptStoreName}>
              {effectivePreviewProfile.storeName}
            </Text>
            {effectivePreviewProfile.storeAddress ? (
              <Text style={styles.receiptMetaCenter}>
                {effectivePreviewProfile.storeAddress}
              </Text>
            ) : null}
            {effectivePreviewProfile.storeContact ? (
              <Text style={styles.receiptMetaCenter}>
                Telp/WA: {effectivePreviewProfile.storeContact}
              </Text>
            ) : null}

            <View style={styles.receiptDash} />

            <View style={styles.receiptMetaRow}>
              <Text style={[styles.receiptMeta, { flexShrink: 1 }]}>
                No : INV/2026/0001
              </Text>
              <Text style={styles.receiptMeta}>
                {new Date().toLocaleDateString("id-ID", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })}{" "}
                {new Date().toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>

            <View style={styles.receiptDash} />

            <View style={styles.receiptItem}>
              <Text style={styles.receiptItemName}>Contoh Produk 1</Text>
              <View style={styles.receiptMetaRow}>
                <Text style={styles.receiptMeta}>1 x Rp15.000</Text>
                <Text style={styles.receiptItemTotal}>Rp15.000</Text>
              </View>
            </View>

            <View style={styles.receiptItem}>
              <Text style={styles.receiptItemName}>Contoh Produk 2</Text>
              <View style={styles.receiptMetaRow}>
                <Text style={styles.receiptMeta}>2 x Rp10.000</Text>
                <Text style={styles.receiptItemTotal}>Rp20.000</Text>
              </View>
            </View>

            <View style={styles.receiptDash} />

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptTotalLabel}>TOTAL</Text>
              <Text style={styles.receiptTotalValue}>Rp35.000</Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMeta}>Tunai</Text>
              <Text style={styles.receiptMeta}>Rp50.000</Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMeta}>Kembalian</Text>
              <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                Rp15.000
              </Text>
            </View>

            <View style={styles.receiptDash} />

            <Text style={styles.receiptFooter}>
              {effectivePreviewProfile.footerMessage}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── DOCKED BOTTOM ACTIONS (Aman dari Tombol Navigasi Android & Sembunyi Saat Keyboard Muncul) ── */}
      {!keyboardVisible && (
        <View
          style={[
            styles.dockedFooter,
            {
              paddingBottom:
                Platform.OS === "android"
                  ? Math.max(insets.bottom, 36) + 12
                  : Math.max(insets.bottom, 14),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.dockedTestBtn}
            onPress={handleTestPrint}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Tes cetak struk"
          >
            <Text style={styles.dockedTestBtnText}>Tes Cetak</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.dockedSaveBtn,
              isReadOnly && { backgroundColor: colors.primaryDark },
              saved && { backgroundColor: colors.successButtonDark },
              saving && { opacity: 0.7 },
            ]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel={
              isReadOnly
                ? "Simpan pengaturan nota khusus paket Pro"
                : "Simpan pengaturan nota"
            }
          >
            {isReadOnly && !saved && !saving && (
              <MaterialCommunityIcons
                name="lock-outline"
                size={16}
                color={colors.onPrimary}
              />
            )}
            <Text style={styles.dockedSaveBtnText}>
              {saved
                ? "TERSIMPAN!"
                : saving
                  ? "MENYIMPAN..."
                  : isReadOnly
                    ? "Simpan (Khusus Pro)"
                    : "SIMPAN PENGATURAN"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Panel Kunci Fitur (tier Gratis) ── */}
      <ProLockModal
        visible={showLockModal}
        feature="customNota"
        onClose={() => setShowLockModal(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Banner Mode Gratis (read-only) ──
  readOnlyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
  },
  readOnlyBannerText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: "#92400E",
    lineHeight: 16,
  },
  readOnlyBannerAction: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: "#92400E",
    textDecorationLine: "underline",
  },

  // ── Form Cards ──
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  cardHeaderRowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  cardHeaderTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  btnTestPrintMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  btnTestPrintMiniText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#0F172A",
  },

  // ── Form Fields ──
  formGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#475569",
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  textInputClean: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: "#0F172A",
    minHeight: 46,
  },
  textAreaClean: {
    height: 68,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  textInputLocked: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
    color: colors.textSecondary,
  },
  lockedFieldHint: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  proLockChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.warningBannerBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  proLockChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.warningTextDark,
  },
  freeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.successContainer,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  freeChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.successDark,
  },
  paperHelperText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textBodySecondary,
    marginBottom: 12,
  },
  paperOptionRow: {
    flexDirection: "row",
    gap: 8,
  },
  paperOptionBtn: {
    flex: 1,
    minHeight: 54,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  paperOptionBtnActive: {
    backgroundColor: colors.primaryContainer,
    borderColor: colors.primary,
  },
  paperOptionLabel: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  paperOptionLabelActive: {
    color: colors.primaryTextDark,
  },
  paperOptionCol: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  paperOptionColActive: {
    color: colors.primaryDark,
  },
  paperDetailBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  paperDetailBoxSaved: {
    backgroundColor: colors.successContainer,
    borderColor: colors.successBorder,
  },
  paperDetailText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textDark,
  },
  paperDetailTextSaved: {
    color: colors.successDark,
    fontFamily: fonts.semiBold,
  },
  addPresetBtnLocked: {
    backgroundColor: colors.surfaceSubtle,
    borderColor: colors.border,
  },

  // ── Presets Dropdown & Custom Per-Store ──
  presetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    marginTop: 4,
  },
  presetLabel: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  addPresetBtnMini: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  addPresetBtnMiniText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  addPresetBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  addPresetInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#0F172A",
  },
  addPresetSaveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addPresetSaveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  presetDropdownWrapper: {
    marginBottom: 12,
  },
  presetDropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  presetDropdownTriggerOpen: {
    borderColor: colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: "#FFFFFF",
  },
  presetDropdownTriggerLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13.5,
    color: "#0F172A",
  },
  presetDropdownList: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: "hidden",
  },
  presetDropdownItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingRight: 10,
  },
  presetDropdownItemActive: {
    backgroundColor: "#FFF7ED",
  },
  presetDropdownSelectArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  presetDropdownItemText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#334155",
  },
  presetDropdownItemTextActive: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  customPresetBadge: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  customPresetBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: colors.primary,
  },
  deleteCustomPresetBtn: {
    padding: 6,
  },

  // ── Info Note ──
  infoNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  infoNoteText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },

  // ── Live Receipt Preview (Authentic Thermal Paper) ──
  previewSubtext: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  previewPaperTag: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryDark,
  },
  receiptPaper: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  receiptPaper58: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 268,
  },
  receiptPaper80: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
  },
  receiptPaperA4: {
    width: "100%",
    borderTopWidth: 4,
    borderTopColor: colors.info,
  },
  receiptStoreName: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    color: "#0F172A",
    letterSpacing: 0.6,
    marginBottom: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptMetaCenter: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    color: "#64748B",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptDash: {
    borderBottomWidth: 1,
    borderBottomColor: "#94A3B8",
    borderStyle: "dashed",
    marginVertical: 8,
  },
  receiptMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    columnGap: 8,
    rowGap: 2,
    marginTop: 3,
  },
  receiptMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: "#475569",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptItem: {
    marginBottom: 6,
  },
  receiptItemName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptItemTotal: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptTotalLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptTotalValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiptFooter: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
    color: "#64748B",
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },

  // ── Docked Bottom Footer ──
  dockedFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: "row",
    gap: 10,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  dockedTestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#F8FAFC",
  },
  dockedTestBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  dockedSaveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  dockedSaveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
});

export default SettingNotaScreen;
