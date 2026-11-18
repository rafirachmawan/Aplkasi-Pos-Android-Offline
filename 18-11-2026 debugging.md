# Laporan Diagnosa QC & Panduan Debugging — MarketPos

> **Tanggal Audit:** 18 November 2026  
> **Tanggal Update Status Perbaikan:** 18 November 2026 (Rilis EAS Mobile Toko Kelontong Selesai)  
> **Peran:** Senior Mobile QC Engineer  
> **Cakupan Audit:** `TokoKelontong/` (Aplikasi Mobile Expo / React Native), `supabase/` (Skema & RLS), `admin-api/`, `admin-web/`, serta konfigurasi build (`app.json`, `eas.json`, `plugins/`).  
> **Status Kelayakan Rilis Mobile:** 🟢 **TOKO KELONTONG SUDAH DIRILIS VIA EAS** · 🟡 **Web F&B (Vercel), Migrasi SQL v12, & Fitur Pro Lanjutan Sengaja Ditunda**

---

## 0. Ringkasan Status Perbaikan (Update Terkini)

Prinsip pengerjaan tahap ini: **seluruh perbaikan dijalankan tanpa mengubah/menghapus skema SQLite, riwayat transaksi/kasbon Supabase, maupun memutus kompatibilitas APK lama dan web QR yang sedang berjalan di klien.**

### ✅ SUDAH DIKERJAKAN & RILIS MOBILE VIA EAS (`TokoKelontong/`)
- **Rilis Mobile (`eas`):** Pembaruan aplikasi mobile `TokoKelontong/` sudah didorong/update melalui EAS oleh pemilik proyek.
- **[P0-1] Double-Potong DP Kasbon:** `KasirScreen.js` kini mengirim `initial_dp` & `invoice_number` satu kali ke `debtRepository.createDebt()` (tanpa memanggil `recordPayment()` lagi) serta memberi peringatan jelas bila pencatatan buku kasbon gagal.
- **[P0-2] Reset Hutang ke Rp0 & Isolasi Cache Kasbon:** `debtRepository.js` kini mengecek cache per `store_id` dengan migrasi satu kali yang aman dari key global lama, membaca sisa hutang dari Supabase bila tidak ada di cache HP ke-2 (tidak lagi default `0`), melempar error jika update server gagal, serta tidak mematenkan `hasDebtTable = false` pada gangguan jaringan biasa.
- **[P0-3] F&B QR Self-Order (`Muat ke Kasir` & Siklus Status — sisi Mobile):** `handleLoadOrderToKasir` memetakan `product_name`, `selling_price`, `capital_price`, dan `wholesale_rules`; `storeProfile` dimuat saat fokus/sebelum cetak dapur; daftar Pesanan Meja kini menampilkan order `pending` & `accepted` (bisa dipanggil ke kasir kapan saja); `handleBayar` otomatis menandai order meja menjadi `completed`.
- **[P0-4] Barcode Scanner Sukses Palsu & Hang Sinyal Lemah:** `ProductRepository.getProductByBarcode` kini mendukung mode `localFirst` (SQLite instan) + timeout Supabase `5000ms`; `BarcodeScannerScreen.js` punya fallback lokal jika callback `route.params` hilang saat restore Android dan tidak pernah menganggap hasil `null`/error sebagai `"added"`.
- **[P0-5] Crash Null-Reference & Global `ErrorBoundary`:** Ditambahkan guard null di `AddProductScreen.js`, `KasirScreen.js`, dan `GudangScreen.js`, serta pembungkus `ErrorBoundary.js` di root `App.js`.
- **[P1-1 Sisi Kode Mobile & Persiapan SQL/Web]:**
  - `supabaseConfig.js` mendukung `EXPO_PUBLIC_SUPABASE_URL` & `EXPO_PUBLIC_SUPABASE_ANON_KEY` dengan fallback eksisting.
  - `helpers.js` (`sha256Hex`, `hashStorePin`), `securityPin.js`, `sessionStore.js`, dan `authService.js` berhenti menyimpan PIN plaintext di HP (`AsyncStorage` & `AuthSnapshot`) dan memakai hash SHA-256 terikat `store_id`, tetap kompatibel dengan `stores.security_pin` lama agar HP lama tidak terkunci.
  - Siap di repo (belum diaktifkan di live DB/Vercel): `CustomerOrderPage.tsx` (`admin-web`) sudah di-update memanggil RPC aman `get_public_store_menu` & `submit_public_table_order` dengan fallback, beserta skrip `supabase/migration_v11_security_hardening_phase1_rpc.sql` & `supabase/migration_v12_security_lockdown_phase2_drop_anon.sql`.
