import React, { useState, useEffect, useContext } from "react";
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
import { generateReceiptHTML } from "../utils/receiptGenerator";
import {
  isPrinterConfigured,
  isBluetoothPrintingSupported,
  printReceiptViaBluetooth,
} from "../utils/bluetoothPrinter";
import usePlan from "../hooks/usePlan";
import { ProLockModal } from "../components/ProLock";

const STORE_PROFILE_KEY = "@TokoKelontong:StoreProfile";
const getCustomPresetsKey = (storeId) =>
  `@TokoKelontong:FooterPresets:${storeId || "default"}`;

const DEFAULT_FOOTER_PRESETS = [
  "Terima kasih telah berbelanja!",
  "Barang yang dibeli tidak dapat ditukar",
  "Terima kasih atas kunjungan Anda",
  "Selamat Berbelanja Kembali!",
];

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

  // Tier langganan toko. Gratis = template nota standar.
  const plan = usePlan();
  const isReadOnly = !plan.isPro;
  const [showLockModal, setShowLockModal] = useState(false);

  useEffect(() => {
    loadSettings();
    if (isBluetoothPrintingSupported()) {
      isPrinterConfigured()
        .then(setBtPrinterReady)
        .catch(() => setBtPrinterReady(false));
    }
  }, []);

  useEffect(() => {
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

  const loadSettings = async () => {
    try {
      const savedProfile = await AsyncStorage.getItem(STORE_PROFILE_KEY);
      if (savedProfile !== null) {
        const data = JSON.parse(savedProfile);
        setStoreName(data.storeName || data.name || "");
        setStoreAddress(data.storeAddress || "");
        setStoreContact(data.storeContact || "");
        setFooterMessage(
          data.footerMessage || "Terima kasih telah berbelanja!",
        );
      } else {
        const legacyName = await AsyncStorage.getItem("storeName");
        if (legacyName) setStoreName(legacyName);
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
      let existing = {};
      try {
        const savedExisting = await AsyncStorage.getItem(STORE_PROFILE_KEY);
        if (savedExisting) existing = JSON.parse(savedExisting);
      } catch (_) {
        existing = {};
      }

      const trimmedName = storeName.trim();
      const data = {
        ...existing,
        storeName: trimmedName,
        storeAddress: storeAddress.trim(),
        storeContact: storeContact.trim(),
        footerMessage: footerMessage.trim(),
        name: trimmedName,
      };

      await AsyncStorage.setItem(STORE_PROFILE_KEY, JSON.stringify(data));

      if (trimmedName) {
        await AsyncStorage.setItem("storeName", trimmedName);
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

    const profile = {
      storeName: storeName.trim() || "Toko Kelontong",
      storeAddress: storeAddress.trim(),
      storeContact: storeContact.trim(),
      footerMessage: footerMessage.trim() || "Terima kasih telah berbelanja!",
    };

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
        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Banner Mode Gratis (kustomisasi nota Pro) ── */}
        {isReadOnly && (
          <TouchableOpacity
            style={styles.readOnlyBanner}
            activeOpacity={0.85}
            onPress={() => setShowLockModal(true)}
          >
            <Text style={styles.readOnlyBannerText}>
              Paket Gratis: menggunakan template nota bawaan. Kustomisasi nota,
              logo, dan pesan footer tersedia di paket Pro.
            </Text>
            <Text style={styles.readOnlyBannerAction}>Upgrade</Text>
          </TouchableOpacity>
        )}

        {/* ── KARTU 1: IDENTITAS TOKO ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>IDENTITAS TOKO DI STRUK</Text>
          </View>

          {/* Nama Toko */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>NAMA TOKO *</Text>
            <TextInput
              style={styles.textInputClean}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Misal: Toko Berkah Jaya"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Alamat Toko */}
          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>ALAMAT TOKO</Text>
            <TextInput
              style={[styles.textInputClean, styles.textAreaClean]}
              value={storeAddress}
              onChangeText={setStoreAddress}
              placeholder="Misal: Jl. Pandean No. 13, Kota"
              placeholderTextColor="#94A3B8"
              multiline
            />
          </View>

          {/* Nomor Telepon / WA */}
          <View style={[styles.formGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>NOMOR TELEPON / WA (OPSIONAL)</Text>
            <TextInput
              style={styles.textInputClean}
              value={storeContact}
              onChangeText={setStoreContact}
              placeholder="Misal: 085196221716"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* ── KARTU 2: FORMAT PESAN STRUK ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeaderTitle}>PESAN PENUTUP STRUK</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.fieldLabel}>PESAN FOOTER STRUK</Text>
            <TextInput
              style={styles.textInputClean}
              value={footerMessage}
              onChangeText={setFooterMessage}
              placeholder="Misal: Terima kasih telah berbelanja!"
              placeholderTextColor="#94A3B8"
            />
          </View>

          {/* Preset Cepat Pesan Footer (Dropdown + Tambah Pilihan Per Toko) */}
          <View style={styles.presetHeaderRow}>
            <Text style={styles.presetLabel}>PILIHAN CEPAT:</Text>
            <TouchableOpacity
              style={styles.addPresetBtnMini}
              onPress={() => {
                setShowAddPresetInput((prev) => !prev);
                setShowPresetDropdown(false);
              }}
              activeOpacity={0.75}
            >
              <Text style={styles.addPresetBtnMiniText}>
                {showAddPresetInput ? "Batal" : "+ Tambah Pilihan"}
              </Text>
            </TouchableOpacity>
          </View>

          {showAddPresetInput && (
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
                    showPresetDropdown && styles.presetDropdownTriggerOpen,
                  ]}
                  onPress={() => setShowPresetDropdown((prev) => !prev)}
                  activeOpacity={0.78}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.presetDropdownTriggerLabel} numberOfLines={1}>
                      {footerMessage.trim() || "Pilih pesan cepat..."}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={showPresetDropdown ? "chevron-up" : "chevron-down"}
                    size={22}
                    color="#64748B"
                  />
                </TouchableOpacity>

                {showPresetDropdown && (
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
            Tampilan nyata struk belanja di kertas printer kasir:
          </Text>

          <View style={styles.receiptPaper}>
            <Text style={styles.receiptStoreName}>
              {storeName.trim() || "NAMA TOKO ANDA"}
            </Text>
            {storeAddress.trim() ? (
              <Text style={styles.receiptMetaCenter}>{storeAddress.trim()}</Text>
            ) : null}
            {storeContact.trim() ? (
              <Text style={styles.receiptMetaCenter}>
                Telp/WA: {storeContact.trim()}
              </Text>
            ) : null}

            <View style={styles.receiptDash} />

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMeta}>No : INV/2026/0001</Text>
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
                <Text style={styles.receiptMeta}>1 x Rp 15.000</Text>
                <Text style={styles.receiptItemTotal}>Rp 15.000</Text>
              </View>
            </View>

            <View style={styles.receiptItem}>
              <Text style={styles.receiptItemName}>Contoh Produk 2</Text>
              <View style={styles.receiptMetaRow}>
                <Text style={styles.receiptMeta}>2 x Rp 10.000</Text>
                <Text style={styles.receiptItemTotal}>Rp 20.000</Text>
              </View>
            </View>

            <View style={styles.receiptDash} />

            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptTotalLabel}>TOTAL</Text>
              <Text style={styles.receiptTotalValue}>Rp 35.000</Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMeta}>Tunai</Text>
              <Text style={styles.receiptMeta}>Rp 50.000</Text>
            </View>
            <View style={styles.receiptMetaRow}>
              <Text style={styles.receiptMeta}>Kembalian</Text>
              <Text style={[styles.receiptMeta, { fontWeight: "bold" }]}>
                Rp 15.000
              </Text>
            </View>

            <View style={styles.receiptDash} />

            <Text style={styles.receiptFooter}>
              {footerMessage.trim() || "Terima kasih telah berbelanja!"}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ── DOCKED BOTTOM ACTIONS (Aman dari Tombol Navigasi Android) ── */}
      <View
        style={[
          styles.dockedFooter,
          {
            paddingBottom:
              Platform.OS === "android"
                ? Math.max(insets.bottom, 16) + 10
                : Math.max(insets.bottom, 14),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.dockedTestBtn}
          onPress={handleTestPrint}
          activeOpacity={0.8}
        >
          <Text style={styles.dockedTestBtnText}>Tes Cetak</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.dockedSaveBtn,
            saved && { backgroundColor: "#059669" },
            saving && { opacity: 0.7 },
          ]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.88}
        >
          <Text style={styles.dockedSaveBtnText}>
            {saved ? "TERSIMPAN!" : saving ? "MENYIMPAN..." : "SIMPAN PENGATURAN"}
          </Text>
        </TouchableOpacity>
      </View>

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
    fontSize: 11,
    color: "#64748B",
    marginBottom: 10,
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
    justifyContent: "space-between",
    alignItems: "center",
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
