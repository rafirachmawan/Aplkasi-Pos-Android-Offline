# RENCANA PERBAIKAN MENUJU PRODUKSI — MARKETPOS

> **Tanggal dokumen:** 31 Oktober 2026
> **Status dokumen:** DRAFT — rencana eksekusi (belum ada kode yang diubah)
> **Baseline audit:** commit `dffd0d7` + working tree (2 file belum di-commit: `TokoKelontong/src/screens/HomeScreen.js`, `TokoKelontong/src/screens/KasirScreen.js`)
> **Prinsip:** Zero Downtime & Zero Data Loss untuk 1 klien aktif. Semua perubahan database bersifat **add-only**, RPC baru wajib punya nilai default, dan APK lama harus tetap bisa bertransaksi.

---

## 0. Cara Memakai Dokumen Ini

1. Setiap item punya ID unik: `P0-xx` (blocker), `P1-xx` (penting), `P2-xx` (fitur lanjutan).
2. Status yang dipakai:
   - ⬜ **Belum** — belum dikerjakan
   - 🟨 **Sedang** — sedang dikerjakan
   - ✅ **Selesai** — sudah lulus Definition of Done + QA
   - ⛔ **Ditunda** — sengaja ditunda, tulis alasannya di kolom catatan
   - 🔁 **Revisi** — sudah dikerjakan tetapi gagal QA
3. Setelah mengerjakan satu item:
   - Ubah status di **Dashboard Progres** (Bagian 2).
   - Centang checklist di detail item.
   - Tambahkan baris di **Log Progres** (Bagian 12).
4. Jangan menandai ✅ hanya karena kode sudah ditulis. Item baru ✅ jika **Definition of Done** dan **QA manual** di item tersebut lulus.
5. Urutan eksekusi mengikuti Bagian 9 (Milestone), bukan urutan nomor semata.

---

## 1. Ringkasan Eksekutif

### 1.1 Penilaian kesiapan

| Aspek | Status | Catatan |
|---|---|---|
| Kelengkapan fitur POS | 🟢 Kuat | Kasir, gudang, laporan, multi-payment, kasbon, grosir, F&B, OTA, PIN, lisensi |
| Ketahanan offline | 🔴 Belum | Cold start offline tidak bisa jualan; antrean tidak masuk laporan; rawan dobel |
| Integritas data & akuntansi | 🔴 Belum | Kasbon dihitung tunai, transaksi Rp 0, belum ada void, belum ada kartu stok |
| Skalabilitas laporan | 🔴 Belum | Berpotensi terpotong di 1.000 baris (batas default Supabase/PostgREST) |
| Keamanan akses | 🟠 Sebagian | PIN plaintext + client-side; belum ada role/audit |
| Kesiapan rilis Android | 🔴 Belum | Release APK masih debug signing, versionCode 1, permission berlebih |
| Operasional & support | 🔴 Belum | Tidak ada recovery akun, crash report, backup terjadwal, test/CI |

**Kesimpulan:** siap dipakai sebagai demo / single-device dengan pengawasan, **belum siap** untuk rilis luas atau klaim “100% offline”.

### 1.2 Lima blocker utama

1. **Offline-first belum nyata** — produk tidak di-cache, stok lokal tidak berkurang, antrean tidak masuk laporan.
2. **Sync belum idempotent** — timeout setelah server commit bisa menghasilkan transaksi dobel.
3. **Laporan bisa terpotong 1.000 baris** — omzet/laba/CSV bisa salah tanpa error.
4. **APK release masih debug-signed** — tidak layak distribusi komersial dan menyulitkan update.
5. **Tidak ada recovery akun + logout menghapus profil nota** — risiko kehilangan akses dan data lokal.

### 1.3 Estimasi kasar (1 developer)

| Kelompok | Estimasi | Catatan |
|---|---|---|
| P0 (blocker) | 10–15 hari kerja | Termasuk migrasi SQL dan QA offline |
| P1 (penting) | 10–15 hari kerja | Bisa dipecah per sprint |
| P2 (fitur lanjutan) | 15–25 hari kerja | Tidak wajib untuk rilis pertama |
| Total sampai layak rilis luas | ± 4–6 minggu | Estimasi kasar, bukan komitmen |

---

## 2. Dashboard Progres

### 2.1 P0 — Blocker Rilis

| ID | Item | Status | Estimasi | Depends on | Catatan |
|---|---|---|---|---|---|
| P0-01 | Offline-first: cache katalog, stok lokal, merge antrean | ⬜ Belum | 4–6 hari | — | Blocker terbesar |
| P0-02 | Idempotensi sync & rekonsiliasi transaksi offline | ⬜ Belum | 2–3 hari | P0-01 | Cegah transaksi dobel |
| P0-03 | Laporan server-side + pagination | ⬜ Belum | 2–3 hari | — | Cegah data terpotong |
| P0-04 | Release signing, versioning, migrasi klien aktif | ⬜ Belum | 1–2 hari | — | Perlu koordinasi klien |
| P0-05 | Recovery akun (lupa password) | ⬜ Belum | 1–2 hari | — | Perlu keputusan metode |
| P0-06 | Hentikan kehilangan `StoreProfile` saat logout | ⬜ Belum | 1 hari | P0-01 | Sinkron profil ke cloud |
| P0-07 | PIN aman (hash + verifikasi server + gating) | ⬜ Belum | 2 hari | — | Perlu keputusan role |

### 2.2 P1 — Penting

| ID | Item | Status | Estimasi | Depends on | Catatan |
|---|---|---|---|---|---|
| P1-01 | Pisahkan kasbon/piutang dari uang tunai di laporan | ⬜ Belum | 0,5 hari | — | Salah hitung laci |
| P1-02 | Perbaikan siklus kasbon offline & pembayaran lintas HP | ⬜ Belum | 1–2 hari | P0-01 | Data bisa “hilang” |
| P1-03 | Tolak transaksi Rp 0 | ⬜ Belum | 0,2 hari | — | Cepat |
| P1-04 | Void / refund / retur + pengembalian stok | ⬜ Belum | 2–3 hari | P0-03 | Wajib POS produksi |
| P1-05 | Tutup kasir / shift + rekonsiliasi laci | ⬜ Belum | 2–3 hari | P1-01 | Tabel sudah ada |
| P1-06 | Kartu stok, restock, opname absolut | ⬜ Belum | 3–4 hari | P0-01 | Audit stok |
| P1-07 | Realtime / freshness multi-HP | ⬜ Belum | 1–2 hari | — | Cegah stok basi |
| P1-08 | Error boundary + crash reporting | ⬜ Belum | 1 hari | — | Support lapangan |
| P1-09 | Test, lint, CI minimum | ⬜ Belum | 2–3 hari | — | Cegah regresi |
| P1-10 | Bersihkan konfigurasi Android & permission | ⬜ Belum | 0,5 hari | P0-04 | Perlu native build |
| P1-11 | Konsolidasi sumber nama/profil toko | ⬜ Belum | 0,5 hari | P0-06 | Hilangkan duplikasi |
| P1-12 | Ekspor CSV ikut filter + rentang tanggal | ⬜ Belum | 0,5 hari | P0-03 | UX laporan |
| P1-13 | Escape HTML nota/label + satuan + logo | ⬜ Belum | 0,5 hari | — | Kerapian struk |
| P1-14 | Cek barcode saat update + arsip produk | ⬜ Belum | 0,5 hari | — | UX & integritas |
| P1-15 | Operasional Supabase (backup/PITR/monitoring) | ⬜ Belum | 1 hari | — | Zero data loss |
| P1-16 | Hardening admin API | ⬜ Belum | 0,5 hari | — | Hanya jika diekspos |
| P1-17 | Tegakkan atau hapus klaim lisensi | ⬜ Belum | 1–2 hari | — | Keputusan bisnis |
| P1-18 | Perbaiki klaim “100% offline” di Panduan/Onboarding | ⬜ Belum | 0,2 hari | — | Kejujuran produk |
| P1-19 | Pagination katalog produk | ⬜ Belum | 1 hari | P0-03 | >1.000 SKU |
| P1-20 | Splash screen & startup yang jelas | ⬜ Belum | 0,3 hari | — | Polish |

