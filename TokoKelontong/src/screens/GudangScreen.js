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

      {/* ── Filter Kategori ── */}
      <View style={styles.categoryScrollWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12 }}
        >
          {categories.map((cat, idx) => (
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
              {/* Badge jumlah produk per kategori */}
              <View
                style={[
                  styles.categoryCount,
                  selectedCategory === cat && styles.categoryCountActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryCountText,
                    selectedCategory === cat && styles.categoryCountTextActive,
                  ]}
                >
                  {cat === 'Semua'
                    ? products.length
                    : products.filter((p) => p.category === cat).length}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
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

  // Kategori
  categoryScrollWrapper: { marginBottom: 6 },
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
