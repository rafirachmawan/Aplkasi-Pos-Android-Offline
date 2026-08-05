import React, { useContext, useState } from "react";
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

import { AppContext } from "../context/AppContext";
import { colors, fonts } from "../theme/colors";

const { width } = Dimensions.get("window");

const formatRupiah = (value) => {
  if (!value && value !== 0) return "Rp 0";
  return "Rp " + Number(value).toLocaleString("id-ID");
};

const HomeScreen = ({ navigation }) => {
  const { state } = useContext(AppContext);
  const [hideBalance, setHideBalance] = useState(false);

  const now = new Date();
  const dayName = now.toLocaleDateString("id-ID", { weekday: "long" });
  const dateStr = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hour = now.getHours();
  const greetingText =
    hour < 11 ? "Selamat Pagi" : hour < 15 ? "Selamat Siang" : hour < 18 ? "Selamat Sore" : "Selamat Malam";
  const greetingEmoji =
    hour < 11 ? "☀️" : hour < 15 ? "🌤️" : hour < 18 ? "🌇" : "🌙";

  const totalPemasukan = state.totalPemasukan ?? 0;
  const totalPengeluaran = state.totalPengeluaran ?? 0;
  const totalSaldo = totalPemasukan - totalPengeluaran;

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
              {state.storeName || "MarketPos"}
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
              <MaterialCommunityIcons name="store" size={26} color={colors.iconColor} />
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
              <Text style={styles.statLabel}>Saldo</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: totalSaldo >= 0 ? colors.success : colors.error },
                ]}
                numberOfLines={1}
              >
                {hideBalance ? "Rp ••••••" : formatRupiah(totalSaldo)}
              </Text>
            </View>

            <View style={styles.statDividerV} />

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pemasukan</Text>
              <Text style={[styles.statValue, { color: colors.success }]} numberOfLines={1}>
                {hideBalance ? "Rp ••••••" : formatRupiah(totalPemasukan)}
              </Text>
            </View>

            <View style={styles.statDividerV} />

            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Pengeluaran</Text>
              <Text style={[styles.statValue, { color: colors.error }]} numberOfLines={1}>
                {hideBalance ? "Rp ••••••" : formatRupiah(totalPengeluaran)}
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
            name="check-decagram"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.footerText}> Sistem Offline Aktif</Text>
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
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 16 : 56,
    paddingBottom: 20,
    paddingHorizontal: 24,
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
    marginBottom: 4,
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
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.iconBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
    marginHorizontal: -4,
  },
  statsCardWrapper: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statsCardTopBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  statsCardTopTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.8,
  },
  eyeToggleBtn: {
    padding: 2,
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
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#64748B",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  statDividerV: {
    width: 1,
    height: 26,
    backgroundColor: "#CBD5E1",
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  primaryHeroCard: {
    backgroundColor: "#0F172A",
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 4,
  },
  primaryCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  primaryCardTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  primaryCardDesc: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  heroArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
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
    width: (width - 40 - 12) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.07)",
  },
  bentoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  iconSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  bentoTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  bentoDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
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
