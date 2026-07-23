PRODUCT REQUIREMENT DOCUMENT (PRD) - MVP VERSION

Nama Proyek: Aplikasi Stok Gudang & Kasir Toko Kelontong (Offline-First) Target Market: UMKM Toko Kelontong (Single User / 1 Perangkat Lokal)

1. Fitur Utama (Must-Have) — Wajib Ada untuk Rilis Pertama

A. Manajemen Produk & Stok (Modul Gudang)

Pencatatan Produk: Input nama produk, harga modal, harga jual, dan stok awal.

Scan Barcode Internal: Integrasi kamera Android untuk scan barcode produk (mempercepat input barang baru dan pencarian).

Manajemen Stok Mandiri: Fitur untuk menambah stok (jika ada barang masuk dari supplier) atau mengurangi stok secara manual (jika ada barang rusak/opname).

Peringatan Stok Menipis (Low Stock Alert): Indikator visual jika stok produk berada di bawah batas minimum yang ditentukan pemilik.

B. Sistem Point of Sale (Modul Kasir)

Keranjang Belanja: Memasukkan produk ke keranjang via ketik nama produk atau scan barcode.

Kalkulator Kasir Otomatis: Menghitung total belanja secara real-time, kalkulasi uang kembalian, dan opsi input diskon manual (jika ada).

Pemotongan Stok Otomatis: Setiap transaksi yang berhasil langsung memotong jumlah stok di database lokal HP saat itu juga.

Cetak Struk Bluetooth: Integrasi dengan Printer Thermal Bluetooth untuk mencetak bukti transaksi fisik.

C. Modul Sinkronisasi & Backup (Fitur Baru)

Database Lokal (HP): Semua data (Produk, Stok, Transaksi) disimpan di storage lokal HP menggunakan SQLite / Room Database. Aplikasi tidak akan freeze atau loading meski internet mati total.

Detektor Koneksi Otomatis: Sistem mendeteksi secara latar belakang (background) ketika HP terhubung ke internet (Wi-Fi/Seluler).

Sinkronisasi Latar Belakang (Background Sync): Ketika internet terdeteksi aktif, aplikasi otomatis mengirimkan data transaksi lokal yang baru dan memperbarui data cadangan ke server/cloud tanpa mengganggu kasir yang sedang berjualan.

Sinkronisasi Manual (Tombol Sync): Menyediakan tombol di menu pengaturan agar pengguna bisa memaksa proses sinkronisasi kapan saja saat mereka yakin internetnya stabil.

D. Laporan Penjualan Sederhana

Ringkasan Pendapatan: Laporan omzet harian dan bulanan yang dihitung dari database lokal.

Laporan Keuntungan Bersih: Perhitungan otomatis laba bersih (Harga Jual - Harga Modal).

Riwayat Transaksi: Daftar nota/struk yang sudah diterbitkan untuk melacak transaksi lampau.

2. Fitur Pendukung (Nice-to-Have) — Ditunda untuk Versi 2.0+

Manajemen utang/bon pelanggan kelontong.

Grafis analisis produk paling laris (Fast Moving Items).

Multi-outlet (jika pemilik punya lebih dari 1 toko kelontong).

⚠️ Risk Assessment (Analisis Risiko Teknis & Biaya)

Risiko Konflik Data (Data Conflict Risk): Jika sinkronisasi tertunda terlalu lama (misal HP offline seminggu), lalu ada pembaruan data stok dari sisi luar/backoffice (jika nanti dikembangkan), akan ada risiko bentrokan data.

Solusi PM: Di MVP ini, kita kunci aturannya: "Data di HP Lokal adalah sumber kebenaran utama (Single Source of Truth)". Cloud hanya berfungsi sebagai wadah penampung backup dan laporan.

Risiko Baterai & Kuota: Proses pengecekan internet dan sinkronisasi latar belakang yang terlalu agresif bisa menguras baterai HP Android spek rendah milik UMKM.

Solusi PM: Mekanisme sinkronisasi otomatis sebaiknya dibatasi (misalnya hanya berjalan 1 jam sekali, atau hanya aktif secara instan saat transaksi selesai jika internet terdeteksi ada).
