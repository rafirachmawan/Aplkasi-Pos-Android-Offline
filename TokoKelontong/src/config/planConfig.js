// =====================================================================
// KONFIGURASI PAKET (GRATIS / PRO)
// =====================================================================

// Nomor WhatsApp pemilik untuk pembelian / perpanjangan paket Pro.
// Format internasional tanpa "+" dan tanpa spasi, contoh: "6281234567890".
// Kosongkan ("") bila tombol upgrade disembunyikan.
export const SUPPORT_WHATSAPP = "6285196221716";

// Nama yang tampil di pesan WhatsApp.
export const SUPPORT_NAME = "MarketPos";

/**
 * Fitur yang dikunci di tier Gratis.
 * Setiap kunci punya judul + penjelasan singkat yang tampil di panel ProLock.
 *
 * CATATAN PENTING: kunci ini HANYA memblokir aksi baru.
 * Data yang sudah ada tetap bisa dilihat (read-only), tidak pernah dihapus.
 */
export const PRO_FEATURES = {
  kasbon: {
    title: "Buku Kasbon",
    description:
      "Catat utang piutang pelanggan dan riwayat cicilannya. Data kasbon lama tetap bisa dilihat.",
  },
  shift: {
    title: "Shift & Kas Keluar",
    description:
      "Buka/tutup shift kasir dan catat kas keluar untuk mengontrol kebocoran uang.",
  },
  laporanLanjutan: {
    title: "Laporan Lanjutan",
    description:
      "Laporan per periode, per produk, per kategori, dan ekspor CSV.",
  },
  dashboard: {
    title: "Dashboard Analitik",
    description: "Produk terlaris, jam ramai, dan tren omzet.",
  },
  fnb: {
    title: "Mode F&B",
    description:
      "Pesanan dine-in / take away dengan nomor meja dan struk dapur.",
  },
  grosir: {
    title: "Harga Grosir",
    description: "Harga khusus untuk pembelian partai.",
  },
  multiPayment: {
    title: "Multi-Pembayaran",
    description: "Bayar gabungan (tunai + QRIS / transfer) dalam satu nota.",
  },
  multiDevice: {
    title: "Multi-Perangkat",
    description: "Hubungkan lebih dari satu HP kasir dalam satu toko.",
  },
  customNota: {
    title: "Kustomisasi Nota",
    description:
      "Atur nama toko, alamat, nomor telepon, dan pesan penutup khusus di struk.",
  },
};

/** Pesan baku tombol upgrade. */
export const UPGRADE_MESSAGE =
  "Halo, saya ingin mengaktifkan paket Pro untuk toko saya.";
