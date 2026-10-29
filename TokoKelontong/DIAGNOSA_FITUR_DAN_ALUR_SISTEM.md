# DIAGNOSA FITUR DAN ALUR SISTEM — MarketPos / TokoKelontong

> Dokumen read-only. Tidak ada kode yang diubah untuk membuat dokumen ini.
> Sumber: `prd.md`, `userFlow.md`, `databasePlaning.md`, `implementationPlan.md`, `taskBreackDown.md`, `supabaseMigrationPlan.md`, `supabase/*.sql`, `TokoKelontong/package.json`, `app.json`, `App.js`, `src/**/*`.
> Tanggal diagnosa: 2026-09-29. Lokasi file: `TokoKelontong/DIAGNOSA_FITUR_DAN_ALUR_SISTEM.md`.

---

## 1. Ringkasan Eksekutif

Aplikasi ini adalah **POS + Stok Gudang untuk toko kelontong single-toko, multi-HP (2 HP dalam 1 toko)** dengan nama app `MARKETPOS` (`slug: marketpos`, package `com.rafi.marketpos`).

Evolusi arsitektur penting untuk dipahami:

| Fase | Keputusan | Status kode saat ini |
|---|---|---|
| PRD MVP awal | Offline-first: SQLite lokal (`expo-sqlite`) = source of truth, cloud hanya backup | **Ditinggalkan** |
| UserFlow revisi | 100% local-first + ekspor CSV manual via Share Sheet, sync dihapus | **Ditinggalkan sebagian** (ekspor CSV dipertahankan, SQLite dibuang) |
| Migrasi Supabase (`supabaseMigrationPlan.md`) | Pure online: buang SQLite total, Supabase = satu-satunya sumber data agar 2 HP realtime tanpa bentrok | **Inilah yang terimplementasi** |

Implikasi praktis:

- Semua baca/tulis produk dan transaksi lewat Supabase (Postgres + Auth + Storage). Tidak ada `db.js` / SQLite di `src/database/` saat ini — hanya `productRepository.js` dan `transactionRepository.js` versi Supabase.
- Stok dikurangi **atomik di server** via RPC `checkout` (anti double-sell 2 kasir jual barang terakhir bersamaan).
- Yang tetap lokal per-HP (`AsyncStorage`): nama toko cache, logo, MAC printer, profil nota (`@TokoKelontong:StoreProfile`), satuan/kategori custom, sesi auth (via Supabase persist).
- Cetak struk: 3 jalur — (1) Bluetooth thermal ESC/POS langsung (Android + APK/dev-build saja), (2) PDF via `expo-print`, (3) pesan WA via `Linking` + `generateWAMessage`.
- Backup lokal / JSON offline sudah dihapus (sesuai migration plan). Ekspor CSV dipertahankan dengan sumber data cloud.

---

## 2. Tech Stack Aktual

Dari `package.json` + `app.json`:

- Framework: `expo@^54.0.36`, React `19.1.0`, React Native `0.81.5`
- Bahasa: JavaScript (bukan TypeScript, bukan Kotlin/Room seperti disarankan `taskBreackDown.md`)
- Backend: `@supabase/supabase-js@^2.112.3` (URL + anon key di `src/config/supabaseConfig.js`)
- DB lokal: tidak dipakai lagi (dahulu `expo-sqlite`, plugin masih tercantum di `app.json` tapi tidak ada `db.js`)
- Navigasi: `@react-navigation/native@7` + `stack@7` saja (rencana Bottom Tab 5 menu di `implementationPlan.md` **tidak dipakai** — diganti Stack + Home bento)
- UI: `react-native-paper@5` (Material), `@expo/vector-icons`, font Inter (`@expo-google-fonts/inter`), `react-native-safe-area-context`, `screens`, `gesture-handler`
- Kamera/scanner: `expo-camera@~17.0.10` (`CameraView.onBarcodeScanned`)
- Foto produk/logo: `expo-image-picker@~17.0.11` + upload ke Supabase Storage via `expo-file-system/legacy` (`uploadAsync`, bukan `fetch->blob`)
- Cetak/share: `expo-print@~15`, `expo-sharing@~14`, `expo-file-system@~19`, `react-native-bluetooth-escpos-printer@^0.0.5` (lazy require, hanya Android native)
- Settings: `@react-native-async-storage/async-storage@2.2.0`
- Barcode render: `jsbarcode@^3.12.3` (khusus `CODE128` via `src/utils/barcode128.js`)
- Update OTA: `expo-updates@~29` + `expo-constants`, EAS `projectId: b3b55795-dbed-43c2-94a6-728f7ac0a817`, `runtimeVersion: 1.0.0`
- Entry: `index.js` -> `App.js` -> providers `SafeAreaProvider > AuthProvider > AppProvider > PaperProvider > NavigationContainer > AppNavigator`