### 2.3 P2 — Fitur Lanjutan (setelah blocker)

| ID | Item | Status | Estimasi | Catatan |
|---|---|---|---|---|
| P2-01 | Backup/restore penuh + import produk CSV | ⬜ Belum | 3–4 hari | Wajib untuk migrasi perangkat |
| P2-02 | Role owner/kasir + audit log | ⬜ Belum | 4–5 hari | Jika ada karyawan |
| P2-03 | Purchase order / supplier / barang masuk | ⬜ Belum | 3–4 hari | Melengkapi kartu stok |
| P2-04 | Master pelanggan + riwayat kasbon | ⬜ Belum | 2–3 hari | Pengembangan kasbon |
| P2-05 | Diskon per item, pajak/service, pembulatan | ⬜ Belum | 2–3 hari | Kebutuhan F&B |
| P2-06 | Notifikasi stok menipis & laporan harian otomatis | ⬜ Belum | 1–2 hari | Retensi |
| P2-07 | Multi-outlet | ⬜ Belum | 5–8 hari | Setelah single-outlet stabil |
| P2-08 | Play Store readiness (privacy policy, Data Safety, hapus akun) | ⬜ Belum | 2–3 hari | Jika rilis Play Store |
| P2-09 | Dark mode & aksesibilitas | ⬜ Belum | 2–3 hari | Nice-to-have |
| P2-10 | Evaluasi upgrade Expo 54 → 57 | ⬜ Belum | 5–8 hari | Wajib regression native |

---

## 3. Detail P0 — Blocker

---

### P0-01 — Offline-first: cache katalog, stok lokal, merge antrean

**Status:** ⬜ Belum

**Masalah**
- Produk hanya dibaca dari Supabase (`TokoKelontong/src/database/productRepository.js:47-52`).
- Saat offline, `loadProducts()` menelan error dan membiarkan grid kosong (`TokoKelontong/src/screens/KasirScreen.js:147-159`).
- Antrean offline hanya menyimpan transaksi; stok lokal tidak dikurangi (`TokoKelontong/src/database/transactionRepository.js:183-200`).
- Laporan dan Home hanya membaca Supabase, bukan antrean (`TokoKelontong/src/screens/HomeScreen.js:52-73`, `LaporanScreen.js:108-136`).
- Gambar produk memakai URL cloud sehingga ikut hilang saat offline.

**Dampak**
- Buka aplikasi saat internet mati = tidak bisa berjualan.
- Penjualan offline berulang bisa melebihi stok.
- Omzet di Home/Laporan tidak sesuai uang yang diterima.
- Pemilik mengira ada data hilang.

**Rencana perbaikan**
- [ ] Tambah modul cache katalog, disarankan **SQLite** (`expo-sqlite` sudah ada di dependencies) atau minimal AsyncStorage ter-scope per `store_id`.
- [ ] Simpan minimal: `id, barcode, product_name, selling_price, capital_price, stock_quantity, min_stock_threshold, unit, category, image_uri, wholesale_rules, updated_at`.
- [ ] `getAllProducts`, `getProductByBarcode`, `getProductById` memakai pola **network-first, cache-fallback**.
- [ ] Tandai data cache dengan `cached_at` dan tampilkan banner “Data offline, terakhir diperbarui …”.
- [ ] Saat checkout offline: kurangi stok cache secara atomik (serialisasi write untuk mencegah race), lalu masukkan ke antrean.
- [ ] Saat sync sukses: refresh cache dari server.
- [ ] Saat sync gagal `insufficient_stock`: jangan hapus antrean; tandai `needs_review` dan tampilkan layar penyelesaian (void / sesuaikan stok).
- [ ] Home, Dashboard, dan Laporan menggabungkan transaksi server + antrean offline, dengan badge “termasuk transaksi offline”.
- [ ] Cache gambar produk (opsional, bisa fase berikut).
- [ ] Tambah indikator koneksi global (online/offline) di Home dan Kasir.

**File yang kemungkinan disentuh**
- `TokoKelontong/src/database/productRepository.js`
- `TokoKelontong/src/database/transactionRepository.js`
- `TokoKelontong/src/utils/offlineQueue.js`
- `TokoKelontong/src/screens/KasirScreen.js`
- `TokoKelontong/src/screens/HomeScreen.js`
- `TokoKelontong/src/screens/LaporanScreen.js`
- `TokoKelontong/src/screens/DashboardScreen.js`
- Baru: `TokoKelontong/src/database/localCatalog.js` (atau `src/services/offlineCatalog.js`)

**Definition of Done**
- [ ] Mode pesawat + force stop aplikasi → buka Kasir → daftar produk tetap muncul dari cache.
- [ ] Cari nama dan scan barcode tetap menemukan produk dari cache.
- [ ] Checkout offline berhasil, stok cache berkurang, nota `OFF-...` tercetak.
- [ ] Tutup dan buka ulang aplikasi → transaksi offline masih ada di antrean.
- [ ] Home menampilkan omzet yang sudah termasuk transaksi offline.
- [ ] Setelah online + sync, omzet tidak berubah dan tidak dobel.
- [ ] Tidak ada akses Supabase yang membuat layar crash ketika offline.

**QA manual**
1. Login, buka Kasir, pastikan produk termuat.
2. Aktifkan mode pesawat.
3. Force stop aplikasi, buka lagi.
4. Jual 2 transaksi, cek stok berkurang.
5. Restart aplikasi, cek antrean masih ada.
6. Matikan mode pesawat, sync, cocokkan total dengan nota.

**Risiko / rollback**
- Cache basi jika ada perubahan harga dari HP lain. Mitigasi: refresh saat fokus + timestamp + tombol refresh manual.
- Jangan menghapus cache saat logout kecuali atas permintaan eksplisit (lihat P0-06).

---

### P0-02 — Idempotensi sync & rekonsiliasi transaksi offline

**Status:** ⬜ Belum

**Masalah**
- `isNetworkError` menganggap `timeout` sebagai offline (`transactionRepository.js:46-57`).
- Jika RPC sudah commit di server tetapi respons terputus, transaksi masuk antrean.
- `syncOfflineQueue` mengirim ulang tanpa ID idempotensi (`transactionRepository.js:209-260`) → penjualan dan pengurangan stok dua kali.
- Nomor nota offline hanya diselipkan ke `payment_notes`, bukan pencarian yang andal.

**Dampak**
- Omzet dan stok bisa dobel.
- Nota pelanggan (`OFF-...`) tidak bisa dicocokkan dengan nota server (`INV/...`).
- Laporan keuangan tidak dapat dipercaya setelah gangguan jaringan.

**Rencana perbaikan**
- [ ] Generate `client_tx_id` (UUID v4) sekali per checkout, sebelum memanggil RPC.
- [ ] Kirim `client_tx_id` dan `offline_invoice_number` ke RPC `checkout`.
- [ ] Migrasi SQL: tambah kolom `client_tx_id text`, `offline_invoice_number text`, dan unique index `(store_id, client_tx_id) where client_tx_id is not null`.
- [ ] RPC `checkout` mengecek `client_tx_id`; jika sudah ada, kembalikan transaksi lama (idempotent), jangan kurangi stok lagi.
- [ ] Antrean menyimpan `client_tx_id`, `status` (`pending|syncing|synced|needs_review`), `attempts`, `last_error`, `last_attempt_at`.
- [ ] Gunakan `client_tx_id` saat sync, bukan membuat ID baru.
- [ ] Tambah timeout request eksplisit (mis. 10–15 detik) + cek konektivitas sebelum menganggap offline.
- [ ] Jika sync menerima “sudah ada”, anggap sukses dan hapus dari antrean.
- [ ] Simpan `offline_invoice_number` agar pencarian nota lama tetap bisa.

