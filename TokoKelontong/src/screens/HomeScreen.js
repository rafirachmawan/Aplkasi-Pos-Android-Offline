import React, { useContext, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import TransactionRepository from "../database/transactionRepository";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";
import PinModal from "../components/PinModal";
import {
  isPinProtected,
  isScreenLocked,
  getLockedMenus,
} from "../utils/securityPin";
import { getOfflineQueueCount } from "../utils/offlineQueue";
import { refreshSyncCounts } from "../services/syncService";
import useSyncStatus from "../hooks/useSyncStatus";

const { width } = Dimensions.get("window");
const isTablet = width >= 600;

const HomeScreen = ({ navigation }) => {
  const { state } = useContext(AppContext);
  const { profile } = useAuth();
  const cloudStoreName = profile?.stores?.store_name;
  const storeName = cloudStoreName || state.storeName || "Toko Saya";

  const [hideBalance, setHideBalance] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [pinProtected, setPinProtected] = useState(false);
  const [lockedMenus, setLockedMenus] = useState({});
  const [todaySummary, setTodaySummary] = useState({
    omzet: 0,
    laba: 0,
    count: 0,
  });
  const syncStatus = useSyncStatus();
  const offlineCount = syncStatus.unsynced;
  const [syncingOffline, setSyncingOffline] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const nowDate = new Date();
          const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;
          try {
            const summary =
              await TransactionRepository.getSummaryByDatePattern(todayStr);
            setTodaySummary(summary);
          } catch (summaryErr) {
            // Offline: ringkasan server tidak tersedia, bagian lain tetap dimuat
            console.log("Ringkasan hari ini belum bisa dimuat:", summaryErr?.message);
          }
          const hasPin = await isPinProtected();
          setPinProtected(hasPin);
          const currentLocked = await getLockedMenus();
          setLockedMenus(currentLocked);
          await getOfflineQueueCount(); // memindahkan antrean lama bila ada
          refreshSyncCounts();
        } catch (e) {
          console.error("Error loading home stats:", e);
        }
      };
      load();
    }, []),
  );

  const handleSyncOffline = async () => {
    if (syncingOffline) return;
    setSyncingOffline(true);
    try {
      const res = await TransactionRepository.syncOfflineQueue();
      if (res.synced > 0) {
        Alert.alert(
          "Sinkronisasi Berhasil",
          `${res.synced} dari ${res.total} transaksi offline berhasil diunggah ke cloud!`,
        );
      } else if (res.total === 0) {
        Alert.alert("Informasi", "Semua transaksi sudah tersinkron ke cloud.");
      } else {
        Alert.alert(
          "Perhatian",
          `Gagal mengunggah transaksi (${res.failed} gagal). Pastikan koneksi internet stabil.`,
        );
      }
      await refreshSyncCounts();
      const nowDate = new Date();
      const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;
      const summary = await TransactionRepository.getSummaryByDatePattern(todayStr);
      setTodaySummary(summary);
    } catch (e) {
      Alert.alert("Gagal Sinkronisasi", e.message || "Terjadi masalah jaringan.");
    } finally {
      setSyncingOffline(false);
    }
  };

  const navigateWithPin = async (screenName, params) => {
    const isLocked = await isScreenLocked(screenName);
    if (isLocked) {
      setPendingNavigation({ screenName, params });
      setPinModalVisible(true);
    } else {
      navigation.navigate(screenName, params);
    }
  };

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalOmzet = todaySummary.omzet;
  const totalLaba = todaySummary.laba;
  const totalTransaksi = todaySummary.count;

  // Menu Operasional Kasir
  const operationalMenus = [
    {
      key: "Gudang",
      title: "Gudang Stok",
      desc: "Kelola produk & stok",
      icon: "package-variant-closed",
      iconColor: "#0284C7",
      bgColor: "#F0F9FF",
    },
    {
      key: "BukuKasbon",
      title: "Buku Kasbon",
      desc: "Piutang pelanggan & WA",
      icon: "book-account-outline",
      iconColor: "#D97706",
      bgColor: "#FFFBEB",
    },
    {
      key: "Laporan",
      title: "Laporan Kasir",
      desc: "Riwayat & rekap penjualan",
      icon: "file-document-outline",
      iconColor: "#059669",
      bgColor: "#ECFDF5",
    },
    {
      key: "Dashboard",
      title: "Statistik Toko",
      desc: "Grafik & analitik omzet",
      icon: "chart-box-outline",
      iconColor: "#4F46E5",
      bgColor: "#EEF2FF",
    },
  ];

  // Menu Alat & Konfigurasi
  const settingsMenus = [
    {
      key: "SettingNota",
      title: "Format Nota & Struk",
      desc: "Atur logo toko, header/footer, dan printer Bluetooth",
      icon: "receipt-text-outline",
      iconColor: "#475569",
      bgColor: "#F1F5F9",
    },
    {
      key: "Pengaturan",
      title: "Pengaturan Toko",
      desc: "Profil usaha, keamanan PIN, dan konfigurasi sistem",
      icon: "cog-outline",
      iconColor: "#475569",
      bgColor: "#F1F5F9",
    },
    {
      key: "Panduan",
      title: "Buku Panduan",
      desc: "Petunjuk pemakaian kasir & fitur offline-online",
      icon: "book-open-outline",
      iconColor: "#475569",
      bgColor: "#F1F5F9",
      directNavigate: true,
    },
  ];

  return (
    <View style={styles.safe}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* ─── Top Navbar Bersih & Kokoh ─── */}
      <View style={styles.topNavbar}>
        <View style={styles.storeHeaderLeft}>
          <View style={styles.storeNameRow}>
            <Text style={styles.storeNameText} numberOfLines={1}>
              {storeName}
            </Text>
            {state.businessMode === "fnb" && (
              <View style={styles.fnbTag}>
                <Text style={styles.fnbTagText}>KAFE / F&B</Text>
              </View>
            )}
          </View>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusDateText}>{dateFormatted}</Text>
          </View>
        </View>

        {/* Store Avatar / Setting Shortcut */}
        <TouchableOpacity
          style={styles.storeAvatarBtn}
          activeOpacity={0.8}
          onPress={() => navigateWithPin("Pengaturan")}
        >
          {state.storeLogo ? (
            <Image
              source={{ uri: state.storeLogo }}
              style={styles.storeAvatarImage}
            />
          ) : (
            <MaterialCommunityIcons
              name="storefront-outline"
              size={24}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Banner Antrean Offline (Hanya tampil jika ada data pending) ─── */}
        {offlineCount > 0 && (
          <View style={styles.offlineAlertCard}>
            <TouchableOpacity
              style={styles.offlineAlertLeft}
              onPress={() => navigation.navigate("TransaksiPending")}
              activeOpacity={0.7}
            >
              <View style={styles.offlineIconBox}>
                <MaterialCommunityIcons
                  name="cloud-upload-outline"
                  size={20}
                  color="#B45309"
                />
              </View>
              <View style={styles.offlineTextWrap}>
                <Text style={styles.offlineTitle}>
                  {offlineCount} Transaksi Belum Terkirim
                </Text>
                <Text style={styles.offlineSub}>
                  {syncStatus.needsReview > 0
                    ? `${syncStatus.needsReview} perlu ditinjau • ketuk untuk lihat`
                    : syncStatus.offline
                      ? "Tidak ada internet • ketuk untuk lihat"
                      : "Dikirim otomatis • ketuk untuk lihat"}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.offlineBtn}
              onPress={handleSyncOffline}
              disabled={syncingOffline}
              activeOpacity={0.8}
            >
              <Text style={styles.offlineBtnText}>
                {syncingOffline ? "Sinkron..." : "Kirim Sekarang"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Hero Sales Overview Card (Modern POS Standard) ─── */}
        <View style={styles.salesHeroCard}>
          <View style={styles.salesHeroHeader}>
            <View style={styles.salesHeroTag}>
              <MaterialCommunityIcons
                name="calendar-today"
                size={13}
                color={colors.textSecondary}
              />
              <Text style={styles.salesHeroTagText}>PENJUALAN HARI INI</Text>
            </View>
            <TouchableOpacity
              style={styles.privacyToggle}
              activeOpacity={0.7}
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <MaterialCommunityIcons
                name={hideBalance ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Hero Omzet Number */}
          <Text style={styles.heroOmzetAmount} numberOfLines={1}>
            {hideBalance ? "Rp ••••••••" : formatRupiah(totalOmzet)}
          </Text>

          {/* Sub-Metrics: Laba Bersih & Transaksi */}
          <View style={styles.metricsDivider} />
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Laba Bersih</Text>
              <Text style={[styles.metricValue, { color: "#059669" }]} numberOfLines={1}>
                {hideBalance ? "Rp ••••••" : formatRupiah(totalLaba)}
              </Text>
            </View>

            <View style={styles.metricVerticalLine} />

            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Total Transaksi</Text>
              <Text style={styles.metricValue} numberOfLines={1}>
                {hideBalance ? "•• Nota" : `${totalTransaksi} Nota Terbit`}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Primary POS Action: Buka Kasir ─── */}
        <TouchableOpacity
          style={styles.mainKasirButton}
          activeOpacity={0.9}
          onPress={() => navigateWithPin("Kasir")}
        >
          <View style={styles.mainKasirLeft}>
            <View style={styles.mainKasirIconBadge}>
              <MaterialCommunityIcons
                name="point-of-sale"
                size={28}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.mainKasirTextCol}>
              <Text style={styles.mainKasirTitle}>Buka Kasir POS</Text>
              <Text style={styles.mainKasirSubtitle}>
                Mulai transaksi, scan barcode & cetak struk
              </Text>
            </View>
          </View>
          <View style={styles.mainKasirArrowWrap}>
            <MaterialCommunityIcons
              name={
                pinProtected && lockedMenus?.["Kasir"]
                  ? "lock-outline"
                  : "arrow-right"
              }
              size={22}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>

        {/* ─── Section 1: Operasional Toko ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Operasional Toko</Text>
        </View>

        <View style={styles.gridContainer}>
          {operationalMenus.map((menu) => {
            const isLocked = pinProtected && lockedMenus?.[menu.key];
            return (
              <TouchableOpacity
                key={menu.key}
                style={styles.gridCard}
                activeOpacity={0.82}
                onPress={() => navigateWithPin(menu.key)}
              >
                <View style={styles.gridCardTop}>
                  <View
                    style={[
                      styles.gridIconSquircle,
                      { backgroundColor: menu.bgColor },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={menu.icon}
                      size={24}
                      color={menu.iconColor}
                    />
                  </View>
                  {isLocked && (
                    <View style={styles.lockBadge}>
                      <MaterialCommunityIcons
                        name="lock"
                        size={12}
                        color="#EF4444"
                      />
                    </View>
                  )}
                </View>
                <Text style={styles.gridCardTitle}>{menu.title}</Text>
                <Text style={styles.gridCardDesc}>{menu.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Section 2: Alat & Konfigurasi ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Alat & Pengaturan</Text>
        </View>

        <View style={styles.settingsGroupCard}>
          {settingsMenus.map((item, index) => {
            const isLocked = pinProtected && lockedMenus?.[item.key];
            const isLast = index === settingsMenus.length - 1;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.settingsRow, !isLast && styles.settingsRowBorder]}
                activeOpacity={0.75}
                onPress={() => {
                  if (item.directNavigate) {
                    navigation.navigate(item.key);
                  } else {
                    navigateWithPin(item.key);
                  }
                }}
              >
                <View
                  style={[
                    styles.settingsIconBox,
                    { backgroundColor: item.bgColor },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={20}
                    color={item.iconColor}
                  />
                </View>
                <View style={styles.settingsTextCol}>
                  <Text style={styles.settingsRowTitle}>{item.title}</Text>
                  <Text style={styles.settingsRowDesc}>{item.desc}</Text>
                </View>
                <MaterialCommunityIcons
                  name={isLocked ? "lock" : "chevron-right"}
                  size={20}
                  color={isLocked ? "#EF4444" : "#94A3B8"}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Footer Brand Ringan ─── */}
        <View style={styles.footerWrap}>
          <MaterialCommunityIcons
            name="shield-check-outline"
            size={15}
            color="#64748B"
          />
          <Text style={styles.footerText}>
            MarketPos • Sistem Kasir Pintar & Andal
          </Text>
        </View>
      </ScrollView>

      {/* ── Modal PIN Keamanan Pemilik Toko ── */}
      <PinModal
        visible={pinModalVisible}
        title="Masukkan PIN Pemilik"
        subtitle="Menu ini dilindungi PIN keamanan toko"
        onCancel={() => {
          setPinModalVisible(false);
          setPendingNavigation(null);
        }}
        onSuccess={() => {
          setPinModalVisible(false);
          if (pendingNavigation) {
            navigation.navigate(
              pendingNavigation.screenName,
              pendingNavigation.params,
            );
            setPendingNavigation(null);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  // ── Top Navbar ──
  topNavbar: {
    backgroundColor: "#FFFFFF",
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 16 : 52,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  storeHeaderLeft: {
    flex: 1,
    paddingRight: 14,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storeNameText: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    color: "#0F172A",
    letterSpacing: 0.2,
  },
  fnbTag: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  fnbTagText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#B45309",
    letterSpacing: 0.5,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    gap: 6,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  statusDateText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "#64748B",
  },
  storeAvatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  storeAvatarImage: {
    width: "100%",
    height: "100%",
  },

  // ── Scroll Content ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },

  // ── Alert Sinkronisasi Offline ──
  offlineAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFBEB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 12,
    marginBottom: 16,
  },
  offlineAlertLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  offlineIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  offlineTextWrap: {
    flex: 1,
  },
  offlineTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#92400E",
  },
  offlineSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  offlineBtn: {
    backgroundColor: "#D97706",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginLeft: 10,
  },
  offlineBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#FFFFFF",
  },

  // ── Sales Hero Card (Square / Moka Style) ──
  salesHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 16,
  },
  salesHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  salesHeroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  salesHeroTagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#64748B",
    letterSpacing: 0.6,
  },
  privacyToggle: {
    padding: 4,
    borderRadius: 6,
  },
  heroOmzetAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 28,
    color: "#0F172A",
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  metricsDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 14,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 2,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  metricVerticalLine: {
    width: 1,
    height: 28,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 12,
  },

  // ── Primary Action: Buka Kasir ──
  mainKasirButton: {
    backgroundColor: "#0F172A",
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  mainKasirLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  mainKasirIconBadge: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainKasirTextCol: {
    flex: 1,
  },
  mainKasirTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: "#FFFFFF",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  mainKasirSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },
  mainKasirArrowWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  // ── Section Headings ──
  sectionHeaderRow: {
    marginBottom: 12,
    marginLeft: 2,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#334155",
    letterSpacing: 0.2,
  },

  // ── Grid Operasional (2 Kolom) ──
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: (width - 32 - 12) / 2 > 320 ? 320 : (width - 32 - 12) / 2,
    flexGrow: isTablet ? 0 : 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  gridCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  gridIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 4,
  },
  gridCardDesc: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
  },

  // ── Section 2: Group Card Pengaturan ──
  settingsGroupCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 24,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  settingsIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  settingsTextCol: {
    flex: 1,
  },
  settingsRowTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 2,
  },
  settingsRowDesc: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#64748B",
  },

  // ── Footer ──
  footerWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingTop: 4,
    paddingBottom: 16,
  },
  footerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
  },
});

export default HomeScreen;