- **[P1-2 sebagian] Checkout Kasbon & Copy Panduan:** Input opsional Jatuh Tempo (format fleksibel Indonesia/angka) & Catatan kasbon kini tampil di modal checkout kasbon `KasirScreen.js`; copy `PanduanScreen.js` diperbarui agar jujur sesuai fitur terpasang (Harian/Bulanan & Produk Terlaris).
- **[P1-3] Alur Offline, Stok Gudang, `usePlan`, HeldOrders, Rp0, CSV, Dashboard, & Storage Orphan:**
  - `authService.signOut()` keluar secara lokal seketika (`scope: "local"`) lalu mencabut sesi server di latar belakang (offline logout < 1 detik).
  - `productRepository.getAllProductsWithSource()` mengurangi stok server dengan outbox lokal pending (`applyPendingStockDeductions`).
  - `usePlan()` menghilangkan `{ force: true }` pada mount; `@TokoKelontong:HeldOrders` diisolasi per `store_id`; `grandTotal <= 0` diblokir; `LaporanScreen.js` & `getFullReportForExport(datePattern)` mengekspor CSV sesuai periode tab; `DashboardScreen.js` fetch katalog 1x; `updateProduct` cek duplikat barcode; `is_offline` pakai `row.status !== "synced"`.
  - `imageStorage.js` (`deleteProductImageByUrl`) + `productRepository.js` (`updateProduct`/`deleteProduct`) kini membersihkan foto lama di bucket `product-images` secara aman bila tidak dipakai produk lain.
- **[P2-1 s/d P2-5 sebagian] Escape HTML, QR PDF Offline, Modal Stability, Config & Dead Code:**
  - `escapeHtml` di `receiptGenerator.js`, `AddProductScreen.js`, `tableQrGenerator.js`.
  - `tableQrGenerator.js` kini menghasilkan `<svg>` QR murni offline via `qrcode-generator` tanpa bergantung `api.qrserver.com`.
  - `CustomAlertHost.js` menonaktifkan animasi fade modal alert di Android + jeda penutupan `150ms` untuk mengurangi benturan tumpukan `<Modal>`.
  - `eas.json` memisahkan channel `preview` & `apk` dari `production`; `app.json` menghapus duplikat `CAMERA` & izin tak terpakai `RECORD_AUDIO`; `AGENTS.md` disesuaikan ke Expo SDK 54 (`v54.0.0`); file mati `ScreenHeader.js`, `showCategoryModal`, `pendingSource`, & import `signOut` (`PengaturanScreen.js`) dibersihkan.
- **Verifikasi:** `26/26` unit & security regression test (`node --test`) lulus + `admin-web` `tsc --noEmit` lulus + `npx expo config --type public` valid + `npx expo export --platform android` (`1346` modules) lulus.

### ⏳ BELUM DIKERJAKAN / BELUM DIJALANKAN (Ditunda untuk Tahap F&B & Berikutnya)
1. **Deploy Web Self-Order F&B (`admin-web` ke Vercel):** Kode `CustomerOrderPage.tsx` (RPC menu publik) sudah selesai di repo dan lulus `typecheck`, namun **belum di-deploy ke Vercel** karena fokus saat ini hanya Toko Kelontong (non-F&B).
2. **Eksekusi SQL Keamanan di Supabase (`v11` & `v12`):**
   - `supabase/migration_v11_security_hardening_phase1_rpc.sql` *(tahap persiapan add-only RPC & kolom `security_pin_hash`)*.
   - `supabase/migration_v12_security_lockdown_phase2_drop_anon.sql` *(penutupan akses baca terbuka `anon` pada `products`, `stores`, `table_orders` — **wajib ditunda** sampai Web F&B Vercel resmi di-deploy)*.
   - Pengosongan kolom plaintext `stores.security_pin = null` *(opsional di dalam `v12` — **ditunda** sampai dipastikan 100% HP klien memakai versi app terbaru)*.
3. **Fitur Pro yang Belum Dibangun (`P1-2` sisanya — `shift`, `multiPayment` split tender, `multiDevice`):** Belum dibangun UI/logikanya di mobile maupun keputusan penyesuaian teks `planConfig.js`.
4. **Plugin Gradle `withAndroidRepositories.js` (`P2-4`):** Sengaja belum didaftarkan di `app.json` karena masih mengandung blok `allprojects` ganda; tunggu uji `expo prebuild --clean` saat butuh build APK native baru.
5. **Checklist QA Lapangan (`PANDUAN_QA_DAN_RILIS_OFFLINE_FIRST.md`):** Verifikasi formal multi-perangkat (`T-O-01` s/d `T-O-19`, `G-3` s/d `G-7`) serta query anti-duplikat SQL server.

---

## 1. Ringkasan Eksekutif & Status Verifikasi Teknis

Secara arsitektur, proyek sudah mengalami peningkatan besar dibanding diagnosa awal Oktober 2026: aplikasi kasir sudah memakai pola *offline-first* dengan outbox SQLite (`localDb.js`), mesin sinkronisasi ber-backoff (`syncService.js`) ke RPC idempotent `checkout_v2`, pemisahan tier SaaS Gratis/Pro (`planService.js`), fitur F&B self-order (`table_orders`), serta panel `admin-api` + `admin-web`.

