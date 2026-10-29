# Diagnosa Bug & Kekurangan — MarketPos / TokoKelontong

> Tanggal: 2026-10-14
> Sumber: `App.js`, `app.json`, `package.json`, `eas.json`, `src/**/*`
> Sifat: read-only diagnosis, tidak mengubah logika aplikasi.

## 1. Ringkasan

Aplikasi POS single-toko multi-HP, backend pure-online Supabase. Klaim UI masih menyebut "100% Offline", padahal tidak ada SQLite, queue offline, maupun backup lokal.

Prioritas:
- P0: crash / data loss / transaksi salah.
- P1: logika salah / UX menipu.
- P2: tech-debt / build / keamanan.

---

## 2. P0 — Kritis

### 2.1 Klaim offline palsu, kasir mati tanpa internet
- `src/screens/HomeScreen.js:371`, `src/screens/PanduanScreen.js:75,201,226`: "100% Pure Offline", "Backup .json".
- Realita: semua baca/tulis via Supabase. Tidak ada `NetInfo`, banner offline, retry, SQLite di `src/database/`.
- Dampak: internet mati = tidak bisa jualan.

### 2.2 Crash edit produk bila field null
- `src/screens/AddProductScreen.js:318-321`:
  - `existingProduct.capital_price.toLocaleString()` crash jika null.
  - `existingProduct.min_stock_threshold.toString()` crash jika null.
- Satu row null = form edit tidak bisa dibuka.

### 2.3 Filter crash bila `product_name` null
- `src/screens/KasirScreen.js:119`, `src/screens/GudangScreen.js:69`: `p.product_name.toLowerCase()` tanpa guard.

### 2.4 Update bisa duplikat barcode
- `src/database/productRepository.js:71-92` cek duplikat hanya di `addProduct`.
- `src/database/productRepository.js:131-161` `updateProduct` tidak cek. Edit bisa kena UNIQUE violation mentah.

### 2.5 Hapus produk berisiko rusak histori
- `src/database/productRepository.js:166-174` hapus tanpa cek `transaction_details`.
- Jika FK `CASCADE`: laba histori hilang. Jika `RESTRICT`: error mentah. Perlu soft-delete / block.

### 2.6 HTML injection di nota & label
- `src/utils/receiptGenerator.js:69,193-195`, `src/screens/AddProductScreen.js:519,527`: `product_name`, `storeName`, `barcode` disuntik langsung ke HTML/SVG tanpa escape.

### 2.7 Transaksi Rp 0 lolos
- `src/screens/KasirScreen.js:248-267`: `diskon == total` -> `grandTotal=0`, `cash=0` lolos `cash>=grand`. Membuat row nol.

### 2.8 Nota hilang dekat tengah malam
- `src/screens/KasirScreen.js:277-281`: pasca-`checkout` cari nota via `getTransactionsByDate(todayStr)` jam HP, sedangkan `created_at` UTC (`src/database/transactionRepository.js:6-23`).
- Skew / beda zona = `fullTx` null, fallback Alert generik tanpa No.Nota dan tanpa tombol cetak.

---

## 3. P1 — Fungsional / UX

### 3.1 Deteksi stok menipis inkonsisten
- Tanpa fallback: `src/screens/KasirScreen.js:481`, `src/components/ProductCard.js:10`: `stock <= min_stock_threshold`.
- Dengan fallback `||5`: `src/screens/GudangScreen.js:75`, `src/database/productRepository.js:64`.
- Produk dengan threshold null tidak pernah flag di Kasir.

### 3.2 Stok opname tidak mungkin
- `src/screens/AddProductScreen.js:650-657`: edit selalu delta `latest + (input-old)`. Tidak ada mode set absolut.

### 3.3 Ekspor CSV selalu full
- `src/screens/LaporanScreen.js:161-183`: abaikan tab Harian/Bulanan, tetap `getFullReportForExport()`. Nama file pakai tanggal filter, isi semua histori.

### 3.4 Klaim realtime palsu
- `src/screens/AuthScreen.js:274`, `src/screens/PengaturanScreen.js:491`: "Sinkronisasi Realtime".
- Tidak ada `supabase.channel().subscribe()`. Hanya `useFocusEffect` refetch. 2 HP lihat stok basi. Aman dari oversell karena RPC `checkout`, tapi UX basi.