> Catatan `AGENTS.md`: mewajibkan baca docs Expo v57 sebelum menulis kode. Kode saat ini memakai Expo 54 — relevan jika upgrade.

---

## 3. Struktur Folder Aktual

```
TokoKelontong/
  App.js, app.json, eas.json, package.json
  src/
    config/supabaseConfig.js        # URL + ANON_KEY
    services/supabaseClient.js      # singleton createClient + AsyncStorage persist
    services/authService.js         # signUp/signIn/signOut/profile/store-name/password
    database/productRepository.js   # CRUD products (Supabase)
    database/transactionRepository.js # checkout RPC + laporan + ekspor
    context/AuthContext.js          # session + profile + ready
    context/AppContext.js           # cart + storeName/logo/printerAddress (lokal)
    navigation/AppNavigator.js      # Stack + auth gate
    screens/AuthScreen.js
    screens/HomeScreen.js           # hub bento, default setelah login
    screens/DashboardScreen.js
    screens/KasirScreen.js          # POS paling kompleks
    screens/GudangScreen.js
    screens/AddProductScreen.js     # tambah/edit + foto + label barcode
    screens/BarcodeScannerScreen.js # modal kamera reusable
    screens/LaporanScreen.js
    screens/PengaturanScreen.js
    screens/SettingNotaScreen.js
    screens/PanduanScreen.js        # statis edukasi
    components/ProductCard.js, ScreenHeader.js
    utils/helpers.js, exportCSV.js, bluetoothPrinter.js,
          receiptGenerator.js, barcode128.js, imageStorage.js
    theme/colors.js                 # slate monochrome + Inter fonts
supabase/
  schema.sql, migration_v2_product_fields.sql,
  migration_v3_storage.sql, migration_v4_invoice_date_wib.sql
```

---

## 4. Arsitektur Data Cloud

### 4.1 Tabel (Supabase Postgres)

1. `stores`: `id (uuid PK)`, `store_name`, `created_at`
2. `profiles`: `id (= auth.users.id PK)`, `username`, `role` (saat ini hanya `kasir`), `store_id (FK stores)`
3. `products`: `id (uuid PK)`, `store_id (FK)`, `barcode (unique per toko, di-validasi di app)`, `product_name`, `capital_price`, `selling_price`, `stock_quantity`, `min_stock_threshold (default 5)`, `image_uri`, `unit (default pack)`, `category (default makanan)`, `created_at`, `updated_at`
4. `transactions`: `id (uuid PK)`, `store_id (FK)`, `invoice_number (unique, format INV/YYYYMMDD/XXXX per toko per hari, dibuat di server)`, `total_price`, `discount_amount`, `grand_total`, `cash_received`, `cash_return`, `created_at (UTC)`
5. `transaction_details`: `id (uuid PK)`, `transaction_id (FK)`, `product_id (FK)`, `product_name (snapshot)`, `quantity`, `price_at_sale (snapshot jual)`, `capital_at_sale (snapshot modal)`

Snapshot `price/capital_at_sale` + `product_name` penting: harga produk boleh naik, riwayat laba masa lalu tidak ikut berubah.

### 4.2 RPC / Fungsi Server