Namun, hasil audit kode dan verifikasi teknis menemukan **bug finansial kritis (double-potong DP Kasbon)**, **kerusakan alur F&B Self-Order**, **celah keamanan multi-tenant pada RLS Supabase**, serta **ketiadaan automated test** di sisi mobile.

### Hasil Pemeriksaan Tooling & Build Saat Ini

| Modul / Area | Pemeriksaan yang Dijalankan | Hasil Observasi |
|---|---|---|
| `admin-api` | `npm run typecheck` (`tsc --noEmit`) | ✅ **Lulus** (exit code 0, audit awal) |
| `admin-web` | `npm --prefix admin-web run typecheck` (`tsc --noEmit`) | ✅ **Lulus** (exit code 0, setelah upgrade RPC menu publik) |
| `TokoKelontong` | `npx expo config --type public` & `npx expo export --platform android` | ✅ **Lulus** (`1346 modules` bundled cleanly; `app.json` & `eas.json` sudah dirapikan) |
| `TokoKelontong` | Automated Tests (`node --test`) & Repo Tooling | ✅ **26/26 lulus** di suite regresi/keamanan/unit scratch (`node --test`); belum ada script `npm test`/ESLint/CI `.github` di repo |
| QA Lapangan | `PANDUAN_QA_DAN_RILIS_OFFLINE_FIRST.md` | ❌ Gerbang `G-3` s/d `G-7` dan seluruh skenario `T-O-01` s/d `T-O-19` masih belum teruji (`☐`) |

---

## 2. Temuan P0 — Kritis (Kesalahan Finansial, Data Korup, & Crash)

### [P0-1] DP / Uang Muka Kasbon Terpotong Dua Kali (Bug Finansial) — ✅ SUDAH DIPERBAIKI (App) · ⏳ SQL RPC Opsional

- **Lokasi File:**
  - `TokoKelontong/src/screens/KasirScreen.js` (baris `572–598`)
  - `TokoKelontong/src/database/debtRepository.js` (baris `140–201` dan `206–275`)
- **Mekanisme Bug:**
  1. Di `KasirScreen.js` (`handleBayar`), saat `paymentMethod === "kasbon"`, aplikasi menghitung:
     ```js
     const dp = parseRpToNumber(kasbonDpInput);
     const remainingDebt = Math.max(0, grandTotal - dp);
     ```
  2. Nilai `remaining_debt: remainingDebt` langsung dikirim ke `debtRepository.createDebt(...)`. Jadi pada titik ini, sisa hutang sudah dikurangi DP (`grandTotal - dp`).
  3. Tepat di bawahnya (`baris 588–594`), jika `dp > 0`, aplikasi memanggil lagi:
     ```js
     await debtRepository.recordPayment(createdDebt.id, {
       payment_amount: dp,
       payment_method: "cash",
       notes: "DP / Uang Muka di Kasir",
     });
     ```
  4. Di dalam `debtRepository.recordPayment` (`baris 232`), sisa hutang dihitung dengan `curDebt.remaining_debt - amount`. Akibatnya DP dikurangkan **dua kali** (`grandTotal - 2 * dp`).
- **Masalah Tambahan di Alur yang Sama:**
  - `invoice_number` tidak dikirim saat memanggil `debtRepository.createDebt(...)` (`KasirScreen.js:577-585`).
  - Jika `createDebt()` gagal, error hanya di-`console.warn` (`KasirScreen.js:595-597`) setelah transaksi utama sudah tersimpan, sehingga nota kasbon ada di `transactions` tapi hilang di `customer_debts`.
- **Dampak:** Belanja Rp100.000 dengan DP Rp20.000 tercatat sisa hutang Rp60.000. Jika DP ≥ 50% dari total belanja, sisa hutang langsung tercatat **Rp0 (`paid`)**.
- **Solusi Perbaikan:**
  - Saat membuat kasbon dengan DP di kasir: kirim `remaining_debt: grandTotal` ke `createDebt` lalu panggil `recordPayment(dp)` **ATAU** kirim `remaining_debt: grandTotal - dp` lalu sisipkan baris `debt_payments` secara langsung tanpa memotong ulang `remaining_debt` (lebih aman: buat RPC Supabase atomik `create_kasbon_with_dp` agar `customer_debts` dan `debt_payments` tercatat dalam 1 transaksi DB).
  - Ambil dan teruskan `invoice_number` dari hasil transaksi, serta tampilkan peringatan jelas bila pencatatan buku kasbon gagal.

---

### [P0-2] `recordPayment` Berisiko Me-reset Sisa Hutang Menjadi `Rp0` & Data Kasbon Bocor Antar-Toko

