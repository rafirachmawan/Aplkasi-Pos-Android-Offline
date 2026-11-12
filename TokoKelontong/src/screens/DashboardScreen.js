import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import ProductRepository from "../database/productRepository";
import TransactionRepository from "../database/transactionRepository";
import { formatRupiah } from "../utils/helpers";
import { colors, fonts } from "../theme/colors";

const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const YEARS = (() => {
  const currentYear = new Date().getFullYear();
  const start = Math.min(2024, currentYear);
  return Array.from(
    { length: currentYear + 1 - start + 1 },
    (_, i) => start + i,
  );
})();

const isToday = (day, month, year) => {
  const t = new Date();
  return (
    t.getDate() === day && t.getMonth() === month && t.getFullYear() === year
  );
};

const DashboardScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Date selection states
  const [filterMode, setFilterMode] = useState("daily"); // 'daily' | 'monthly' | 'all'
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [isPickerVisible, setIsPickerVisible] = useState(false);

  // Summary state
  const [summary, setSummary] = useState({
    omzet: 0,
    omzet_tunai: 0,
    omzet_non_tunai: 0,
    laba: 0,
    count: 0,
    top_products: [],
  });
  const [dateSubTitleText, setDateSubTitleText] = useState("");
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);

  const formatYMD = (year, monthIndex, day) => {
    const y = year;
    const m = String(monthIndex + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const products = await ProductRepository.getAllProducts();
      setTotalProducts(products.length);
      const lowStock = await ProductRepository.getLowStockProducts();
      setLowStockProducts(lowStock);

      let pattern = "";
      let subtitle = "";

      if (filterMode === "daily") {
        const maxDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const safeDay = Math.min(selectedDay, maxDay);
        pattern = formatYMD(selectedYear, selectedMonth, safeDay);
        const dateObj = new Date(selectedYear, selectedMonth, safeDay);
        subtitle = dateObj.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
      } else if (filterMode === "monthly") {
        pattern = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
        subtitle = `Bulan ${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
      } else {
        subtitle = "Semua Riwayat Transaksi";
      }

      setDateSubTitleText(subtitle);

      const result =
        await TransactionRepository.getSummaryByDatePattern(pattern);
      setSummary({
        omzet: result?.omzet || 0,
        omzet_tunai: result?.omzet_tunai || 0,
        omzet_non_tunai: result?.omzet_non_tunai || 0,
        laba: result?.laba || 0,
        count: result?.count || 0,
        top_products: result?.top_products || [],
      });
    } catch (e) {
      console.error("Dashboard load error:", e);
    }
  }, [filterMode, selectedDay, selectedMonth, selectedYear]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData]),
  );

  const handleSetToday = () => {
    const today = new Date();
    setSelectedDay(today.getDate());
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
    setFilterMode("daily");
  };

  const changeDateByStep = (direction) => {
    if (filterMode === "daily") {
      const d = new Date(selectedYear, selectedMonth, selectedDay);
      d.setDate(d.getDate() + direction);
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
      setSelectedDay(d.getDate());
    } else if (filterMode === "monthly") {
      const d = new Date(selectedYear, selectedMonth, 1);
      d.setMonth(d.getMonth() + direction);
      setSelectedYear(d.getFullYear());
      setSelectedMonth(d.getMonth());
    }
  };

  const navigateToTransactions = () => {
    let dateParam = "";

    if (filterMode === "daily") {
      const maxDayNav = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      dateParam = formatYMD(
        selectedYear,
        selectedMonth,
        Math.min(selectedDay, maxDayNav),
      );
    } else if (filterMode === "monthly") {
      dateParam = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`;
    }

    navigation.navigate("Laporan", {
      initialFilter: filterMode,
      dateFilter: dateParam,
    });
  };

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Kalkulasi rata-rata per transaksi
  const averageBasket =
    summary.count > 0 ? Math.round(summary.omzet / summary.count) : 0;

  // Margin Laba Kotor dalam Persentase
  const marginPct =
    summary.omzet > 0
      ? Math.round((summary.laba / summary.omzet) * 100)
      : 0;

  // Cek apakah tanggal saat ini adalah periode hari ini
  const isCurrentSelectionToday =
    filterMode === "daily" && isToday(selectedDay, selectedMonth, selectedYear);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.scrollContent,
        { paddingBottom: Math.max(insets.bottom, 16) + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Segmented Control Filter Periode (Modern Pill) ── */}
      <View style={styles.segmentedContainer}>
        {[
          { key: "daily", label: "Hari Ini" },
          { key: "monthly", label: "Bulanan" },
          { key: "all", label: "Semua" },
        ].map((item) => {
          const isActive =
            filterMode === item.key &&
            (item.key !== "daily" || isCurrentSelectionToday);
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
              onPress={() => {
                if (item.key === "daily") {
                  handleSetToday();
                } else {
                  setFilterMode(item.key);
                }
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.segmentText,
                  isActive && styles.segmentTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Date Navigator Bar (Dengan Tombol Cepat Hari Ini) ── */}
      {filterMode !== "all" ? (
        <View style={styles.dateNavCard}>
          <TouchableOpacity
            onPress={() => changeDateByStep(-1)}
            style={styles.dateNavArrowBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={22}
              color="#0F172A"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dateNavCenter}
            onPress={() => setIsPickerVisible(true)}
            activeOpacity={0.75}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MaterialCommunityIcons
                name={filterMode === "daily" ? "calendar" : "calendar-month"}
                size={16}
                color={colors.primary}
              />
              <Text style={styles.dateNavTitle}>{dateSubTitleText}</Text>
              <MaterialCommunityIcons
                name="chevron-down"
                size={16}
                color="#64748B"
              />
            </View>
            {!isCurrentSelectionToday && filterMode === "daily" && (
              <TouchableOpacity
                onPress={handleSetToday}
                style={styles.badgeJumpToday}
                activeOpacity={0.7}
              >
                <Text style={styles.badgeJumpTodayText}>Kembali ke Hari Ini</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => changeDateByStep(1)}
            style={styles.dateNavArrowBtn}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color="#0F172A"
            />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.allPeriodCard}>
          <MaterialCommunityIcons
            name="calendar-range"
            size={16}
            color={colors.primary}
          />
          <Text style={styles.allPeriodText}>
            Akumulasi Seluruh Riwayat Penjualan Toko
          </Text>
        </View>
      )}

      {/* ── Unified Hero Financial Card (Dark Slate Theme) ── */}
      <TouchableOpacity
        style={styles.heroSummaryCard}
        onPress={navigateToTransactions}
        activeOpacity={0.9}
      >
        <View style={styles.summaryTopRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.summaryBadgePill}>
              <View style={styles.summaryDotLive} />
              <Text style={styles.summaryBadgePillText}>
                TOTAL OMZET PENJUALAN
              </Text>
            </View>
            <Text style={styles.summaryOmzetValue}>
              {formatRupiah(summary.omzet)}
            </Text>
          </View>
          <View style={styles.summaryTxBadge}>
            <MaterialCommunityIcons
              name="receipt-text-check-outline"
              size={18}
              color="#F8FAFC"
            />
            <Text style={styles.summaryTxBadgeText}>
              {summary.count} Transaksi
            </Text>
          </View>
        </View>

        {/* Indikator Laba Bersih & Margin */}
        <View style={styles.profitBannerRow}>
          <View style={styles.profitPill}>
            <MaterialCommunityIcons
              name="trending-up"
              size={15}
              color="#10B981"
            />
            <Text style={styles.profitLabel}>Laba Bersih:</Text>
            <Text style={styles.profitValue}>
              {formatRupiah(summary.laba)}
            </Text>
            {summary.omzet > 0 && (
              <Text style={styles.profitPct}>({marginPct}%)</Text>
            )}
          </View>
        </View>

        <View style={styles.summaryDivider} />

        {/* Pemisahan Tunai Laci vs Non-Tunai */}
        <View style={styles.splitRow}>
          <View style={styles.splitCol}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MaterialCommunityIcons
                name="cash-multiple"
                size={15}
                color="#34D399"
              />
              <Text style={styles.splitColLabel}>Tunai (Laci Kasir)</Text>
            </View>
            <Text style={styles.splitColValue}>
              {formatRupiah(summary.omzet_tunai || 0)}
            </Text>
          </View>

          <View style={styles.splitVerticalLine} />

          <View style={styles.splitCol}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <MaterialCommunityIcons
                name="cellphone-check"
                size={15}
                color="#38BDF8"
              />
              <Text style={styles.splitColLabel}>Non-Tunai (QRIS/TF)</Text>
            </View>
            <Text style={styles.splitColValue}>
              {formatRupiah(summary.omzet_non_tunai || 0)}
            </Text>
          </View>
        </View>

        <View style={styles.tapToDetailRow}>
          <Text style={styles.tapToDetailText}>Lihat Detail Transaksi Lengkap</Text>
          <MaterialCommunityIcons
            name="arrow-right"
            size={14}
            color="#94A3B8"
          />
        </View>
      </TouchableOpacity>

      {/* ── Secondary Analytics Cards (Basket Size & Katalog) ── */}
      <View style={styles.gridRow}>
        <TouchableOpacity
          style={styles.subStatCard}
          onPress={navigateToTransactions}
          activeOpacity={0.8}
        >
          <View style={styles.subStatHeader}>
            <View style={[styles.subStatIconWrap, { backgroundColor: "#EFF6FF" }]}>
              <MaterialCommunityIcons
                name="calculator-variant-outline"
                size={20}
                color={colors.primary}
              />
            </View>
            <MaterialCommunityIcons
              name="arrow-up-right"
              size={16}
              color="#94A3B8"
            />
          </View>
          <Text style={styles.subStatLabel}>RATA-RATA STRUK</Text>
          <Text style={styles.subStatValue} numberOfLines={1}>
            {formatRupiah(averageBasket)}
          </Text>
          <Text style={styles.subStatSub}>Nilai rata-rata belanja</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.subStatCard}
          onPress={() => navigation.navigate("Gudang")}
          activeOpacity={0.8}
        >
          <View style={styles.subStatHeader}>
            <View style={[styles.subStatIconWrap, { backgroundColor: "#F0FDF4" }]}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={20}
                color="#059669"
              />
            </View>
            <MaterialCommunityIcons
              name="arrow-up-right"
              size={16}
              color="#94A3B8"
            />
          </View>
          <Text style={styles.subStatLabel}>TOTAL PRODUK</Text>
          <Text style={styles.subStatValue} numberOfLines={1}>
            {totalProducts} Barang
          </Text>
          <Text style={styles.subStatSub}>Tersimpan di gudang</Text>
        </TouchableOpacity>
      </View>

      {/* ── Section Produk Terlaris (Top 5 Best Sellers) ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={styles.sectionIconSquircle}>
              <MaterialCommunityIcons
                name="fire"
                size={18}
                color="#EA580C"
              />
            </View>
            <Text style={styles.sectionTitle}>Produk Terlaris</Text>
          </View>
          {summary.top_products.length > 0 && (
            <View style={styles.topBadgeCount}>
              <Text style={styles.topBadgeCountText}>Top 5</Text>
            </View>
          )}
        </View>

        {summary.top_products.length === 0 ? (
          <View style={styles.emptyTopBox}>
            <MaterialCommunityIcons
              name="shopping-outline"
              size={28}
              color="#94A3B8"
            />
            <Text style={styles.emptyTopText}>
              Belum ada data produk terjual pada periode ini.
            </Text>
          </View>
        ) : (
          <View style={styles.topListWrap}>
            {summary.top_products.map((item, index) => {
              const maxQty = summary.top_products[0]?.qty || 1;
              const barWidthPct = Math.max(15, Math.round((item.qty / maxQty) * 100));

              return (
                <View key={index} style={styles.topProductRow}>
                  <View
                    style={[
                      styles.rankCircle,
                      index === 0 && styles.rank1,
                      index === 1 && styles.rank2,
                      index === 2 && styles.rank3,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankNumber,
                        index < 3 && { color: "#FFFFFF" },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={styles.topProductName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${barWidthPct}%` },
                          index === 0 && { backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                  </View>

                  <View style={styles.topProductQtyBadge}>
                    <Text style={styles.topProductQtyText}>
                      {item.qty} terjual
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Section Status Stok Gudang ── */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={[
                styles.sectionIconSquircle,
                lowStockProducts.length > 0 && { backgroundColor: "#FEF2F2" },
              ]}
            >
              <MaterialCommunityIcons
                name={
                  lowStockProducts.length > 0
                    ? "alert-circle-outline"
                    : "shield-check-outline"
                }
                size={18}
                color={lowStockProducts.length > 0 ? "#DC2626" : "#059669"}
              />
            </View>
            <Text
              style={[
                styles.sectionTitle,
                lowStockProducts.length > 0 && { color: "#DC2626" },
              ]}
            >
              {lowStockProducts.length > 0
                ? `Perlu Restok (${lowStockProducts.length})`
                : "Status Stok Gudang"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.btnBukaGudang}
            onPress={() => navigation.navigate("Gudang")}
            activeOpacity={0.75}
          >
            <Text style={styles.btnBukaGudangText}>Kelola Gudang →</Text>
          </TouchableOpacity>
        </View>

        {lowStockProducts.length === 0 ? (
          <View style={styles.emptyStockContainer}>
            <View style={styles.emptyStockIconCircle}>
              <MaterialCommunityIcons
                name="check-decagram"
                size={32}
                color="#059669"
              />
            </View>
            <Text style={styles.emptyStockTitle}>Semua Stok Aman</Text>
            <Text style={styles.emptyStockSub}>
              Tidak ada produk yang habis atau di bawah batas minimum.
            </Text>
          </View>
        ) : (
          <View style={styles.warningList}>
            {lowStockProducts.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={styles.lowStockRow}
                onPress={() =>
                  navigation.navigate("AddProductScreen", { product: p })
                }
                activeOpacity={0.7}
              >
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.lowStockName} numberOfLines={1}>
                    {p.product_name}
                  </Text>
                  {p.category ? (
                    <Text style={styles.lowStockCategory}>
                      Kategori: {p.category}
                    </Text>
                  ) : null}
                </View>

                <View
                  style={[
                    styles.lowStockBadge,
                    p.stock_quantity <= 0 && {
                      backgroundColor: "#FEE2E2",
                      borderColor: "#FCA5A5",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.lowStockBadgeText,
                      p.stock_quantity <= 0 && { color: "#DC2626" },
                    ]}
                  >
                    {p.stock_quantity <= 0
                      ? `Habis (${p.stock_quantity})`
                      : `Sisa: ${p.stock_quantity} ${p.unit || "pack"}`}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* ── MODAL PILIH TANGGAL / BULAN / TAHUN ── */}
      <Modal
        visible={isPickerVisible}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setIsPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.modalIconSquircle}>
                  <MaterialCommunityIcons
                    name="calendar-search"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Pilih Periode Tanggal</Text>
                  <Text style={styles.modalSub}>
                    Sesuaikan rentang data analitik
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsPickerVisible(false)}
                style={styles.modalCloseBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>

            {/* Mode Switcher inside Modal */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  filterMode === "daily" && styles.modeTabActive,
                ]}
                onPress={() => setFilterMode("daily")}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    filterMode === "daily" && styles.modeTabTextActive,
                  ]}
                >
                  Per Tanggal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  filterMode === "monthly" && styles.modeTabActive,
                ]}
                onPress={() => setFilterMode("monthly")}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    filterMode === "monthly" && styles.modeTabTextActive,
                  ]}
                >
                  Per Bulan
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeTab,
                  filterMode === "all" && styles.modeTabActive,
                ]}
                onPress={() => setFilterMode("all")}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    filterMode === "all" && styles.modeTabTextActive,
                  ]}
                >
                  Semua
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 340 }}
              showsVerticalScrollIndicator={false}
            >
              {filterMode !== "all" ? (
                <>
                  {/* 1. SELEKTOR TAHUN */}
                  <Text style={styles.pickerSectionLabel}>TAHUN</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pickerRow}
                  >
                    {YEARS.map((yr) => (
                      <TouchableOpacity
                        key={yr}
                        style={[
                          styles.pickerItem,
                          selectedYear === yr && styles.pickerItemActive,
                        ]}
                        onPress={() => setSelectedYear(yr)}
                      >
                        <Text
                          style={[
                            styles.pickerItemText,
                            selectedYear === yr && styles.pickerItemTextActive,
                          ]}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* 2. SELEKTOR BULAN */}
                  <Text style={styles.pickerSectionLabel}>BULAN</Text>
                  <View style={styles.monthGrid}>
                    {MONTH_NAMES.map((mName, mIdx) => (
                      <TouchableOpacity
                        key={mIdx}
                        style={[
                          styles.monthGridItem,
                          selectedMonth === mIdx && styles.monthGridItemActive,
                        ]}
                        onPress={() => setSelectedMonth(mIdx)}
                      >
                        <Text
                          style={[
                            styles.monthGridText,
                            selectedMonth === mIdx &&
                              styles.monthGridTextActive,
                          ]}
                        >
                          {mName.slice(0, 3)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* 3. SELEKTOR TANGGAL (Jika Mode Daily) */}
                  {filterMode === "daily" && (
                    <>
                      <Text style={styles.pickerSectionLabel}>
                        TANGGAL ({MONTH_NAMES[selectedMonth]} {selectedYear})
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.pickerRow}
                      >
                        {daysArray.map((dNum) => (
                          <TouchableOpacity
                            key={dNum}
                            style={[
                              styles.dayItem,
                              selectedDay === dNum && styles.dayItemActive,
                            ]}
                            onPress={() => setSelectedDay(dNum)}
                          >
                            <Text
                              style={[
                                styles.dayItemText,
                                selectedDay === dNum &&
                                  styles.dayItemTextActive,
                              ]}
                            >
                              {dNum}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </>
                  )}
                </>
              ) : (
                <View style={styles.allInfoBox}>
                  <MaterialCommunityIcons
                    name="information-outline"
                    size={24}
                    color={colors.primary}
                  />
                  <Text style={styles.allInfoText}>
                    Menampilkan total omzet, laba kotor, dan riwayat transaksi dari
                    seluruh periode tanpa batasan tanggal.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalResetBtn}
                onPress={handleSetToday}
                activeOpacity={0.8}
              >
                <Text style={styles.modalResetText}>Hari Ini</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalApplyBtn}
                onPress={() => setIsPickerVisible(false)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalApplyText}>Terapkan Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingTop: 8,
  },

  // ── Segmented Control Pill ──
  segmentedContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  segmentBtnActive: {
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  segmentText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#64748B",
  },
  segmentTextActive: {
    fontFamily: fonts.bold,
    color: "#0F172A",
  },

  // ── Date Navigator Bar ──
  dateNavCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dateNavArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  dateNavCenter: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 8,
  },
  dateNavTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  badgeJumpToday: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 1,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
  },
  badgeJumpTodayText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primary,
  },
  allPeriodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  allPeriodText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primary,
  },

  // ── Unified Hero Financial Card ──
  heroSummaryCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    backgroundColor: "#0F172A",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  summaryTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  summaryDotLive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  summaryBadgePillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#94A3B8",
    letterSpacing: 0.5,
  },
  summaryOmzetValue: {
    fontFamily: fonts.extraBold,
    fontSize: 24,
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  summaryTxBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  summaryTxBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#F8FAFC",
  },
  profitBannerRow: {
    marginTop: 10,
  },
  profitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  profitLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#6EE7B7",
  },
  profitValue: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: "#34D399",
  },
  profitPct: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#A7F3D0",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 12,
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  splitCol: {
    flex: 1,
  },
  splitColLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
  },
  splitColValue: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 2,
  },
  splitVerticalLine: {
    width: 1,
    height: 26,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginHorizontal: 12,
  },
  tapToDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  tapToDetailText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
  },

  // ── Secondary Analytics Cards ──
  gridRow: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  subStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  subStatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  subStatIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  subStatLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  subStatValue: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: "#0F172A",
  },
  subStatSub: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 2,
  },

  // ── Section Card Common ──
  sectionCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionIconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFF7ED",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: "#0F172A",
  },
  topBadgeCount: {
    backgroundColor: "#FFF7ED",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  topBadgeCountText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#EA580C",
  },

  // Produk Terlaris Rows
  emptyTopBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  emptyTopText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 4,
  },
  topListWrap: {
    gap: 10,
  },
  topProductRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rankCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rank1: { backgroundColor: "#F59E0B" },
  rank2: { backgroundColor: "#64748B" },
  rank3: { backgroundColor: "#B45309" },
  rankNumber: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#475569",
  },
  topProductName: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
    marginBottom: 4,
  },
  progressBarBg: {
    height: 5,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 5,
    backgroundColor: "#3B82F6",
    borderRadius: 3,
  },
  topProductQtyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  topProductQtyText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#0F172A",
  },

  // Status Stok Gudang
  btnBukaGudang: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  btnBukaGudangText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  emptyStockContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 4,
  },
  emptyStockIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyStockTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#059669",
  },
  emptyStockSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    textAlign: "center",
  },
  warningList: {
    gap: 8,
  },
  lowStockRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  lowStockName: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
  },
  lowStockCategory: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  lowStockBadge: {
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  lowStockBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#DC2626",
  },

  // ── Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalIconSquircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
  },
  modalSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  modalCloseBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },
  modeTabs: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 9,
  },
  modeTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  modeTabText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#64748B",
  },
  modeTabTextActive: {
    fontFamily: fonts.bold,
    color: "#0F172A",
  },
  pickerSectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#64748B",
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 8,
  },
  pickerRow: {
    gap: 8,
    paddingBottom: 4,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  pickerItemActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  pickerItemText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#64748B",
  },
  pickerItemTextActive: {
    color: "#FFFFFF",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  monthGridItem: {
    width: "31%",
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  monthGridItemActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  monthGridText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#64748B",
  },
  monthGridTextActive: {
    color: "#FFFFFF",
  },
  dayItem: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dayItemActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  dayItemText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#64748B",
  },
  dayItemTextActive: {
    color: "#FFFFFF",
  },
  allInfoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 14,
    borderRadius: 12,
    gap: 10,
    marginVertical: 8,
  },
  allInfoText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  modalResetBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalResetText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#475569",
  },
  modalApplyBtn: {
    flex: 1,
    backgroundColor: "#0F172A",
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalApplyText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#FFFFFF",
  },
});

export default DashboardScreen;
