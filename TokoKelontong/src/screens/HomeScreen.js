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
import { signOut } from "../services/authService";
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
import usePlan from "../hooks/usePlan";

const { width } = Dimensions.get("window");
const isTablet = width >= 600;

const HomeScreen = ({ navigation }) => {
  const { state, dispatch } = useContext(AppContext);
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

  // Tier langganan toko. Menu Pro TETAP bisa dibuka (K-11: data lama harus
  // tetap terlihat); badge ini hanya penanda bahwa aksi baru terkunci.
  const plan = usePlan();

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

  const handleLogout = async () => {
    let unsynced = 0;
    try {
      unsynced = await getOfflineQueueCount();
    } catch {
      unsynced = 0;
    }
    const warning =
      unsynced > 0
        ? `Ada ${unsynced} transaksi yang belum terkirim ke cloud. Transaksi tetap tersimpan aman di HP ini dan akan terkirim saat Anda masuk lagi dengan akun yang sama dan ada internet. Tetap keluar?`
        : "Anda akan keluar dari akun di HP ini. Data toko tetap aman di cloud.";
    Alert.alert(
      unsynced > 0 ? "Masih Ada Transaksi Belum Terkirim" : "Keluar Akun",
      warning,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Keluar",
          style: "destructive",
          onPress: () => {
            dispatch({ type: "CLEAR_CART" });
            signOut();
          },
        },
      ],
    );
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

  // Menu Bento Grid Utama
  const operationalMenus = [
    {
      key: "Gudang",
      title: "Gudang & Stok",
      desc: "Kelola katalog produk, harga & stok",
      icon: "package-variant-closed",
    },
    {
      key: "Laporan",
      title: "Laporan Penjualan",
      desc: "Riwayat nota & rekapitulasi kas",
      icon: "file-document-outline",
      proFeature: "laporanLanjutan",
    },
    {
      key: "Dashboard",
      title: "Statistik Toko",
      desc: "Grafik performa & produk terlaris",
      icon: "chart-bar",
      proFeature: "dashboard",
    },
    {
      key: "BukuKasbon",
      title: "Buku Kasbon",
      desc: "Catatan piutang & tagihan pelanggan",
      icon: "book-open-variant",
      proFeature: "kasbon",
    },
  ];

  // Menu Konfigurasi & Panduan
  const settingsMenus = [
    {
      key: "SettingNota",
      title: "Format Nota & Printer",
      desc: "Atur kop struk, catatan kaki & Bluetooth thermal",
      proFeature: "customNota",
    },
    {
      key: "Pengaturan",
      title: "Pengaturan Toko",
      desc: "Profil usaha, meja F&B, PIN & langganan",
    },
    {
      key: "Panduan",
      title: "Panduan Penggunaan",
      desc: "Cara pakai kasir, sinkronisasi & printer",
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

      {/* ─── Header Toko Bersih & Status Koneksi ─── */}
      <View style={styles.topNavbar}>
        <TouchableOpacity
          style={styles.brandLeftRow}
          activeOpacity={0.82}
          onPress={() => navigateWithPin("Pengaturan")}
        >
          <View style={styles.storeAvatarBtn}>
            <Image
              source={
                state.storeLogo
                  ? { uri: state.storeLogo }
                  : require("../../assets/app-logo.png")
              }
              style={
                state.storeLogo
                  ? styles.storeAvatarPhoto
                  : styles.storeAvatarLogoDefault
              }
              resizeMode={state.storeLogo ? "cover" : "contain"}
            />
          </View>

          <View style={styles.storeHeaderLeft}>
            <View style={styles.storeNameRow}>
              <Text style={styles.storeNameText} numberOfLines={1}>
                {storeName}
              </Text>
              <View
                style={[styles.tierBadge, plan.isPro && styles.tierBadgePro]}
              >
                <Text
                  style={[
                    styles.tierBadgeText,
                    plan.isPro && styles.tierBadgeTextPro,
                  ]}
                >
                  {plan.isPro ? "PRO" : "STARTER"}
                </Text>
              </View>
              {state.businessMode === "fnb" && (
                <View style={styles.fnbTag}>
                  <Text style={styles.fnbTagText}>F&B</Text>
                </View>
              )}
            </View>
            <Text style={styles.statusDateText} numberOfLines={1}>
              {dateFormatted}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.connStatusPill,
            syncStatus.offline
              ? styles.connStatusPillOffline
              : syncStatus.syncing
                ? styles.connStatusPillSyncing
                : styles.connStatusPillOnline,
          ]}
          activeOpacity={0.8}
          onPress={() => {
            if (offlineCount > 0) {
              navigation.navigate("TransaksiPending");
            } else {
              refreshSyncCounts();
            }
          }}
        >
          <View
            style={[
              styles.connStatusDot,
              syncStatus.offline
                ? { backgroundColor: "#F59E0B" }
                : syncStatus.syncing
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: "#10B981" },
            ]}
          />
          <Text
            style={[
              styles.connStatusText,
              syncStatus.offline
                ? styles.connStatusTextOffline
                : syncStatus.syncing
                  ? styles.connStatusTextSyncing
                  : styles.connStatusTextOnline,
            ]}
          >
            {syncStatus.offline
              ? "Offline"
              : syncStatus.syncing
                ? "Sinkron..."
                : "Online"}
          </Text>
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
              <View style={styles.offlineTextWrap}>
                <Text style={styles.offlineTitle}>
                  {offlineCount} Transaksi Menunggu Sinkronisasi
                </Text>
                <Text style={styles.offlineSub}>
                  {syncStatus.needsReview > 0
                    ? `${syncStatus.needsReview} perlu ditinjau • ketuk untuk detail`
                    : syncStatus.offline
                      ? "Tersimpan aman di perangkat • ketuk untuk detail"
                      : "Siap diunggah ke cloud • ketuk untuk detail"}
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
                {syncingOffline ? "Mengirim..." : "Sinkronkan"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Kartu Hero Omzet Warm Orange ─── */}
        <View style={styles.salesHeroCard}>
          <View style={styles.heroDecorCircle} />
          <View style={styles.salesHeroHeader}>
            <Text style={styles.salesHeroTagText}>OMZET HARI INI</Text>
            <TouchableOpacity
              style={styles.privacyToggle}
              activeOpacity={0.7}
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.privacyToggleText}>
                {hideBalance ? "Tampilkan" : "Sembunyikan"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroOmzetAmount} numberOfLines={1}>
            {hideBalance ? "Rp ••••••••" : formatRupiah(totalOmzet)}
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Estimasi Laba Bersih</Text>
              <Text style={styles.metricValue} numberOfLines={1}>
                {hideBalance ? "Rp ••••••" : formatRupiah(totalLaba)}
              </Text>
            </View>

            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Transaksi Selesai</Text>
              <Text style={styles.metricValue} numberOfLines={1}>
                {hideBalance ? "•• Nota" : `${totalTransaksi} Nota`}
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Bento Grid: Menu Operasional (2 Kolom) ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Manajemen & Operasional</Text>
        </View>

        <View style={styles.gridContainer}>
          {operationalMenus.map((menu) => {
            const isLocked = pinProtected && lockedMenus?.[menu.key];
            const needsPro = Boolean(menu.proFeature) && !plan.isPro;
            return (
              <TouchableOpacity
                key={menu.key}
                style={styles.gridCard}
                activeOpacity={0.82}
                onPress={() => navigateWithPin(menu.key)}
              >
                <View style={styles.gridCardTop}>
                  <View style={styles.gridIconSquircle}>
                    <MaterialCommunityIcons
                      name={menu.icon}
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.gridCardBadges}>
                    {isLocked && (
                      <View style={styles.lockBadge}>
                        <Text style={styles.lockBadgeText}>PIN</Text>
                      </View>
                    )}
                    {needsPro && (
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={styles.gridCardTitle}>{menu.title}</Text>
                <Text style={styles.gridCardDesc}>{menu.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Pengaturan & Konfigurasi (Clean Minimal List) ─── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>Konfigurasi & Bantuan</Text>
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
                <View style={styles.settingsTextCol}>
                  <View style={styles.settingsTitleInline}>
                    <Text style={styles.settingsRowTitle}>{item.title}</Text>
                    {item.proFeature && !plan.isPro && (
                      <View style={styles.proBadge}>
                        <Text style={styles.proBadgeText}>PRO</Text>
                      </View>
                    )}
                    {isLocked && (
                      <View style={styles.lockBadge}>
                        <Text style={styles.lockBadgeText}>PIN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.settingsRowDesc}>{item.desc}</Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Tombol Keluar (Logout) Paling Bawah ─── */}
        <TouchableOpacity
          style={styles.logoutBottomButton}
          activeOpacity={0.78}
          onPress={handleLogout}
        >
          <MaterialCommunityIcons
            name="logout"
            size={18}
            color="#DC2626"
          />
          <Text style={styles.logoutBottomText}>Keluar Akun (Logout)</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Floating Bottom CTA: Buka Kasir POS ─── */}
      <View style={styles.floatingBottomWrap}>
        <TouchableOpacity
          style={styles.mainKasirButton}
          activeOpacity={0.9}
          onPress={() => navigateWithPin("Kasir")}
        >
          <View style={styles.mainKasirTextCol}>
            <Text style={styles.mainKasirTitle}>Buka Kasir POS</Text>
            <Text style={styles.mainKasirSubtitle}>
              Transaksi penjualan, scan barcode & cetak struk
            </Text>
          </View>
          <View style={styles.mainKasirActionPill}>
            <Text style={styles.mainKasirActionText}>
              {pinProtected && lockedMenus?.["Kasir"] ? "Buka PIN" : "Mulai →"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

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
    backgroundColor: colors.background,
  },

  // ── Top Navbar ──
  topNavbar: {
    backgroundColor: colors.surface,
    paddingTop:
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) + 14 : 52,
    paddingBottom: 14,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 10,
  },
  brandLeftRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storeAvatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FED7AA",
    overflow: "hidden",
  },
  storeAvatarPhoto: {
    width: "100%",
    height: "100%",
  },
  storeAvatarLogoDefault: {
    width: 28,
    height: 28,
  },
  storeHeaderLeft: {
    flex: 1,
    justifyContent: "center",
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  storeNameText: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  tierBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tierBadgePro: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  tierBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: "#64748B",
    letterSpacing: 0.5,
  },
  tierBadgeTextPro: {
    color: colors.primary,
  },
  fnbTag: {
    backgroundColor: "#0F172A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fnbTagText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  statusDateText: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: colors.textSecondary,
    marginTop: 2,
  },
  connStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  connStatusPillOnline: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  connStatusPillOffline: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  connStatusPillSyncing: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  connStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  connStatusText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  connStatusTextOnline: {
    color: "#047857",
  },
  connStatusTextOffline: {
    color: "#B45309",
  },
  connStatusTextSyncing: {
    color: colors.primary,
  },

  // ── Scroll Content ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 120,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },

  // ── Alert Sinkronisasi Offline ──
  offlineAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF7ED",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
    marginBottom: 16,
  },
  offlineAlertLeft: {
    flex: 1,
    paddingRight: 10,
  },
  offlineTextWrap: {
    flex: 1,
  },
  offlineTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#9A3412",
  },
  offlineSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#C2410C",
    marginTop: 2,
  },
  offlineBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  offlineBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  // ── Sales Hero Card (Warm Orange) ──
  salesHeroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 5,
    marginBottom: 24,
    overflow: "hidden",
    position: "relative",
  },
  heroDecorCircle: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -60,
    right: -50,
  },
  salesHeroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  salesHeroTagText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "rgba(255,255,255,0.86)",
    letterSpacing: 0.8,
  },
  privacyToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  privacyToggleText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#FFFFFF",
  },
  heroOmzetAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    color: "#FFFFFF",
    letterSpacing: -0.6,
    marginBottom: 18,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.16)",
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 3,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: "#FFFFFF",
  },

  // ── Section Headings ──
  sectionHeaderRow: {
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },

  // ── Bento Grid Operasional (2 Kolom) ──
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 24,
  },
  gridCard: {
    width: (width - 36 - 12) / 2 > 320 ? 320 : (width - 36 - 12) / 2,
    flexGrow: isTablet ? 0 : 1,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 1,
  },
  gridCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  gridIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FFEDD5",
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: "#64748B",
    letterSpacing: 0.4,
  },
  proBadge: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.primary,
  },
  gridCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  gridCardDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // ── Section 2: Group Card Pengaturan ──
  settingsGroupCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  settingsRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  settingsTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  settingsTitleInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  settingsRowTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  settingsRowDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Tombol Logout Paling Bawah ──
  logoutBottomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 24,
  },
  logoutBottomText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: "#DC2626",
  },

  // ── Floating Bottom CTA: Buka Kasir POS ──
  floatingBottomWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 16,
    backgroundColor: "rgba(255, 253, 251, 0.94)",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  mainKasirButton: {
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "#0F172A",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 5,
  },
  mainKasirTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  mainKasirTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: "#FFFFFF",
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  mainKasirSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: "rgba(255,255,255,0.72)",
  },
  mainKasirActionPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  mainKasirActionText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },
});

export default HomeScreen;