- `current_store_id()` -> `store_id` milik user login. Dipakai `ProductRepository.getStoreId()` (dengan cache per-user) dan `updateStoreName`.
- `register_store(p_username, p_store_name)` -> buat `stores` + `profiles(role kasir)`. Idempoten, error `already_registered` diabaikan (self-heal akun setengah terdaftar).
- `checkout(p_items[{product_id, product_name, quantity, price_at_sale, capital_at_sale}], p_total_price, p_discount_amount, p_grand_total, p_cash_received, p_cash_return)` -> validasi stok + lock baris + kurangi stok atomik + buat nota unik + insert header+detail. Error `insufficient_stock` diterjemahkan di `transactionRepository.js` menjadi pesan ramah.

### 4.3 RLS & Isolasi Toko

- Semua tabel difilter per `store_id` via RLS. `getAllProducts()` tidak filter eksplisit `store_id` di client — mengandalkan RLS.
- Model akun: **1 toko = 1 akun**, akun yang sama dipakai di semua HP toko itu (sesuai migration plan). Username dipetakan ke email internal `username@marketpos.app` (`toAuthEmail`).

### 4.4 Storage

- Bucket publik `product-images` (lihat `migration_v3_storage.sql`). Upload via `uploadProductImage(localUri, folder)` di `src/utils/imageStorage.js`: cek `FileSystem.getInfoAsync`, deteksi ekstensi, nama `folder/Date.now()-random.ext`, `uploadAsync` dengan header `apikey + Bearer access_token`, lalu `getPublicUrl`. Hasil disimpan ke `products.image_uri` / logo toko.

---

## 5. Auth & Sesi

File: `src/services/authService.js`, `src/context/AuthContext.js`, `src/screens/AuthScreen.js`.

- `AuthScreen` punya 2 mode: `Masuk` dan `Daftar Toko`. Validasi lokal: username lowercase regex `^[a-z0-9_.]+$` min 3, password min 6, `storeName` wajib saat register. Tidak ada `navigate` eksplisit — pindah ke `Home` otomatis via auth gate saat `session` muncul.
- `signUp({username,password,storeName})`: `auth.signUp({email,password})` -> throw `email_confirmation_still_on` jika `!data.session` (artinya Confirm Email masih ON di dashboard) -> `ensureProfile`.
- `signIn({username,password})`: `signInWithPassword` + `ensureProfile(username,"")` (self-heal).
- `AuthContext`: `session, profile, ready, refreshProfile`. `loadProfile` retry 4x @800ms panggil `getProfile()` (`profiles + join stores(id,store_name)`) untuk atasi race `register_store`. Listen `onAuthStateChange`.
- `changePassword(current,new)`: ambil username dari profile -> `signInWithPassword` verifikasi (throw `wrong_password` jika gagal) -> `auth.updateUser({password:new})`.
- `updateStoreName`: via `current_store_id` + update `stores`. Berlaku untuk semua HP toko yang sama.
- Lupa password: **reset manual oleh developer** via dashboard Supabase (tidak ada fitur self-reset).
- Sesi persist di `AsyncStorage` (`persistSession:true, autoRefreshToken:true`).

---

## 6. State Global (Client-Only)

File: `src/context/AppContext.js` — diverifikasi langsung.

```js
initialState = { cart: [], storeName: 'MarketPos', storeLogo: null, printerAddress: null }
```

- Reducer: `ADD_TO_CART` (match `product_id`, `quantity+1` atau push `{...payload,quantity:1}`), `REMOVE_FROM_CART`, `UPDATE_CART_QTY`, `CLEAR_CART`, `SET_STORE_NAME/LOGO/PRINTER_ADDRESS`, `LOAD_SETTINGS`.
- Saat mount: load 3 key `storeName, storeLogo, printerAddress` dari `AsyncStorage` -> `LOAD_SETTINGS`.
- Cart **tidak persist** — hilang saat restart. Sengaja tidak direset saat blur `KasirScreen` agar kembali dari scanner tidak hilang.
- Item cart diasumsikan punya `product_id` (bukan `id`).

---

## 7. Navigasi

File: `src/navigation/AppNavigator.js` — diverifikasi langsung. Pola **Stack tunggal**, bukan Bottom Tab.

