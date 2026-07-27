import React, { useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, Alert } from 'react-native';
import { Searchbar, useTheme, Text, Button } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import ProductRepository from '../database/productRepository';
import ProductCard from '../components/ProductCard';

const GudangScreen = ({ navigation }) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);

  const fetchProducts = useCallback(() => {
    try {
      let data = [];
      if (searchQuery.trim() === '') {
        data = ProductRepository.getAllProducts();
      } else {
        data = ProductRepository.searchProductByName(searchQuery);
      }
      setProducts(data);
    } catch (error) {
      console.error("Failed to fetch products:", error);
    }
  }, [searchQuery]);

  useFocusEffect(
    useCallback(() => {
      fetchProducts();
    }, [fetchProducts])
  );

  const handleDelete = (id) => {
    Alert.alert(
      "Hapus Barang",
      "Apakah Anda yakin ingin menghapus barang ini?",
      [
        { text: "Batal", style: "cancel" },
        { 
          text: "Hapus", 
          style: "destructive",
          onPress: () => {
            try {
              ProductRepository.deleteProduct(id);
              fetchProducts();
            } catch (error) {
              Alert.alert("Error", "Gagal menghapus produk");
            }
          } 
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Cari barang..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchbar}
      />
      
      <FlatList
        data={products}
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
            <Text style={{ color: theme.colors.textSecondary }}>Belum ada barang di gudang.</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <View style={styles.bottomContainer}>
        <Button
          mode="contained"
          onPress={() => navigation.navigate('AddProductScreen')}
          style={styles.addBtn}
          buttonColor={theme.colors.primary}
          labelStyle={{ fontWeight: 'bold', fontSize: 16 }}
          contentStyle={{ paddingVertical: 8 }}
          icon="plus"
        >
          TAMBAH BARANG
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 16 },
  bottomContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    elevation: 8,
  },
  addBtn: {
    borderRadius: 12,
  },
  emptyContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default GudangScreen;
