import React, { useState, useCallback } from 'react';
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
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProductRepository from '../database/productRepository';
import ProductCard from '../components/ProductCard';
import { colors, fonts } from '../theme/colors';

const GudangScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['Semua']);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const screenWidth = Dimensions.get('window').width;

  const fabBottom = Platform.OS === 'android'
    ? Math.max(insets.bottom + 24, 32)
    : Math.max(insets.bottom + 16, 24);

  const fetchProducts = useCallback(() => {
    try {
      const data = ProductRepository.getAllProducts();
      setProducts(data);

      // Ambil kategori unik dari produk
      const uniqueCats = Array.from(
        new Set(data.map((p) => p.category).filter(Boolean))
      );
      setCategories(['Semua', ...uniqueCats]);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  // Filter berdasarkan kategori + search
  const displayedProducts = products.filter((p) => {
    const matchCat =
      selectedCategory === 'Semua' || p.category === selectedCategory;
    const matchSearch =
      p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const handleDelete = (id) => {
    Alert.alert('Hapus Barang', 'Apakah Anda yakin ingin menghapus barang ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: () => {
          try {
            ProductRepository.deleteProduct(id);
            fetchProducts();
          } catch (error) {
            Alert.alert('Error', 'Gagal menghapus produk');
          }
        },
      },
    ]);
  };

  // Hitung stok menipis untuk badge
  const lowStockCount = products.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_threshold || 5)
  ).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity <= 0).length;

  return (
    <View style={styles.container}>

      {/* ── Info Bar ── */}
      <View style={styles.infoBar}>
        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="package-variant" size={16} color={colors.primary} />
          <Text style={styles.infoValue}>{products.length}</Text>
          <Text style={styles.infoLabel}>Total Item</Text>
        </View>
        <View style={styles.infoSep} />
        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={colors.warning} />
          <Text style={[styles.infoValue, { color: colors.warning }]}>{lowStockCount}</Text>
          <Text style={styles.infoLabel}>Stok Menipis</Text>
        </View>
        <View style={styles.infoSep} />
        <View style={styles.infoItem}>
          <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.error} />
          <Text style={[styles.infoValue, { color: colors.error }]}>{outOfStockCount}</Text>
          <Text style={styles.infoLabel}>Habis</Text>
        </View>
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
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Kategori: Smart Pill + Grid Button ── */}
      <View style={styles.categoryBarRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 12, paddingRight: 8 }}
          style={{ flex: 1 }}
        >
          {categories.slice(0, 5).map((cat, idx) => {
            const count = cat === 'Semua'
              ? products.length
              : products.filter(p => p.category === cat).length;
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
                <View style={[
                  styles.categoryCount,
                  selectedCategory === cat && styles.categoryCountActive,
                ]}>
                  <Text style={[
                    styles.categoryCountText,
                    selectedCategory === cat && styles.categoryCountTextActive,
                  ]}>
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
          <MaterialCommunityIcons name="view-grid-outline" size={18} color={colors.primary} />
          {categories.length > 5 && (
            <View style={styles.categoryGridBtnBadge}>
              <Text style={styles.categoryGridBtnBadgeText}>{categories.length - 1}</Text>
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
            onEdit={() => navigation.navigate('AddProductScreen', { product: item })}
            onDelete={() => handleDelete(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant-remove" size={56} color={colors.border} />
            <Text style={styles.emptyText}>
              {searchQuery || selectedCategory !== 'Semua'
                ? 'Tidak ada barang ditemukan.'
                : 'Belum ada barang di gudang.'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: fabBottom + 70 }}
      />

      {/* ── FAB Tambah Barang ── */}
      <TouchableOpacity
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => navigation.navigate('AddProductScreen')}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
        <Text style={styles.fabText}>TAMBAH BARANG</Text>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.catModalIconWrap}>
                  <MaterialCommunityIcons name="shape-outline" size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.catModalTitle}>Pilih Kategori</Text>
                  <Text style={styles.catModalSubtitle}>{categories.length - 1} kategori • {products.length} produk</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setShowCategoryModal(false)}
                style={styles.catModalCloseBtn}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Grid */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.catModalGrid}
            >
              {categories.map((cat, idx) => {
                const count = cat === 'Semua'
                  ? products.length
                  : products.filter(p => p.category === cat).length;
                const isActive = selectedCategory === cat;
                const iconName = cat === 'Semua' ? 'apps' : 'tag-outline';

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
                    <View style={[
                      styles.catGridIconWrap,
                      isActive && styles.catGridIconWrapActive,
                    ]}>
                      <MaterialCommunityIcons
                        name={iconName}
                        size={22}
                        color={isActive ? '#FFFFFF' : colors.iconColor}
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
                    <Text style={[
                      styles.catGridCount2,
                      isActive && styles.catGridCountActive,
                    ]}>
                      {count} produk
                    </Text>
                    {isActive && (
                      <View style={styles.catGridCheckmark}>
                        <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} />
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
    flexDirection: 'row',
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  infoValue: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  infoLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  infoSep: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },

  // Kategori - Smart Pill + Grid
  categoryBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  categoryCount: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  categoryCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  categoryCountText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  categoryCountTextActive: {
    color: '#fff',
  },
  categoryGridBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
  },
  categoryGridBtnBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  categoryGridBtnBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Category Grid Modal (Centered Card)
  catModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  catModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '92%',
    maxWidth: 420,
    maxHeight: '75%',
    paddingBottom: 16,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  catModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  catModalIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catModalTitle: {
    fontSize: 16,
    fontWeight: '800',
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
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  catModalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  catGridItem: (screenWidth) => ({
    width: (screenWidth - 32 - 20) / 3,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    position: 'relative',
  }),
  catGridItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: colors.primary,
    borderWidth: 2,
  },
  catGridIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  catGridIconWrapActive: {
    backgroundColor: colors.primary,
  },
  catGridLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 2,
  },
  catGridLabelActive: {
    color: colors.primary,
  },
  catGridCount2: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  catGridCountActive: {
    color: colors.primary,
  },
  catGridCheckmark: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    elevation: 6,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabText: {
    fontFamily: fonts.extraBold,
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
});

export default GudangScreen;
