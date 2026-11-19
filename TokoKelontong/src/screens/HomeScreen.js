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
  useWindowDimensions,
  Platform,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import { signOut } from "../services/authService";
import TransactionRepository from "../database/transactionRepository";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";
import PinModal from "../components/PinModal";
import ConnectionStatusPill from "../components/ConnectionStatusPill";
import {
  getPinSecurityStatus,
  isScreenLocked,
} from "../utils/securityPin";
import { getOfflineQueueCount } from "../utils/offlineQueue";
import { refreshSyncCounts } from "../services/syncService";
import useSyncStatus from "../hooks/useSyncStatus";
import usePlan from "../hooks/usePlan";
import useAppUpdate from "../hooks/useAppUpdate";
import { SUPPORT_WHATSAPP } from "../config/planConfig";

const { width } = Dimensions.get("window");
const isTablet = width >= 600;

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { state, dispatch } = useContext(AppContext);
  const { profile } = useAuth();
  const cloudStoreName = profile?.stores?.store_name;
  const storeName = cloudStoreName || state.storeName || "Toko Saya";

  const trimmedStoreName = String(storeName || "").trim();
  const isCompactPhone = windowWidth < 360;
  const dynamicStoreNameStyle =
    trimmedStoreName.length > 24 || isCompactPhone
      ? styles.storeNameTextCompact
      : trimmedStoreName.length > 16
        ? styles.storeNameTextMedium
        : null;

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
  const appUpdate = useAppUpdate();

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
          const pinStatus = await getPinSecurityStatus();
          setPinProtected(pinStatus.hasPin);
          setLockedMenus(pinStatus.lockedMenus);
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
            dispatch({ type: "RESET_STORE_STATE" });
            signOut();
          },
        },
      ],
    );
  };

  const handleContactCS = async () => {
    const phone = SUPPORT_WHATSAPP || "6285196221716";
    const msg = `Halo CS MarketPos, saya mengalami kendala / bug di aplikasi (Toko: ${trimmedStoreName || "Toko Saya"}).`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Tidak Dapat Membuka WhatsApp",
        "Silakan hubungi CS MarketPos melalui WhatsApp di 085196221716.",
      );
    }
  };

  const now = new Date();
  const useShortWeekday =
    windowWidth < 380 || (!plan.isPro && state.businessMode === "fnb");
  const dateFormatted = now.toLocaleDateString("id-ID", {
    weekday: useShortWeekday ? "short" : "long",
    day: "numeric",
    month: "short",
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
      <View
        style={[
          styles.topNavbar,
          {
            paddingTop:
              Platform.OS === "android"
                ? Math.max(insets.top, StatusBar.currentHeight || 0) + 12
                : Math.max(insets.top, 14) + 8,
          },
        ]}
      >
        <View style={styles.topNavbarInner}>
          <View style={styles.storeAvatarBtn} accessible={false}>
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

          <View style={styles.storeIdentityCol}>
            <Text
              style={[styles.storeNameText, dynamicStoreNameStyle]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {storeName}
            </Text>

            <View style={styles.storeMetaRow}>
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
              <Text style={styles.metaSeparator} accessible={false}>
                •
              </Text>
              <Text
                style={styles.statusDateText}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {dateFormatted}
              </Text>
            </View>
          </View>

          <ConnectionStatusPill
            style={styles.connectionPill}
            offline={syncStatus.offline}
            syncing={syncStatus.syncing}
            onPress={() => {
              if (offlineCount > 0) {
                navigation.navigate("TransaksiPending");
              } else {
                refreshSyncCounts();
              }
            }}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Card Pemberitahuan Update OTA (Tetap Muncul Sampai Diperbarui) ─── */}
        {appUpdate.shouldShowBanner && (
          <View style={styles.updateAlertCard}>
            <View style={styles.updateIconWrap}>
              <MaterialCommunityIcons
                name={
                  appUpdate.isReadyToInstall
                    ? "check-decagram-outline"
                    : "cloud-download-outline"
                }
                size={20}
                color={colors.infoBadgeText}
              />
            </View>

            <View style={styles.updateCardTextCol}>
              <View style={styles.updateTitleRow}>
                <Text style={styles.updateCardTitle} numberOfLines={1}>
                  {appUpdate.isReadyToInstall
                    ? "Update Siap Dipasang"
                    : "Update Tersedia"}
                </Text>
                <View style={styles.updateStatusBadge}>
                  <Text style={styles.updateStatusBadgeText}>BARU</Text>
                </View>
              </View>
              <Text style={styles.updateCardSub} numberOfLines={2}>
                {appUpdate.isUpdating
                  ? "Sedang mengunduh & menyiapkan pembaruan..."
                  : appUpdate.isReadyToInstall
                    ? "Sudah terunduh. Ketuk Pasang untuk memuat ulang."
                    : "Perbaikan & fitur terbaru siap dipasang."}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.updateActionBtn,
                appUpdate.isUpdating && { opacity: 0.75 },
              ]}
              onPress={appUpdate.promptApplyUpdate}
              disabled={appUpdate.isUpdating}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                appUpdate.isReadyToInstall
                  ? "Pasang pembaruan aplikasi sekarang"
                  : "Update aplikasi sekarang"
              }
            >
              {appUpdate.isUpdating ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={styles.updateActionBtnText}>
                  {appUpdate.isReadyToInstall ? "Pasang" : "Update"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ─── Banner Antrean Offline (Hanya tampil jika ada data pending) ─── */}
        {offlineCount > 0 && (
          <View style={styles.offlineAlertCard}>
            <TouchableOpacity
              style={styles.offlineAlertLeft}
              onPress={() => navigation.navigate("TransaksiPending")}
              activeOpacity={0.7}
              accessibilityRole="button"
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
              accessibilityRole="button"
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
              activeOpacity={0.75}
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={
                hideBalance
                  ? "Tampilkan nominal omzet dan laba"
                  : "Sembunyikan nominal omzet dan laba"
              }
            >
              <MaterialCommunityIcons
                name={hideBalance ? "eye-outline" : "eye-off-outline"}
                size={15}
                color={colors.onPrimary}
              />
              <Text style={styles.privacyToggleText}>
                {hideBalance ? "Tampilkan" : "Sembunyikan"}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.heroOmzetAmount} numberOfLines={1}>
            {hideBalance ? "Rp••••••••" : formatRupiah(totalOmzet)}
          </Text>

          <View style={styles.metricsRow}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Estimasi Laba Bersih</Text>
              <Text style={styles.metricValue} numberOfLines={1}>
                {hideBalance ? "Rp••••••" : formatRupiah(totalLaba)}
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
                accessibilityRole="button"
                accessibilityLabel={menu.title}
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
                accessibilityRole="button"
                accessibilityLabel={item.title}
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
                    {item.key === "Pengaturan" && appUpdate.hasUpdate && (
                      <View style={styles.updateMenuBadge}>
                        <Text style={styles.updateMenuBadgeText}>UPDATE</Text>
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
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Tombol Keluar (Logout) ─── */}
        <TouchableOpacity
          style={styles.logoutBottomButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Keluar Akun"
          onPress={handleLogout}
        >
          <MaterialCommunityIcons
            name="logout"
            size={18}
            color={colors.errorDark}
          />
          <Text style={styles.logoutBottomText}>Keluar Akun (Logout)</Text>
        </TouchableOpacity>

        {/* ─── Tombol CS / Lapor Kendala via WhatsApp ─── */}
        <TouchableOpacity
          style={styles.csSupportButton}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Hubungi CS WhatsApp untuk lapor bug atau kendala"
          onPress={handleContactCS}
        >
          <View style={styles.csIconWrap}>
            <MaterialCommunityIcons
              name="whatsapp"
              size={20}
              color={colors.successButtonDark}
            />
          </View>
          <View style={styles.csTextCol}>
            <View style={styles.csTitleRow}>
              <Text style={styles.csTitle} numberOfLines={1}>
                Hubungi CS
              </Text>
              <View style={styles.csWaBadge}>
                <Text style={styles.csWaBadgeText}>WhatsApp</Text>
              </View>
            </View>
            <Text style={styles.csSubtitle} numberOfLines={1}>
              Lapor bug · 0851-9622-1716
            </Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </ScrollView>

      {/* ─── Floating Bottom CTA: Buka Kasir POS ─── */}
      <View
        style={[
          styles.floatingBottomWrap,
          {
            paddingBottom:
              Platform.OS === "android"
                ? Math.max(insets.bottom, 36) + 12
                : Math.max(insets.bottom, 24),
          },
        ]}
      >
        <TouchableOpacity
          style={styles.mainKasirButton}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Buka Kasir POS"
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
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  topNavbarInner: {
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  storeAvatarBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    overflow: "hidden",
    flexShrink: 0,
  },
  storeAvatarPhoto: {
    width: "100%",
    height: "100%",
  },
  storeAvatarLogoDefault: {
    width: 30,
    height: 30,
  },
  storeIdentityCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  storeNameText: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    lineHeight: 22,
    color: colors.text,
    letterSpacing: -0.3,
  },
  storeNameTextMedium: {
    fontSize: 15.5,
    lineHeight: 20,
  },
  storeNameTextCompact: {
    fontSize: 14.5,
    lineHeight: 19,
  },
  connectionPill: {
    flexShrink: 0,
  },
  storeMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  tierBadge: {
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  tierBadgePro: {
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  tierBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textBodySecondary,
    letterSpacing: 0.3,
  },
  tierBadgeTextPro: {
    color: colors.primaryTextDark,
  },
  fnbTag: {
    backgroundColor: colors.text,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 0,
  },
  fnbTagText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onPrimary,
    letterSpacing: 0.3,
  },
  metaSeparator: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textMuted,
    flexShrink: 0,
  },
  statusDateText: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  // ── Scroll Content ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 155,
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
  },

  // ── Alert Sinkronisasi Offline ──
  offlineAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primaryContainer,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
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
    color: colors.primaryTextDark,
  },
  offlineSub: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primaryDark,
    marginTop: 2,
  },
  offlineBtn: {
    backgroundColor: colors.primary,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  offlineBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.onPrimary,
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
    backgroundColor: colors.heroDecorCircle,
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
    fontSize: 12,
    color: colors.onPrimarySoft,
    letterSpacing: 0.6,
  },
  privacyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.heroControlBg,
  },
  privacyToggleText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.onPrimary,
  },
  heroOmzetAmount: {
    fontFamily: fonts.extraBold,
    fontSize: 32,
    color: colors.onPrimary,
    letterSpacing: -0.6,
    marginBottom: 18,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricBox: {
    flex: 1,
    justifyContent: "space-between",
    backgroundColor: colors.heroMetricBg,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.onPrimarySoft,
    marginBottom: 4,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.onPrimary,
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
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.text,
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
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorderSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  gridCardBadges: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockBadge: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  lockBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textBodySecondary,
    letterSpacing: 0.3,
  },
  proBadge: {
    backgroundColor: colors.primaryContainer,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  proBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.3,
    color: colors.primaryDark,
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
    borderColor: colors.cardBorder,
    shadowColor: colors.text,
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
    borderBottomColor: colors.cardBorder,
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

  // ── Tombol Logout & CS ──
  logoutBottomButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.errorContainer,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  logoutBottomText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.errorDark,
  },
  csSupportButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    marginBottom: 24,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  csIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.successContainer,
    borderWidth: 1,
    borderColor: colors.successBorder,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  csTextCol: {
    flex: 1,
    minWidth: 0,
  },
  csTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  csTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
  },
  csWaBadge: {
    backgroundColor: colors.successContainer,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  csWaBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.successText,
    letterSpacing: 0.2,
  },
  csSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
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
    backgroundColor: colors.floatingBarBg,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  mainKasirButton: {
    maxWidth: 680,
    width: "100%",
    alignSelf: "center",
    backgroundColor: colors.text,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: colors.text,
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
    color: colors.onPrimary,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  mainKasirSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.onDarkMuted,
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
    color: colors.onPrimary,
  },

  // ── Card Pemberitahuan Update OTA (Clean & Selalu Tampil Sampai Diperbarui) ──
  updateAlertCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.infoContainer,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.infoBorder,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 16,
    gap: 12,
  },
  updateIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.infoBadgeBg,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  updateCardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  updateTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  updateStatusBadge: {
    backgroundColor: colors.infoBadgeBg,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  updateStatusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.infoBadgeText,
    letterSpacing: 0.3,
  },
  updateCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: colors.text,
  },
  updateCardSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.infoText,
    marginTop: 2,
    lineHeight: 16,
  },
  updateActionBtn: {
    backgroundColor: colors.info,
    minHeight: 38,
    minWidth: 74,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  updateActionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: colors.onPrimary,
  },
  updateMenuBadge: {
    backgroundColor: colors.infoBadgeBg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  updateMenuBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: colors.infoBadgeText,
    letterSpacing: 0.3,
  },
});

export default HomeScreen;
