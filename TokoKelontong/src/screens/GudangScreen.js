import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  Modal,
  Dimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProductRepository, { isNetworkLikeError } from "../database/productRepository";
import ProductCard from "../components/ProductCard";
import { getCatalogSyncedAt } from "../database/localDb";
import { getActiveStoreId } from "../services/sessionStore";
import { syncNow } from "../services/syncService";
import useSyncStatus from "../hooks/useSyncStatus";
import { colors, fonts } from "../theme/colors";

const GudangScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [usingCache, setUsingCache] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const isOffline = !!syncStatus.offline || usingCache;
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(["Semua"]);
  const [selectedCategory, setSelectedCategory] = useState("Semua");
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [stockFilter, setStockFilter] = useState("all"); // 'all' | 'low' | 'out'
  const [lastSyncText, setLastSyncText] = useState("");

  const screenWidth = Dimensions.get("window").width;

  const fabBottom =
    Platform.OS === "android"
      ? Math.max(insets.bottom, 16) + 12
      : Math.max(insets.bottom, 14) + 10;

  const fetchProducts = useCallback(async () => {
    try {
      setLoadError(null);
      const { products: data, fromCache } =
        await ProductRepository.getAllProductsWithSource();
      setProducts(data);
      setUsingCache(fromCache);

      // Ambil kategori unik dari produk
      const uniqueCats = Array.from(
        new Set(data.map((p) => p.category).filter(Boolean)),
      );
      setCategories(["Semua", ...uniqueCats]);

      const storeId = await getActiveStoreId();
      if (storeId) {
        const syncedAt = await getCatalogSyncedAt(storeId);
        if (syncedAt) {
          const d = new Date(syncedAt);
          setLastSyncText(
            d.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            }),
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      if (isNetworkLikeError(error)) {
        setUsingCache(true);
        setLoadError(
          "Tidak ada koneksi internet dan belum ada katalog tersimpan di HP.",
        );
      } else {
        setLoadError(error?.message || "Gagal memuat data barang.");
      }
    }
  }, []);

  const prevOfflineRef = useRef(syncStatus.offline);
  useEffect(() => {
    const cameOnline = prevOfflineRef.current && !syncStatus.offline;
    prevOfflineRef.current = syncStatus.offline;
    if (cameOnline && (usingCache || loadError)) {
      fetchProducts();
    }
  }, [syncStatus.offline, usingCache, loadError, fetchProducts]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
      return () => {
        setSearchQuery("");
        setSelectedCategory("Semua");
        setStockFilter("all");
      };
    }, [fetchProducts]),
  );

  // Filter berdasarkan kategori + search + status stok
  const displayedProducts = products.filter((p) => {
    const matchCat =
      selectedCategory === "Semua" || p.category === selectedCategory;
    const matchSearch =
      p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode &&
        p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    let matchStock = true;
    if (stockFilter === "low") {
      matchStock =
        p.stock_quantity > 0 &&
        p.stock_quantity <= (p.min_stock_threshold || 5);
    } else if (stockFilter === "out") {
      matchStock = p.stock_quantity <= 0;
    }
    return matchCat && matchSearch && matchStock;
  });

  const handleAddProduct = () => {
    if (isOffline) {
      Alert.alert(
        "Mode Offline (Hanya-Baca)",
        "Menambah barang membutuhkan koneksi internet. Sambungkan internet lalu coba lagi. Penjualan di Kasir tetap dapat dilakukan tanpa internet.",
      );
      return;
    }
    navigation.navigate("AddProductScreen");
  };

  const handleEditProduct = (item) => {
    if (isOffline) {
      Alert.alert(
        "Mode Offline (Hanya-Baca)",
        "Mengubah data barang membutuhkan koneksi internet. Sambungkan internet lalu coba lagi. Penjualan di Kasir tetap dapat dilakukan tanpa internet.",
      );
      return;
    }
    navigation.navigate("AddProductScreen", { product: item });
  };

  const handleDelete = (id) => {
    if (isOffline) {
      Alert.alert(
        "Mode Offline (Hanya-Baca)",
        "Menghapus barang membutuhkan koneksi internet. Sambungkan internet lalu coba lagi.",
      );
      return;
    }
    Alert.alert(
      "Hapus Barang",
      "Apakah Anda yakin ingin menghapus barang ini?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await ProductRepository.deleteProduct(id);
              syncNow({ forceCatalog: true }).catch(() => {});
              fetchProducts();
            } catch (error) {
              Alert.alert("Error", error.message || "Gagal menghapus produk");
            }
          },
        },
      ],
    );
  };

  // Hitung stok menipis untuk badge
  const lowStockCount = products.filter(
    (p) =>
      p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_threshold || 5),
  ).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity <= 0).length;

  return (
    <View style={styles.container}>
      {/* ── Banner Mode Offline (Hanya-Baca) ── */}
      {isOffline && (
        <View style={styles.offlineBannerGudang}>
          <MaterialCommunityIcons
            name="cloud-off-outline"
            size={20}
            color="#B45309"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineBannerTitle}>
              Mode Offline (Hanya-Baca)
            </Text>
            <Text style={styles.offlineBannerSub}>
              {lastSyncText
                ? `Katalog per ${lastSyncText} • Tambah & ubah barang butuh internet`
                : "Tambah, ubah, atau hapus barang membutuhkan koneksi internet"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={fetchProducts}
            activeOpacity={0.75}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.offlineBannerAction}>Muat Ulang</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Summary Metrics Bar (Filter Stok Cepat) ── */}
      <View style={styles.infoBar}>
        <TouchableOpacity
          style={[
            styles.infoItem,
            stockFilter === "all"
              ? styles.infoItemActiveAll
              : styles.infoItemInactive,
          ]}
          onPress={() => setStockFilter("all")}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.infoIconWrap,
              stockFilter === "all"
                ? styles.infoIconAllActive
                : styles.infoIconAll,
            ]}
          >
            <MaterialCommunityIcons
              name="package-variant"
              size={16}
              color={stockFilter === "all" ? "#FFFFFF" : colors.primary}
            />
          </View>
          <Text
            style={[
              styles.infoValue,
              stockFilter === "all" && styles.infoValueActiveAll,
            ]}
          >
            {products.length}
          </Text>
          <Text
            style={[
              styles.infoLabel,
              stockFilter === "all" && styles.infoLabelActiveAll,
            ]}
          >
            Total Item
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.infoItem,
            stockFilter === "low"
              ? styles.infoItemActiveLow
              : styles.infoItemInactive,
          ]}
          onPress={() => {
            if (stockFilter === "low") {
              setStockFilter("all");
            } else {
              setStockFilter("low");
              setSelectedCategory("Semua");
              setSearchQuery("");
            }
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.infoIconWrap,
              stockFilter === "low"
                ? styles.infoIconLowActive
                : styles.infoIconLow,
            ]}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={16}
              color={stockFilter === "low" ? "#B45309" : "#D97706"}
            />
          </View>
          <Text
            style={[
              styles.infoValue,
              { color: "#D97706" },
              stockFilter === "low" && styles.infoValueActiveLow,
            ]}
          >
            {lowStockCount}
          </Text>
          <Text
            style={[
              styles.infoLabel,
              stockFilter === "low" && styles.infoLabelActiveLow,
            ]}
          >
            Stok Menipis
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.infoItem,
            stockFilter === "out"
              ? styles.infoItemActiveOut
              : styles.infoItemInactive,
          ]}
          onPress={() => {
            if (stockFilter === "out") {
              setStockFilter("all");
            } else {
              setStockFilter("out");
              setSelectedCategory("Semua");
              setSearchQuery("");
            }
          }}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.infoIconWrap,
              stockFilter === "out"
                ? styles.infoIconOutActive
                : styles.infoIconOut,
            ]}
          >
            <MaterialCommunityIcons
              name="close-circle-outline"
              size={16}
              color={stockFilter === "out" ? "#DC2626" : colors.error}
            />
          </View>
          <Text
            style={[
              styles.infoValue,
              { color: colors.error },
              stockFilter === "out" && styles.infoValueActiveOut,
            ]}
          >
            {outOfStockCount}
          </Text>
          <Text
            style={[
              styles.infoLabel,
              stockFilter === "out" && styles.infoLabelActiveOut,
            ]}
          >
            Habis
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={colors.textSecondary}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama barang atau barcode..."
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <MaterialCommunityIcons
              name="close-circle"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Kategori: Smart Pill + Grid Button ── */}
      <View style={styles.categoryBarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
          style={{ flex: 1 }}
        >
          {categories.slice(0, 5).map((cat, idx) => {
            const count =
              cat === "Semua"
                ? products.length
                : products.filter((p) => p.category === cat).length;
            return (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.categoryPill,
                  selectedCategory === cat && styles.categoryPillActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    selectedCategory === cat && styles.categoryPillTextActive,
                  ]}
                >
                  {cat}
                </Text>
                <View
                  style={[
                    styles.categoryCount,
                    selectedCategory === cat && styles.categoryCountActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryCountText,
                      selectedCategory === cat &&
                        styles.categoryCountTextActive,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Grid Button */}
        <TouchableOpacity
          style={styles.categoryGridBtn}
          onPress={() => setShowCategoryModal(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="view-grid-outline"
            size={18}
            color={colors.primary}
          />
          {categories.length > 5 && (
            <View style={styles.categoryGridBtnBadge}>
              <Text style={styles.categoryGridBtnBadgeText}>
                {categories.length - 1}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── List Produk ── */}
      <FlatList
        data={displayedProducts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            readOnly={isOffline}
            onEdit={() => handleEditProduct(item)}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name={loadError ? "wifi-off" : "package-variant-remove"}
              size={56}
              color={loadError ? "#D97706" : colors.border}
            />
            <Text style={styles.emptyText}>
              {loadError
                ? loadError
                : searchQuery ||
                    selectedCategory !== "Semua" ||
                    stockFilter !== "all"
                  ? "Tidak ada barang ditemukan."
                  : "Belum ada barang di gudang."}
            </Text>
            {loadError && (
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={fetchProducts}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>Coba Lagi</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={{ paddingBottom: fabBottom + 64, paddingTop: 4 }}
      />

      {/* ── FAB Tambah Barang ── */}
      <TouchableOpacity
        style={[
          styles.fab,
          { bottom: fabBottom },
          isOffline && styles.fabReadOnly,
        ]}
        onPress={handleAddProduct}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name={isOffline ? "lock-outline" : "plus"}
          size={22}
          color="#fff"
        />
        <Text style={styles.fabText}>
          {isOffline ? "TAMBAH BARANG (BUTUH INTERNET)" : "TAMBAH BARANG"}
        </Text>
      </TouchableOpacity>

      {/* ── Modal Kategori Grid (Centered Card) ── */}
      <Modal
        visible={showCategoryModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.catModalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryModal(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.catModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.catModalHeader}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View style={styles.catModalIconWrap}>
                  <MaterialCommunityIcons
                    name="shape-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <View>
                  <Text style={styles.catModalTitle}>Pilih Kategori</Text>
                  <Text style={styles.catModalSubtitle}>
                    {categories.length - 1} kategori • {products.length} produk
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.catModalCloseBtn}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* Grid */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.catModalGrid}
            >
              {categories.map((cat, idx) => {
                const count =
                  cat === "Semua"
                    ? products.length
                    : products.filter((p) => p.category === cat).length;
                const isActive = selectedCategory === cat;
                const iconName = cat === "Semua" ? "apps" : "tag-outline";

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.catGridItem(screenWidth),
                      isActive && styles.catGridItemActive,
                    ]}
                    onPress={() => {
                      setSelectedCategory(cat);
                      setShowCategoryModal(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.catGridIconWrap,
                        isActive && styles.catGridIconWrapActive,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={iconName}
                        size={22}
                        color={isActive ? "#FFFFFF" : colors.iconColor}
                      />
                    </View>
                    <Text
                      style={[
                        styles.catGridLabel,
                        isActive && styles.catGridLabelActive,
                      ]}
                      numberOfLines={1}
                    >
                      {cat}
                    </Text>
                    <Text
                      style={[
                        styles.catGridCount2,
                        isActive && styles.catGridCountActive,
                      ]}
                    >
                      {count} produk
                    </Text>
                    {isActive && (
                      <View style={styles.catGridCheckmark}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  // Info bar
  infoBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    alignItems: "center",
    gap: 6,
  },
  infoItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  infoItemInactive: {
    backgroundColor: "#F8FAFC",
    borderColor: "transparent",
  },
  infoItemActiveAll: {
    backgroundColor: "#FFFFFF",
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoItemActiveLow: {
    backgroundColor: "#FFFBEB",
    borderColor: "#F59E0B",
    shadowColor: "#F59E0B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoItemActiveOut: {
    backgroundColor: "#FEF2F2",
    borderColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  infoIconAll: {
    backgroundColor: "#F1F5F9",
  },
  infoIconAllActive: {
    backgroundColor: colors.primary,
  },
  infoIconLow: {
    backgroundColor: "#FEF3C7",
  },
  infoIconLowActive: {
    backgroundColor: "#FDE68A",
  },
  infoIconOut: {
    backgroundColor: "#FEE2E2",
  },
  infoIconOutActive: {
    backgroundColor: "#FECACA",
  },
  infoValue: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.text,
  },
  infoValueActiveAll: {
    color: colors.primary,
  },
  infoValueActiveLow: {
    color: "#B45309",
  },
  infoValueActiveOut: {
    color: "#DC2626",
  },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.2,
    marginTop: 1,
  },
  infoLabelActiveAll: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  infoLabelActiveLow: {
    color: "#B45309",
    fontFamily: fonts.bold,
  },
  infoLabelActiveOut: {
    color: "#DC2626",
    fontFamily: fonts.bold,
  },

  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
    padding: 0,
  },

  // Kategori - Smart Pill + Grid
  categoryBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
    elevation: 1,
    gap: 6,
  },
  categoryPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryPillText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#64748B",
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
  },
  categoryCount: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  categoryCountActive: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  categoryCountText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: "#475569",
  },
  categoryCountTextActive: {
    color: "#FFFFFF",
  },
  categoryGridBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    position: "relative",
    elevation: 1,
  },
  categoryGridBtnBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  categoryGridBtnBadgeText: {
    fontSize: 9,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
  },

  // Category Grid Modal (Centered Card)
  catModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  catModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    width: "92%",
    maxWidth: 420,
    maxHeight: "75%",
    paddingBottom: 16,
    overflow: "hidden",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  catModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  catModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  catModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  catModalSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  catModalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catModalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  catGridItem: (screenWidth) => ({
    width: (screenWidth - 32 - 20) / 3,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    position: "relative",
  }),
  catGridItemActive: {
    backgroundColor: "#EFF6FF",
    borderColor: colors.primary,
    borderWidth: 2,
  },
  catGridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  catGridIconWrapActive: {
    backgroundColor: colors.primary,
  },
  catGridLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
    marginBottom: 2,
  },
  catGridLabelActive: {
    color: colors.primary,
  },
  catGridCount2: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  catGridCountActive: {
    color: colors.primary,
  },
  catGridCheckmark: {
    position: "absolute",
    top: 6,
    right: 6,
  },

  // Empty state
  emptyContainer: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },

  // FAB
  fab: {
    position: "absolute",
    left: 16,
    right: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  fabText: {
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    fontSize: 13,
    letterSpacing: 0.5,
  },
  fabReadOnly: {
    backgroundColor: "#94A3B8",
    shadowOpacity: 0.1,
    elevation: 2,
  },

  // Offline banner
  offlineBannerGudang: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  offlineBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#92400E",
  },
  offlineBannerSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#B45309",
    marginTop: 1,
  },
  offlineBannerAction: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: "#92400E",
  },
});

export default GudangScreen;