**File yang kemungkinan disentuh**
- `TokoKelontong/src/database/transactionRepository.js`
- `TokoKelontong/src/utils/offlineQueue.js`
- `supabase/migration_v8_*.sql` (baru)
- `TokoKelontong/src/screens/KasirScreen.js`
- `TokoKelontong/src/screens/LaporanScreen.js`

**Definition of Done**
- [ ] Simulasi: server commit lalu koneksi diputus sebelum respons diterima.
- [ ] Sync berikutnya tidak membuat transaksi kedua.
- [ ] Stok hanya berkurang satu kali.
- [ ] Nota `OFF-...` bisa dicari dan dikaitkan ke transaksi server.
- [ ] Sync berulang 3× pada data yang sama tetap menghasilkan satu transaksi.

**QA manual**
1. Gunakan akun dummy dan database uji.
2. Matikan Wi-Fi tepat setelah menekan “Selesaikan Transaksi” (atau gunakan proxy untuk memutus respons).
3. Pastikan transaksi masuk antrean.
4. Online-kan, sync 3 kali.
5. Cek `transactions` hanya ada 1 baris dan stok hanya berkurang sekali.

**Risiko / rollback**
- Perubahan RPC harus punya parameter default agar APK lama tetap bisa memanggil 6/8/10 parameter.
- Uji di Supabase staging/dummy terlebih dahulu, bukan langsung ke project klien.

---

### P0-03 — Laporan server-side + pagination

**Status:** ⬜ Belum

**Masalah**
- Semua query transaksi mengambil seluruh baris tanpa `.range()`:
  - `fetchTransactions` (`transactionRepository.js:33-44`)
  - `getFullReportForExport` (`:378-443`)
  - `getSummaryByDatePattern` (`:448-530`)
- Supabase/PostgREST memiliki batas default 1.000 baris.
- Agregasi omzet/laba dilakukan di perangkat setelah mengunduh semua detail.

**Dampak**
- Riwayat, omzet bulanan, laba, dan CSV bisa salah/terpotong tanpa pesan error.
- Boros kuota dan lambat pada toko ramai.
- Dashboard bisa freeze pada perangkat spek rendah.

**Rencana perbaikan**
- [ ] Buat RPC agregasi di server, misalnya `report_summary(p_start timestamptz, p_end timestamptz)` yang mengembalikan: omzet, laba, jumlah transaksi, tunai, non-tunai, kasbon/piutang, top products.
- [ ] Buat fungsi pagination riwayat: `getTransactionsPage({ start, end, page, pageSize })` memakai `.range(from, to)`.
- [ ] `getFullReportForExport` mengambil data per rentang tanggal/per halaman, bukan seluruh tabel sekaligus.
- [ ] Tambah index yang diperlukan (cek `transactions(store_id, created_at)` dan `transaction_details(transaction_id)` sudah ada).
- [ ] Pastikan total baris yang dikembalikan bisa diketahui (`count: 'exact'`) untuk pagination UI.
- [ ] Tambahkan loading state dan pesan “memuat halaman …”.

**File yang kemungkinan disentuh**
- `TokoKelontong/src/database/transactionRepository.js`
- `TokoKelontong/src/screens/LaporanScreen.js`
- `TokoKelontong/src/screens/DashboardScreen.js`
- `TokoKelontong/src/screens/HomeScreen.js`
- `supabase/migration_v8_*.sql` (RPC baru)

**Definition of Done**
- [ ] Database uji berisi >1.500 transaksi.
- [ ] Omzet/laba harian, bulanan, dan “semua” sama dengan hasil query SQL manual.
- [ ] Riwayat bisa scroll/halaman tanpa kehilangan data.
- [ ] CSV berisi jumlah baris yang sama dengan total transaksi pada rentang yang dipilih.
- [ ] Waktu muat Dashboard < 3 detik pada koneksi normal.

**QA manual**
1. Seed 1.500+ transaksi dummy (tanggal bervariasi).
2. Bandingkan `report_summary` dengan `select sum(grand_total)`.
3. Buka Laporan tab Harian/Bulanan/Riwayat.
4. Ekspor CSV, hitung baris, cocokkan.
5. Uji pada HP spek rendah.

**Risiko / rollback**
- RPC baru bersifat read-only; aman untuk data lama.
- Jangan mengubah signature RPC lama yang dipakai APK aktif.

---

### P0-04 — Release signing, versioning, dan migrasi klien aktif

**Status:** ⬜ Belum

**Masalah**
- `TokoKelontong/android/app/build.gradle` memakai `signingConfigs.debug` untuk build `release`.
- `versionCode 1`, `versionName "1.0.0"` statis.
- `_build_apk_local.bat` menjalankan `assembleRelease` dengan konfigurasi tersebut.
- `runtimeVersion` masih statis `1.0.0`, berisiko OTA tidak cocok dengan APK native lama.

**Dampak**
- APK komersial memakai debug key yang kredensialnya umum.
- Tidak layak untuk Play Store; update bisa bentrok.
- Risiko OTA mengirim JS yang membutuhkan modul native yang belum ada di APK lama.

**Rencana perbaikan**
- [ ] Buat keystore produksi (JKS) di luar repo; simpan password di password manager.
- [ ] Konfigurasi signing release melalui environment variable / EAS credentials, jangan hardcode.
- [ ] Naikkan `versionCode` dan `versionName` setiap rilis.
- [ ] Gunakan `appVersionSource: remote` atau catat versioning manual yang konsisten.
- [ ] Ganti `runtimeVersion` statis menjadi fingerprint atau bump eksplisit setiap perubahan native.
- [ ] Dokumentasikan prosedur backup keystore (minimal 2 salinan aman).
- [ ] Siapkan **jalur migrasi klien aktif** karena Android tidak mengizinkan update dengan tanda tangan (signing key) berbeda:
  - Build versi “migration” yang masih memakai key lama dan menambahkan fitur **Ekspor Data Lokal** (antrean offline, `StoreProfile`, printer, lisensi, held orders).
  - Klien ekspor → uninstall → install APK release baru → import.
  - Data cloud (produk, transaksi, kasbon) tetap aman karena tersimpan di Supabase.
- [ ] Jika tidak mau migrasi, opsi sementara: pertahankan key lama untuk update klien aktif, dan gunakan key baru hanya untuk instalasi baru. Catat sebagai technical debt.

**File yang kemungkinan disentuh**
- `TokoKelontong/android/app/build.gradle` (generated; konfigurasi via `app.json`/EAS)
- `TokoKelontong/app.json`
- `TokoKelontong/eas.json`
- `TokoKelontong/_build_apk_local.bat`
- `TokoKelontong/PANDUAN_BUILD_APK.md`
- `TokoKelontong/PANDUAN_INSTALL_DAN_UPDATE.md`

**Definition of Done**
- [ ] `apksigner verify --print-certs app-release.apk` menunjukkan sertifikat release, bukan `CN=Android Debug`.
- [ ] APK baru bisa di-install di perangkat bersih.
- [ ] Proses migrasi klien aktif diuji end-to-end di HP dummy.
- [ ] OTA hanya diterima oleh APK dengan runtimeVersion yang cocok.
- [ ] Dokumen backup keystore tersedia.