- Jika `!ready`: splash blank. Jika `!session`: hanya route `Auth` (`headerShown:false`).
- Jika login: `Home` (default, `headerShown:false`), `Dashboard`, `Kasir` (title Kasir POS), `Gudang`, `AddProductScreen` (Form Barang), `SettingNota`, `Laporan`, `Pengaturan`, `Panduan`, `BarcodeScanner` (`headerShown:false, presentation:modal`).
- Header default: putih, title kiri bold 17, border bawah `#F1F5F9`.

---

## 8. Fitur Per Layar (Alur Detail)

### 8.1 `AuthScreen` — Gerbang Wajib Login

- State: `mode, username, password, storeName, showPassword, loading, error`.
- Butuh internet (pure online). Error difriendly-kan (`invalid login credentials`, `username_taken`, `already_registered`, `at least 6`, `email_confirmation_still_on`, `signups disabled`, `failed to fetch`).

### 8.2 `HomeScreen` — Hub Utama

- State: `hideBalance`, `todaySummary{omzet,laba,count}`. `useFocusEffect` -> `getSummaryByDatePattern(YYYY-MM-DD hari ini)`.
- Aksi: eye toggle mask `Rp ••••••`, hero `Buka Kasir` -> `Kasir`, bento `Dashboard/Gudang/Laporan/Format Nota`, list `Pengaturan Toko` -> `Pengaturan`, `Buku Panduan` -> `Panduan`.

### 8.3 `DashboardScreen` — Analitik Omzet/Laba

- State: `filterMode:daily|monthly|all`, `selectedDay/Month/Year`, `summary{omzet,laba,count}`, `lowStockProducts[]`, `totalProducts`.
- Load: `getAllProducts` -> total, `getLowStockProducts` (filter client `stock <= min||5`, sort stok ASC) -> peringatan, bangun `pattern` (`daily=YYYY-MM-DD` clamp maxDay, `monthly=YYYY-MM`, `all=""`) -> `getSummaryByDatePattern(pattern)`.
- Agregasi di `transactionRepository.getSummaryByDatePattern`: query `grand_total + details(quantity,price_at_sale,capital_at_sale)`, hitung `omzet+=grand_total`, `modal+=qty*capital_at_sale`, `laba+=grand_total-modal`.
- Aksi: chip `Hari Ini/Bulanan/Semua`, modal filter (tab tanggal/bulan/semua + picker tahun 2024..tahun+1 + grid bulan + tanggal horizontal + `Terapkan`), tap StatCard -> `navigate("Laporan",{initialFilter,dateFilter})`, tap produk menipis -> `AddProductScreen({product})`.

### 8.4 `KasirScreen` — POS (Terenkompleks)

- State: `allProducts[], categories[Semua,...], selectedCategory, searchQuery, showCartModal/showSuccessModal, cashInput/discountInput (string Rp), lastTx/lastTxDetails[], submitting, storeProfile{}, btPrinterReady`. Cart dari `AppContext`.
- Load (`useFocusEffect`): `getAllProducts` + derive kategori unik, cek `isBluetoothPrintingSupported()+isPrinterConfigured()`.
- Input produk: search nama/barcode + tombol `barcode-scan` -> `navigate("BarcodeScanner",{onBarcodeScanned: code->getProductByBarcode->addToCart atau Alert tidak ditemukan})`. Web: Alert tidak tersedia.
- Grid 2 kolom (3 jika tablet): tap -> `addToCart` cek `stock<=0` / `qtyCart>=stock`. Badge qty, tombol `- / +` cek stok. Stok habis: disabled opacity 0.5.
- Floating cart -> modal keranjang: list + qty control + hapus (`CLEAR_CART` confirm), `total=sum`, `diskon=min(parse(discount),total)`, `grandTotal`, `cash=parse(cashInput)`, `kembalian=cash-grandTotal`. Quick `Uang Pas/50rb/100rb`.
- `SELESAIKAN TRANSAKSI` (disabled jika `cash<grandTotal||submitting`) -> `handleBayar`:
  1. `createTransaction(cart,total,diskon,grand,cash,kembalian)` -> `txId` (RPC `checkout`)
  2. Langsung `CLEAR_CART+close+clear input` cegah double-save
  3. `getTransactionsByDate(today)->find txId`, `getStoreProfile()` dari `AsyncStorage @TokoKelontong:StoreProfile`, `getTransactionDetails(txId)` -> modal sukses pratinjau struk thermal
  4. `loadProducts()` refresh stok
