# Implementasi Aplikasi Android — Kasir & Stok Toko Kelontong
### Status: FINAL — Siap Eksekusi

---

## Ringkasan Keputusan (Decision Log)

| Topik | Keputusan |
|---|---|
| Framework | **Expo + EAS Build** (Custom Dev Client) |
| Bahasa | **JavaScript** |
| Database | **expo-sqlite** (bawaan Expo) |
| Barcode Scanner | **expo-camera + expo-barcode-scanner** |
| Bluetooth Printer | **react-native-bluetooth-escpos-printer** (via EAS custom build) |
| Export | **CSV saja** (via expo-file-system + expo-sharing) |
| Nama Toko | **Bisa diisi di Pengaturan** (default: "Toko Kelontong") |
| UI Library | **react-native-paper** (Material Design 3) |

---

## Tech Stack Lengkap

| Komponen | Library / Package |
|---|---|
| Framework | `expo` (SDK terbaru) |
| Bahasa | JavaScript |
| Custom Native Module | `expo-dev-client` (untuk EAS Build) |
| Database Lokal | `expo-sqlite` |
| Navigation | `@react-navigation/native` + `@react-navigation/bottom-tabs` + `@react-navigation/stack` |
| Barcode Scanner | `expo-camera` + `expo-barcode-scanner` |
| Bluetooth Printer | `react-native-bluetooth-escpos-printer` |
| File System | `expo-file-system` |
| Share Sheet | `expo-sharing` |
| State Management | React Context API + `useReducer` |
| UI Components | `react-native-paper` (Material 3) |
| Icons | `@expo/vector-icons` (sudah termasuk di Expo) |
| AsyncStorage (Settings) | `@react-native-async-storage/async-storage` |

> **Kenapa `expo-dev-client`?**
> Library `react-native-bluetooth-escpos-printer` membutuhkan native Android code.
> Dengan `expo-dev-client`, kita build **custom Expo app** yang bisa menjalankan native module
> tersebut — tanpa harus lepas dari ekosistem Expo.

---

## Struktur Folder Proyek

```
c:\rafi\Aplikasi Android Offline\TokoKelontong\
│
├── app.json                        ← Konfigurasi Expo (nama app, icon, permissions)
├── eas.json                        ← Konfigurasi EAS Build (profile: development, preview, production)
├── package.json                    ← Semua dependencies
├── babel.config.js
├── App.js                          ← Entry point utama
│
└── src/
    ├── database/
    │   ├── db.js                   ← Init SQLite, buat 3 tabel, index barcode
    │   ├── productRepository.js    ← CRUD tabel products
    │   └── transactionRepository.js← CRUD tabel transactions + transaction_details
    │
    ├── screens/
    │   ├── DashboardScreen.js      ← Omzet harian/bulanan + reminder ekspor
    │   ├── KasirScreen.js          ← UI kasir + keranjang + kalkulator
    │   ├── GudangScreen.js         ← List produk + low stock alert
    │   ├── AddProductScreen.js     ← Form tambah/edit produk + scan barcode
    │   ├── LaporanScreen.js        ← Riwayat transaksi, filter harian/bulanan
    │   └── PengaturanScreen.js     ← Nama toko, ekspor CSV, info app
    │
    ├── components/
    │   ├── BarcodeScanner.js       ← Komponen kamera scanner (reusable)
    │   ├── CartItem.js             ← Baris item di keranjang kasir
    │   ├── ProductCard.js          ← Card produk di halaman gudang
    │   └── LowStockBadge.js        ← Badge warna merah/kuning stok menipis
    │
    ├── utils/
    │   ├── bluetoothPrinter.js     ← Connect printer + format & cetak struk ESC/POS
    │   ├── exportCSV.js            ← Generate file CSV + share via expo-sharing
    │   └── helpers.js              ← Format tanggal, nomor invoice (INV/YYYYMMDD/XXXX), dll
    │
    ├── context/
    │   └── AppContext.js           ← Global state: cart items, nama toko dari settings
    │
    ├── navigation/
    │   └── AppNavigator.js         ← Bottom Tab 5 menu + Stack Navigator per modul
    │
    └── theme/
        └── colors.js               ← Palet warna dark mode + konstanta UI
```

---

## Detail Per Epic

---

### EPIC 1 — Database & Setup Proyek

**Tujuan:** Proyek bisa dijalankan di emulator/HP, database terbentuk tanpa error.

#### `app.json` — Permissions yang diminta:
- `CAMERA` (barcode scanner)
- `BLUETOOTH` + `BLUETOOTH_CONNECT` + `BLUETOOTH_SCAN` (printer)
- `WRITE_EXTERNAL_STORAGE` (export CSV)

#### `eas.json` — 3 Build Profile:
- `"development"` → untuk testing dengan expo-dev-client
- `"preview"` → internal APK testing
- `"production"` → APK final untuk toko