**QA manual**
1. Build release, verifikasi sertifikat.
2. Install di perangkat kosong.
3. Simulasikan klien lama: install versi migration, ekspor data, uninstall, install release baru, import.
4. Pastikan antrean offline dan profil nota kembali.
5. Uji update OTA dari versi N ke N+1.

**Risiko / rollback**
- Pergantian signing key = wajib uninstall untuk klien lama. Jangan lakukan tanpa komunikasi dan ekspor data.
- Simpan APK versi lama untuk rollback.

---

### P0-05 — Recovery akun (lupa password)

**Status:** ⬜ Belum

**Masalah**
- Login memakai username → email internal `username@marketpos.app` (`authService.js:6-9`).
- Tidak ada tombol “Lupa Password” di `AuthScreen`.
- Reset hanya bisa dilakukan developer lewat dashboard Supabase.

**Dampak**
- Pemilik toko bisa kehilangan akses permanen.
- Beban support manual ke developer.
- Tidak layak untuk produk berbayar.

**Rencana perbaikan (pilih salah satu, perlu keputusan)**
- **Opsi A (disarankan):** tambah email/WhatsApp opsional saat daftar; gunakan `supabase.auth.resetPasswordForEmail` untuk email asli.
- **Opsi B:** OTP WhatsApp melalui Edge Function + admin API.
- **Opsi C:** recovery code sekali pakai yang dibuat saat registrasi, disimpan user.
- [ ] Tambah UI “Lupa Password” di `AuthScreen`.
- [ ] Tambah layar input kode/OTP + password baru.
- [ ] Invalidasi sesi lama setelah reset.
- [ ] Catat aktivitas reset di audit log (jika P2-02 sudah ada).

**File yang kemungkinan disentuh**
- `TokoKelontong/src/screens/AuthScreen.js`
- `TokoKelontong/src/services/authService.js`
- `supabase/migration_v8_*.sql` (jika perlu tabel recovery)
- `admin-api` (jika memakai OTP WhatsApp)

**Definition of Done**
- [ ] Pengguna bisa reset password tanpa bantuan developer.
- [ ] Password lama tidak berlaku setelah reset.
- [ ] Sesi di perangkat lain diinvalidasi atau diminta login ulang.
- [ ] Tidak ada cara menebak username/akun orang lain lewat pesan error.

**QA manual**
1. Daftar akun dummy.
2. Logout, klik “Lupa Password”.
3. Ikuti alur reset.
4. Login dengan password baru.
5. Coba login dengan password lama → harus gagal.

---

### P0-06 — Hentikan kehilangan `StoreProfile` saat logout

**Status:** ⬜ Belum

**Masalah**
- `clearStoreLocalSession()` menghapus `@TokoKelontong:StoreProfile` saat logout (`authService.js:15-29`).
- Alamat, kontak, footer nota, dan logo hanya tersimpan di key tersebut, tidak di cloud.
- `storeName` juga dihapus.

**Dampak**
- Setelah logout/login, format nota bisa kembali default.
- Klien merasa kehilangan pengaturan.
- Multi-HP tidak konsisten.

**Rencana perbaikan**
- [ ] Jangan hapus `StoreProfile` saat logout; hapus hanya lewat aksi eksplisit “Reset Pengaturan”.
- [ ] Simpan profil nota ke tabel `stores` (tambahkan kolom `address`, `contact`, `footer_message`, `logo_url`) agar sinkron lintas HP.
- [ ] Scope key lokal per `store_id`, bukan global.
- [ ] Saat login, merge profil cloud → lokal dengan strategi “cloud menang” kecuali offline.
- [ ] Hapus duplikasi sumber `storeName` (AsyncStorage vs `StoreProfile` vs `stores.store_name`).

**File yang kemungkinan disentuh**
- `TokoKelontong/src/services/authService.js`
- `TokoKelontong/src/screens/PengaturanScreen.js`
- `TokoKelontong/src/screens/SettingNotaScreen.js`
- `TokoKelontong/src/context/AppContext.js`
- `supabase/migration_v8_*.sql`

**Definition of Done**
- [ ] Logout → login kembali → alamat/kontak/footer/logo nota tetap ada.
- [ ] Ganti profil nota di HP A → HP B melihat perubahan setelah refresh.
- [ ] Reset eksplisit tetap bisa menghapus profil dengan konfirmasi.

**QA manual**
1. Isi alamat, kontak, footer, logo.
2. Logout.
3. Login lagi.
4. Buka Setting Nota dan cetak struk → data masih ada.
5. Ulangi di HP kedua.

---

### P0-07 — PIN aman (hash + verifikasi server + gating)

**Status:** ⬜ Belum

**Masalah**
- PIN disimpan plaintext di AsyncStorage (`securityPin.js:163-205`).
- PIN disimpan plaintext di `stores.security_pin` (migration v5) dan bisa dibaca lewat `stores_select_own`.
- Gating hanya di `HomeScreen` (`HomeScreen.js:106-114`), bukan di level screen/navigasi.
- Semua HP memakai akun toko yang sama, sehingga “kasir vs owner” tidak benar-benar terpisah.

**Dampak**
- PIN bisa dibaca atau dinonaktifkan oleh kasir yang paham teknis.
- Proteksi owner bersifat kosmetik.

**Rencana perbaikan**
- [ ] Hapus PIN plaintext dari `stores` dan dari `select` profil.
- [ ] Buat tabel `store_security` (atau kolom `pin_hash`) dengan hash + salt.
- [ ] Verifikasi PIN lewat RPC `verify_store_pin` dengan rate limit dan lockout (mis. 5 gagal → tunggu 5 menit).
- [ ] Untuk mode offline, simpan hash lokal + counter percobaan; jangan simpan PIN asli.
- [ ] Gating di level screen/guard, bukan hanya tombol Home.
- [ ] Opsional: lock otomatis saat aplikasi masuk background.
- [ ] Jika ingin pemisahan owner/kasir, buat akun terpisah dengan role dan RLS (masuk P2-02).

**File yang kemungkinan disentuh**
- `TokoKelontong/src/utils/securityPin.js`
- `TokoKelontong/src/components/PinModal.js`
- `TokoKelontong/src/screens/HomeScreen.js`
- `TokoKelontong/src/screens/PengaturanScreen.js`
- `TokoKelontong/src/services/authService.js`
- `supabase/migration_v8_*.sql`

**Definition of Done**
- [ ] Tidak ada PIN plaintext di database maupun AsyncStorage.
- [ ] PIN tidak bisa dibaca lewat query client.
- [ ] 5 percobaan salah → terkunci sementara.
- [ ] Navigasi langsung ke screen terkunci tetap meminta PIN.
- [ ] Menonaktifkan PIN memerlukan PIN lama.

**QA manual**
1. Set PIN, cek isi AsyncStorage dan tabel `stores` → tidak ada PIN asli.
2. Coba akses Gudang/Laporan/Pengaturan → diminta PIN.
3. Salah 5× → terkunci.
4. Restart aplikasi → status lock tetap.
5. Ganti/hapus PIN dengan PIN lama.

---

## 4. Detail P1 — Penting

---

### P1-01 — Pisahkan kasbon/piutang dari uang tunai

**Masalah:** `getSummaryByDatePattern` memasukkan metode `kasbon` ke `omzet_tunai` karena hanya `qris/transfer/debit` yang dianggap non-tunai (`transactionRepository.js:498-503`).

**Dampak:** rekap “Tunai di Laci” terlalu besar; kasir mengira uang fisik kurang.

**Rencana**
- [ ] Pisahkan kategori: `tunai`, `non_tunai`, `kasbon/piutang`, `dp_kasbon`.
- [ ] Omzet tetap memakai `grand_total` (akrual), tetapi “uang diterima” hanya menghitung tunai + non-tunai + DP.
- [ ] Tampilkan dua angka: “Omzet (akrual)” dan “Uang Masuk”.
- [ ] Sesuaikan pesan WhatsApp tutup toko.

