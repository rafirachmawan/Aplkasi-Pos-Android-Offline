# Daftar Fitur Aplikasi MarketPos (TokoKelontong)

## 1. Autentikasi & Multi-Toko
- Login & registrasi akun toko
- Login & akses sesi offline
- Isolasi data, profil, kategori, satuan, & cache per toko (`store_id`)
- Ganti password & keluar akun (`Logout`)

## 2. Beranda (`HomeScreen`)
- Header identitas toko (logo, nama, status paket Starter/Pro, tag F&B, tanggal, status Online/Offline)
- Badge & kartu pemberitahuan update OTA (`EAS Update`)
- Banner & tombol sinkronisasi cepat antrean transaksi offline
- Kartu ringkasan omzet, estimasi laba bersih, & jumlah nota hari ini (dengan sembunyikan/tampilkan nominal)
- Navigasi menu operasional & konfigurasi dengan proteksi PIN
- Tombol Hubungi CS via WhatsApp
- Tombol cepat **Buka Kasir POS**

## 3. Kasir POS (`KasirScreen`)
- Katalog produk dengan pencarian & filter kategori
- Scan barcode kamera multi-scan otomatis masuk keranjang
- Keranjang belanja, ubah qty, diskon, & catatan transaksi
- Harga grosir / bertingkat otomatis berdasarkan jumlah pembelian (Pro)
- Metode pembayaran: Tunai, QRIS, Transfer Bank, Debit/EDC, & Kasbon (Pro)
- Hitung kembalian otomatis
- Tahan pesanan (*Hold Order*) & panggil ulang pesanan tertahan
- Checkout offline-first tersimpan di SQLite lokal
- Cetak struk PDF/sistem, cetak printer thermal Bluetooth (`58mm` / `80mm`), & kirim nota via WhatsApp

## 4. Mode F&B / Kafe & Resto (Pro)
- Switch mode operasional **Retail / Kelontong** vs **F&B**
- Pilihan tipe pesanan **Dine-In** (nomor meja) & **Take Away**
- Unggah & hapus gambar QRIS toko
- Pengaturan jumlah meja aktif & generator QR meja (PDF A4 massal, thermal Bluetooth satuan, bagikan tautan WhatsApp)
- Penerimaan pesanan meja *self-order* secara realtime
- Cetak & kirim tiket pesanan dapur (*Kitchen Ticket*) via Bluetooth / WhatsApp

## 5. Gudang & Produk (`GudangScreen` & `AddProductScreen`)
- Ringkasan & filter cepat: Total Produk, Stok Menipis, Stok Habis
- Pencarian produk & filter kategori
- Tambah, edit, & hapus produk beserta foto produk
- Scan barcode tunggal & cetak label barcode Code128 (PDF / Bluetooth)
- Kelola kategori & satuan produk kustom per toko
- Pengelolaan stok minimum atau mode **Stok Tak Terbatas**
- Aturan harga grosir / bertingkat & kalkulator margin/estimasi laba
- Penyesuaian delta stok agar antrean transaksi offline tetap akurat

## 6. Statistik Toko (`DashboardScreen`)
- Ringkasan omzet, estimasi laba kotor, rata-rata per transaksi, & rincian per metode bayar
- Filter periode: Harian, Bulanan, & Semua Riwayat (filter lanjutan Pro)
- Top 5 Produk Terlaris (Pro)
- Daftar produk **Perlu Restok** & total katalog barang (terproteksi PIN)

## 7. Laporan Penjualan (`LaporanScreen`)
- Tab **Harian**, **Bulanan**, & **Riwayat** (periode lanjutan Pro)
- Pencarian berdasarkan nomor nota atau metode pembayaran
- Modal detail struk transaksi
- Cetak ulang struk (PDF / Bluetooth) & kirim ulang struk via WhatsApp
- Bagikan rekap penutupan (*Closing*) harian ke WhatsApp
- Ekspor laporan penjualan ke CSV (Pro)

## 8. Buku Kasbon & Piutang (`BukuKasbonScreen`)
- Ringkasan total piutang aktif, jumlah belum lunas, & total lunas
- Filter status (**Semua**, **Belum Lunas**, **Lunas**) & pencarian pelanggan
- Catat kasbon manual & otomatis dari checkout kasir (Pro)
- Catat pembayaran cicilan / pelunasan & lihat riwayat cicilan
- Kirim pengingat tagihan kasbon via WhatsApp
- Penyimpanan & auto-sync kasbon saat kembali online

## 9. Sinkronisasi & Antrean Offline (`PendingTransactionsScreen`)
- Penyimpanan katalog, transaksi checkout, & kasbon di SQLite lokal
- Auto-sync latar belakang saat internet tersambung kembali
- Daftar antrean transaksi lokal (*Pending* & *Perlu Tinjauan*)
- Kirim ulang transaksi offline ke server & hapus antrean bermasalah

## 10. Format Nota & Printer (`SettingNotaScreen` & `PengaturanScreen`)
- Pilihan ukuran kertas printer: `58mm`, `80mm`, & Standar A4 / PDF
- Kustomisasi nama, alamat, nomor telepon, & pesan footer struk + preset (Pro)
- Pratinjau struk langsung (*Live Preview*) & Tes Cetak
- Pairing & koneksi printer thermal Bluetooth

## 11. Pengaturan, Keamanan & Bantuan (`PengaturanScreen` & `PanduanScreen`)
- Profil toko (nama & foto logo toko)
- Informasi paket langganan (Gratis vs Pro), sisa masa aktif, & ID perangkat
- PIN keamanan pemilik 4 digit & pilih menu yang dikunci
- Pembaruan aplikasi OTA (`EAS Update`) otomatis lewat badge card & manual di Pengaturan
- Buku Panduan Kasir interaktif
