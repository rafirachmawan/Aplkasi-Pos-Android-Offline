FASE 3: USER FLOW & ARCHITECTURE (REVISED VERSION)

1. Alur Pengguna (User Flow)

Dengan dihilangkannya fitur sync, alur kerja aplikasi kini menjadi jauh lebih linier dan terfokus pada performa lokal perangkat:

A. Alur Transaksi Kasir (POS Flow)

Mulai: Kasir membuka aplikasi -> Masuk ke halaman Kasir.

Input Produk: Kasir scan barcode produk via kamera ATAU ketik nama produk.

Validasi Stok: Sistem cek database lokal di HP. Jika stok > 0, masuk keranjang. Jika habis, muncul peringatan.

Checkout & Bayar: Input nominal uang tunai -> Sistem hitung kembalian.

Finalisasi Instan:

Stok langsung terpotong di database lokal HP saat itu juga.

Struk belanja tercetak via Printer Bluetooth.

Transaksi tercatat permanen di riwayat lokal.

B. Alur Ekspor Data & Backup Mandiri (Fitur Baru)

Pemicu: Pemilik toko ingin mengamankan data transaksi atau melihat laporan di laptop.

Aksi: Masuk ke Pengaturan -> Tekan tombol "Ekspor Data (.csv/.xlsx)".

Proses Sistem: Aplikasi mengambil seluruh data dari database lokal HP (Tabel Produk & Tabel Penjualan) lalu mengonversinya menjadi file Excel atau CSV.

Distribusi: Muncul Native Share Sheet Android. Pemilik bisa langsung mengirimkan file tersebut ke WhatsApp pribadi, Email, atau menyimpannya ke Google Drive sebagai backup aman.

2. Arsitektur Data (100% Local-First)

Arsitektur sistem sekarang menjadi sangat bersih dan tertutup:

‌

[Aplikasi Android UI] ──(Input/Scan)──► [Database Lokal HP: Room/SQLite]
│
(Tombol Ekspor)
│
▼
[File .CSV / .XLSX]
│
(Android Share)
▼
[WhatsApp / Google Drive Owner]

Aturan Ekspor Data:

Format Universal: Data diekspor dalam format .csv atau .xlsx (Excel) agar mudah dibuka oleh pemilik toko di perangkat mana pun tanpa aplikasi khusus.

Format Penamaan File: Otomatis menggunakan format Laporan_Toko_YYYYMMDD.csv agar rapi dan tidak saling tertimpa saat disimpan di Google Drive.

⚠️ Risk Assessment (Analisis Risiko Baru)

Risiko Kelalaian Manusia (Human Error Risk): Karena tidak ada sinkronisasi otomatis, keamanan data kini 100% bergantung pada kedisiplinan pemilik toko untuk melakukan ekspor mandiri. Jika HP hilang sebelum mereka sempat melakukan ekspor, data hari itu akan hilang.

Solusi PM: Di halaman utama (Dashboard), kita wajib memasang pengingat visual kecil, misalnya: "Terakhir kali data diekspor: 3 hari lalu. Jangan lupa backup data Anda hari ini."

Alur operasional dan backup lokal ini sudah sangat solid, murah, dan aman untuk UMKM.
