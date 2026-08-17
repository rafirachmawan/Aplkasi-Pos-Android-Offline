# Pondasi Arsitektur Online-First (Supabase) — MarketPos

### Status: FINAL — Hasil Diskusi, Siap Eksekusi Bertahap

Dokumen ini menjadi pondasi keputusan migrasi MarketPos dari aplikasi **100% offline**
menjadi aplikasi **pure online** dengan Supabase sebagai satu-satunya sumber data,
untuk memenuhi kebutuhan klien: **2 HP dalam 1 toko dengan data & stok realtime tanpa bentrok**.

---

## 1. Latar Belakang

- Aplikasi saat ini 100% offline: setiap HP menyimpan data sendiri di SQLite lokal (`expo-sqlite`).
- Klien memesan aplikasi untuk tokonya dengan kebutuhan **sinkronisasi 2 HP**.
- Karena data hidup terpisah di tiap HP, muncul risiko "data nabrak" (stok/transaction konflik).
- Keputusan akhir: **buang data lokal, semua transaksi online** agar data dan stok realtime
  dan mustahil bentrok (database menjadi wasit tunggal).

---

## 2. Ringkasan Keputusan (Decision Log)

| Topik                     | Keputusan                                                                       |
| ------------------------- | ------------------------------------------------------------------------------- |
| Arsitektur                | **Pure online (online-first)** — data lokal SQLite dibuang total                |
| Backend                   | **Supabase** (PostgreSQL + Auth + Realtime)                                     |
| Akun Supabase             | **Akun baru dengan email bisnis** (terpisah dari akun pribadi)                  |
| Project                   | `marketpos-prod` (produksi, semua toko) + `marketpos-dev` (testing)             |
| Region                    | **Southeast Asia (Singapore)** — latency kecil untuk Indonesia                  |
| Model akun                | **1 toko = 1 akun**; akun yang sama dipakai di semua HP toko itu                |
| Role                      | Sementara hanya **`kasir`** (struktur siap untuk `owner`/`admin` di masa depan) |
| Gate aplikasi             | **Wajib login** untuk membuka aplikasi                                          |
| Pendaftaran               | Username + password + nama toko, dilakukan di onboarding                        |
| Penyimpanan username      | Trik email Supabase: `username@marketpos.app` (user tidak butuh email asli)     |
| Lupa password             | **Reset manual oleh developer** (via dashboard Supabase)                        |
| Ganti password            | Ada fitur di aplikasi (menu Pengaturan)                                         |
| Stok                      | Dikurangi **atomik oleh database** (fungsi + row lock) — anti bentrok           |
| Realtime                  | **Supabase Realtime** — semua HP auto-update saat ada perubahan                 |
| Pengaturan printer & nota | **Tetap lokal per-HP** (AsyncStorage) — preferensi per perangkat                |
| Backup lokal              | **Dihapus** (data hidup di cloud)                                               |
| Export CSV laporan        | Dipertahankan (sumber data berubah ke cloud)                                    |

---

## 3. Analisa Opsi (Jejak Pertimbangan)

### 3.1 Opsi Sinkronisasi yang Dipertimbangkan

| Opsi                          | Konsep                                      | Kesimpulan                                        |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------- |
| A. Sync Wi‑Fi lokal / hotspot | Host–klien dalam satu jaringan, pola outbox | Ditolak — klien memilih full online agar realtime |
| B. Cloud sync                 | Semua tulis/baca lewat cloud                | **Dipilih**                                       |
| C. Export/import manual       | Backup dipindah manual                      | Ditolak — bukan sync sejati, rawan keliru         |

### 3.2 Perbandingan Provider Cloud

