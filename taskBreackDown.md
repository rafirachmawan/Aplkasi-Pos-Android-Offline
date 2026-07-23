FASE 5: TASK BREAKDOWN (PRODUCT BACKLOG)

Daftar tugas ini dirancang untuk Sprint 1 & Sprint 2 (Estimasi pengerjaan 2–4 minggu oleh seorang Android Developer).

[EPIC 1: DATABASE & ENVIRONMENT SETUP]

Task 1.1: Inisialisasi Proyek Android & Setup Database Lokal

Deskripsi: Set up project architecture baru di Android Studio (disarankan menggunakan Kotlin dan Jetpack Compose/Room DB untuk efisiensi). Implementasikan skema database lokal berdasarkan rancangan tabel products, transactions, dan transaction_details.

Kriteria Selesai (Definition of Done): Aplikasi bisa dijalankan di emulator, database lokal berhasil diinisialisasi tanpa error, dan indeksasi pada kolom barcode sudah terpasang.

[EPIC 2: MODUL GUDANG (MANAJEMEN STOK)]

Task 2.1: UI/UX Halaman Manajemen Produk

Deskripsi: Buat tampilan list produk, form input produk baru (Nama, Barcode, Harga Modal, Harga Jual, Stok Awal, Batas Minimum), dan tombol edit stok.

Kriteria Selesai: Tampilan responsif di HP Android low-end, navigasi lancar, dan validasi input (angka tidak boleh minus) berfungsi.

Task 2.2: Integrasi Kamera untuk Scan Barcode (Input)

Deskripsi: Integrasikan library scanner (seperti Google Code Scanner atau ML Kit) ke kamera HP untuk membaca barcode fisik produk.

Kriteria Selesai: Kamera bisa mendeteksi barcode dengan cepat dan otomatis mengisi kolom barcode pada form produk.

Task 2.3: Logika Validasi Barcode Unik & Low Stock Alert

Deskripsi: Terapkan aturan database UNIQUE pada barcode. Jika barcode sudah ada, munculkan pop-up opsi update stok. Buat indikator warna merah/kuning jika stock_quantity kurang dari atau sama dengan min_stock_threshold.

Kriteria Selesai: Tidak ada duplikasi data produk di database lokal, dan produk yang stoknya menipis memiliki tanda peringatan visual yang jelas.

[EPIC 3: MODUL KASIR (POINT OF SALE)]

Task 3.1: UI/UX Halaman Kasir & Keranjang Belanja

Deskripsi: Buat halaman kasir yang memiliki kolom pencarian barang (ketik manual), tombol aktifkan kamera scan barcode, dan daftar item yang masuk keranjang belanja.

Kriteria Selesai: Kasir bisa memasukkan barang ke keranjang melalui ketik nama maupun scan barcode dalam waktu kurang dari 1 detik per barang.

Task 3.2: Logika Checkout & Pemotongan Stok Otomatis

Deskripsi: Buat fungsi kalkulator kasir (menghitung Total kotor, Diskon manual, Grand Total, Uang Diterima, dan Kembalian). Ketika tombol "Selesai" ditekan, jalankan Database Transaction untuk menyimpan data ke tabel transactions & transaction_details, sekaligus memotong stock_quantity di tabel products.

Kriteria Selesai: Stok barang langsung berkurang secara real-time setelah transaksi sukses. Uang kembalian terhitung akurat.

Task 3.3: Integrasi Printer Thermal Bluetooth (Cetak Struk)

Deskripsi: Hubungkan aplikasi dengan driver Printer Thermal Bluetooth ukuran 58mm/80mm untuk mencetak teks struk belanja (Nama Toko, Tanggal, No Nota, Daftar Barang, Total, Uang Bayar, Kembalian).

Kriteria Selesai: Struk fisik berhasil dicetak segera setelah transaksi dinyatakan selesai di aplikasi.

[EPIC 4: LAPORAN & EKSPOR DATA]

Task 4.1: Dashboard Ringkasan Finansial

Deskripsi: Buat halaman laporan sederhana yang menghitung total omzet (Grand Total) dan total keuntungan bersih (grand_total - akumulasi harga modal barang yang terjual) berdasarkan filter harian dan bulanan.

Kriteria Selesai: Pemilik toko bisa melihat performa penjualan harian dan bulanan dengan akurat langsung di HP.

Task 4.2: Fitur Ekspor Database ke File Excel/CSV

Deskripsi: Buat fungsi query untuk menarik data riwayat transaksi lengkap, lalu konversikan menjadi file format .csv atau .xlsx. Integrasikan dengan komponen Android Native Share agar file bisa dikirim langsung ke WhatsApp atau Google Drive.

Kriteria Selesai: Ketika tombol "Ekspor Data" ditekan, file Excel/CSV berhasil dibuat dengan format nama Laporan_Toko_YYYYMMDD.csv dan bisa dibagikan dengan lancar ke aplikasi lain.

⚠️ Risk Assessment (Analisis Risiko Akhir)

Risiko Fragmentasi Android: Target market kita adalah UMKM toko kelontong yang kemungkinan besar menggunakan HP Android dengan versi OS lama atau spesifikasi RAM rendah (2GB-3GB).

Solusi PM: Ingatkan Developer agar membangun aplikasi ini menggunakan native framework (bukan framework hybrid yang berat) dan batasi penggunaan memori kamera saat scan barcode agar HP tidak sering crash atau lag saat kasir sedang ramai antrean.
