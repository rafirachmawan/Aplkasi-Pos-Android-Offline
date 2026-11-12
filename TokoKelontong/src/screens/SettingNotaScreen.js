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

const STORE_PROFILE_KEY = "@TokoKelontong:StoreProfile";

const FOOTER_PRESETS = [
  "Terima kasih telah berbelanja!",
  "Barang yang dibeli tidak dapat ditukar",
  "Terima kasih atas kunjungan Anda 🙏",
  "Selamat Berbelanja Kembali!",
];

const SettingNotaScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { dispatch } = useContext(AppContext);
  const { refreshProfile } = useAuth();

  const [storeName, setStoreName] = useState("");
  const [storeAddress, setStoreAddress] = useState("");
  const [storeContact, setStoreContact] = useState("");
  const [footerMessage, setFooterMessage] = useState(
    "Terima kasih telah berbelanja!",
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [btPrinterReady, setBtPrinterReady] = useState(false);

  useEffect(() => {
    loadSettings();
    if (isBluetoothPrintingSupported()) {
      isPrinterConfigured()
        .then(setBtPrinterReady)
        .catch(() => setBtPrinterReady(false));
    }
  }, []);

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
        {/* ── KARTU 1: IDENTITAS TOKO ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <MaterialCommunityIcons
              name="store-outline"
              size={18}
              color={colors.primary}
            />
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
            <MaterialCommunityIcons
              name="message-text-outline"
              size={18}
              color={colors.primary}
            />
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

          {/* Preset Cepat Pesan Footer */}
          <Text style={styles.presetLabel}>PILIHAN CEPAT:</Text>
          <View style={styles.presetWrap}>
            {FOOTER_PRESETS.map((preset, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.presetChip,
                  footerMessage === preset && styles.presetChipActive,
                ]}
                onPress={() => setFooterMessage(preset)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    footerMessage === preset && styles.presetChipTextActive,
                  ]}
                >
                  {preset}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.infoNoteBox}>
            <MaterialCommunityIcons
              name="information-outline"
              size={16}
              color="#64748B"
            />
            <Text style={styles.infoNoteText}>
              Pesan ini akan tercetak otomatis di bagian paling bawah setiap
              struk kasir dan file PDF yang dibagikan.
            </Text>
          </View>
        </View>

        {/* ── KARTU 3: PRATINJAU STRUK LIVE (TERMAL) ── */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRowBetween}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons
                name="receipt-text-outline"
                size={18}
                color={colors.primary}
              />
              <Text style={styles.cardHeaderTitle}>PRATINJAU STRUK LIVE</Text>
            </View>

            <TouchableOpacity
              style={styles.btnTestPrintMini}
              onPress={handleTestPrint}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons
                name={btPrinterReady ? "bluetooth" : "printer"}
                size={14}
                color="#0F172A"
              />
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
          <MaterialCommunityIcons
            name={btPrinterReady ? "bluetooth" : "printer"}
            size={18}
            color="#0F172A"
          />
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
          <MaterialCommunityIcons
            name={saved ? "check-circle-outline" : "content-save-check-outline"}
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.dockedSaveBtnText}>
            {saved ? "TERSIMPAN!" : saving ? "MENYIMPAN..." : "SIMPAN PENGATURAN"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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

  // ── Presets ──
  presetLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  presetChip: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  presetChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  presetChipText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#475569",
  },
  presetChipTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
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
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 13,
    elevation: 4,
    shadowColor: "#0F172A",
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