**DoD**
- [ ] Transaksi kasbon Rp 100.000 dengan DP Rp 20.000 → uang masuk Rp 20.000, piutang Rp 80.000.
- [ ] Rekap laci cocok dengan uang fisik.

---

### P1-02 — Perbaikan siklus kasbon offline & lintas HP

**Masalah**
- Kasbon offline disimpan lokal, tetapi `getDebts()` hanya mengembalikan data server saat online (`debtRepository.js:74-78`).
- `recordPayment` jika data lokal tidak ditemukan menghasilkan `remaining_debt = 0` tetapi status `unpaid` (`:228-245`).
- Pembayaran untuk kasbon yang belum ada di server bisa gagal FK dan hanya di-`catch`.
- `invoice_number` kasbon dari kasir dikirim kosong.

**Rencana**
- [ ] Simpan kasbon ke antrean offline yang ikut disinkronkan (atau gunakan local-first + sync).
- [ ] `getDebts` menggabungkan data server + lokal yang belum tersinkron, dengan penanda “belum tersinkron”.
- [ ] Hitung sisa hutang dari data server (bukan cache) saat online; validasi ulang sebelum update.
- [ ] Kirim `invoice_number` dari transaksi.
- [ ] Jangan biarkan pembayaran “sukses” jika update server gagal; tandai pending.
- [ ] Tambah rekonsiliasi otomatis saat sync.

**DoD**
- [ ] Kasbon dibuat offline → muncul di Buku Kasbon → setelah sync muncul di HP lain.
- [ ] Pembayaran dari HP kedua mengurangi sisa hutang dengan benar.
- [ ] Tidak ada status `remaining = 0` tetapi `unpaid`.

---

### P1-03 — Tolak transaksi Rp 0

**Masalah:** `grandTotal` bisa 0 saat diskon = total; validasi `cash >= grandTotal` lolos (`KasirScreen.js:307-308, 1827-1830`).

**Rencana**
- [ ] Tambah validasi `grandTotal > 0` di `handleBayar` dan `canSubmit`.
- [ ] Validasi server-side di RPC `checkout` (tolak `p_grand_total <= 0`, kecuali ada alasan bisnis eksplisit).
- [ ] Tambah pesan “Total tidak boleh Rp 0”.

**DoD**
- [ ] Diskon 100% tidak bisa diselesaikan sebagai transaksi biasa.
- [ ] Tidak ada row transaksi dengan `grand_total = 0` baru.

---

### P1-04 — Void / refund / retur + pengembalian stok

**Masalah:** belum ada mekanisme pembatalan transaksi. Salah input hanya bisa dibiarkan.

**Rencana**
- [ ] Tambah status transaksi: `completed`, `voided`, `refunded`, `partially_refunded`.
- [ ] RPC `void_transaction(p_transaction_id, p_reason)` yang mengembalikan stok secara atomik dan mencatat audit.
- [ ] UI di Laporan: tombol “Batalkan” dengan PIN owner + alasan wajib.
- [ ] Refund parsial per item (bisa fase berikut).
- [ ] Laporan mengecualikan transaksi void dari omzet, tetapi tetap menampilkannya di riwayat.
- [ ] Cetak nota pembatalan.

**DoD**
- [ ] Transaksi void → stok kembali, omzet berkurang, riwayat tetap ada.
- [ ] Tidak bisa void dua kali.
- [ ] Hanya owner/PIN yang bisa void.

---

### P1-05 — Tutup kasir / shift + rekonsiliasi laci

**Masalah:** tabel `cashier_shifts` dan `shift_expenses` sudah ada di migration v6, tetapi belum ada UI/logika.

**Rencana**
- [ ] Layar “Buka Shift” (modal awal, nama kasir).
- [ ] Hitung otomatis penjualan tunai/non-tunai, kasbon, DP, dan pengeluaran.
- [ ] Layar “Tutup Shift”: input uang fisik, hitung selisih, catatan.
- [ ] Cetak/WA rekap tutup kasir.
- [ ] Cegah checkout jika belum buka shift (opsional, bisa toggle di Pengaturan).

**DoD**
- [ ] Buka shift → jualan → tutup shift → selisih benar.
- [ ] Rekap bisa dicetak dan dikirim WA.
- [ ] Data shift tersimpan dan bisa dilihat kembali.

---

### P1-06 — Kartu stok, restock, opname absolut

**Masalah**
- Stok hanya diubah langsung lewat form edit; tidak ada riwayat mutasi.
- Edit stok memakai delta (`AddProductScreen.js:656-663`), bukan mode opname absolut.
- Tidak ada pencatatan barang masuk/rusak.

**Rencana**
- [ ] Tabel `stock_movements`: `product_id`, `type` (`sale`, `restock`, `opname`, `damage`, `return`, `void`), `qty_change`, `stock_before`, `stock_after`, `reference_id`, `note`, `created_by`, `created_at`.
- [ ] Semua pengurangan/penambahan stok wajib lewat RPC yang mencatat mutasi.
- [ ] UI “Stok Masuk” dan “Stok Keluar/Rusak”.
- [ ] Mode opname: input stok fisik → sistem menghitung selisih dan mencatat alasannya.
- [ ] Halaman riwayat kartu stok per produk.

**DoD**
- [ ] Setiap perubahan stok punya baris mutasi.
- [ ] Opname 100 → 80 tercatat sebagai koreksi 20.
- [ ] Riwayat stok bisa difilter per produk/tanggal.

---

### P1-07 — Realtime / freshness multi-HP

**Masalah:** tidak ada `supabase.channel().subscribe()`; refresh hanya saat layar difokuskan.

**Rencana**
- [ ] Subscribe perubahan `products` dan `transactions` per `store_id` saat Kasir/Gudang aktif.
- [ ] Debounce refresh agar tidak boros.
- [ ] Fallback polling ringan (mis. 30–60 detik) jika realtime gagal.
- [ ] Tampilkan “stok diperbarui …” dan tombol refresh manual.
- [ ] Tetap andalkan RPC atomik untuk mencegah oversell.

**DoD**
- [ ] Jual di HP A → stok di HP B berubah < 5 detik.
- [ ] Tidak ada loop refresh berlebihan.
- [ ] Saat offline, fallback cache tetap jalan.

---

### P1-08 — Error boundary + crash reporting

**Masalah:** error hanya `console.log`; tidak ada jejak crash di lapangan.

**Rencana**
- [ ] Tambah React Error Boundary global dengan layar “Terjadi kesalahan” + tombol kirim laporan.
- [ ] Integrasi crash reporting (Sentry/Bugsnag/Firebase Crashlytics) atau minimal log file lokal yang bisa diekspor.
- [ ] Catat versi app, device, dan langkah terakhir.
- [ ] Jangan kirim data sensitif (password, PIN, isi transaksi lengkap) ke log.

**DoD**
- [ ] Crash buatan tertangkap dan menampilkan layar pemulihan.
- [ ] Laporan berisi versi app dan stack trace.
- [ ] Tidak ada data sensitif di log.

---

### P1-09 — Test, lint, CI minimum

**Masalah:** tidak ada test/lint/CI; perubahan berisiko regresi.

**Rencana**
- [ ] Tambah ESLint + Prettier.
- [ ] Unit test untuk logika uang, diskon, grosir, kasbon, dan format tanggal.
- [ ] Test integrasi untuk `transactionRepository` dengan mock Supabase.
- [ ] Minimal smoke test: login, tambah produk, checkout, laporan.
- [ ] GitHub Actions: lint + test + `expo export` pada setiap push.
- [ ] Jangan jalankan OTA production otomatis; tetap manual setelah checklist.

