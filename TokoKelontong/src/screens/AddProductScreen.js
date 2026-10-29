import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Text,
  Platform,
  Image,
  Modal,
  TextInput as RNTextInput,
  StatusBar,
  Linking,
} from "react-native";
import { TextInput, Button } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ProductRepository from "../database/productRepository";
import { useAuth } from "../context/AuthContext";
import { colors, fonts } from "../theme/colors";
import { encodeCode128 } from "../utils/barcode128";
import { uploadProductImage, isCloudImageUri } from "../utils/imageStorage";
import {
  isPrinterConfigured,
  isBluetoothPrintingSupported,
  printBarcodeLabelViaBluetooth,
} from "../utils/bluetoothPrinter";

// ─── Helper: format angka menjadi format Rupiah saat diketik ───────────────
const formatToRp = (raw) => {
  const num = raw.replace(/\D/g, "");
  if (!num) return "";
  return parseInt(num, 10).toLocaleString("id-ID");
};

const parseRp = (formatted) => {
  if (!formatted) return 0;
  const cleaned = String(formatted).replace(/\D/g, "");
  return parseInt(cleaned, 10) || 0;
};

const DEFAULT_UNITS = ["pack"];
const UNITS_STORAGE_KEY = "product_units";

const DEFAULT_CATEGORIES = ["makanan", "minuman"];
const CATEGORIES_STORAGE_KEY = "product_categories";

// Key penyimpanan per toko agar daftar satuan/kategori tidak campur antar toko
// di satu HP yang sama.
const unitsKeyFor = (storeId) => `${UNITS_STORAGE_KEY}:${storeId}`;
const categoriesKeyFor = (storeId) => `${CATEGORIES_STORAGE_KEY}:${storeId}`;

// ─── Komponen BarcodeDisplay (Code128 ASLI) ─────────────────────────────────────
// Merender barcode Code128 standar industri (bisa dibaca scanner)
// memakai algoritma pustaka JsBarcode — bukan bar dari kode karakter.
const SimpleBarcodeDisplay = ({ value }) => {
  const data = encodeCode128(value);
  if (!data) return null;

  // Sesuaikan lebar bar agar muat layar (batas lebar total ~300px)
  const barWidth = Math.max(1, Math.min(2, Math.floor(300 / data.length)));

  return (
    <View style={barcodeStyles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={barcodeStyles.barcodeArea}>
          {data.split("").map((bit, i) => (
            <View
              key={i}
              style={{
                width: barWidth,
                height: 60,
                backgroundColor: bit === "1" ? "#000" : "transparent",
              }}
            />
          ))}
        </View>
      </ScrollView>
      <Text style={barcodeStyles.barcodeText}>{value}</Text>
    </View>
  );
};

const barcodeStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  barcodeArea: {
    flexDirection: "row",
    height: 60,
    backgroundColor: "#fff",
    paddingHorizontal: 8,
  },
  barcodeText: {
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 6,
    letterSpacing: 2,
    color: "#000",
  },
});

