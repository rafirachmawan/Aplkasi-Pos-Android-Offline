import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  Platform,
} from 'react-native';
import { TextInput, Button, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import ProductRepository from '../database/productRepository';
import { colors } from '../theme/colors';

const AddProductScreen = ({ navigation, route }) => {
  const theme = useTheme();
  const existingProduct = route.params?.product;
  // Terima hasil scan barcode dari BarcodeScannerScreen
  const scannedBarcode = route.params?.scannedBarcode;

  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [capitalPrice, setCapitalPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [minStock, setMinStock] = useState('5');

  useEffect(() => {
    if (existingProduct) {
      setBarcode(existingProduct.barcode || '');
      setProductName(existingProduct.product_name);
      setCapitalPrice(existingProduct.capital_price.toString());
      setSellingPrice(existingProduct.selling_price.toString());
      setStockQuantity(existingProduct.stock_quantity.toString());
      setMinStock(existingProduct.min_stock_threshold.toString());
    }
  }, [existingProduct]);

  // Terima hasil scan barcode
  useEffect(() => {
    if (scannedBarcode) {
      setBarcode(scannedBarcode);
    }
  }, [scannedBarcode]);

  const openBarcodeScanner = () => {
    if (Platform.OS === 'web') {
      Alert.alert('Info', 'Fitur scan barcode hanya tersedia di build Android.');
      return;
    }
    navigation.navigate('BarcodeScanner', {
      onBarcodeScanned: (code) => {
        setBarcode(code);
        // Cek apakah barcode sudah terdaftar
        try {
          const existing = ProductRepository.getProductByBarcode(code);
          if (existing && existing.id !== existingProduct?.id) {
            Alert.alert(
              'Barcode Sudah Terdaftar',
              `Barcode ini milik produk: "${existing.product_name}"\n\nApakah Anda ingin mengedit produk tersebut?`,
              [
                { text: 'Batal', style: 'cancel', onPress: () => setBarcode('') },
                {
                  text: 'Edit Produk',
                  onPress: () => navigation.replace('AddProductScreen', { product: existing }),
                },
              ]
            );
          }
        } catch (_) {}
      },
    });
  };

  const handleSave = () => {
    if (!productName || !capitalPrice || !sellingPrice || !stockQuantity) {
      Alert.alert('Error', 'Harap isi semua kolom wajib (*)!');
      return;
    }
    const capPrice = parseInt(capitalPrice, 10);
    const sellPrice = parseInt(sellingPrice, 10);
    const stock = parseInt(stockQuantity, 10);
    const minStockVal = parseInt(minStock, 10);

    if (isNaN(capPrice) || capPrice < 0) {
      Alert.alert('Error', 'Harga modal tidak valid.');
      return;
    }
    if (isNaN(sellPrice) || sellPrice < 0) {
      Alert.alert('Error', 'Harga jual tidak valid.');
      return;
    }
    if (isNaN(stock) || stock < 0) {
      Alert.alert('Error', 'Stok tidak boleh negatif.');
      return;
    }

    const data = {
      barcode: barcode.trim() || null,
      product_name: productName.trim(),
      capital_price: capPrice,
      selling_price: sellPrice,
      stock_quantity: stock,
      min_stock_threshold: isNaN(minStockVal) ? 5 : minStockVal,
    };

    try {
      if (existingProduct) {
        ProductRepository.updateProduct(existingProduct.id, data);
        Alert.alert('✅ Sukses', 'Produk berhasil diperbarui.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        ProductRepository.addProduct(data);
        Alert.alert('✅ Sukses', 'Produk berhasil ditambahkan.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.formContainer}>
        {/* Barcode Field + Scan Button */}
        <View style={styles.barcodeRow}>
          <View style={{ flex: 1 }}>
            <TextInput
              label="Barcode (Opsional)"
              value={barcode}
              onChangeText={setBarcode}
              mode="outlined"
              style={styles.input}
              keyboardType="default"
              placeholder="Ketik atau scan barcode..."
              right={
                barcode ? (
                  <TextInput.Icon icon="close-circle" onPress={() => setBarcode('')} />
                ) : null
              }
            />
          </View>
          <TouchableOpacity style={styles.scanBtn} onPress={openBarcodeScanner}>
            <MaterialCommunityIcons name="barcode-scan" size={26} color="#fff" />
          </TouchableOpacity>
        </View>

        <TextInput
          label="Nama Barang *"
          value={productName}
          onChangeText={setProductName}
          mode="outlined"
          style={styles.input}
          autoCapitalize="words"
        />

        <View style={styles.row}>
          <TextInput
            label="Harga Modal (Rp) *"
            value={capitalPrice}
            onChangeText={setCapitalPrice}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            label="Harga Jual (Rp) *"
            value={sellingPrice}
            onChangeText={setSellingPrice}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
          />
        </View>

        {/* Margin preview */}
        {capitalPrice && sellingPrice && (
          <View style={styles.marginPreview}>
            <MaterialCommunityIcons name="trending-up" size={16} color={
              parseInt(sellingPrice) >= parseInt(capitalPrice) ? colors.primary : colors.error
            } />
            <Text style={[styles.marginText, {
              color: parseInt(sellingPrice) >= parseInt(capitalPrice) ? colors.primary : colors.error
            }]}>
              Margin: Rp {(parseInt(sellingPrice || 0) - parseInt(capitalPrice || 0)).toLocaleString('id-ID')}
              {' '}
              ({capitalPrice && sellingPrice && parseInt(capitalPrice) > 0
                ? Math.round(((parseInt(sellingPrice) - parseInt(capitalPrice)) / parseInt(capitalPrice)) * 100)
                : 0}%)
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <TextInput
            label={existingProduct ? 'Stok Saat Ini *' : 'Stok Awal *'}
            value={stockQuantity}
            onChangeText={setStockQuantity}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            label="Batas Min Stok"
            value={minStock}
            onChangeText={setMinStock}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
          />
        </View>

        {/* Info min stock */}
        <Text style={styles.infoText}>
          💡 Peringatan stok menipis muncul saat stok ≤ batas minimum.
        </Text>

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          contentStyle={{ paddingVertical: 6 }}
          icon={existingProduct ? 'content-save' : 'plus'}
        >
          {existingProduct ? 'SIMPAN PERUBAHAN' : 'TAMBAH BARANG'}
        </Button>

        {existingProduct && (
          <Button
            mode="outlined"
            onPress={() => navigation.goBack()}
            style={[styles.saveButton, { marginTop: 8 }]}
            textColor={colors.textSecondary}
          >
            BATAL
          </Button>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  formContainer: { padding: 16 },
  input: { marginBottom: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },

  barcodeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  scanBtn: {
    width: 52, height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    elevation: 3,
  },

  marginPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4',
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 14, borderWidth: 1, borderColor: '#BBF7D0',
  },
  marginText: { fontSize: 13, fontWeight: '600' },

  infoText: {
    fontSize: 12, color: colors.textSecondary,
    marginBottom: 16, lineHeight: 18,
  },
  saveButton: { marginTop: 8, paddingVertical: 4 },
});

export default AddProductScreen;