**DoD**
- [ ] `npm run lint` dan `npm test` lulus.
- [ ] CI berjalan di PR.
- [ ] Minimal 1 test untuk setiap perhitungan uang.

---

### P1-10 — Bersihkan konfigurasi Android & permission

**Masalah**
- `app.json` meminta `RECORD_AUDIO`, `READ/WRITE_EXTERNAL_STORAGE`, dan plugin `expo-sqlite` yang tidak dipakai.
- `CAMERA` duplikat.
- `runtimeVersion` statis.
- `versionCode` statis.

**Rencana**
- [ ] Hapus `RECORD_AUDIO` dan permission storage yang tidak perlu.
- [ ] Pertahankan hanya permission kamera + Bluetooth yang benar-benar dipakai.
- [ ] Hapus plugin `expo-sqlite` jika tidak dipakai (atau pertahankan jika P0-01 memilih SQLite).
- [ ] Pastikan `targetSdkVersion` memenuhi syarat Play Store saat ini.
- [ ] Naikkan versionCode/versionName.
- [ ] Uji ulang scanner, kamera, dan printer setelah perubahan.

**DoD**
- [ ] Daftar permission di APK hanya yang diperlukan.
- [ ] Aplikasi tetap bisa scan barcode, foto produk, dan cetak Bluetooth.
- [ ] Tidak ada warning permission saat instalasi.

---

### P1-11 — Konsolidasi sumber nama/profil toko

**Masalah:** nama toko tersebar di `AsyncStorage storeName`, `@TokoKelontong:StoreProfile`, `stores.store_name`, dan `AppContext`.

**Rencana**
- [ ] Tetapkan satu sumber kebenaran: tabel `stores` untuk data cloud, cache lokal untuk offline.
- [ ] Hapus penulisan ganda yang tidak perlu.
- [ ] Migrasi data lama ke skema baru tanpa menghapus key lama (fallback).

**DoD**
- [ ] Ganti nama toko di satu tempat → semua layar dan struk ikut berubah.
- [ ] Tidak ada data yang hilang setelah migrasi.

---

### P1-12 — Ekspor CSV ikut filter + rentang tanggal

**Masalah:** tombol ekspor selalu mengambil seluruh riwayat (`LaporanScreen.js:174-182`).

**Rencana**
- [ ] Ekspor mengikuti tab/rentang tanggal yang aktif.
- [ ] Tambah opsi “Semua Riwayat” secara eksplisit.
- [ ] Nama file mencerminkan rentang.
- [ ] Gunakan pagination/streaming dari P0-03.

**DoD**
- [ ] Ekspor Harian hanya berisi hari itu.
- [ ] Ekspor Bulanan hanya berisi bulan itu.
- [ ] Jumlah baris cocok dengan ringkasan di layar.

---

### P1-13 — Escape HTML nota/label + satuan + logo

**Masalah**
- `product_name`/`storeName` disisipkan langsung ke HTML (`receiptGenerator.js:169, 302, 386, 409`).
- Satuan WhatsApp hardcode `pcs` (`:21`).
- Logo toko tidak dirender di nota.

**Rencana**
- [ ] Tambah fungsi `escapeHtml` untuk semua nilai dinamis.
- [ ] Gunakan `item.unit || 'pcs'`.
- [ ] Render logo toko di header HTML/struk jika tersedia.
- [ ] Uji nama produk mengandung `<`, `>`, `&`, `"`.

**DoD**
- [ ] Nama produk aneh tidak merusak layout.
- [ ] Satuan sesuai produk.
- [ ] Logo muncul di nota.

---

### P1-14 — Cek barcode saat update + arsip produk

**Masalah**
- `updateProduct` tidak cek duplikat barcode; error unique constraint muncul mentah (`productRepository.js:226-291`).
- `deleteProduct` hard delete tanpa arsip.

**Rencana**
- [ ] Cek barcode duplikat sebelum update, kecuali milik produk sendiri.
- [ ] Ubah hapus menjadi soft delete (`is_archived`) atau konfirmasi yang jelas.
- [ ] Sembunyikan produk arsip dari Kasir, tetapi tetap tampil di riwayat.
- [ ] Tambah opsi “Pulihkan produk”.

**DoD**
- [ ] Edit barcode duplikat menampilkan pesan ramah.
- [ ] Produk terhapus tidak muncul di Kasir, tetapi riwayat transaksi tetap utuh.

---

### P1-15 — Operasional Supabase (backup/PITR/monitoring)

**Masalah:** klaim “zero data loss” belum didukung backup terjadwal dan prosedur restore.

**Rencana**
- [ ] Pastikan project memakai paket yang tidak di-pause otomatis.
- [ ] Aktifkan backup harian/PITR sesuai paket.
- [ ] Jadwalkan ekspor data berkala (produk, transaksi, kasbon).
- [ ] Dokumentasikan prosedur restore dan uji sekali.
- [ ] Pantau error rate, kuota, dan storage.
- [ ] Simpan kredensial service role hanya di server, bukan di repo.

**DoD**
- [ ] Ada backup terbaru yang bisa direstore.
- [ ] Uji restore ke project dummy berhasil.
- [ ] Dokumen prosedur tersedia.

---

### P1-16 — Hardening admin API

**Masalah:** `admin-api` memakai default `admin123`, tanpa rate limit login; hanya read-only tetapi memegang service role.

**Rencana**
- [ ] Wajib ganti password default saat start (tolak `admin123` di production).
- [ ] Tambah rate limit login dan lockout.
- [ ] Pastikan hanya listen di `127.0.0.1` atau di belakang VPN.
- [ ] Rotasi `API_TOKEN`.
- [ ] Jangan pernah deploy dengan service role di client.

**DoD**
- [ ] Login brute force dibatasi.
- [ ] Server tidak bisa diakses dari internet publik.
- [ ] Tidak ada password default.

---

### P1-17 — Tegakkan atau hapus klaim lisensi

**Masalah**
- `getLicenseInfo` hanya dipakai untuk menampilkan status di Pengaturan; tidak memblokir fitur.
- Trial 14 hari tidak ditegakkan.
- `EXPO_PUBLIC_LICENSE_SALT` ikut ter-embed di APK.
- Device ID berbasis AsyncStorage; hapus data = trial baru.

**Rencana (pilih salah satu)**
- **Tegakkan:** verifikasi lisensi di server + Play Billing/aktivasi online; atau
- **Sederhanakan:** hapus klaim trial/lisensi dan jadikan fitur aktivasi manual sebagai pencatatan administratif.

**DoD**
- [ ] Tidak ada klaim yang tidak sesuai perilaku aplikasi.
- [ ] Jika ditegakkan, tidak bisa diakali dengan hapus data aplikasi.
- [ ] Jika tidak ditegakkan, UI tidak menampilkan “TRIAL” yang menyesatkan.

---

### P1-18 — Perbaiki klaim “100% offline” di Panduan/Onboarding

**Masalah:** `PanduanScreen.js:201,226` masih menyebut “Backup & Restore Data (Pure Offline)” dan “100% Pure Offline”.

**Rencana**
- [ ] Ganti dengan deskripsi akurat: “Transaksi tetap bisa disimpan saat offline, data disinkronkan saat online.”
- [ ] Hapus bagian backup/restore yang tidak ada, atau implementasikan (P2-01).
- [ ] Tambah bagian “Cara kerja offline & sync” yang menjelaskan antrean dan status.

**DoD**
- [ ] Tidak ada lagi klaim “100% offline” yang menyesatkan.
- [ ] Panduan sesuai fitur aktual.

---

### P1-19 — Pagination katalog produk

**Masalah:** `getAllProducts` mengambil semua produk tanpa batas; berpotensi terpotong 1.000 baris untuk toko besar.

