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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import { AppContext } from "../context/AppContext";
import { useAuth } from "../context/AuthContext";
import TransactionRepository from "../database/transactionRepository";
import { colors, fonts } from "../theme/colors";

const { width } = Dimensions.get("window");

const formatRupiah = (value) => {
  if (!value && value !== 0) return "Rp 0";
  return "Rp " + Number(value).toLocaleString("id-ID");
};

const HomeScreen = ({ navigation }) => {
  const { state } = useContext(AppContext);
  const { profile } = useAuth();
  const cloudStoreName = profile?.stores?.store_name;
  const [hideBalance, setHideBalance] = useState(false);
  const [todaySummary, setTodaySummary] = useState({
    omzet: 0,
    laba: 0,
    count: 0,
  });

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        try {
          const nowDate = new Date();
          const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}-${String(nowDate.getDate()).padStart(2, "0")}`;
          const summary =
            await TransactionRepository.getSummaryByDatePattern(todayStr);
          setTodaySummary(summary);
        } catch (e) {
          console.error("Error loading home stats:", e);
        }
      };
      load();
    }, []),
  );

  const now = new Date();
  const dayName = now.toLocaleDateString("id-ID", { weekday: "long" });
  const dateStr = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hour = now.getHours();
  const greetingText =
    hour < 11
      ? "Selamat Pagi"
      : hour < 15
        ? "Selamat Siang"
        : hour < 18
          ? "Selamat Sore"
          : "Selamat Malam";
  const greetingEmoji =
    hour < 11 ? "☀️" : hour < 15 ? "🌤️" : hour < 18 ? "box" : "🌙";

  const totalPemasukan = todaySummary.omzet;
  const totalLaba = todaySummary.laba;
  const todayTransaksi = todaySummary.count;

  return (
    <View style={styles.safe}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      {/* ─── Clean White Header ─── */}
      <View style={styles.headerWhite}>
        {/* Top row: greeting + logo */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {cloudStoreName || state.storeName || "MarketPos"}
            </Text>

            <View style={styles.dateRow}>
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={14}
                color={colors.textSecondary}
              />
              <Text style={styles.dateSubText}>
                {dayName}, {dateStr}
              </Text>
            </View>
          </View>

          {/* Store Logo / Icon */}
          <View style={styles.headerIcon}>
            {state.storeLogo ? (
              <Image
                source={{ uri: state.storeLogo }}
                style={styles.storeLogoImage}
              />
            ) : (
              <MaterialCommunityIcons
                name="store"
                size={26}
                color={colors.iconColor}
              />
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.headerDivider} />

        {/* Floating Metric Card */}
        <View style={styles.statsCardWrapper}>
          <View style={styles.statsCardTopBar}>
            <Text style={styles.statsCardTopTitle}>RINGKASAN KEUANGAN</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.eyeToggleBtn}
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons
                name={hideBalance ? "eye-off-outline" : "eye-outline"}
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Omset Hari Ini</Text>
              <Text
                style={[styles.statValue, { color: colors.primary }]}
                numberOfLines={1}
              >
                {hideBalance ? "Rp ••••••" : formatRupiah(totalPemasukan)}
              </Text>
            </View>

            <View style={styles.statDividerV} />

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Laba Bersih</Text>
              <Text
                style={[styles.statValue, { color: colors.success }]}
                numberOfLines={1}
              >
                {hideBalance ? "Rp ••••••" : formatRupiah(totalLaba)}
              </Text>
            </View>

            <View style={styles.statDividerV} />

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Transaksi</Text>
              <Text
                style={[styles.statValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {hideBalance ? "••x" : `${todayTransaksi}x`}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* Primary Hero Action: Buka Kasir */}
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.primaryHeroCard}
          onPress={() => navigation.navigate("Kasir")}
        >
          <View style={styles.primaryCardLeft}>
            <View style={styles.primaryIconWrapper}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={30}
                color="#FFFFFF"
              />
            </View>
            <View>
              <Text style={styles.primaryCardTitle}>Buka Kasir</Text>
              <Text style={styles.primaryCardDesc}>Mulai transaksi baru</Text>
            </View>
          </View>
          <View style={styles.heroArrowBtn}>
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color="#FFFFFF"
            />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Menu Utama</Text>

        {/* Secondary Actions (Bento Grid) */}
        <View style={styles.grid}>
          {/* Dashboard */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.bentoCard}
            onPress={() => navigation.navigate("Dashboard")}
          >
            <View style={styles.bentoHeader}>
              <View style={styles.iconSquircle}>
                <MaterialCommunityIcons
                  name="chart-arc"
                  size={24}
                  color={colors.iconColor}
                />
              </View>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={18}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.bentoTitle}>Dashboard</Text>
            <Text style={styles.bentoDesc}>Statistik toko</Text>
          </TouchableOpacity>

          {/* Gudang */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.bentoCard}
            onPress={() => navigation.navigate("Gudang")}
          >
            <View style={styles.bentoHeader}>
              <View style={styles.iconSquircle}>
                <MaterialCommunityIcons
                  name="package-variant-closed"
                  size={24}
                  color={colors.iconColor}
                />
              </View>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={18}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.bentoTitle}>Gudang</Text>
            <Text style={styles.bentoDesc}>Kelola stok</Text>
          </TouchableOpacity>

          {/* Laporan */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.bentoCard}
            onPress={() => navigation.navigate("Laporan")}
          >
            <View style={styles.bentoHeader}>
              <View style={styles.iconSquircle}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={24}
                  color={colors.iconColor}
                />
              </View>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={18}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.bentoTitle}>Laporan</Text>
            <Text style={styles.bentoDesc}>Data penjualan</Text>
          </TouchableOpacity>

          {/* Pengaturan Nota */}
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.bentoCard}
            onPress={() => navigation.navigate("SettingNota")}
          >
            <View style={styles.bentoHeader}>
              <View style={styles.iconSquircle}>
                <MaterialCommunityIcons
                  name="receipt"
                  size={24}
                  color={colors.iconColor}
                />
              </View>
              <MaterialCommunityIcons
                name="arrow-top-right"
                size={18}
                color="#94A3B8"
              />
            </View>
            <Text style={styles.bentoTitle}>Format Nota</Text>
            <Text style={styles.bentoDesc}>Desain struk</Text>
          </TouchableOpacity>
        </View>

        {/* Administrative Actions */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.listCard}
          onPress={() => navigation.navigate("Pengaturan")}
        >
          <View style={styles.listIconSquircle}>
            <MaterialCommunityIcons
              name="cog-outline"
              size={22}
              color={colors.iconColor}
            />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={styles.listTitle}>Pengaturan Toko</Text>
            <Text style={styles.listDesc}>Konfigurasi profil dan sistem</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#94A3B8"
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.listCard}
          onPress={() => navigation.navigate("Panduan")}
        >
          <View style={styles.listIconSquircle}>
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={22}
              color={colors.iconColor}
            />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={styles.listTitle}>Buku Panduan</Text>
            <Text style={styles.listDesc}>Cara pakai dan fungsi aplikasi</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={22}
            color="#94A3B8"
          />
        </TouchableOpacity>

        {/* Footer info */}
        <View style={styles.footerNote}>
          <MaterialCommunityIcons
            name="shield-check"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.footerText}>
            {" "}
            MarketPos - 100% Pure Offline Kasir Android
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerWhite: {
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 24 : 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  greetingText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateSubText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primaryContainer,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
    marginHorizontal: -4,
  },
  statsCardWrapper: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  statsCardTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  statsCardTopTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 9,
    fontWeight: "800",
    color: colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  eyeToggleBtn: {
    padding: 3,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.02)",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: "500",
    marginBottom: 2,
    textAlign: "center",
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    lineHeight: 16,
  },
  statDividerV: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
    marginHorizontal: 6,
  },
  storeLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  scrollWrapper: {
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 48,
  },
  primaryHeroCard: {
    backgroundColor: colors.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 6,
  },
  primaryCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  primaryCardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  primaryCardDesc: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "400",
  },
  heroArrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: 0.3,
    marginBottom: 14,
    marginLeft: 2,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  bentoCard: {
    width: (width - 40 - 16) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
    transition: "all 0.2s ease",
  },
  bentoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  iconSquircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryContainer,
  },
  bentoTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  bentoDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "400",
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 14,
    paddingHorizontal: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.07)",
    marginBottom: 10,
  },
  listIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    backgroundColor: "#F1F5F9",
  },
  listTextContainer: {
    flex: 1,
  },
  listTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  listDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    paddingBottom: 8,
  },
  footerText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});

export default HomeScreen;