- Modal sukses: `Cetak` (`generateReceiptHTML+Print.printAsync`), `Kirim WA` (`generateWAMessage+Linking whatsapp://send`, fallback PDF share), `Cetak Langsung (Bluetooth)` jika `btPrinterReady && android` (`printReceiptViaBluetooth`), `Tutup`.

### 8.5 `GudangScreen` — Manajemen Stok

- State: `searchQuery, products[], categories[], selectedCategory, showCategoryModal, stockFilter:all|low|out`.
- Load: `fetchProducts()=getAllProducts()` di `useFocusEffect`, reset filter saat blur.
- Filter display: `matchCat + matchSearch(nama/barcode) + matchStock(low:0<stok<=min||5, out:stok<=0)`. InfoBar `Total/Menipis/Habis` bisa diklik toggle filter.
- Aksi: search + clear, pill kategori (5 pertama) + modal grid full, `FlatList ProductCard onEdit->AddProductScreen({product})`, `onDelete->confirm->deleteProduct->fetchProducts`, FAB `TAMBAH BARANG` -> `AddProductScreen` mode tambah.

### 8.6 `AddProductScreen` — Form Barang (Tambah/Edit)

- Mode ganda via `route.params.product`. Form: `barcode, productName, capitalPrice/sellingPrice (string Rp locale), stockQuantity, minStock(5), imageUri, unit(pack), category(makanan)`.
- Satuan/kategori custom: list + modal add/edit, key `product_units:storeId` / `product_categories:storeId` (+migrasi key lama global), validasi duplikat lowercase, min 1 item. Tap pilih, long-press edit/hapus.
- Foto: tap -> `Alert Galeri/Kamera -> expo-image-picker (allowsEditing:false, quality:0.8)` -> `setImageUri`, tombol X hapus, izin ditolak -> `openSettings`.
- Barcode row: input + tombol scan -> `BarcodeScanner({autoClose:true, onBarcodeScanned:setBarcode + cek getProductByBarcode duplikat -> Alert Edit Produk? -> replace AddProductScreen({product:existing})})`, tombol label -> modal.
- Margin preview jika modal+jual terisi.
- `handleSave`: validasi wajib, `stock>=0`, cek duplikat barcode, upload foto lokal via `uploadProductImage` jika bukan `isCloudImageUri` (gagal -> pilihan Batal/Simpan Tanpa Foto), susun `data{...}`, jika edit hitung delta `latest=getProductById(id); stock=max(0,latest.stock+(input-old))` -> `updateProduct` else `addProduct` -> `goBack`.
- Modal label: `encodeCode128(value)` -> bar hitam custom, `CETAK LABEL` (`SVG->HTML->Print.printAsync`), `CETAK VIA BLUETOOTH` (`printBarcodeLabelViaBluetooth`).

### 8.7 `BarcodeScannerScreen` — Modal Kamera Reusable

- Props: `onBarcodeScanned(data), autoClose`. State: `permission=useCameraPermissions()`, `scanned`, `isScannedRef` anti double-scan.
- Web: info tidak tersedia. `!permission`: meminta izin. `!granted`: ditolak + `Kembali` + `Buka Pengaturan`.
- Normal: `CameraView onBarcodeScanned`, overlay viewfinder + hint + `Scan Lagi` + `X`. Jika `autoClose` (AddProduct) langsung `goBack`, else diam untuk scan berkali-kali (Kasir).

### 8.8 `LaporanScreen` — Riwayat + Ekspor