- **Lokasi File:** `TokoKelontong/src/database/debtRepository.js` (baris `4–5`, `60–89`, `206–275`)
- **Mekanisme Bug:**
  1. Di `recordPayment()` (`baris 224–225`), nilai default adalah `let updatedRemaining = 0; let newStatus = "unpaid";`.
  2. Nilai tersebut hanya di-update apabila `debtId` ditemukan di cache lokal `AsyncStorage` (`idx !== -1` pada `baris 230`).
  3. Jika kasbon dibuat dari perangkat kasir lain, atau cache `AsyncStorage` perangkat sudah bersih/install ulang (`idx === -1`), blok update lokal tidak berjalan — lalu `baris 260–267` tetap menjalankan:
     ```js
     await supabase.from("customer_debts").update({
       remaining_debt: 0, // <-- salah!
       status: "unpaid",  // <-- salah!
     }).eq("id", debtId);
     ```
  4. `LOCAL_DEBTS_KEY` (`@TokoKelontong:CustomerDebts`) dan `LOCAL_PAYMENTS_KEY` (`@TokoKelontong:DebtPayments`) tidak di-scope per `store_id`. Saat berganti akun toko di HP yang sama, cache lokal toko sebelumnya bisa terbaca.
  5. Di `getDebts()` (`baris 86–88`), blok `catch` men-set `hasDebtTable = false` untuk semua jenis error (termasuk timeout/jaringan putus) dan tidak pernah di-reset selama aplikasi berjalan. Di `recordPayment()` (`baris 269–271`), kegagalan query Supabase juga ditelan lalu fungsi tetap mengembalikan `{ success: true }`.
- **Dampak:** Sisa hutang pelanggan di server terhapus menjadi Rp0 saat dicicil dari HP ke-2, status hutang tetap `"unpaid"` meski sudah lunas, serta data kasbon berisiko bercampur antar toko di perangkat yang sama.
- **Solusi Perbaikan:**
  - Hitung sisa hutang di server (via RPC atomik / baca `customer_debts` terbaru dari Supabase jika tidak ada di lokal, bukan mengandalkan default `0`).
  - Scope seluruh cache kasbon dengan prefix `:${storeId}`.
  - Bedakan error tabel tidak ada (`42P01`) dengan error jaringan, dan lempar error saat `recordPayment` gagal tersimpan ke server agar UI tidak menampilkan sukses palsu.

---

### [P0-3] Fitur F&B QR Self-Order (`Muat ke Kasir` & Siklus Status Order) Rusak

- **Lokasi File:**
  - `TokoKelontong/src/screens/KasirScreen.js` (baris `141–246`, `252`, `618`)
  - `TokoKelontong/src/services/tableOrderService.js` (baris `8–27`)
  - `admin-web/src/features/customerOrder/pages/CustomerOrderPage.tsx` (baris `256–262`)
- **Mekanisme Bug:**
  1. Web pelanggan (`CustomerOrderPage.tsx`) menyimpan item pesanan ke `table_orders.items` dengan key `{ product_id, name, price, quantity, notes }`.
  2. Saat kasir mengetuk **Muat ke Kasir**, `handleLoadOrderToKasir` (`KasirScreen.js:214–237`) mengirim payload `ADD_TO_CART`:
     ```js
     payload: {
       product_id: prod.id,
       name: prod.name,       // salah key! Seharusnya product_name
       price: item.price,     // salah key! Seharusnya selling_price
       quantity: item.quantity,
     }
     ```
     - Jika `prod` ditemukan di `allProducts`, objek produk tidak punya `prod.name` (punyanya `product_name`), sehingga `prod.name` menjadi `undefined`.
     - `selling_price` dan `capital_price` tidak ikut di-set.
     - Akibatnya `getCartItemPriceInfo()` mengembalikan `unitPrice: undefined`, `totalHarga` menjadi `NaN` (`RpNaN`), nama item di keranjang kosong, dan jika di-checkout akan menghasilkan `price_at_sale = 0` / `product_name = ""` / gagal di `checkout_v2` (`needs_review` karena `NaN` pada field integer).
  3. Di `handleAcceptTableOrder` (`KasirScreen.js:163`), `printKitchenTicketViaBluetooth` menerima state `storeProfile` yang masih `{}` (karena `setStoreProfile` hanya dipanggil di dalam `handleBayar` baris 618), sehingga struk dapur selalu mencetak `"MarketPos"` bukan nama toko.
  4. Begitu order diterima (`status = 'accepted'`), `loadPendingOrders()` tidak menampilkannya lagi karena `fetchPendingTableOrders()` hanya mengambil `status = 'pending'`. Jika kasir memilih **"Tutup"** setelah cetak dapur (alur normal dine-in: masak dulu, bayar nanti), tidak ada daftar order `accepted` di kasir untuk dimuat ke pembayaran, dan `handleBayar` tidak pernah mengubah `table_orders.status` menjadi `'completed'`.
- **Solusi Perbaikan:**
  - Normalisasi payload di `handleLoadOrderToKasir`: petakan `product_name: prod.product_name || item.name || ""`, `selling_price: Number(prod.selling_price ?? item.price) || 0`, `capital_price: Number(prod.capital_price || 0)`, `wholesale_rules: prod.wholesale_rules || []`.
  - Muat `storeProfile` saat `KasirScreen` focus (bukan hanya setelah `handleBayar`).
  - Simpan `activeTableOrderId` di state kasir agar setelah `handleBayar` sukses, `updateTableOrderStatus(activeTableOrderId, "completed")` dipanggil, serta sediakan tab/filter order berstatus `accepted` di modal Pesanan Meja.

