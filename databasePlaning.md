FASE 4: DATABASE PLANNING (LOGICAL SCHEMA)

Untuk mendukung operasional toko kelontong yang cepat, kita hanya membutuhkan 3 tabel utama yang saling berelasi secara sederhana:

1. Tabel: products (Data Barang Gudang)

Tabel ini menyimpan data master barang yang dijual di toko kelontong.

id (Integer, Primary Key, Auto Increment): ID unik untuk sistem internal.

barcode (String, Unique, Indexed): Nomor barcode produk (dari kemasan barang). Kolom ini wajib diberi Index agar proses pencarian saat scan kamera kasir berjalan di bawah 100 milidetik.

product_name (String): Nama barang (misal: "Indomie Goreng Aceh").

capital_price (Decimal/Integer): Harga modal per unit dari supplier.

selling_price (Decimal/Integer): Harga jual ke pelanggan.

stock_quantity (Integer): Jumlah stok fisik yang tersedia di gudang/rak saat ini.

min_stock_threshold (Integer): Batas minimum untuk memicu peringatan stok menipis (default: 5).

2. Tabel: transactions (Data Nota Penjualan)

Tabel ini mencatat ringkasan dari setiap struk belanja yang berhasil dicetak.

id (Integer, Primary Key, Auto Increment): ID unik struk.

invoice_number (String, Unique): Nomor nota formal (Format: INV/YYYYMMDD/XXXX).

total_price (Decimal/Integer): Total belanja kotor sebelum diskon.

discount_amount (Decimal/Integer): Nominal potongan harga manual (jika ada).

grand_total (Decimal/Integer): Total akhir yang wajib dibayar pelanggan (total_price - discount_amount).

cash_received (Decimal/Integer): Jumlah uang tunai yang diserahkan pelanggan.

cash_return (Decimal/Integer): Jumlah uang kembalian.

created_at (Timestamp): Tanggal dan jam transaksi dilakukan (wajib untuk laporan harian/bulanan).

3. Tabel: transaction_details (Detail Barang per Nota)

Tabel jembatan untuk mencatat barang apa saja dan berapa jumlahnya yang dibeli dalam satu struk (Relasi One-to-Many dari tabel transactions).

id (Integer, Primary Key, Auto Increment): ID unik baris detail.

transaction_id (Integer, Foreign Key ke transactions.id): Menghubungkan detail ini ke nota utamanya.

product_id (Integer, Foreign Key ke products.id): Menghubungkan ke produk yang dibeli.

quantity (Integer): Jumlah barang yang dibeli untuk produk tersebut.

price_at_sale (Decimal/Integer): Harga jual produk pada saat transaksi terjadi (Penting! Agar jika di masa depan harga produk di tabel products naik, riwayat keuangan masa lalu tidak ikut berubah).

capital_at_sale (Decimal/Integer): Harga modal produk pada saat transaksi (Penting untuk menghitung keuntungan bersih historis yang akurat).

Logic Engine untuk Fitur Ekspor (.CSV / .XLSX)

Saat tombol "Ekspor Data" ditekan, aplikasi akan menjalankan perintah internal (Query) untuk menggabungkan data dari tabel transactions dan transaction_details, lalu memuntahkannya menjadi struktur kolom Excel berikut:

Tanggal | No Nota | Nama Barang | Qty | Harga Modal | Harga Jual | Total Penjualan | Total Keuntungan

⚠️ Risk Assessment (Analisis Risiko Fase 4)

Risiko Duplikasi Barcode (Data Integrity Risk): Terkadang ada produk kelontong yang berbeda rasa tetapi menggunakan barcode yang sama dari pabriknya, atau kasir salah melakukan input barcode ganda.

Solusi PM: Sistem database lokal harus dipasang validasi ketat. Kolom barcode wajib diset sebagai UNIQUE. Jika ada input barang dengan barcode yang sudah ada, aplikasi harus menolak dan memberikan opsi: "Barcode sudah terdaftar. Apakah Anda ingin memperbarui stok produk [Nama Produk Lama]?"

Risiko Performa Database Lambat (Query Performance): Toko kelontong memiliki ratusan hingga ribuan jenis barang. Jika database tidak dioptimasi, proses scan barcode akan semakin lemot seiring bertambahnya data.

Solusi PM: Pastikan Developer menerapkan indeksasi (Indexing) khusus pada kolom barcode di tabel products.

Rancangan database lokal kita sudah sangat rapi, efisien, dan siap menampung data toko kelontong.