- State: `activeTab:Harian|Bulanan|Riwayat, transactions[], summary{omzet,laba,count}, selectedDate, selectedTx/txDetails[], storeProfile`. Params dari Dashboard: `initialFilter/dateFilter` (`FILTER_TO_TAB`).
- Load: `getDateStr YYYY-MM-DD`, `getMonthStr YYYY-MM`. `Harian->getTransactionsByDate`, `Bulanan/Riwayat->getMonthlyTransactions(pattern/"")`, selalu `getSummaryByDatePattern` untuk presisi.
- Aksi: tab switch, navigator tanggal `±1` (next disabled jika >= hari/bulan ini), tap nota -> `getTransactionDetails+getStoreProfile` -> modal struk + `Cetak Nota` + `Kirim PDF (WA text else PDF share)`.
- `Ekspor CSV`: **selalu full** (`getFullReportForExport()->exportToCSV(data, Laporan_Semua_Transaksi_YYYYMMDD.csv)`), bukan filter tab. Flatten per-barang + alokasi diskon proporsional, kolom `Tanggal,No_Nota,Nama_Barang,Qty,Harga_Modal,Harga_Jual,Total_Penjualan,Keuntungan`.

### 8.9 `PengaturanScreen`

- State: `storeNameInput/printerInput/logoUri, profile, pw modal fields, printer picker, checkingUpdate`.
- Aksi: avatar tap -> picker logo, input nama toko + MAC printer + `Pilih dari Printer Terpairing (getPairedPrinters, hanya jika isBluetoothPrintingSupported else Alert Expo Go)`, link Bluetooth settings, `Ganti Password` (validasi `new>=6 && confirm sama` -> `changePassword`), `Keluar` (`CLEAR_CART + signOut`), `Buku Panduan`, `Periksa Update` (`Updates.checkForUpdateAsync->fetch->reload`, else Alert APK only), `SIMPAN` (AsyncStorage `storeName/printerAddress/storeLogo` + upload logo via `uploadProductImage(logo,logos)` + merge `StoreProfile` + dispatch + `updateStoreName->refreshProfile`), Zona Reset dikunci (double Alert info aman).

### 8.10 `SettingNotaScreen`

- State: `storeName/storeAddress/storeContact/footerMessage (default Terima kasih...)`. Load/merge `AsyncStorage @TokoKelontong:StoreProfile` agar `logo/printerAddress` tidak hilang. Simpan -> `StoreProfile + storeName` + dispatch + `updateStoreName`. Tidak ada navigasi keluar selain back.

### 8.11 `PanduanScreen` — Statis

- Tanpa state global/repo/navigasi. 6 section collapsible: Kasir POS, Dashboard, Gudang, Laporan/Excel, Nota & Printer, Backup & Restore (teks backup JSON **usang** — fitur tidak ada di Pengaturan saat ini).

---

## 9. Komponen Reusable

- `ProductCard({product,onEdit,onDelete})`: thumbnail `image_uri` atau ikon per kategori, nama, badge `Menipis` jika `stock<=min`, `Barcode:-`, `Stok+unit`, jual `formatRupiah`, tombol pencil/delete. Dipakai `GudangScreen`.
- `ScreenHeader({title,subtitle,rightElement})`: custom header back + title + slot kanan, putih + border. Siap pakai (screen saat ini pakai header stack bawaan).

---

## 10. Services & Utils