---

### [P0-4] Barcode Scanner Memberi Feedback Sukses Palsu & Macet Saat Sinyal Lemah

- **Lokasi File:**
  - `TokoKelontong/src/screens/KasirScreen.js` (baris `378–400`)
  - `TokoKelontong/src/screens/BarcodeScannerScreen.js` (baris `66`, `172–197`)
  - `TokoKelontong/src/database/productRepository.js` (baris `162–206`)
- **Mekanisme Bug:**
  1. `KasirScreen` mengirim fungsi `onBarcodeScanned` lewat React Navigation `route.params` (nilai non-serializable). Jika Android melakukan kill/restore activity karena keterbatasan RAM saat kamera aktif, `onBarcodeScanned` menjadi `undefined`.
  2. Di `BarcodeScannerScreen.js:173–176`:
     ```js
     const result = onBarcodeScanned ? await onBarcodeScanned(code) : null;
     if (!result || result.status === "added") { ... }
     ```
     Karena `!result` bernilai `true`, scanner bergetar dan menampilkan pesan `"Produk (...) ditambahkan"` padahal **tidak ada barang yang masuk ke keranjang**.
  3. Di dalam `onBarcodeScanned`, `ProductRepository.getProductByBarcode(code)` menembak Supabase dulu **tanpa timeout** sebelum fallback ke SQLite. Saat jaringan toko lambat/setengah putus, kasir membeku di status `"Mencari barcode..."` dan stok hasil fetch server tidak dikurangi `pendingMap` outbox lokal.
- **Solusi Perbaikan:**
  - Untuk mode kasir (`multiScan`), cari barcode langsung dari SQLite (`getCatalogProductByBarcode`) dan dispatch `ADD_TO_CART` langsung melalui `AppContext` (atau event/store handler) tanpa mengandalkan callback di `route.params`.
  - Jika `onBarcodeScanned` memang kosong, tampilkan error bukan status sukses (`added`).

---

### [P0-5] Risiko Crash Null-Reference & Ketiadaan Global ErrorBoundary

- **Lokasi File:**
  - `TokoKelontong/src/screens/AddProductScreen.js` (baris `336–346`): `existingProduct.capital_price.toLocaleString()`, `selling_price.toLocaleString()`, `stock_quantity.toString()`, `min_stock_threshold.toString()` tanpa guard null/undefined.
  - `TokoKelontong/src/screens/KasirScreen.js` (baris `357`) & `TokoKelontong/src/screens/GudangScreen.js` (baris `116`): `p.product_name.toLowerCase()` tanpa null guard `(p.product_name || "")`.
  - `TokoKelontong/App.js`: tidak ada React `ErrorBoundary` pembungkus aplikasi.
- **Dampak:** Satu data produk bernilai `null` pada field tersebut akan membuat form edit atau halaman Kasir/Gudang langsung crash/blank tanpa fallback UI.
- **Solusi Perbaikan:** Tambahkan fallback default `Number(val || 0)` / `String(val ?? "")` di semua akses properti produk, dan bungkus root `App.js` dengan `ErrorBoundary` yang memiliki tombol pemulihan ("Muat Ulang Halaman").

---

## 3. Temuan P1 — Tinggi (Keamanan Data, Multi-Tenant, & Kesenjangan Fitur)

### [P1-1] Celah Kebocoran Data Lintas Toko & Data Sensitif via Supabase RLS (`anon` Key)

- **Lokasi File:**
  - `supabase/migration_v10_fnb_self_order.sql` (baris `73–110`)
  - `supabase/HOTFIX_FIX_DATA_ISOLATION_RLS.sql` (baris `8–27`)
  - `TokoKelontong/src/config/supabaseConfig.js` (baris `9–12`)
- **Mekanisme Masalah:**
  - `SUPABASE_URL` dan `SUPABASE_ANON_KEY` tertanam publik di aplikasi mobile dan `admin-web` (wajar untuk client key, tapi artinya **keamanan wajib 100% dijaga oleh RLS**).
  - Migrasi v10 (dan hotfix RLS) menambahkan policy:
    - `products_select_public_menu` (`FOR SELECT TO anon USING (true)`) -> Siapa pun dapat me-request seluruh tabel `products` lintas semua toko, termasuk **`capital_price` (harga modal/kulakan)**, `stock_quantity`, dan `wholesale_rules`.
    - `stores_select_public_menu` (`FOR SELECT TO anon USING (true)`) -> Membuka seluruh kolom `stores` ke `anon`, termasuk **`security_pin` pemilik toko dalam plaintext**!
    - `table_orders_select_public` (`FOR SELECT TO anon, authenticated USING (true)`) -> Membocorkan data pemesan (`customer_name`, `customer_phone`), nominal, dan `payment_proof_url` antar toko (meski hotfix menambahkan `table_orders_select_cashier`, policy `table_orders_select_public` untuk `anon` masih terbuka `USING (true)`).
    - `table_orders_insert_public` (`WITH CHECK (true)`) -> Tidak ada validasi harga/total terhadap harga produk di server dan tidak mengunci agar insert anon hanya boleh berstatus `'pending'`.
