# RANCANA FITUR F&B BARU: QR SELF-ORDER MEJA & E-MENU (TIER PRO)

> **Tanggal Dokumen:** 14 November 2026  
> **Status:** DRAFT FINAL — Siap Eksekusi (Disepakati Bersama)  
> **Terkait:** `13 11 2026 update pro dan gratis .md` (Tier SaaS Pro), `ROADMAP_UPDATE_DAN_ATURAN_RILIS_AMAN.md` (Golden Rules)  
> **Prinsip Dasar:** Zero Downtime, Add-Only Database, Offline-First Kasir, dan Zero Domain Cost (Gratis via Vercel).

---

## 1. Tujuan dan Nilai Jual (Value Proposition)

Fitur **QR Self-Order Meja & E-Menu Digital** adalah fitur unggulan untuk paket **PRO** segmen Resto, Kafe, Kedai Kopi, dan Warung Makan Modern.

### Nilai Jual Utama bagi Pemilik Kafe:
1. **Mengurangi Beban Biaya Karyawan/Pelayan:** Pelanggan pesan sendiri langsung dari meja menggunakan kamera HP masing-masing, pelayan tidak perlu mencatat manual bolak-balik.
2. **Cepat & Anti-Salah Catat:** Pesanan langsung masuk ke HP kasir dan otomatis bisa dicetak ke Struk Dapur / Koki.
3. **Meningkatkan Nilai Jual SaaS PRO:** Fitur ini di pasaran (Moka, ESB, Majoo) hanya ada di paket termahal (Rp 200.000 – Rp 500.000/bulan). Dengan fitur ini, pemilik kafe akan merasa sangat layak membayar langganan Pro.

---

## 2. Keputusan Desain yang Telah Disepakati

| No | Parameter | Keputusan | Alasan / Catatan |
|---|---|---|---|
| **K-01** | **Infrastruktur Web** | Menggunakan **Vercel** (Gratis). | Mendapatkan URL resmi aman HTTPS gratis tanpa biaya bulanan server. |
| **K-02** | **Kebutuhan Domain** | **Tanpa Beli Domain** (Pakai subdomain gratis Vercel). | Pelanggan hanya scan kamera HP ke QR Code meja, pelanggan tidak mengetik URL sehingga nama domain tidak berpengaruh. |
| **K-03** | **Alur Pembayaran QRIS** | **Wajib Upload Bukti Transfer**. | Pelanggan melihat QRIS toko di HP -> transfer -> upload foto bukti pembayaran sebelum klik kirim pesanan untuk mencegah penipuan struk palsu. |
| **K-04** | **Metode Pembayaran** | **1. QRIS** (upload bukti)<br>**2. Bayar di Kasir** (Tunai/Debit saat mau pulang). | Memberi fleksibilitas bagi pelanggan yang membawa uang tunai. |
| **K-05** | **Alur Pemesanan Ulang (Repeat Order)** | **1 Pesanan = 1 Nota Terpisah**. | Jika meja yang sama pesan ronde ke-2 (misal tambah minum), pesanan kedua terbit sebagai nota baru independen. Akuntansi bersih, dapur tidak bingung, dan kasir tidak pusing menggabungkan bill. |
| **K-06** | **Aksesibilitas Pelanggan** | **Tanpa Download Aplikasi (Web Mobile PWA).** | Pelanggan cukup buka kamera HP -> scan -> langsung terbuka web menu responsif. |
| **K-07** | **Hak Akses Fitur** | **Eksklusif Tier PRO.** | Toko tier Gratis tidak bisa mengaktifkan menu QR Meja ini. |

---

## 3. Arsitektur Alur Sistem (End-to-End Workflow)

```
┌────────────────────────────────────────────────────────┐
│ 1. SETUP OLEH PEMILIK KAFE (Aplikasi Kasir Android)    │
│  - Masuk ke Pengaturan F&B (Tier Pro)                  │
│  - Upload gambar QRIS resmi toko                       │
│  - Tentukan jumlah meja (misal Meja 1 s/d 10)          │
│  - Cetak Barcode/QR Meja (via Printer Bluetooth / PDF) │
└──────────────────────────┬─────────────────────────────┘
                           │ (Ditempel di Meja Kafe)
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. PELANGGAN DUDUK & SCAN (HP Pelanggan / Browser Web) │
│  - Pelanggan scan QR di Meja (misal: Meja 03)          │
│  - Terbuka Web Menu: https://.../order/:storeId/03     │
│  - Pilih makanan & minuman (+ catatan menu)            │
│  - Isi: Nama Pemesan                                   │
│  - Pilih Pembayaran:                                   │
│      A. QRIS -> Scan QRIS Toko -> Upload Foto Bukti    │
│      B. Bayar di Kasir -> Tunai / Kasir                │
│  - Klik "Kirim Pesanan"                                │
└──────────────────────────┬─────────────────────────────┘
                           │ (Tersimpan ke Supabase Cloud)
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. KASIR TOKO MENERIMA PESANAN (HP Kasir Android)      │
│  - Notifikasi suara / badge: "Pesanan Baru Meja 03"    │
│  - Kasir review daftar pesanan & foto bukti bayar      │
│  - Kasir klik "Terima Pesanan"                         │
│  - Struk Dapur (Kitchen Ticket) otomatis tercetak di   │
│    printer Bluetooth dapur agar koki mulai memasak     │
│  - Transaksi otomatis tercatat di laporan kasir        │
└────────────────────────────────────────────────────────┘
```