| File | Fungsi |
|---|---|
| `supabaseClient.js` | `createClient(URL,ANON,{auth:{storage:AsyncStorage,persist,autoRefresh}})` |
| `authService.js` | `toAuthEmail, signUp, ensureProfile(register_store), signIn, signOut, getProfile, updateStoreName, changePassword` |
| `productRepository.js` | `getAllProducts, getProductByBarcode(maybeSingle), searchProductByName(ilike), getLowStockProducts(client filter), addProduct(cek duplikat+insert store_id), getProductById, updateProduct, deleteProduct` |
| `transactionRepository.js` | `createTransaction(RPC checkout), getTransactionsByDate/Monthly(fetchTransactions+rangeFromPattern zona perangkat), getFullReportForExport(JOIN+flatten+diskon proporsional), getTransactionDetails, getSummaryByDatePattern(omzet/laba/count)` |
| `helpers.js` | `formatRupiah` (`Intl id-ID IDR 0 desimal`) |
| `exportCSV.js` | `exportToCSV(data,filename)->{success}`: `toCSV` escape `,"\\n`, BOM `\\uFEFF`, web via Blob+`<a>`, native via `FileSystem/legacy cacheDirectory+write+Sharing.shareAsync(text/csv)` |
| `bluetoothPrinter.js` | ESC/POS 58mm: `isSupported(android+NativeModules)`, `isConfigured(AsyncStorage printerAddress)`, `getPairedPrinters(izin SDK31 CONNECT+SCAN else LOCATION + enableBluetooth)`, `printReceiptViaBluetooth(tx,details,storeProfile)` (header center bold, `No+tanggal`, `nama + qty x ..`, `Subtotal/Diskon/TOTAL/Tunai/Kembalian`, `printAndFeed(120)`), `printBarcodeLabelViaBluetooth` (`printBarCode CODE128,2,80`) |
| `receiptGenerator.js` | `generateWAMessage` (markdown `*bold* _italic_`, emoji, `━/─`, tanggal locale, `qty pcs × price = *subtotal*`), `generateReceiptHTML` (gradient `#4F46E5→#7C3AED→#0EA5E9`, Inter, max-width 400px, meta+item+diskon kondisional+payment box) |
| `barcode128.js` | `encodeCode128(value)->"1101..."` via `jsbarcode/src/barcodes/CODE128`, `null` jika gagal |
| `imageStorage.js` | `uploadProductImage(localUri,folder)->publicUrl`, `isCloudImageUri(/^https?:/)` |
| `theme/colors.js` | Slate monochrome (`primary #0F172A`, `background #F8FAFC`, `surface #FFFFFF`, `error #EF4444`, `warning #F59E0B`, `success #10B981`) + `fonts Inter_*` |

---

## 11. Alur Sistem End-to-End (Teks Diagram)

### 11.1 Buka App -> Auth -> Home

```
Buka App -> Splash blank (ready?) -> getSession
  !session -> Auth (Masuk/Daftar) [butuh internet]
    Daftar: username+password+namaToko -> signUp -> register_store -> Home
    Masuk: username+password -> signIn (+self-heal ensureProfile) -> Home
  session -> loadProfile (retry 4x) -> Home (omzet hari ini)
```

### 11.2 Kasir POS (Jalur Uang)

```
Home Buka Kasir -> loadProducts + cek printer
  -> search/scan -> getProductByBarcode/ilike -> ADD_TO_CART (cek stok)
  -> Floating cart -> modal: diskon (min), cash, kembalian, Uang Pas/50/100
  -> SELESAIKAN -> RPC checkout (lock+kurangi stok+nota unik) -> CLEAR_CART cegah double
  -> fetch nota+detail+StoreProfile -> modal sukses
    -> Cetak PDF / WA / Bluetooth / Tutup
  -> refresh stok grid
```

### 11.3 Gudang -> AddProduct

```
Gudang -> fetch all -> filter cat/search/low|out
  FAB -> AddProduct (tambah): foto picker -> barcode scan+duplikat cek
    -> satuan/kategori custom -> margin preview -> upload foto -> addProduct -> goBack
  Edit (tap card/modal label): prefill -> delta stok (latest + (input-old)) -> updateProduct
    -> cetak label (HTML PDF / Bluetooth CODE128)
```

### 11.4 Laporan -> Ekspor

```
Dashboard (daily/monthly/all) -> tap stat -> Laporan(initialFilter)
  Laporan tab Harian/Bulanan/Riwayat -> fetch + summary presisi
    -> tap nota -> detail + cetak ulang / WA PDF
    -> Ekspor CSV (selalu SEMUA transaksi) -> share sheet (WA/Gmail/Drive)
```

### 11.5 Pengaturan

```
Pengaturan: logo picker -> nama toko (cloud+lokal) -> MAC printer picker
  -> ganti password (verifikasi lama) -> simpan (merge StoreProfile+dispatch)
  -> cek OTA update / panduan / keluar (clear cart+signOut)
SettingNota: nama/alamat/telp/footer -> merge StoreProfile (tanpa hapus logo/printer)
```

---

