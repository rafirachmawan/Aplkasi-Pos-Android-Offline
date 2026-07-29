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
import Svg, { LinearGradient, Defs, Rect, Stop } from "react-native-svg";
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
      <StatusBar translucent={true} backgroundColor="transparent" barStyle="light-content" />

      {/* Header Background */}
      <View style={styles.headerBackground}>
        <View style={StyleSheet.absoluteFillObject}>
          <Svg height="100%" width="100%">
            <Defs>
              <LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#7C3AED" />
                <Stop offset="1" stopColor="#EC4899" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#grad)" />
          </Svg>
        </View>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerGreeting}>Selamat Datang,</Text>
            <Text style={styles.headerTitle}>
              {state.storeName || "Toko Kelontong"}
            </Text>
            <View style={styles.dateContainer}>
              <MaterialCommunityIcons name="calendar-month" size={14} color="rgba(255,255,255,0.8)" />
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
                size={28}
                color={colors.primary}
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
              <MaterialCommunityIcons name="storefront-outline" size={32} color={colors.surface} />
            </View>
            <View>
              <Text style={styles.primaryCardTitle}>Buka Kasir</Text>
              <Text style={styles.primaryCardDesc}>Mulai transaksi baru</Text>
            </View>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={28} color={colors.textSecondary} style={{opacity: 0.3}} />
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
                <MaterialCommunityIcons name="chart-arc" size={26} color="#334155" />
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
                <MaterialCommunityIcons name="package-variant-closed" size={26} color="#334155" />
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
                <MaterialCommunityIcons name="file-document-outline" size={26} color="#334155" />
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
                <MaterialCommunityIcons name="receipt" size={26} color="#334155" />
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
            <MaterialCommunityIcons name="cog-outline" size={24} color="#334155" />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={styles.listTitle}>Pengaturan Toko</Text>
            <Text style={styles.listDesc}>Konfigurasi profil dan sistem</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.listCard}
          onPress={() => navigation.navigate("Panduan")}
        >
          <View style={[styles.listIconCircle, { backgroundColor: "#EFF6FF" }]}>
            <MaterialCommunityIcons name="book-open-page-variant" size={24} color="#3B82F6" />
          </View>
          <View style={styles.listTextContainer}>
            <Text style={styles.listTitle}>Buku Panduan</Text>
            <Text style={styles.listDesc}>Cara pakai dan fungsi aplikasi</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        {/* Footer info */}
        <View style={styles.footerNote}>
          <MaterialCommunityIcons
            name="check-decagram"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.footerText}>
            {" "}Sistem Offline Aktif
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
  headerBackground: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 16 : 48, 
    paddingBottom: 40,
    paddingHorizontal: 24,
    overflow: 'hidden', // Menjamin SVG gradient terpotong membulat mengikuti radius
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
  },
  headerGreeting: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerDate: {
    fontSize: 12,
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: 6,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  storeLogoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 26,
  },
  scrollWrapper: {
    flex: 1,
    zIndex: 10,
    elevation: 10, // Menjamin ScrollView merender di atas header
  },
  overlapSpacer: {
    height: 24,
    marginTop: -24, // Disesuaikan dengan pengurangan tinggi header
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
    borderRadius: 28, // Bulat sempurna (halus)
    backgroundColor: colors.primary,
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