| Aspek                          | Firebase (Firestore)         | Supabase                                   | PocketBase (VPS)               |
| ------------------------------ | ---------------------------- | ------------------------------------------ | ------------------------------ |
| Jenis data                     | NoSQL (dokumen)              | **SQL (Postgres)**                         | SQL (SQLite)                   |
| Realtime                       | Sangat mulus                 | Ada (cukup untuk 2 HP)                     | Ada (perlu polyfill SSE di RN) |
| Auth                           | Bawaan                       | Bawaan                                     | Bawaan                         |
| Limit project gratis           | Longgar                      | 2 per akun                                 | Tidak ada (server sendiri)     |
| Laporan agregat (omzet/laba)   | Ribet (tanpa SUM/GROUP BY)   | **Enak (SQL murni)**                       | Enak (SQL)                     |
| Kecocokan dengan kode sekarang | Redesign model data dari nol | **Migrasi natural (sama-sama relasional)** | Perlu usaha ekstra             |
| Biaya                          | Gratis (Spark)               | Gratis / $25 (Pro)                         | ±$5–6/bulan (VPS)              |

**Kenapa Supabase menang:**

1. Laporan (omzet/laba per hari/bulan) adalah fitur inti — agregasi SQL (`SUM`, `GROUP BY`) jauh lebih mudah dan akurat daripada NoSQL.
2. Repository lokal saat ini berbentuk tabel relasional → pindah ke Supabase hanya ganti sumber data, bukan redesign.
3. Isolasi per toko via **RLS** lebih ringkas dan aman dibanding rules NoSQL.
4. Limit 2 project selesai dengan **akun bisnis baru**; risiko pause kecil karena kasir aktif tiap hari.

Firebase disimpan sebagai catatan (unggul di realtime & tanpa limit), PocketBase sebagai
opsi fase bisnis (saat langganan klien menutup biaya VPS).

---

## 4. Limit Supabase & Strategi

| Resource (Free) | Nilai      | Kebutuhan 1 Toko (estimasi)            |
| --------------- | ---------- | -------------------------------------- |
| Database        | 500 MB     | ±1–5 MB/bulan (data teks kecil)        |
| Bandwidth       | 5 GB/bulan | ±0,3–1 GB/bulan (polling + push kecil) |
| Auth MAU        | 50.000     | 1–5 user per toko                      |
| Project aktif   | 2 per akun | Diatasi dengan akun bisnis baru        |

Strategi:

- **1 project untuk SEMUA toko/klien**, dipisah per toko lewat `store_id` + RLS
  (bukan 1 project per klien).
- Project free bisa di-pause setelah ±1–2 minggu tidak aktif → **aman** karena kasir
  memakai aplikasi setiap hari; kalaupun tidur, data aman dan tinggal di-restore.
- Jalur tumbuh: upgrade **Pro ($25/bulan)** saat produk menghasilkan — biaya dibebankan
  ke langganan klien; atau self-host di kemudian hari.

---

## 5. Arsitektur Data Cloud (Konsep)

Mengikuti skema lokal yang sudah ada, dengan penyesuaian: **ID menjadi UUID**
(aman multi-perangkat) dan semua tabel punya `store_id`.

1. **stores** — data toko
   `id (uuid, PK)`, `store_name`, `created_at`

2. **profiles** — akun pengguna (1 baris per auth user)
   `id (= auth.users id, PK)`, `username`, `role` (default `'kasir'`), `store_id (FK stores)`

3. **products** — master barang (cermin tabel lokal + `store_id`)
   `id (uuid, PK)`, `store_id (FK)`, `barcode`, `product_name`, `capital_price`,
   `selling_price`, `stock_quantity`, `min_stock_threshold`, `created_at`, `updated_at`

4. **transactions** — nota penjualan
   `id (uuid, PK)`, `store_id (FK)`, `invoice_number (unique)`, `total_price`,
   `discount_amount`, `grand_total`, `cash_received`, `cash_return`, `created_at`

5. **transaction_details** — isi barang per nota
   `id (uuid, PK)`, `transaction_id (FK)`, `product_id (FK)`, `quantity`,
   `price_at_sale`, `capital_at_sale`

Mesin keamanan & konsistensi:

- **RLS** di semua tabel: baris hanya terlihat/terubah oleh akun yang `store_id`-nya sama.
- **Fungsi stok atomik** `kurangi_stok(product_id, qty)`: mengunci baris, cek
  `stock_quantity >= qty`, kurangi; jika kurang → error "stok tidak cukup".
  Dua HP menjual barang terakhir bersamaan = mustahil double-sell.