## 12. Printer & Nota

- Printer config per-HP (`printerAddress` AsyncStorage, bukan cloud).
- `printReceiptViaBluetooth` butuh `BluetoothManager+BluetoothEscposPrinter` native — aman di Expo Go (lazy require return null + pesan `NOT_SUPPORTED`), aktif di APK/dev-build Android. iOS/web tidak didukung.
- Format 32 kolom (`LINE_WIDTH=32`), `TEXT_OPTS UTF-8 codepage 0`, tanggal `DD/MM/YYYY HH:mm`.
- `SettingNotaScreen` mengontrol `storeName/storeAddress/storeContact/footerMessage` yang dipakai ketiga jalur cetak (Bluetooth + HTML + WA).

---

## 13. Permissions & Build

`app.json`: `CAMERA, BLUETOOTH, BLUETOOTH_ADMIN/CONNECT/SCAN, WRITE/READ_EXTERNAL_STORAGE, RECORD_AUDIO`, plugin `expo-sqlite (sisa, tidak dipakai)`, `expo-camera`, `expo-image-picker`, `expo-font`. iOS `NSCamera/Photo` strings ID. OTA `updates.enabled:true, checkOnLaunch:always`, EAS project `b3b55795-dbed-43c2-94a6-728f7ac0a817`.

---

## 14. Gap PRD vs Aktual + Risiko (Temuan Diagnosa)

1. **Offline-first dihapus**: internet mati = kasir tidak bisa jualan (pure online). Mitigasi di dokumen: koneksi layak + hotspot cadangan + banner status (banner belum terlihat di kode yang dibaca).
2. **Realtime Supabase**: direncanakan untuk 2 HP auto-update, tetapi tidak ditemukan subscribe realtime di ringkasan repo — refresh mengandalkan `useFocusEffect` + `loadProducts` manual pasca-transaksi. Perlu QA 2 HP bersamaan.
3. **Bottom Tab batal**: diganti Stack+Home. Dokumentasi `implementationPlan.md` usang di bagian ini.
4. **SQLite/ verify plan usang**: checklist `db.js`, backup lokal, `OnboardingScreen` tidak lagi relevan.
5. **Panduan usang**: section Backup & Restore JSON tidak ada implementasinya; section grafik/terlaris juga belum ada (hanya stat card).
6. **Ekspor selalu full**: tombol di Laporan mengabaikan filter tab — by design saat ini, tapi bisa membingungkan user yang berharap ekspor sesuai filter.
7. **Duplikat barcode**: ditangani via cek `getProductByBarcode` + dialog tambah-stok/edit, plus UNIQUE di DB. Masih perlu UX untuk kasus pabrik beda rasa barcode sama.
8. **Performa**: barcode indexed di server (Postgres), bukan index lokal. Search `ilike %keyword%` untuk ribuan SKU perlu pagination (saat ini `getAllProducts` full).
9. **Expo 54 vs AGENTS.md v57**: jika upgrade, uji `CameraView`, `FileSystem legacy`, `Bluetooth` native patch (`patches/`, `plugins/`).

---

## 15. Cara Verifikasi Manual Cepat

- Auth: daftar username baru + nama toko -> cek `stores/profiles` di Supabase -> logout -> masuk lagi.
- Gudang: tambah produk + scan barcode -> cek duplikat -> edit stok -> cek badge menipis/habis.
- Kasir 2 HP: jual barang terakhir bersamaan -> pastikan satu gagal `insufficient_stock` + stok tidak minus.
- Cetak: pair printer -> cetak nota + label barcode -> cek WA share + PDF.
- Laporan: bandingkan omzet Dashboard vs Laporan harian/bulanan -> ekspor CSV -> buka di Excel (cek BOM UTF-8).
- Pengaturan: ganti nama toko -> cek HP kedua berubah; ganti password -> login ulang.

---

*Akhir dokumen. Untuk detail SQL lihat `supabase/schema.sql` + `migration_v2..v4`. Untuk alur produk awal lihat `prd.md` + `userFlow.md` (arsip, tidak lagi menggambarkan arsitektur berjalan).*