### 3.5 Cart pakai stok basi
- `src/context/AppContext.js:15-27` snapshot `stock_quantity` saat add.
- `src/screens/KasirScreen.js:196-197` fallback ke `cartItem.stock_quantity`. Tolak baru ketahuan saat bayar.

### 3.6 Dashboard fetch 2x
- `src/screens/DashboardScreen.js:68-71`: `getAllProducts()` + `getLowStockProducts()` yang isinya `getAllProducts()` lagi.

### 3.7 Tanpa pagination
- `src/database/productRepository.js:23-30`, `src/database/transactionRepository.js:98-104,154-162`: full table tiap fokus. Ribu SKU / belas ribu nota = timeout / OOM.

### 3.8 Panduan usang
- `src/screens/PanduanScreen.js:123-126,199-220`: grafik terlaris, filter tahun, backup/restore JSON, "agregasi SQL" tidak ada implementasinya.

### 3.9 Logo tidak dipakai di nota
- Upload di `src/screens/PengaturanScreen.js:287` ke `product-images/logos`, tapi `src/utils/receiptGenerator.js` tidak render logo. Replace/hapus tidak hapus object lama = orphan.

### 3.10 WA selalu "pcs"
- `src/utils/receiptGenerator.js:21`: `${quantity} pcs` hardcode, abaikan `unit`.

---

## 4. P2 — Build / Keamanan / Kualitas

### 4.1 Expo 54 vs AGENTS wajib v57
- `package.json:15`: `expo ^54.0.36`. `AGENTS.md:3` wajib docs v57.
- `src/utils/exportCSV.js:54`, `src/utils/imageStorage.js:1` pakai `expo-file-system/legacy`. Upgrade perlu uji `CameraView`, `FileSystem`, patch di `patches/`, `plugins/`.

### 4.2 Plugin & permission
- `app.json:32-42,47-63`: `expo-sqlite` masih ada padahal SQLite dibuang. `RECORD_AUDIO`, `WRITE/READ_EXTERNAL_STORAGE` tidak perlu. `CAMERA` duplikat.
- `app.json:6-11`: `runtimeVersion:1.0.0` hardcoded + `checkOnLaunch:always, fallbackToCacheTimeout:0` = start lambat offline, risiko OTA native mismatch (Bluetooth).
- `eas.json:11-17`: `preview` dan `apk` satu `channel production`.

### 4.3 Kunci Supabase di repo
- `src/config/supabaseConfig.js:9-12`: URL + anon key hardcode. Fungsional karena RLS, tapi harusnya via env/`extra`.

### 4.4 Duplikasi sumber storeName
- `AsyncStorage storeName` + `@TokoKelontong:StoreProfile` + `stores.store_name` + `AppContext`.
- `src/screens/PengaturanScreen.js:89-93` overwrite input dari profile telat. `src/screens/SettingNotaScreen.js:81-96` hanya sinkron nama.

### 4.5 Dead code / style salah
- Modal kategori Kasir `src/screens/KasirScreen.js:680-799` tidak pernah dibuka. `greetingText/Emoji` `HomeScreen.js:60-70`, `ScreenHeader.js`, `pendingSource` tidak dipakai.
- `src/components/ProductCard.js:81,97`: `theme.colors.textSecondary` tidak ada di merge `App.js:18-29` = undefined.

### 4.6 Auth fragile
- `src/services/authService.js:25-39`: `ensureProfile` tangkap semua error lalu `register_store`, cek `already_registered` via substring.
- `src/services/authService.js:82-88`: verifikasi password lama via `signInWithPassword`, gagal network dikira `wrong_password`. Tanpa lupa password.
- `src/context/AuthContext.js:20-34`: retry 4x tanpa cancel, gagal diam-diam profile null.

---

## 5. Saran Perbaikan Berurutan

1. Putuskan arsitektur: tetap online (hapus klaim offline + banner offline) atau kembalikan queue offline.
2. P0: guard null, cek barcode saat update, block hapus ber-FK, escape HTML, tolak grandTotal 0, kembalikan nota penuh dari RPC (jangan query ulang by-date).
3. P1: samakan threshold fallback, mode opname absolut, ekspor ikut filter, pagination, realtime/polling 2 HP.
4. P2: bersih `app.json`, env key, channel EAS, hapus dead code, tambah error boundary + crash report.