// ─── Main Screen ───────────────────────────────────────────────────────────
const AddProductScreen = ({ navigation, route }) => {
  const existingProduct = route.params?.product;
  const scannedBarcode = route.params?.scannedBarcode;

  // store_id toko yang sedang login — dasar key penyimpanan satuan/kategori.
  const { profile } = useAuth();
  const storeId = profile?.store_id || null;

  const [barcode, setBarcode] = useState("");
  const [productName, setProductName] = useState("");
  const [capitalPrice, setCapitalPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [imageUri, setImageUri] = useState(null);
  const [unit, setUnit] = useState("pack");
  const [wholesaleRules, setWholesaleRules] = useState([]);
  const [showAddWholesaleModal, setShowAddWholesaleModal] = useState(false);
  const [wsMinQtyInput, setWsMinQtyInput] = useState("");
  const [wsPriceInput, setWsPriceInput] = useState("");
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Unit CRUD state
  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [showEditUnitModal, setShowEditUnitModal] = useState(false);
  const [newUnitInput, setNewUnitInput] = useState("");
  const [editingUnit, setEditingUnit] = useState(null); // { index, value }
  const [editUnitInput, setEditUnitInput] = useState("");

  // Image Source Selection Modal state
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);

  // Printer Bluetooth: tombol cetak langsung hanya tampil bila sudah diatur
  const [btPrinterReady, setBtPrinterReady] = useState(false);

  // Category CRUD state
  const [category, setCategory] = useState("makanan");
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryInput, setEditCategoryInput] = useState("");

  // Load units & categories per toko dari storage
  useEffect(() => {
    if (!storeId) return;
    setUnits(DEFAULT_UNITS);
    setCategories(DEFAULT_CATEGORIES);
    const uKey = unitsKeyFor(storeId);
    const cKey = categoriesKeyFor(storeId);
    (async () => {
      // Migrasi satu kali: key lama (global perangkat) dipindah ke toko ini.
      let storedUnits = await AsyncStorage.getItem(uKey);
      if (!storedUnits) {
        const legacy = await AsyncStorage.getItem(UNITS_STORAGE_KEY);
        if (legacy) {
          await AsyncStorage.setItem(uKey, legacy);
          await AsyncStorage.removeItem(UNITS_STORAGE_KEY);
          storedUnits = legacy;
        }
      }
      let storedCats = await AsyncStorage.getItem(cKey);
      if (!storedCats) {
        const legacy = await AsyncStorage.getItem(CATEGORIES_STORAGE_KEY);
        if (legacy) {
          await AsyncStorage.setItem(cKey, legacy);
          await AsyncStorage.removeItem(CATEGORIES_STORAGE_KEY);
          storedCats = legacy;
        }
      }
      if (storedUnits) {
        try {
          const parsed = JSON.parse(storedUnits);
          if (Array.isArray(parsed) && parsed.length > 0) setUnits(parsed);
        } catch (_) {
          // Data tersimpan korup — biarkan daftar default dipakai.
        }
      }
      if (storedCats) {
        try {
          const parsed = JSON.parse(storedCats);
          if (Array.isArray(parsed) && parsed.length > 0) setCategories(parsed);
        } catch (_) {
          // Data tersimpan korup — biarkan daftar default dipakai.
        }
      }
    })();
  }, [storeId]);

  // Deteksi printer Bluetooth sekali saat layar dibuka
  useEffect(() => {
    if (isBluetoothPrintingSupported()) {
      isPrinterConfigured()
        .then(setBtPrinterReady)
        .catch(() => setBtPrinterReady(false));
    }
  }, []);

  const saveUnits = async (newUnits) => {
    setUnits(newUnits);
    if (storeId) {
      await AsyncStorage.setItem(unitsKeyFor(storeId), JSON.stringify(newUnits));
    }
  };

  const handleAddUnit = async () => {
    const val = newUnitInput.trim().toLowerCase();
    if (!val) return;
    if (units.includes(val)) {
      Alert.alert("Duplikat", `Satuan "${val}" sudah ada.`);
      return;
    }
    await saveUnits([...units, val]);
    setUnit(val);
    setNewUnitInput("");
    setShowAddUnitModal(false);
  };

  const handleEditUnit = async () => {
    const val = editUnitInput.trim().toLowerCase();
    if (!val || editingUnit === null) return;
    if (units.includes(val) && val !== editingUnit.value) {
      Alert.alert("Duplikat", `Satuan "${val}" sudah ada.`);
      return;
    }
    const updated = units.map((u, i) => (i === editingUnit.index ? val : u));
    await saveUnits(updated);
    if (unit === editingUnit.value) setUnit(val);
    setShowEditUnitModal(false);
    setEditingUnit(null);
  };

  const handleDeleteUnit = (u, index) => {
    if (units.length <= 1) {
      Alert.alert("Tidak bisa", "Minimal harus ada 1 satuan.");
      return;
    }
    Alert.alert("Hapus Satuan", `Hapus satuan "${u}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const updated = units.filter((_, i) => i !== index);
          await saveUnits(updated);
          if (unit === u) setUnit(updated[0]);
        },
      },
    ]);
  };

  const saveCategories = async (newCats) => {
    setCategories(newCats);
    if (storeId) {
      await AsyncStorage.setItem(categoriesKeyFor(storeId), JSON.stringify(newCats));
    }
  };

  const handleAddCategory = async () => {
    const val = newCategoryInput.trim().toLowerCase();
    if (!val) return;
    if (categories.includes(val)) {
      Alert.alert("Duplikat", `Kategori "${val}" sudah ada.`);
      return;
    }
    await saveCategories([...categories, val]);
    setCategory(val);
    setNewCategoryInput("");
    setShowAddCategoryModal(false);
  };

  const handleEditCategory = async () => {
    const val = editCategoryInput.trim().toLowerCase();
    if (!val || editingCategory === null) return;
    if (categories.includes(val) && val !== editingCategory.value) {
      Alert.alert("Duplikat", `Kategori "${val}" sudah ada.`);
      return;
    }
    const updated = categories.map((c, i) =>
      i === editingCategory.index ? val : c,
    );
    await saveCategories(updated);
    if (category === editingCategory.value) setCategory(val);
    setShowEditCategoryModal(false);
    setEditingCategory(null);
  };

  const handleDeleteCategory = (c, index) => {
    if (categories.length <= 1) {
      Alert.alert("Tidak bisa", "Minimal harus ada 1 kategori.");
      return;
    }
    Alert.alert("Hapus Kategori", `Hapus kategori "${c}"?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Hapus",
        style: "destructive",
        onPress: async () => {
          const updated = categories.filter((_, i) => i !== index);
          await saveCategories(updated);
          if (category === c) setCategory(updated[0]);
        },
      },
    ]);
  };

  useEffect(() => {
    if (existingProduct) {
      setBarcode(existingProduct.barcode || "");
      setProductName(existingProduct.product_name);
      setCapitalPrice(existingProduct.capital_price.toLocaleString("id-ID"));
      setSellingPrice(existingProduct.selling_price.toLocaleString("id-ID"));
      setStockQuantity(existingProduct.stock_quantity.toString());
      setMinStock(existingProduct.min_stock_threshold.toString());
      setImageUri(existingProduct.image_uri || null);
      setUnit(existingProduct.unit || "pcs");
      setCategory(existingProduct.category || "makanan");
      setWholesaleRules(existingProduct.wholesale_rules || []);
    }
  }, [existingProduct]);

  useEffect(() => {
    if (scannedBarcode) setBarcode(scannedBarcode);
  }, [scannedBarcode]);

  // ── Image picker ──
  const handlePickImage = () => {
    Alert.alert(
      "Foto Produk",
      "Pilih lokasi pengambilan foto produk:",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Galeri Foto",
          onPress: () => executePicker("gallery"),
        },
        {
          text: "Kamera HP",
          onPress: () => executePicker("camera"),
        },
      ],
      { cancelable: true },
    );
  };

  const handleSelectSource = (source) => {
    setShowImageSourceModal(false);
    setTimeout(() => {
      executePicker(source);
    }, 400);
  };

  const executePicker = async (source) => {
    try {
      if (source === "gallery") {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Akses Galeri Ditolak",
            "Aplikasi membutuhkan izin untuk mengakses galeri foto. Silakan izinkan di Pengaturan HP Anda.",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Buka Pengaturan",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return;
        }

        // Tanpa layar crop: foto langsung dipakai agar user tidak bingung.
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
        });

        if (
          result &&
          !result.canceled &&
          result.assets &&
          result.assets.length > 0
        ) {
          setImageUri(result.assets[0].uri);
        }
      } else if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Akses Kamera Ditolak",
            "Aplikasi membutuhkan izin untuk menggunakan kamera. Silakan izinkan di Pengaturan HP Anda.",
            [
              { text: "Batal", style: "cancel" },
              {
                text: "Buka Pengaturan",
                onPress: () => Linking.openSettings(),
              },
            ],
          );
          return;
        }

        // Tanpa layar crop: foto langsung dipakai agar user tidak bingung.
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          allowsEditing: false,
          quality: 0.8,
        });

        if (
          result &&
          !result.canceled &&
          result.assets &&
          result.assets.length > 0
        ) {
          setImageUri(result.assets[0].uri);
        }
      }
    } catch (e) {
      console.error("ImagePicker Error:", e);
      let errorMsg = e.message || "Gagal membuka media";
      if (
        errorMsg.toLowerCase().includes("camera is not available") ||
        errorMsg.toLowerCase().includes("simulator")
      ) {
        errorMsg =
          "Kamera tidak tersedia (misal di Simulator iOS). Gunakan HP fisik atau pilih dari Galeri.";
      }
      Alert.alert("Gagal Mengambil Foto", errorMsg);
    }
  };

  // ── Barcode scanner ──
  const openBarcodeScanner = () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Info",
        "Fitur scan barcode hanya tersedia di build Android.",
      );
      return;
    }
    navigation.navigate("BarcodeScanner", {
      autoClose: true,
      onBarcodeScanned: async (code) => {
        setBarcode(code);
        try {
          const existing = await ProductRepository.getProductByBarcode(code);
          if (existing && existing.id !== existingProduct?.id) {
            Alert.alert(
              "Barcode Sudah Terdaftar",
              `Barcode ini milik produk: "${existing.product_name}"\n\nApakah ingin mengedit produk tersebut?`,
              [
                {
                  text: "Batal",
                  style: "cancel",
                  onPress: () => setBarcode(""),
                },
                {
                  text: "Edit Produk",
                  onPress: () =>
                    navigation.replace("AddProductScreen", {
                      product: existing,
                    }),
                },
              ],
            );
          }
        } catch (_) {}
      },
    });
  };

  // ── Cetak Label Barcode via HTML print ──
  const handlePrintBarcode = async () => {
    if (!barcode) {
      Alert.alert(
        "Barcode Kosong",
        "Isi kolom barcode terlebih dahulu sebelum mencetak label.",
      );
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("Info", "Fitur cetak hanya tersedia di build Android.");
      return;
    }
    try {
      // Barcode Code128 ASLI (bisa dibaca scanner), dibuat offline
      const data = encodeCode128(barcode);
      if (!data) {
        Alert.alert(
          "Barcode Tidak Valid",
          "Karakter ini tidak bisa di-encode menjadi barcode Code128.",
        );
        return;
      }

      const svgBars = data
        .split("")
        .map((bit, i) =>
          bit === "1"
            ? `<rect x="${i * 2}" y="0" width="2" height="60" fill="black"/>`
            : "",
        )
        .join("");
      const totalWidth = data.length * 2 + 20;

      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="80" style="max-width:280px; height:auto;">
          <rect width="${totalWidth}" height="80" fill="white"/>
          <g transform="translate(10,0)">${svgBars}</g>
          <text x="${totalWidth / 2}" y="76" text-anchor="middle" font-size="10" font-family="monospace">${barcode}</text>
        </svg>
      `;

      const html = `
        <html>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;height:100vh;">
            <div style="text-align:center;border:1px solid #ccc;padding:16px;border-radius:8px;width:280px;">
              <p style="font-size:14px;font-weight:bold;margin:0 0 8px;">${productName || "Produk"}</p>
              ${svgString}
            </div>
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (e) {
      Alert.alert("Error Cetak", e.message);
    }
  };

  // ── Cetak Label Barcode langsung ke printer thermal Bluetooth ──
  const handlePrintBarcodeBluetooth = async () => {
    if (!barcode) {
      Alert.alert(
        "Barcode Kosong",
        "Isi kolom barcode terlebih dahulu sebelum mencetak label.",
      );
      return;
    }
    try {
      await printBarcodeLabelViaBluetooth({
        barcode,
        productName: productName || "Produk",
        priceText: sellingPrice ? `Rp ${sellingPrice}` : null,
      });
      Alert.alert("Berhasil", "Label dikirim ke printer Bluetooth.");
    } catch (e) {
      Alert.alert(
        "Gagal Cetak",
        e.message || "Terjadi kesalahan saat mencetak ke printer.",
      );
    }
  };

  // ── Save ──
  const handleSave = async () => {
    if (!productName || !capitalPrice || !sellingPrice || !stockQuantity) {
      Alert.alert("Error", "Harap isi semua kolom wajib (*)!");
      return;
    }
    const capPrice = parseRp(capitalPrice);
    const sellPrice = parseRp(sellingPrice);
    const stock = parseInt(stockQuantity, 10);
    const minStockVal = parseInt(minStock, 10);

    if (isNaN(capPrice) || capPrice < 0) {
      Alert.alert("Error", "Harga modal tidak valid.");
      return;
    }
    if (isNaN(sellPrice) || sellPrice < 0) {
      Alert.alert("Error", "Harga jual tidak valid.");
      return;
    }
    if (isNaN(stock) || stock < 0) {
      Alert.alert("Error", "Stok tidak boleh negatif.");
      return;
    }

    // Cek barcode duplikat sebelum simpan (jalur tambah & edit)
    const barcodeVal = barcode.trim() || null;
    if (barcodeVal) {
      try {
        const existingBarcode =
          await ProductRepository.getProductByBarcode(barcodeVal);
        if (existingBarcode && existingBarcode.id !== existingProduct?.id) {
          Alert.alert(
            "Barcode Sudah Terdaftar",
            `Barcode ini sudah dipakai oleh produk "${existingBarcode.product_name}". Gunakan barcode lain.`,
          );
          return;
        }
      } catch (_) {
        // Jika cek gagal, lanjut — unique index di server jadi penjaga akhir
      }
    }

    // Upload foto lokal ke Supabase Storage agar tampil di semua HP.
    // URL cloud (http) yang sudah ada tidak di-upload ulang.
    let finalImageUri = imageUri || null;
    if (imageUri && !isCloudImageUri(imageUri)) {
      try {
        finalImageUri = await uploadProductImage(imageUri);
      } catch (uploadErr) {
        const proceed = await new Promise((resolve) =>
          Alert.alert(
            "Gagal Upload Foto",
            "Foto produk tidak bisa diunggah ke cloud (" +
              uploadErr.message +
              "). Apakah bucket 'product-images' sudah dibuat di Supabase?",
            [
              {
                text: "Batal Simpan",
                style: "cancel",
                onPress: () => resolve(false),
              },
              { text: "Simpan Tanpa Foto", onPress: () => resolve(true) },
            ],
          ),
        );
        if (!proceed) return;
        finalImageUri = null;
      }
    }

    const data = {
      barcode: barcodeVal,
      product_name: productName.trim(),
      capital_price: capPrice,
      selling_price: sellPrice,
      stock_quantity: stock,
      min_stock_threshold: isNaN(minStockVal) ? 5 : Math.max(0, minStockVal),
      image_uri: finalImageUri,
      unit,
      category,
      wholesale_rules: wholesaleRules,
    };

    try {
      if (existingProduct) {
        // Terapkan SELISIH stok yang diketik user terhadap stok terbaru
        // di server, agar penjualan dari perangkat lain selama form
        // terbuka tidak tertimpa angka absolut yang sudah lama.
        const latest = await ProductRepository.getProductById(
          existingProduct.id,
        );
        const stockDelta = stock - (existingProduct.stock_quantity || 0);
        data.stock_quantity = Math.max(
          0,
          (latest ? latest.stock_quantity : stock) + stockDelta,
        );
        await ProductRepository.updateProduct(existingProduct.id, data);
        Alert.alert("✅ Sukses", "Produk berhasil diperbarui.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      } else {
        await ProductRepository.addProduct(data);
        Alert.alert("✅ Sukses", "Produk berhasil ditambahkan.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const capNum = parseRp(capitalPrice);
  const sellNum = parseRp(sellingPrice);
  const margin = sellNum - capNum;
  const marginPct = capNum > 0 ? Math.round((margin / capNum) * 100) : 0;
  const marginPositive = sellNum >= capNum;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Gambar Produk ── */}
        <Text style={styles.sectionLabel}>Foto Produk</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.productImage} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <MaterialCommunityIcons
                name="camera-plus"
                size={36}
                color={colors.primary}
              />
              <Text style={styles.imagePlaceholderText}>
                Upload Foto Produk
              </Text>
            </View>
          )}
          {imageUri && (
            <TouchableOpacity
              style={styles.removeImageBtn}
              onPress={() => setImageUri(null)}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={24}
                color="#EF4444"
              />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* ── Barcode + Scan ── */}
        <Text style={styles.sectionLabel}>Barcode & Label</Text>
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
                  <TextInput.Icon
                    icon="close-circle"
                    onPress={() => setBarcode("")}
                  />
                ) : null
              }
            />
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={openBarcodeScanner}>
            <MaterialCommunityIcons
              name="barcode-scan"
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, !barcode.trim() && { opacity: 0.4 }]}
            onPress={() => {
              if (!barcode.trim()) {
                Alert.alert(
                  "Barcode Kosong",
                  "Isi kolom barcode terlebih dahulu untuk melihat label.",
                );
                return;
              }
              setShowBarcodeModal(true);
            }}
          >
            <MaterialCommunityIcons
              name="tag-outline"
              size={24}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* ── Info Produk ── */}
        <Text style={styles.sectionLabel}>Informasi Produk</Text>
        <TextInput
          label="Nama Barang *"
          value={productName}
          onChangeText={setProductName}
          mode="outlined"
          style={styles.input}
          autoCapitalize="words"
        />

        {/* ── Harga format Rp otomatis ── */}
        <View style={styles.row}>
          <TextInput
            label="Harga Modal (Rp) *"
            value={capitalPrice ? `Rp ${capitalPrice}` : ""}
            onChangeText={(text) => {
              const raw = text.replace(/^Rp\s?/, "");
              setCapitalPrice(formatToRp(raw));
            }}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1, marginRight: 8 }]}
          />
          <TextInput
            label="Harga Jual (Rp) *"
            value={sellingPrice ? `Rp ${sellingPrice}` : ""}
            onChangeText={(text) => {
              const raw = text.replace(/^Rp\s?/, "");
              setSellingPrice(formatToRp(raw));
            }}
            mode="outlined"
            keyboardType="numeric"
            style={[styles.input, { flex: 1, marginLeft: 8 }]}
          />
        </View>

        {/* ── Margin Preview ── */}
        {capitalPrice !== "" && sellingPrice !== "" && (
          <View
            style={[
              styles.marginPreview,
              {
                borderColor: marginPositive ? colors.border : "#FCA5A5",
                backgroundColor: marginPositive ? colors.iconBg : "#FFF1F2",
              },
            ]}
          >
            <MaterialCommunityIcons
              name={marginPositive ? "trending-up" : "trending-down"}
              size={16}
              color={marginPositive ? colors.primary : colors.error}
            />
            <Text
              style={[
                styles.marginText,
                { color: marginPositive ? colors.primary : colors.error },
              ]}
            >
              Margin: Rp {margin.toLocaleString("id-ID")} ({marginPct}%)
            </Text>
          </View>
        )}

        {/* ── Harga Grosir / Bertingkat (Tiered Pricing) ── */}
        <View style={styles.wholesaleCard}>
          <View style={styles.wholesaleHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <MaterialCommunityIcons
                name="layers-outline"
                size={18}
                color="#0F172A"
              />
              <Text style={styles.wholesaleTitle}>Harga Grosir / Bertingkat</Text>
            </View>
            <TouchableOpacity
              style={styles.btnAddWholesale}
              onPress={() => {
                setWsMinQtyInput("");
                setWsPriceInput("");
                setShowAddWholesaleModal(true);
              }}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#0F172A" />
              <Text style={styles.btnAddWholesaleText}>Tambah</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.wholesaleSubtitle}>
            Potongan harga satuan otomatis jika pembeli membeli dalam jumlah banyak (misal beli ≥ 12 {unit}).
          </Text>

          {wholesaleRules.length === 0 ? (
            <Text style={styles.wholesaleEmptyText}>
              Belum ada aturan harga grosir. Klik Tambah untuk membuat aturan.
            </Text>
          ) : (
            <View style={styles.wholesaleList}>
              {wholesaleRules
                .slice()
                .sort((a, b) => a.min_qty - b.min_qty)
                .map((rule, idx) => (
                  <View key={idx} style={styles.wholesaleItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.wholesaleMinQty}>
                        Beli ≥ {rule.min_qty} {unit}
                      </Text>
                      <Text style={styles.wholesalePriceText}>
                        Rp {rule.price.toLocaleString("id-ID")} / {unit}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setWholesaleRules(
                          wholesaleRules.filter((_, i) => i !== idx),
                        );
                      }}
                      style={styles.btnDeleteWholesale}
                    >
                      <MaterialCommunityIcons
                        name="trash-can-outline"
                        size={18}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          )}
        </View>

        {/* ── Stok ── */}
        <View style={styles.row}>
          <TextInput
            label={existingProduct ? "Stok Saat Ini *" : "Stok Awal *"}
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

        <Text style={styles.infoText}>
          💡 Peringatan stok menipis muncul saat stok ≤ batas minimum.
        </Text>

        {/* ── Satuan Produk ── */}
        <View style={styles.unitHeader}>
          <Text style={styles.sectionLabel}>Satuan</Text>
        </View>
        <View style={styles.unitPillWrap}>
          {units.map((u, index) => (
            <TouchableOpacity
              key={u + index}
              style={[styles.unitPill, unit === u && styles.unitPillActive]}
              onPress={() => setUnit(u)}
              onLongPress={() => {
                setEditingUnit({ index, value: u });
                setEditUnitInput(u);
                setShowEditUnitModal(true);
              }}
            >
              <Text
                style={[
                  styles.unitPillText,
                  unit === u && styles.unitPillTextActive,
                ]}
              >
                {u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.infoText}>
          💡 Tekan tahan satuan untuk ubah/hapus.
        </Text>

        <Button
          mode="outlined"
          onPress={() => {
            setNewUnitInput("");
            setShowAddUnitModal(true);
          }}
          style={[styles.saveButton, { marginTop: 16 }]}
          textColor={colors.primary}
          icon="plus"
        >
          TAMBAH SATUAN BARU
        </Button>

        {/* ── Kategori Produk ── */}
        <View style={styles.unitHeader}>
          <Text style={styles.sectionLabel}>Kategori</Text>
        </View>
        <View style={styles.unitPillWrap}>
          {categories.map((c, index) => (
            <TouchableOpacity
              key={c + index}
              style={[styles.unitPill, category === c && styles.unitPillActive]}
              onPress={() => setCategory(c)}
              onLongPress={() => {
                setEditingCategory({ index, value: c });
                setEditCategoryInput(c);
                setShowEditCategoryModal(true);
              }}
            >
              <Text
                style={[
                  styles.unitPillText,
                  category === c && styles.unitPillTextActive,
                ]}
              >
                {c}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.infoText}>
          💡 Tekan tahan kategori untuk ubah/hapus.
        </Text>

        <Button
          mode="outlined"
          onPress={() => {
            setNewCategoryInput("");
            setShowAddCategoryModal(true);
          }}
          style={[styles.saveButton, { marginTop: 16 }]}
          textColor={colors.primary}
          icon="plus"
        >
          TAMBAH KATEGORI BARU
        </Button>

        <Button
          mode="contained"
          onPress={handleSave}
          style={styles.saveButton}
          buttonColor={colors.primary}
          labelStyle={{ fontWeight: "bold", fontSize: 16 }}
          contentStyle={{ paddingVertical: 6 }}
          icon={existingProduct ? "content-save" : "plus"}
        >
          {existingProduct ? "SIMPAN PERUBAHAN" : "TAMBAH BARANG"}
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
      </ScrollView>

      {/* ── Modal Label Barcode ── */}
      <Modal
        visible={showBarcodeModal}
        transparent
        statusBarTranslucent={true}
        animationType="slide"
        onRequestClose={() => setShowBarcodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Label Barcode</Text>
              <TouchableOpacity onPress={() => setShowBarcodeModal(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={colors.text}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalProductName}>
              {productName || "Produk"}
            </Text>

            {/* Barcode Visual */}
            <SimpleBarcodeDisplay value={barcode} />

            {sellingPrice !== "" && (
              <Text style={styles.modalPrice}>Rp {sellingPrice}</Text>
            )}

            <TouchableOpacity
              style={styles.printBtn}
              onPress={handlePrintBarcode}
            >
              <MaterialCommunityIcons name="printer" size={20} color="#fff" />
              <Text style={styles.printBtnText}>CETAK LABEL</Text>
            </TouchableOpacity>

            {btPrinterReady && Platform.OS === "android" && (
              <TouchableOpacity
                style={[
                  styles.printBtn,
                  { backgroundColor: "#0F172A", marginTop: 10 },
                ]}
                onPress={handlePrintBarcodeBluetooth}
              >
                <MaterialCommunityIcons
                  name="bluetooth"
                  size={20}
                  color="#fff"
                />
                <Text style={styles.printBtnText}>
                  CETAK VIA PRINTER BLUETOOTH
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal Tambah Satuan ── */}
      <Modal
        visible={showAddUnitModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowAddUnitModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowAddUnitModal(false)}
        >
          <View style={styles.unitModal}>
            <Text style={styles.unitModalTitle}>Tambah Satuan Baru</Text>
            <RNTextInput
              style={styles.unitModalInput}
              value={newUnitInput}
              onChangeText={setNewUnitInput}
              placeholder="Contoh: dus, lusin, pack..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={handleAddUnit}
            />
            <View style={styles.unitModalActions}>
              <TouchableOpacity
                style={styles.unitModalCancelBtn}
                onPress={() => setShowAddUnitModal(false)}
              >
                <Text style={styles.unitModalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unitModalConfirmBtn}
                onPress={handleAddUnit}
              >
                <Text style={styles.unitModalConfirmText}>Tambah</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Edit Satuan ── */}
      <Modal
        visible={showEditUnitModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowEditUnitModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowEditUnitModal(false)}
        >
          <View style={styles.unitModal}>
            <Text style={styles.unitModalTitle}>Edit Satuan</Text>
            <RNTextInput
              style={styles.unitModalInput}
              value={editUnitInput}
              onChangeText={setEditUnitInput}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={handleEditUnit}
            />
            <View style={styles.unitModalActions}>
              <TouchableOpacity
                style={[
                  styles.unitModalCancelBtn,
                  { borderColor: colors.error },
                ]}
                onPress={() => {
                  if (editingUnit)
                    handleDeleteUnit(editingUnit.value, editingUnit.index);
                  setShowEditUnitModal(false);
                }}
              >
                <Text
                  style={[styles.unitModalCancelText, { color: colors.error }]}
                >
                  Hapus
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unitModalConfirmBtn}
                onPress={handleEditUnit}
              >
                <Text style={styles.unitModalConfirmText}>Simpan</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.unitEditHint}>
              * Tekan tahan (long press) pada satuan untuk edit/hapus
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Tambah Kategori ── */}
      <Modal
        visible={showAddCategoryModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowAddCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowAddCategoryModal(false)}
        >
          <View style={styles.unitModal}>
            <Text style={styles.unitModalTitle}>Tambah Kategori Baru</Text>
            <RNTextInput
              style={styles.unitModalInput}
              value={newCategoryInput}
              onChangeText={setNewCategoryInput}
              placeholder="Contoh: makanan, minuman, sabun..."
              placeholderTextColor={colors.textSecondary}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={handleAddCategory}
            />
            <View style={styles.unitModalActions}>
              <TouchableOpacity
                style={styles.unitModalCancelBtn}
                onPress={() => setShowAddCategoryModal(false)}
              >
                <Text style={styles.unitModalCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unitModalConfirmBtn}
                onPress={handleAddCategory}
              >
                <Text style={styles.unitModalConfirmText}>Tambah</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Edit Kategori ── */}
      <Modal
        visible={showEditCategoryModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowEditCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowEditCategoryModal(false)}
        >
          <View style={styles.unitModal}>
            <Text style={styles.unitModalTitle}>Edit Kategori</Text>
            <RNTextInput
              style={styles.unitModalInput}
              value={editCategoryInput}
              onChangeText={setEditCategoryInput}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={handleEditCategory}
            />
            <View style={styles.unitModalActions}>
              <TouchableOpacity
                style={[
                  styles.unitModalCancelBtn,
                  { borderColor: colors.error },
                ]}
                onPress={() => {
                  if (editingCategory)
                    handleDeleteCategory(
                      editingCategory.value,
                      editingCategory.index,
                    );
                  setShowEditCategoryModal(false);
                }}
              >
                <Text
                  style={[styles.unitModalCancelText, { color: colors.error }]}
                >
                  Hapus
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.unitModalConfirmBtn}
                onPress={handleEditCategory}
              >
                <Text style={styles.unitModalConfirmText}>Simpan</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.unitEditHint}>
              * Tekan tahan (long press) pada kategori untuk edit/hapus
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Pilih Sumber Gambar ── */}
      <Modal
        visible={showImageSourceModal}
        transparent
        statusBarTranslucent={true}
        animationType="fade"
        onRequestClose={() => setShowImageSourceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowImageSourceModal(false)}
        >
          <View style={styles.sourceModalCard}>
            <Text style={styles.sourceModalTitle}>Pilih Sumber Foto</Text>
            <Text style={styles.sourceModalDesc}>
              Pilih dari mana Anda ingin mengambil foto produk.
            </Text>

            <View style={styles.sourceOptionsRow}>
              <TouchableOpacity
                style={styles.sourceOptionBtn}
                onPress={() => handleSelectSource("gallery")}
              >
                <View
                  style={[
                    styles.sourceIconWrap,
                    { backgroundColor: colors.iconBg },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="image"
                    size={32}
                    color={colors.iconColor}
                  />
                </View>
                <Text style={styles.sourceOptionText}>Galeri</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sourceOptionBtn}
                onPress={() => handleSelectSource("camera")}
              >
                <View
                  style={[
                    styles.sourceIconWrap,
                    { backgroundColor: colors.iconBg },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={32}
                    color={colors.iconColor}
                  />
                </View>
                <Text style={styles.sourceOptionText}>Kamera</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sourceCancelBtn}
              onPress={() => setShowImageSourceModal(false)}
            >
              <Text style={styles.sourceCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Tambah Aturan Harga Grosir ── */}
      <Modal visible={showAddWholesaleModal} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={styles.wsModalCard}>
            <View style={styles.wsModalHeader}>
              <Text style={styles.wsModalTitle}>Tambah Harga Grosir</Text>
              <TouchableOpacity
                onPress={() => setShowAddWholesaleModal(false)}
              >
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.wsModalSubtitle}>
              Tentukan jumlah minimum dan harga per satuan:
            </Text>

            <Text style={styles.wsInputLabel}>
              Jumlah Pembelian Minimum ({unit}) *
            </Text>
            <RNTextInput
              style={styles.wsInput}
              value={wsMinQtyInput}
              onChangeText={setWsMinQtyInput}
              keyboardType="number-pad"
              placeholder="Contoh: 12"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.wsInputLabel}>
              Harga Satuan Grosir (Rp) *
            </Text>
            <RNTextInput
              style={styles.wsInput}
              value={wsPriceInput}
              onChangeText={(v) => setWsPriceInput(formatToRp(v))}
              keyboardType="number-pad"
              placeholder="Contoh: 2.800"
              placeholderTextColor="#94A3B8"
            />

            <View style={styles.wsModalActions}>
              <TouchableOpacity
                style={styles.wsCancelBtn}
                onPress={() => setShowAddWholesaleModal(false)}
              >
                <Text style={styles.wsCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.wsSaveBtn}
                onPress={() => {
                  const minQ = parseInt(wsMinQtyInput, 10);
                  const pr = parseRp(wsPriceInput);
                  if (!minQ || minQ <= 1) {
                    Alert.alert(
                      "Jumlah Salah",
                      "Jumlah minimum grosir harus lebih dari 1.",
                    );
                    return;
                  }
                  if (!pr || pr <= 0) {
                    Alert.alert("Harga Salah", "Masukkan harga grosir yang valid.");
                    return;
                  }
                  if (wholesaleRules.some((r) => r.min_qty === minQ)) {
                    Alert.alert(
                      "Duplikat",
                      `Aturan untuk minimal ${minQ} ${unit} sudah ada.`,
                    );
                    return;
                  }
                  setWholesaleRules([...wholesaleRules, { min_qty: minQ, price: pr }]);
                  setShowAddWholesaleModal(false);
                }}
              >
                <Text style={styles.wsSaveText}>Simpan Aturan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 8,
  },

  // Unit header row
  unitHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 8,
  },
  addUnitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  addUnitBtnText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700",
  },

  // Image
  imagePicker: {
    position: "relative",
    width: "100%",
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  productImage: { width: "100%", height: "100%" },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryContainer,
    gap: 8,
  },
  imagePlaceholderText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: "600",
  },
  removeImageBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },

  // Barcode row
  barcodeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 8,
  },
  iconBtn: {
    width: 52,
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
  },

  // Inputs
  input: { marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },

  marginPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
  },

  // Wholesale Styles
  wholesaleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 14,
  },
  wholesaleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  wholesaleTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: "#0F172A",
  },
  btnAddWholesale: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  btnAddWholesaleText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: "#0F172A",
  },
  wholesaleSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 10,
    lineHeight: 16,
  },
  wholesaleEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    paddingVertical: 4,
  },
  wholesaleList: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  wholesaleItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF2F7",
  },
  wholesaleMinQty: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#0F172A",
  },
  wholesalePriceText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.success,
    marginTop: 1,
  },
  btnDeleteWholesale: {
    padding: 6,
  },

  // Wholesale Modal
  wsModalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 20,
    width: "88%",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  wsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  wsModalTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: "#0F172A",
  },
  wsModalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: "#64748B",
    marginBottom: 12,
  },
  wsInputLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: "#475569",
    marginBottom: 6,
    marginTop: 6,
  },
  wsInput: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: "#0F172A",
  },
  wsModalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
  },
  wsCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    alignItems: "center",
  },
  wsCancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: "#64748B",
  },
  wsSaveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#0F172A",
    alignItems: "center",
  },
  wsSaveText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: "#FFFFFF",
  },
  marginText: { fontSize: 13, fontWeight: "600" },

  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  saveButton: { marginTop: 8, paddingVertical: 4 },

  // Unit pills
  unitPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  unitPillActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryContainer,
  },
  unitPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  unitPillTextActive: {
    color: colors.primary,
  },
  unitPillWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },

  // Unit Modal (Add / Edit)
  unitModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 24,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  unitModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 16,
  },
  unitModalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  unitModalActions: {
    flexDirection: "row",
    gap: 10,
  },
  unitModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
  },
  unitModalCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textSecondary,
  },
  unitModalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
  },
  unitModalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  unitEditHint: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  modalProductName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8,
  },
  modalPrice: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  printBtn: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 14,
    gap: 8,
  },
  printBtnText: { color: "#fff", fontWeight: "bold", fontSize: 15 },

  // Image Source Modal
  sourceModalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    marginHorizontal: 32,
    padding: 24,
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  sourceModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginBottom: 8,
  },
  sourceModalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  sourceOptionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    width: "100%",
    marginBottom: 24,
  },
  sourceOptionBtn: {
    alignItems: "center",
  },
  sourceIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  sourceOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  sourceCancelBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
  },
  sourceCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textSecondary,
  },
});

export default AddProductScreen;