- **Risiko Tambahan PIN Keamanan:** `stores.security_pin` disimpan sebagai plaintext di Postgres dan `AsyncStorage` (`@TokoKelontong:AuthSnapshot`, `@TokoKelontong:SecurityPin`).
- **Solusi Perbaikan:**
  - Hapus policy `SELECT` terbuka pada `products` dan `stores` untuk `anon`. Ganti dengan `SECURITY DEFINER` RPC khusus e-menu (mis. `get_public_store_menu(p_store_id uuid)`) yang hanya mengembalikan kolom publik (`store_name`, `qris_image_url`, `fnb_active_tables`, `id`, `product_name`, `selling_price`, `category`, `image_uri`).
  - Lakukan verifikasi/penyimpanan PIN keamanan dengan hash (bukan plaintext) dan tidak mengekspose kolom PIN ke query publik.
  - Pindahkan pembacaan `SUPABASE_URL` & `SUPABASE_ANON_KEY` di `supabaseConfig.js` agar mendukung `process.env.EXPO_PUBLIC_*`.

---

### [P1-2] Ketidaksesuaian Klaim Fitur Paket Pro & Buku Panduan vs Implementasi Nyata

- **Lokasi File:**
  - `TokoKelontong/src/config/planConfig.js` (baris `26–56`)
  - `TokoKelontong/src/screens/PanduanScreen.js` (baris `114–120`, `161`)
  - `TokoKelontong/src/screens/KasirScreen.js` (baris `90–91`, `2020–2080`)
- **Rincian Kesenjangan:**
  1. `PRO_FEATURES.shift` ("Buka/tutup shift kasir dan catat kas keluar"): Tabel `cashier_shifts` & `shift_expenses` sudah ada di `migration_v6` dan ditampilkan di `admin-web`, tetapi **fitur ini belum ada di aplikasi mobile `TokoKelontong`**.
  2. `PRO_FEATURES.multiPayment` ("Bayar gabungan (tunai + QRIS)"): Di `KasirScreen.js`, metode pembayaran berupa dropdown tunggal; belum ada pembayaran gabungan/split payment.
  3. `PRO_FEATURES.multiDevice` ("Hubungkan lebih dari satu HP kasir"): Belum ada batasan atau manajemen perangkat di mobile maupun server.
  4. State `kasbonDueDate` dan `kasbonNotes` sudah dideklarasikan dan di-reset di `KasirScreen.js`, tetapi input form tanggal jatuh tempo & catatan kasbon belum dirender di modal checkout Kasbon.
  5. `PanduanScreen.js` masih mencantumkan filter **Tahun**, **Grafik tren transaksi**, dan **agregasi SQL**, padahal agregasi laporan dihitung di JavaScript sisi klien (`transactionRepository.js:724–765`) dan grafik tren tidak ada.
- **Solusi Perbaikan:** Implementasikan fitur yang dijanjikan sebelum dipromosikan di paket Pro, atau perbarui copy `planConfig.js` & `PanduanScreen.js` agar 100% jujur sesuai fitur yang rilis.

---

### [P1-3] Celah Alur Offline, Sinkronisasi State, & Beban Query

1. **Logout Offline Menggantung 8 Detik:**
   - Di `HomeScreen.js:151–154`, tombol Keluar menjalankan `dispatch({ type: "RESET_STORE_STATE" })` lalu `signOut()`.
   - Di `authService.js:87–108`, `signOut()` menunggu `supabase.auth.signOut()` timeout hingga **8000 ms** sebelum membersihkan token lokal (`sb-<ref>-auth-token` & `scope: "local"`). Selama 8 detik saat offline, layar terlihat tidak merespons dan pengguna tetap berada di `HomeScreen` tanpa loading indicator.
2. **Inkonsistensi Stok Kasir vs Gudang Saat Ada Outbox Pending:**
   - `KasirScreen` membaca stok efektif (`stock_snapshot - pendingMap`), sedangkan `GudangScreen` saat online membaca stok mentah dari server (`getAllProductsWithSource()`) tanpa memperhitungkan transaksi yang belum terkirim / berstatus `needs_review` di outbox SQLite.
3. **Query Berlebihan oleh `usePlan()` dan Manipulasi Jam Klien:**
   - `usePlan.js:25` selalu memanggil `refreshPlan({ force: true })` tiap komponen mount. Karena layar-layar utama (mis. `KasirScreen`, `LaporanScreen`, `DashboardScreen`, `BukuKasbonScreen`, `SettingNotaScreen`, `PengaturanScreen`) juga merender `<ProLockModal>` yang ikut memanggil `usePlan()`, setiap navigasi memicu **2 query paksa bersamaan** ke `store_subscriptions`.
   - `planService.js:68` menghitung masa aktif Pro dengan `Date.now()` perangkat secara murni saat offline, sehingga mengubah jam HP ke masa lalu bisa memperpanjang akses Pro lokal (dan jika `plan_expires_at` bernilai `null`, `computeEffective` di baris 64 memperlakukannya sebagai `free`).