**Rencana**
- [ ] Tambah pagination/search server-side untuk Gudang.
- [ ] Untuk Kasir, tetap cache produk aktif (lihat P0-01) tetapi muat bertahap.
- [ ] Tambah index pencarian nama/barcode.

**DoD**
- [ ] Toko dengan 2.000+ SKU tetap bisa mencari dan menjual semua produk.
- [ ] Tidak ada produk “hilang” dari daftar.

---

### P1-20 — Splash screen & startup yang jelas

**Masalah:** `App.js` mengembalikan `null` saat font belum siap; layar blank putih.

**Rencana**
- [ ] Tambah `expo-splash-screen` dengan logo MarketPos.
- [ ] Tampilkan status “Memuat data…” saat auth/profile belum siap.
- [ ] Tangani kegagalan font dengan fallback.

**DoD**
- [ ] Tidak ada layar putih kosong saat startup.
- [ ] Splash hilang setelah app siap.

---

## 5. Detail P2 — Fitur Lanjutan

> P2 tidak wajib untuk rilis produksi pertama. Kerjakan setelah P0 dan P1 stabil.

| ID | Fitur | Ringkasan | Definition of Done |
|---|---|---|---|
| P2-01 | Backup/restore penuh + import CSV | Ekspor/impor produk, transaksi, kasbon, pengaturan; backup otomatis harian | Restore ke perangkat baru menghasilkan data identik |
| P2-02 | Role owner/kasir + audit log | Akun terpisah, hak akses per role, catat siapa melakukan apa | Kasir tidak bisa ubah HPP/hapus transaksi; audit bisa difilter |
| P2-03 | Purchase order/supplier | Barang masuk, supplier, harga beli, hutang supplier | Stok dan kartu stok bertambah otomatis |
| P2-04 | Master pelanggan | Profil pelanggan, riwayat kasbon, nomor WA | Kasbon terhubung ke pelanggan, bukan hanya nama |
| P2-05 | Diskon per item, pajak, pembulatan | Kebutuhan F&B/resto | Total dan struk sesuai aturan pajak |
| P2-06 | Notifikasi & laporan otomatis | Stok menipis, rekap harian ke WA | Notifikasi muncul tanpa membuka app |
| P2-07 | Multi-outlet | Beberapa toko dalam satu akun | Laporan dan stok terpisah per outlet |
| P2-08 | Play Store readiness | Privacy policy, Data Safety, hapus akun, screenshot, AAB | Lolos review internal testing |
| P2-09 | Dark mode & aksesibilitas | Kontras, font scaling, label tombol | Lulus uji aksesibilitas dasar |
| P2-10 | Upgrade Expo 54 → 57 | Ikuti `AGENTS.md`, uji native | Semua fitur native tetap jalan |

---

## 6. Perubahan Database yang Direncanakan (Non-Destructive)

> Semua perubahan WAJIB mengikuti aturan di `ROADMAP_UPDATE_DAN_ATURAN_RILIS_AMAN.md`: add-only, default value, tanpa DROP/RENAME, RPC dengan parameter default.

### 6.1 Migrasi v8 (usulan)

```sql
-- Contoh arah, bukan script final. Jalankan di project dummy dulu.

-- 1. Idempotensi transaksi
alter table public.transactions
  add column if not exists client_tx_id text,
  add column if not exists offline_invoice_number text;

create unique index if not exists transactions_client_tx_uniq
  on public.transactions (store_id, client_tx_id)
  where client_tx_id is not null;

-- 2. Status transaksi (void/refund)
alter table public.transactions
  add column if not exists status text not null default 'completed',
  add column if not exists void_reason text default '',
  add column if not exists voided_at timestamptz default null;

-- 3. Profil toko di cloud
alter table public.stores
  add column if not exists address text default '',
  add column if not exists contact text default '',
  add column if not exists footer_message text default '',
  add column if not exists logo_url text default null;

-- 4. Kartu stok
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  type text not null,
  qty_change integer not null,
  stock_before integer,
  stock_after integer,
  reference_id uuid,
  note text default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5. Keamanan PIN (jangan simpan plaintext)
create table if not exists public.store_security (
  store_id uuid primary key references public.stores(id) on delete cascade,
  pin_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz default null,
  updated_at timestamptz not null default now()
);
```

### 6.2 RPC baru/usulan

- `checkout(..., p_client_tx_id text default null, p_offline_invoice_number text default '')` → idempotent.
- `report_summary(p_start timestamptz, p_end timestamptz)` → agregasi omzet/laba/tunai/non-tunai/kasbon.
- `void_transaction(p_transaction_id uuid, p_reason text)` → void + restore stok + audit.
- `record_stock_movement(...)` → semua mutasi stok.
- `verify_store_pin(p_pin text)` → verifikasi + rate limit.
- `set_store_pin(p_old_pin text, p_new_pin text)` / `remove_store_pin(p_pin text)`.

### 6.3 Aturan kompatibilitas

- [ ] APK lama yang masih memanggil `checkout` 6/8/10 parameter tetap berjalan.
- [ ] Kolom baru selalu punya `DEFAULT`.
- [ ] Jangan hapus `stores.security_pin` sebelum semua klien pindah; biarkan sebagai legacy sampai migrasi aman.
- [ ] Uji migrasi pada salinan database, bukan langsung production.

---

## 7. Matriks Pengujian

### 7.1 Skenario wajib

| No | Skenario | Ekspektasi | Status |
|---|---|---|---|
| T-01 | Cold start offline (force stop + mode pesawat) | Produk dari cache muncul, bisa checkout | ⬜ |
| T-02 | Checkout offline lalu restart app | Antrean & stok lokal tetap benar | ⬜ |
| T-03 | Sync setelah offline | Tidak dobel, stok benar, laporan cocok | ⬜ |
| T-04 | Timeout setelah server commit | Tidak ada transaksi dobel | ⬜ |
| T-05 | 2 HP jual barang terakhir bersamaan | Satu berhasil, satu `insufficient_stock` | ⬜ |
| T-06 | 1.500+ transaksi | Laporan & CSV tidak terpotong | ⬜ |
| T-07 | Kasbon dengan DP | Uang laci & piutang benar | ⬜ |
| T-08 | Kasbon dibuat offline | Muncul & tersinkron | ⬜ |
| T-09 | Pembayaran kasbon dari HP kedua | Sisa hutang benar | ⬜ |
| T-10 | Diskon 100% | Ditolak, tidak ada transaksi Rp 0 | ⬜ |
| T-11 | Void transaksi | Stok kembali, omzet berkurang | ⬜ |
| T-12 | Tutup shift | Selisih laci benar | ⬜ |
| T-13 | Opname stok | Selisih tercatat di kartu stok | ⬜ |
| T-14 | Logout → login | Profil nota tidak hilang | ⬜ |
| T-15 | Lupa password | Bisa reset tanpa developer | ⬜ |
| T-16 | PIN salah 5× | Terkunci sementara | ⬜ |
| T-17 | Cetak Bluetooth | Nota & label tetap tercetak | ⬜ |
| T-18 | Nama produk `<>&"` | Struk tidak rusak | ⬜ |
| T-19 | APK release | Sertifikat release, bukan debug | ⬜ |
| T-20 | OTA update | Hanya diterima APK dengan runtime cocok | ⬜ |
| T-21 | Restore backup | Data kembali lengkap | ⬜ |
| T-22 | HP spek rendah | Dashboard < 3 detik | ⬜ |

### 7.2 Data uji

- [ ] Akun dummy terpisah dari akun klien.
- [ ] Minimal 1.500 transaksi dummy dengan variasi metode bayar.
- [ ] Minimal 2.000 produk dummy untuk uji pagination.
- [ ] Printer Bluetooth fisik untuk uji cetak.
- [ ] Dua HP Android untuk uji multi-device.

