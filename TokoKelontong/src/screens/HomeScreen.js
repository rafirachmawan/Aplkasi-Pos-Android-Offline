import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppContext } from "../context/AppContext";
import { colors } from "../theme/colors";

const { width } = Dimensions.get("window");

const HomeScreen = ({ navigation }) => {
  const { state } = useContext(AppContext);
  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={styles.safe}>
      <StatusBar
        translucent={true}
        backgroundColor="transparent"
        barStyle="light-content"
      />

      {/* Premium Dark Slate Header */}
      <View style={styles.headerDarkSlate}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting}>Selamat Datang,</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {state.storeName || "MarketPos"}
            </Text>
            <View style={styles.dateContainer}>
              <MaterialCommunityIcons
                name="calendar-month-outline"
                size={14}
                color="#CBD5E1"
              />
              <Text style={styles.headerDate}>{today}</Text>
            </View>
          </View>
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
                color="#0F172A"
              />
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollWrapper}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.overlapSpacer} />
        {/* Primary Action: Kasir (Overlaps Header) */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.primaryCard}
          onPress={() => navigation.navigate("Kasir")}
        >
          <View style={styles.primaryCardLeft}>
            <View style={styles.primaryIconWrapper}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={32}
                color="#FFFFFF"
              />
            </View>
            <View>
              <Text style={styles.primaryCardTitle}>Buka Kasir</Text>
              <Text style={styles.primaryCardDesc}>Mulai transaksi baru</Text>
            </View>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={28}
            color={colors.textSecondary}
            style={{ opacity: 0.3 }}
          />
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
              <View style={[styles.iconCircle, { backgroundColor: "#F1F5F9" }]}>
                <MaterialCommunityIcons
                  name="chart-arc"
                  size={26}
                  color="#334155"
                />
              </View>
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
              <View style={[styles.iconCircle, { backgroundColor: "#F1F5F9" }]}>
                <MaterialCommunityIcons
                  name="package-variant-closed"
                  size={26}
                  color="#334155"
                />
              </View>
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
              <View style={[styles.iconCircle, { backgroundColor: "#F1F5F9" }]}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={26}
                  color="#334155"
                />
              </View>
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
              <View style={[styles.iconCircle, { backgroundColor: "#F1F5F9" }]}>
                <MaterialCommunityIcons
                  name="receipt"
                  size={26}
                  color="#334155"
                />
              </View>
            </View>
            <Text style={styles.bentoTitle}>Format Nota</Text>
            <Text style={styles.bentoDesc}>Desain struk</Text>
          </TouchableOpacity>
        </View>

        {/* Administrative Actions */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.listCard, { marginBottom: 16 }]}
          onPress={() => navigation.navigate("Pengaturan")}
        >
          <View style={[styles.listIconCircle, { backgroundColor: "#F1F5F9" }]}>
            <MaterialCommunityIcons
              name="cog-outline"
              size={24}
              color="#334155"
            />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={styles.listTitle}>Pengaturan Toko</Text>
            <Text style={styles.listDesc}>Konfigurasi profil dan sistem</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={colors.border}
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.listCard}
          onPress={() => navigation.navigate("Panduan")}
        >
          <View style={[styles.listIconCircle, { backgroundColor: "#F1F5F9" }]}>
            <MaterialCommunityIcons
              name="book-open-page-variant"
              size={24}
              color="#0F172A"
            />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={styles.listTitle}>Buku Panduan</Text>
            <Text style={styles.listDesc}>Cara pakai dan fungsi aplikasi</Text>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color={colors.border}
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
  headerDarkSlate: {
    backgroundColor: "#0F172A", // Slate 900
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight + 20 : 56,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
    paddingRight: 16,
  },
  headerGreeting: {
    fontSize: 13,
    color: "#94A3B8", // Slate 400
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerDate: {
    fontSize: 12,
    color: "#F8FAFC",
    fontWeight: "600",
    marginLeft: 6,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16, // Squircle instead of full circle for a modern corporate look
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
  },
  storeLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  scrollWrapper: {
    flex: 1,
    zIndex: 10,
    elevation: 10,
  },
  overlapSpacer: {
    height: 32,
    marginTop: -32,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  primaryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24, // Lebih membulat dan halus
    padding: 22,
    marginBottom: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    elevation: 2, // Shadow Android yang sangat tipis
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  primaryCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 16, // Matching squircle
    backgroundColor: "#0F172A", // Dark Slate / Black
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  primaryCardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 2,
  },
  primaryCardDesc: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
    marginLeft: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 16,
  },
  bentoCard: {
    width: (width - 40 - 14) / 2,
    backgroundColor: "#FFFFFF",
    borderRadius: 24, // Lebih membulat
    padding: 20,
    elevation: 0, // Dihilangkan agar flat dan halus
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)", // Garis tepi sangat tipis dan halus
  },
  bentoHeader: {
    flexDirection: "row",
    justifyContent: "flex-start",
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24, // Bulat sempurna agar terkesan lebih 'halus'
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC", // Background icon yang lebih lembut
  },
  bentoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4,
  },
  bentoDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    elevation: 0,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 24,
  },
  listIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24, // Bulat sempurna
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    backgroundColor: "#F8FAFC",
  },
  listTextContainer: {
    flex: 1,
  },
  listTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 2,
  },
  listDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});

export default HomeScreen;