#### `src/database/db.js`
- Buka koneksi SQLite dengan nama file `toko_kelontong.db`
- Buat 3 tabel dengan `CREATE TABLE IF NOT EXISTS`:

```
Tabel: products
  - id               INTEGER PRIMARY KEY AUTOINCREMENT
  - barcode          TEXT UNIQUE (INDEX)
  - product_name     TEXT
  - capital_price    INTEGER
  - selling_price    INTEGER
  - stock_quantity   INTEGER
  - min_stock_threshold INTEGER DEFAULT 5

Tabel: transactions
  - id               INTEGER PRIMARY KEY AUTOINCREMENT
  - invoice_number   TEXT UNIQUE
  - total_price      INTEGER
  - discount_amount  INTEGER DEFAULT 0
  - grand_total      INTEGER
  - cash_received    INTEGER
  - cash_return      INTEGER
  - created_at       DATETIME DEFAULT CURRENT_TIMESTAMP

Tabel: transaction_details
  - id               INTEGER PRIMARY KEY AUTOINCREMENT
  - transaction_id   INTEGER FK → transactions.id
  - product_id       INTEGER FK → products.id
  - quantity         INTEGER
  - price_at_sale    INTEGER   ← snapshot harga jual saat itu
  - capital_at_sale  INTEGER   ← snapshot harga modal saat itu
```

#### `src/database/productRepository.js`

| Fungsi | Keterangan |
|---|---|
| `getAllProducts()` | Ambil semua produk, urutkan A-Z |
| `getProductByBarcode(barcode)` | Cari via barcode (< 100ms karena indexed) |
| `searchProductByName(keyword)` | LIKE query untuk pencarian di kasir |
| `getLowStockProducts()` | WHERE stock_quantity <= min_stock_threshold |
| `addProduct(data)` | INSERT + handle error barcode duplikat |
| `updateProduct(id, data)` | UPDATE data/stok produk |
| `deleteProduct(id)` | DELETE produk |

#### `src/database/transactionRepository.js`

| Fungsi | Keterangan |
|---|---|
| `createTransaction(nota, items[])` | SQLite Transaction atomic: INSERT transactions + INSERT transaction_details (loop per item) + UPDATE stock_quantity per produk |
| `getTransactionsByDate(date)` | Filter transaksi harian |
| `getMonthlyTransactions(year, month)` | Filter transaksi bulanan |
| `getFullReportForExport()` | JOIN 3 tabel untuk generate CSV |

---

### EPIC 2 — Theme & Navigation

#### `src/theme/colors.js`
- Dark mode dengan aksen **hijau emerald** `#10B981`
- Low stock danger: merah `#EF4444`, kuning `#F59E0B`
- Background: `#111827`, Surface card: `#1F2937`

#### `src/navigation/AppNavigator.js`
```
Bottom Tab Navigator (5 Tab):
  ├── Dashboard   (icon: home)
  ├── Kasir       (icon: shopping-cart)  ← default aktif
  ├── Gudang      (icon: archive)
  ├── Laporan     (icon: bar-chart)
  └── Pengaturan  (icon: settings)

Stack Navigator:
  ├── Gudang Stack → GudangScreen → AddProductScreen
  └── Kasir Stack  → KasirScreen → (modal BarcodeScanner)
```

---

### EPIC 3 — Modul Gudang (Manajemen Stok)

#### `GudangScreen.js`
- Search bar untuk filter nama produk
- FlatList dengan `ProductCard` per produk
- Badge **merah** jika stok ≤ `min_stock_threshold`
- Badge **kuning** jika stok ≤ 2x `min_stock_threshold`
- FAB `+` di pojok kanan bawah → ke `AddProductScreen`
- Pull-to-refresh untuk reload dari SQLite

#### `AddProductScreen.js`
- Form: Nama Produk, Barcode, Harga Modal (Rp), Harga Jual (Rp), Stok Awal, Batas Min Stok
- Tombol kamera di field Barcode → buka `BarcodeScanner`
- Validasi: semua wajib diisi, angka tidak boleh negatif
- Jika barcode duplikat → pop-up: *"Barcode sudah terdaftar untuk [Nama]. Tambah stok saja?"*
- Mode Edit: data pre-filled dari `ProductCard`

#### `BarcodeScanner.js`
- Full-screen modal kamera dengan frame pemandu
- Auto-close + return nilai barcode setelah terdeteksi

---

### EPIC 4 — Modul Kasir (POS)

#### `KasirScreen.js`
- **Atas**: Search bar nama produk + tombol kamera barcode
- **Tengah**: FlatList keranjang belanja (`CartItem` per baris)
- **Bawah (sticky footer)**:
  - Subtotal Rp XX.XXX
  - Input Diskon (Rp, opsional)
  - Grand Total Rp XX.XXX
  - Input Uang Diterima → Kembalian terhitung otomatis
  - Tombol `SELESAI & BAYAR` (disabled jika keranjang kosong)