---

## 8. Rencana Rollout & Keamanan Update

1. [ ] Semua perubahan diuji di project Supabase dummy.
2. [ ] Jalankan migrasi SQL di production (add-only) pada jam sepi.
3. [ ] Rilis APK native baru (jika ada perubahan permission/native module) lebih dulu.
4. [ ] Setelah APK baru terpasang di perangkat klien, baru kirim OTA JS.
5. [ ] Pantau error dan antrean offline selama 24–48 jam.
6. [ ] Siapkan APK versi sebelumnya untuk rollback.
7. [ ] Jangan mengirim OTA ke `production` sebelum checklist Bagian 10 lulus.

**Catatan penting:** perubahan permission Android **tidak bisa** dikirim lewat OTA; wajib build APK baru.

---

## 9. Urutan Eksekusi & Milestone

### Milestone 1 — Offline benar-benar jalan (P0-01, P0-02)
Target: kasir bisa buka app dan jualan saat offline, lalu sync tanpa dobel.

- [ ] Cache katalog + stok lokal
- [ ] Checkout offline local-first
- [ ] Merge antrean ke laporan
- [ ] Idempotensi sync (`client_tx_id`)
- [ ] Uji T-01 s/d T-04

### Milestone 2 — Laporan & akuntansi benar (P0-03, P1-01, P1-02, P1-03)
Target: angka omzet, laba, uang laci, dan CSV bisa dipercaya.

- [ ] RPC agregasi + pagination
- [ ] Pisahkan kasbon/piutang
- [ ] Perbaiki siklus kasbon
- [ ] Tolak Rp 0
- [ ] Uji T-05 s/d T-10

### Milestone 3 — Siap rilis (P0-04 s/d P0-07, P1-08 s/d P1-10, P1-15, P1-18)
Target: APK aman, akun bisa dipulihkan, data tidak hilang saat logout, PIN aman.

- [ ] Signing + versioning + migrasi klien
- [ ] Recovery akun
- [ ] Profil nota tidak hilang
- [ ] PIN aman
- [ ] Error boundary + CI
- [ ] Permission bersih
- [ ] Klaim offline diperbaiki
- [ ] Uji T-14 s/d T-20

### Milestone 4 — Operasional toko (P1-04 s/d P1-07, P1-11 s/d P1-14, P1-16, P1-17, P1-19, P1-20)
Target: void, shift, kartu stok, realtime, ekspor, dan kualitas struk.

- [ ] Void/refund
- [ ] Shift & laci
- [ ] Kartu stok/opname
- [ ] Realtime
- [ ] Ekspor filter
- [ ] Struk & barcode
- [ ] Pagination produk
- [ ] Admin API & lisensi

### Milestone 5 — Fitur komersial (P2)
Target: nilai jual tambahan setelah fondasi stabil.

- [ ] Backup/restore penuh
- [ ] Role & audit
- [ ] Supplier/purchase
- [ ] Play Store readiness
- [ ] Fitur lain sesuai prioritas bisnis

---

## 10. Checklist Pre-Flight Rilis

### 10.1 Kode & build
- [ ] `npm run lint` lulus.
- [ ] `npm test` lulus.
- [ ] `npx expo export -p android` lulus tanpa error.
- [ ] Tidak ada `console.log` berisi data sensitif.
- [ ] Versi app dan versionCode sudah dinaikkan.
- [ ] APK release ditandatangani keystore produksi.
- [ ] Runtime version cocok dengan APK.

### 10.2 Database
- [ ] Migrasi diuji di project dummy.
- [ ] Migrasi production dijalankan (add-only).
- [ ] APK lama masih bisa checkout (backward compatibility).
- [ ] Backup sebelum migrasi tersedia.
- [ ] RLS diuji: akun toko A tidak bisa membaca data toko B.

### 10.3 Fungsional
- [ ] Checkout tunai, QRIS, transfer, debit, kasbon.
- [ ] Checkout offline + sync.
- [ ] Cetak Bluetooth, PDF, WA.
- [ ] Laporan harian/bulanan/semua cocok.
- [ ] Ekspor CSV cocok.
- [ ] Buku kasbon & pembayaran.
- [ ] Hold bill.
- [ ] PIN & menu terkunci.
- [ ] Logout/login tidak kehilangan profil.
- [ ] Lupa password berfungsi.

### 10.4 Perangkat
- [ ] Uji di 2 HP.
- [ ] Uji HP spek rendah.
- [ ] Uji printer Bluetooth.
- [ ] Uji kamera & scan barcode.
- [ ] Uji mode pesawat.
- [ ] Uji restart saat transaksi.

### 10.5 Rilis
- [ ] APK/OTA diuji di akun dummy.
- [ ] Komunikasi ke klien aktif (jadwal, dampak, cara migrasi).
- [ ] Rollback plan siap.
- [ ] Monitoring 48 jam setelah rilis.

---

## 11. Keputusan yang Perlu Diambil Sebelum Eksekusi

| No | Keputusan | Opsi | Rekomendasi |
|---|---|---|---|
| D-01 | Penyimpanan offline | SQLite vs AsyncStorage | **SQLite** untuk katalog + antrean (transaksional, lebih aman) |
| D-02 | Distribusi | Play Store vs APK/WA | Tentukan dulu karena memengaruhi signing, privacy policy, hapus akun |
| D-03 | Metode recovery akun | Email vs OTP WhatsApp vs recovery code | Email jika punya email; OTP WA jika target UMKM |
| D-04 | Model akses | Satu akun toko vs akun owner/kasir | Akun terpisah jika ada karyawan |
| D-05 | Lisensi | Ditegakkan server-side vs dihapus klaimnya | Tegakkan hanya jika model bisnis jelas |
| D-06 | Backup cloud | Paket Supabase + PITR | Wajib untuk klaim zero data loss |
| D-07 | Migrasi signing key | Ekspor-impor vs pertahankan key lama | Ekspor-impor untuk jangka panjang |
| D-08 | Cakupan rilis pertama | P0 saja vs P0+P1 | Minimal P0 + P1-01/02/03 sebelum rilis luas |

---

## 12. Log Progres

| Tanggal | ID | Status | Catatan | Oleh |
|---|---|---|---|---|
| 2026-10-31 | — | 📄 | Dokumen rencana dibuat. Belum ada kode yang diubah. | Audit |
|  |  |  |  |  |
|  |  |  |  |  |

**Cara update log:**
- Setiap selesai satu item, tambahkan baris: tanggal, ID, status, ringkasan perubahan, dan nama pengembang.
- Jika item gagal QA, ubah status ke 🔁 Revisi dan tulis penyebabnya.

---

## 13. Di Luar Lingkup Dokumen Ini

- Perubahan desain visual besar (rebranding).
- Fitur akuntansi pajak formal / e-Faktur.
- Integrasi marketplace/ojol.
- Multi-bahasa.
- Sertifikasi perangkat keras selain printer ESC/POS.

---

## 14. Referensi

- `ROADMAP_UPDATE_DAN_ATURAN_RILIS_AMAN.md` — aturan add-only dan rilis aman.
- `TokoKelontong/DIAGNOSA_BUG_DAN_KEKURANGAN.md` — diagnosa awal.
- `TokoKelontong/DIAGNOSA_FITUR_DAN_ALUR_SISTEM.md` — alur sistem.
- `supabase/schema.sql` dan `migration_v5`–`v7` — skema saat ini.
- `TokoKelontong/app.json`, `eas.json`, `android/app/build.gradle` — konfigurasi rilis.

---

*Dokumen ini hanya berisi rencana. Tidak ada file kode aplikasi yang diubah saat pembuatannya.*