- **invoice_number** dihasilkan fungsi/sequence di database per toko → unik antar perangkat.
- **Realtime publication** untuk `products`, `transactions`, `transaction_details`.

---

## 6. Alur Aplikasi (Konsep)

```
Buka App
   │
   ▼
Splash → cek sesi tersimpan
   ├── Tidak ada sesi → Layar Auth (Daftar / Masuk)   [butuh internet]
   │       Daftar: username + password + nama toko
   │       → buat auth user + profiles(role kasir) + stores
   └── Ada sesi → Aplikasi utama
                    │
                    ▼
        Semua layar baca/tulis langsung ke Supabase
        (Kasir, Gudang, Dashboard, Laporan)
                    │
        Bayar → kurangi_stok() → simpan transaksi
                    │
        Realtime → HP lain auto-update stok & riwayat
```

Ganti password (Pengaturan): validasi password lama → `updateUser` password baru →
berlaku di semua HP. Lupa password → hubungi developer (reset manual).

---

## 7. Perubahan Codebase

**Dihapus:**

- `src/database/db.js`, `productRepository.js`, `transactionRepository.js`
  (versi SQLite lokal) → diganti repository Supabase.
- `src/utils/backupService.js` (backup lokal tidak relevan lagi).

**Diubah:**

- `OnboardingScreen` → alur auth (daftar/masuk).
- `AppNavigator` → gate sesi (belum login → auth; sudah → utama).
- Semua layar (Kasir, Gudang, Dashboard, Laporan) → sumber data Supabase
  dengan loading/error state.
- `AppContext` → menyimpan sesi + profil toko.

**Dipertahankan:**

- Pengaturan printer & format nota (AsyncStorage, per-HP).
- `exportCSV` (sumber data berubah ke cloud).
- Bluetooth printer & barcode scanner.

---

## 8. Risiko & Mitigasi

| Risiko                    | Dampak                  | Mitigasi                                                                          |
| ------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| Internet mati             | Kasir tidak bisa jualan | Klien siapkan koneksi layak + cadangan hotspot; banner status koneksi di aplikasi |
| Sinyal lemah              | Aplikasi terasa lambat  | Loading state yang baik; region Singapore                                         |
| Project free di-pause     | Sync berhenti sementara | Aktivitas harian kasir mencegahnya; restore via dashboard, data aman              |
| Lupa password tanpa email | User terkunci           | Reset manual developer + fitur ganti password di aplikasi                         |

---

## 9. Fase Eksekusi

**Fase 1 — Fondasi Supabase** _(menunggu Project URL + anon key)_
Jalankan SQL: tabel + RLS + fungsi `kurangi_stok` + generator nota + realtime.
Tambahkan konfigurasi Supabase (URL + anon key) di aplikasi.

**Fase 2 — Auth & Gate**
Layar daftar/masuk, cek sesi di navigator, profil toko di context,
fitur ganti password di Pengaturan.

**Fase 3 — Semua Layar Online**
Repository Supabase + refactor Kasir/Gudang/Dashboard/Laporan
dengan loading/error/empty state.

**Fase 4 — Realtime & Poles**
Subscribe perubahan produk/transaksi, banner koneksi,
QA skenario 2 HP bersamaan (jual barang terakhir, edit harga, hapus produk).

---

## 10. Checklist Langkah Berikutnya

- [x] Buat akun Supabase baru (email bisnis)
- [x] Buat project `MarketPos` (region ap-south-1)
- [x] Kirim **Project URL** + **anon key** → terisi di `src/config/supabaseConfig.js`
- [x] File SQL Fase 1 siap: `supabase/schema.sql`
- [x] Fase 2: auth service, gate login, layar Masuk/Daftar, ganti password, logout
- [x] Email provider aktif + Confirm email OFF di dashboard
- [x] `supabase/schema.sql` dijalankan di SQL Editor
- [x] Uji daftar + masuk (register_store berhasil)
- [x] Fase 3: semua layar online (repository Supabase, data lokal dibuang)
- [ ] **Jalankan `supabase/migration_v2_product_fields.sql`** (kolom category/unit/image_uri + policy update nama toko)
- [ ] Fase 4: realtime & poles