- Flow setelah "SELESAI & BAYAR":
  1. `createTransaction()` → atomic SQLite transaction
  2. Berhasil → dialog: *"Cetak Struk?"*
  3. "Ya" → `bluetoothPrinter.printReceipt(data)`
  4. Keranjang dikosongkan

#### `src/utils/bluetoothPrinter.js`
- `scanDevices()` → cari printer Bluetooth terdekat
- `connectPrinter(deviceAddress)` → simpan address ke AsyncStorage
- `printReceipt(data)` → cetak struk format ESC/POS:

```
================================
       TOKO KELONTONG
================================
Tgl: 23-07-2026     Jam: 14:30
No : INV/20260723/0001
--------------------------------
Indomie Goreng         x2
  Rp 3.500       Rp 7.000
--------------------------------
Total:          Rp  7.000
Diskon:         Rp      0
Bayar:          Rp 10.000
Kembalian:      Rp  3.000
================================
      Terima Kasih! :)
================================
```

---

### EPIC 5 — Laporan & Ekspor Data

#### `DashboardScreen.js`
- **3 Card ringkasan**:
  - Omzet Hari Ini
  - Keuntungan Bersih Hari Ini (price_at_sale - capital_at_sale)
  - Omzet Bulan Ini
- **Banner reminder ekspor** (oranye): *"Terakhir diekspor: 3 hari lalu. Jangan lupa backup!"*
- **Card stok menipis**: jumlah produk yang perlu diisi ulang

#### `LaporanScreen.js`
- Toggle: Harian | Bulanan
- Date picker untuk pilih tanggal/bulan
- FlatList riwayat nota (No Invoice, Grand Total, Waktu)
- Tap nota → tampilkan detail item yang dibeli

#### `PengaturanScreen.js`
- Input nama toko → disimpan ke `AsyncStorage`
- Tombol **"Pilih Printer Bluetooth"** → scan & pair perangkat
- Tombol besar **"EKSPOR DATA (.CSV)"**:
  1. `getFullReportForExport()` → query JOIN semua data
  2. Generate string CSV
  3. Simpan ke `expo-file-system` DocumentDirectory
  4. `expo-sharing` → Native Share Sheet (WhatsApp, Gmail, Drive, dll)
  5. Simpan timestamp ekspor ke `AsyncStorage`

#### `src/utils/exportCSV.js`
Format kolom file CSV:
```
Tanggal, No Nota, Nama Barang, Qty, Harga Modal, Harga Jual, Total Penjualan, Keuntungan
2026-07-23, INV/20260723/0001, Indomie Goreng, 2, 2500, 3500, 7000, 2000
```
Nama file: `Laporan_Toko_20260723.csv`

---

## Alur Setup & Eksekusi (Langkah Demi Langkah)

```bash
# 1. Buat proyek Expo baru
npx create-expo-app@latest TokoKelontong
cd TokoKelontong

# 2. Install semua dependencies
npm install expo-sqlite expo-camera expo-barcode-scanner expo-file-system expo-sharing
npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/stack
npm install react-native-paper @react-native-async-storage/async-storage
npm install react-native-bluetooth-escpos-printer
npm install expo-dev-client

# 3. Konfigurasi EAS
eas login
eas build:configure

# 4. Buat semua file src/ (database, screens, utils, dll)

# 5. Build APK development ke HP
eas build --profile development --platform android

# 6. Install APK di HP, lalu jalankan:
npx expo start --dev-client
```

---

## Verification Plan

| Test | Cara Verifikasi |
|---|---|
| ✅ Database terbentuk | Buka app → tidak ada error crash |
| ✅ Tambah produk | Input form + scan barcode → produk muncul di list |
| ✅ Low stock alert | Set stok = 2, min = 5 → badge merah muncul |
| ✅ Transaksi kasir | Checkout → stok berkurang → dialog cetak struk muncul |
| ✅ Cetak struk | Connect printer Bluetooth → struk tercetak |
| ✅ Laporan harian | Dashboard menampilkan omzet hari ini |
| ✅ Ekspor CSV | File CSV ter-generate + bisa di-share ke WhatsApp |

---

## Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| EAS Build pertama lambat (~15 menit) | Normal, hanya sekali. Selanjutnya incremental |
| Bluetooth tidak connect ke printer | Tambah fitur input MAC address printer manual di Pengaturan |
| HP lama tidak support `expo-barcode-scanner` | Fallback: input barcode manual via keyboard |
| File CSV gagal di-share | Pastikan permission WRITE_EXTERNAL_STORAGE di `app.json` |
| Barcode duplikat dari pabrik | Dialog konfirmasi "tambah stok saja?" sudah disiapkan |