---

## 4. Rincian Teknis Komponen

### 4.1 Halaman Web Pelanggan (Public Customer Web)
* **Lokasi Kode:** Ditambahkan sebagai public route di `admin-web` (atau bundle web khusus) dengan path:
  `/order/:storeId/:tableNumber`
* **Fitur Halaman:**
  1. **Header Toko & Meja:** Menampilkan nama kafe dan nomor meja yang sedang aktif (terkunci otomatis dari URL QR).
  2. **Katalog Menu:** Membaca data produk aktif dari Supabase (`products`) lengkap dengan foto, harga, dan kategori.
  3. **Keranjang Belanja:** Menghitung subtotal secara real-time.
  4. **Form Checkout Pelanggan:**
     - Nama Pemesan (Wajib).
     - Catatan Khusus per Item (Contoh: *Es Kopi - Less sugar, sedikit es*).
     - Pilihan Metode Pembayaran: `QRIS` atau `Bayar di Kasir`.
     - Upload Bukti Transfer (Khusus pilihan QRIS).
  5. **Halaman Sukses:** Konfirmasi pesanan telah terkirim ke dapur beserta nomor antrean.

### 4.2 Backend & Database Supabase (Add-Only)
* **Tabel Baru `table_orders`:**
  - `id` (uuid, primary key)
  - `store_id` (uuid, references stores.id)
  - `table_number` (text, nomor meja)
  - `customer_name` (text, nama pemesan)
  - `customer_phone` (text, opsional)
  - `total_amount` (numeric, grand total)
  - `payment_method` (text: 'qris' | 'cash_cashier')
  - `payment_proof_url` (text, url foto bukti transfer jika QRIS)
  - `status` (text: 'pending' | 'accepted' | 'completed' | 'cancelled')
  - `items` (jsonb, daftar produk, qty, harga, catatan)
  - `created_at` (timestamptz default now())
* **Storage Bucket Baru di Supabase:**
  - `qris_merchants`: Menyimpan gambar QRIS resmi toko.
  - `payment_proofs`: Menyimpan foto bukti transfer yang diunggah pelanggan.
* **RLS (Row Level Security):**
  - Pelanggan (anon/public): Boleh INSERT pesanan baru dan upload foto bukti ke bucket.
  - Kasir (authenticated): Boleh SELECT dan UPDATE status pesanan tokonya sendiri.

### 4.3 Aplikasi Mobile Kasir (`TokoKelontong`)
* **Pengaturan F&B:**
  - Form Upload Gambar QRIS Toko.
  - Generator QR Meja (Input rentang meja, cetak langsung ke Bluetooth printer atau simpan PDF/gambar).
* **Layar Pesanan Meja (Incoming Table Orders):**
  - Tab / popup pesanan aktif dari meja.
  - Preview detail barang, catatan pelanggan, dan tombol klik untuk memperbesar foto bukti bayar.
  - Tombol **"Terima Pesanan"**: otomatis mencetak Kitchen Ticket Bluetooth dan memasukkan transaksi ke database lokal kasir.
  - Tombol **"Tolak / Batalkan"**: jika bukti transfer tidak valid atau meja salah pesan.

---

## 5. Rencana Tahapan Eksekusi (Roadmap Implementasi)

### Tahap 1: Persiapan Database & Storage Supabase (Add-Only)
1. Buat migration SQL baru (`migration_v10_fnb_self_order.sql`).
2. Buat tabel `table_orders` dan index terkait.
3. Buat bucket storage `qris_merchants` dan `payment_proofs`.
4. Konfigurasikan RLS policies yang aman.

### Tahap 2: Pembuatan Halaman Web Pelanggan (Vercel Ready)
1. Buat route `/order/:storeId/:tableNumber` pada web app.
2. Desain UI mobile-first yang bersih, cepat, dan ringan (mirip aplikasi GoFood/GrabFood).
3. Integrasi upload bukti transfer QRIS ke Supabase Storage.
4. Integrasi pengiriman pesanan ke tabel `table_orders`.

### Tahap 3: Fitur di Aplikasi Kasir Android (`TokoKelontong`)
1. Layar pengaturan upload gambar QRIS toko di `PengaturanScreen.js`.
2. Generator & template cetak QR Code Meja (dukungan Thermal Bluetooth & PDF).
3. Modul penerima pesanan meja di `KasirScreen.js` (notifikasi pesanan masuk, preview bukti bayar, dan auto cetak struk dapur).

### Tahap 4: Pengujian & QA Terpadu
1. Simulasi scan QR meja dari HP pelanggan -> pesan makanan via QRIS + upload bukti.
2. Verifikasi pesanan masuk di HP kasir Android secara realtime.
3. Cetak struk dapur dan verifikasi stok terpotong normal.
4. Simulasi pesanan kedua di meja yang sama (terbit nota baru secara independen).

---

## 6. Catatan Keamanan & Batasan

1. **Anti-Spam Pesanan:** Batasi maksimal 10 transaksi pending per nomor meja untuk mencegah orang iseng mengirim pesanan fiktif.
2. **Validasi Bukti Bayar:** Kasir wajib memverifikasi kesesuaian mutasi rekening toko sebelum menekan tombol "Terima Pesanan".
3. **Offline Guard:** Jika HP kasir sedang tidak ada internet sama sekali, kasir tetap bisa melayani pesanan manual seperti biasa (katalog dan kasir offline tetap 100% jalan).