4. **Transaksi Rp0 Masih Lolos:**
   - Di `KasirScreen.js:517`, jika diskon sama dengan subtotal (`grandTotal === 0`) dan input tunai kosong (`cashReceived === 0`), transaksi bernilai `Rp0` tetap lolos disimpan ke outbox dan server.
5. **Held Orders Tidak Terisolasi `store_id`:**
   - `@TokoKelontong:HeldOrders` (`KasirScreen.js:257`) belum memakai prefix `storeId` dan tidak dibersihkan saat logout standar (`authService.js:22–32`).
6. **Bug & Inefisiensi Lain di Repository & Layar:**
   - `LaporanScreen.js:263` (`handleExportCSV`) tetap mengekspor seluruh riwayat (`getFullReportForExport()`) mengabaikan filter tab `Harian` / `Bulanan`.
   - `DashboardScreen.js:89–91` menarik seluruh produk dua kali (`getAllProducts()` lalu `getLowStockProducts()`).
   - `productRepository.js:362–427` (`updateProduct`) belum mengecek duplikat barcode sebelum `UPDATE`, dan `deleteProduct` / ganti foto tidak menghapus file gambar lama (orphan object) di Supabase Storage.
   - `transactionRepository.js:140` menentukan `is_offline` berdasarkan status polling koneksi saat membaca data (`!!getSyncState().offline`), bukan berdasarkan status sinkronisasi transaksi atau status saat dibuat.

---

## 4. Temuan P2 — Kualitas Kode, UI Android, Konfigurasi Build, & Hygiene

1. **HTML/SVG Injection pada Generator Cetak & PDF:**
   - `receiptGenerator.js` (`210–466`), `AddProductScreen.js` (`551–560`), dan `tableQrGenerator.js` (`66–179`) menyisipkan `storeName`, `storeAddress`, `storeContact`, `footerMessage`, `product_name`, `barcode`, `table_number`, dan `payment_notes` langsung ke HTML/SVG tanpa HTML escaping (`&`, `<`, `>`, `"`, `'`). Karakter seperti `<` atau `&` pada nama barang/toko dapat merusak layout struk cetak.
2. **Cetak PDF QR Meja Bergantung API Eksternal:**
   - `tableQrGenerator.js:60` memakai `https://api.qrserver.com/v1/create-qr-code/...` di dalam `<img src="...">` untuk generate PDF QR meja. Jika offline atau layanan eksternal tersebut bermasalah, gambar QR di PDF gagal muncul. Sebaiknya generate QR menjadi SVG secara lokal.
3. **Risiko Modal Stacking `CustomAlertHost` di Android:**
   - `CustomAlertHost.js:24–140` mengganti `Alert.alert` bawaan OS dengan komponen `<Modal>` React Native. Di Android, memicu `Alert.alert` saat `<Modal>` lain masih terbuka (mis. modal Keranjang, modal Kasbon, modal Pesanan Meja) rawan mengalami glitch z-order/focus/freeze pada sejumlah versi Android.
4. **Konfigurasi Build (`app.json`, `eas.json`, `plugins/`):**
   - `TokoKelontong/plugins/withAndroidRepositories.js` tersedia di repo, tetapi **belum didaftarkan** di array `plugins` pada `TokoKelontong/app.json`.
   - `TokoKelontong/app.json` (`37–47`) mendeklarasikan permission duplikat (`CAMERA` & `android.permission.CAMERA`), permission tidak terpakai (`android.permission.RECORD_AUDIO`), serta permission storage lawas (`WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`).
   - `TokoKelontong/eas.json` (`11–27`) menaruh profil `preview`, `apk`, dan `production` pada `channel: "production"` yang sama — berisiko mengirim OTA uji coba langsung ke APK produksi klien.
   - `TokoKelontong/AGENTS.md` mengarahkan ke dokumentasi Expo `v57.0.0`, sedangkan proyek berjalan di Expo SDK 54 (`expo: ^54.0.36`).
5. **Dead Code & Kebersihan Repo:**
   - `KasirScreen.js:79, 1293`: `showCategoryModal` tidak memiliki pemicu untuk dibuka (`setShowCategoryModal(true)` tidak pernah dipanggil).
   - `PengaturanScreen.js:38`: import `signOut` tidak digunakan.
   - `TokoKelontong/src/components/ScreenHeader.js`: komponen tidak dipakai di mana pun.
   - `AddProductScreen.js:149` & `PengaturanScreen.js:121`: state `pendingSource` tidak dipakai.
   - Root repositori memiliki `package-lock.json` yang untracked, serta modifikasi belum ter-commit pada `TokoKelontong/package-lock.json` dan `admin-web/package-lock.json`.

---

## 5. Rencana Debugging & Urutan Eksekusi Perbaikan

| Prioritas | Status | Target Perbaikan | File Utama | Kriteria & Catatan |
|---|---|---|---|---|
| **1 (P0)** | ✅ **SUDAH RILIS VIA EAS** *(SQL RPC opsional)* | Perbaiki double-deduksi DP Kasbon & fallback `recordPayment` | `KasirScreen.js`, `debtRepository.js`, `sessionStore.js` | DP Rp20rb pada belanja Rp100rb kini tersisa Rp80rb; `recordPayment` ambil saldo server bila cache HP ke-2 kosong; cache kasbon terisolasi `store_id` dgn migrasi aman; *SQL RPC atomik masih opsional*. |
| **2 (P0)** | ✅ **SUDAH RILIS VIA EAS** *(Mobile)* · ⏳ *(Web F&B Vercel ditunda)* | Perbaiki payload & lifecycle F&B `table_orders` | `KasirScreen.js`, `tableOrderService.js` | Item keranjang terpetakan lengkap (`product_name`, `selling_price`, `capital_price`), profil toko dimuat sebelum cetak dapur, order `accepted` tampil untuk dipanggil bayar, status otomatis `completed` saat bayar. |
| **3 (P0)** | ✅ **SUDAH RILIS VIA EAS** | Perbaiki `BarcodeScannerScreen` (non-serializable callback & latency) | `KasirScreen.js`, `BarcodeScannerScreen.js`, `productRepository.js` | Scan kasir baca SQLite lokal dulu (`localFirst`) + timeout server 5 detik, fallback lokal saat callback `route.params` hilang, serta tidak pernah menampilkan toast sukses palsu. |
| **4 (P0)** | ✅ **SUDAH RILIS VIA EAS** | Guard null field produk & pasang `ErrorBoundary` | `AddProductScreen.js`, `KasirScreen.js`, `GudangScreen.js`, `ErrorBoundary.js`, `App.js` | Seluruh field produk terlindungi fallback aman; aplikasi dibungkus `ErrorBoundary` dengan tombol pemulihan tampilan. |
| **5 (P1)** | ✅ **SUDAH RILIS (App Mobile Hash PIN)** · ⏳ **BELUM (Web F&B Vercel + SQL v11/v12)** | Tutup kebocoran RLS `anon` & amankan PIN | `migration_v11_security_hardening_phase1_rpc.sql`, `migration_v12_security_lockdown_phase2_drop_anon.sql`, `CustomerOrderPage.tsx`, `securityPin.js`, `sessionStore.js`, `supabaseConfig.js` | App mobile sudah menyimpan & memverifikasi PIN berbasis hash SHA-256 (kompatibel dgn kolom lama). **Belum dijalankan:** `migration_v11` + deploy Web F&B Vercel + `migration_v12` (sengaja ditunda sampai tahap F&B dikerjakan). |
| **6 (P1)** | ✅ **SUDAH RILIS VIA EAS** *(kecuali fitur Pro baru)* | Sinkronkan stok Gudang/Kasir, logout offline cepat, throttle `usePlan`, blokir Rp0, checkout kasbon, ekspor CSV sesuai tab, bersihkan foto orphan | `productRepository.js`, `imageStorage.js`, `localDb.js`, `authService.js`, `usePlan.js`, `KasirScreen.js`, `DashboardScreen.js`, `LaporanScreen.js`, `PanduanScreen.js`, `transactionRepository.js` | Logout offline < 1 detik, stok Gudang dipotong pending outbox, `HeldOrders` terisolasi `store_id`, `grandTotal <= 0` diblokir, foto produk lama dibersihkan aman dari bucket Storage; *fitur baru Shift/Split Payment/Multi-Device masih menunggu keputusan produk*. |
| **7 (P2)** | ✅ **SUDAH RILIS VIA EAS** *(kecuali plugin Gradle native)* | Escape HTML struk, QR SVG offline, stabilitas alert modal, rapikan `app.json`/`eas.json`/`AGENTS.md` & dead code | `helpers.js`, `receiptGenerator.js`, `tableQrGenerator.js`, `CustomAlertHost.js`, `eas.json`, `app.json`, `AGENTS.md`, `PengaturanScreen.js` | QR PDF 100% offline SVG (`qrcode-generator`), animasi modal alert Android dirapikan, channel `preview`/`apk`/`production` dipisah, permission duplikat/`RECORD_AUDIO` dihapus, file mati `ScreenHeader.js` dihapus (`26/26` test `node --test` lulus). *Plugin `withAndroidRepositories.js` ditahan hingga uji build Gradle bersih.* |
| **8 (QA)** | ⏳ **BELUM** | Verifikasi checklist lapangan & audit server pasca update | `PANDUAN_QA_DAN_RILIS_OFFLINE_FIRST.md` | Menunggu konfirmasi hasil pakai di HP klien & pengecekan checklist (`T-O-01` s/d `T-O-19`, `G-3` s/d `G-7`). |
