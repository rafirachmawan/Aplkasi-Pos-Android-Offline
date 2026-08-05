import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';

const GuideSection = ({ title, badge, icon, iconBg, iconColor, content }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.cardHeader}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
        </View>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.cardTitle}>{title}</Text>
          {badge && (
            <View style={styles.badgeWrap}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <MaterialCommunityIcons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.cardContent}>
          {content.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <View style={styles.bulletNumber}>
                <Text style={styles.bulletText}>{idx + 1}</Text>
              </View>
              <View style={styles.itemTextWrap}>
                {item.subtitle ? (
                  <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
                ) : null}
                <Text style={styles.listText}>{item.desc || item}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const PanduanScreen = () => {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        
        {/* Header Title Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerIconCircle}>
            <MaterialCommunityIcons name="book-open-page-variant" size={28} color={colors.primary} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Buku Panduan Kasir</Text>
            <Text style={styles.headerSubtitle}>
              Panduan lengkap operasional toko offline & penggunaan fitur kasir POS.
            </Text>
          </View>
        </View>

        {/* 1. Transaksi Kasir */}
        <GuideSection
          title="Buka Kasir (POS)"
          badge="Fitur Utama"
          icon="cart-arrow-right"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            {
              subtitle: "Pilih / Scan Barang",
              desc: "Pilih produk dari daftar katalog atau tekan tombol kamera untuk memindai Barcode pada kemasan produk."
            },
            {
              subtitle: "Atur Jumlah & Diskon",
              desc: "Gunakan tombol (+) dan (-) untuk mengubah kuantitas. Isi kolom Diskon (Rp) jika ingin memberikan potongan harga khusus."
            },
            {
              subtitle: "Pembayaran & Kembalian",
              desc: "Tekan 'Bayar', lalu pilih nominal uang pas atau masukkan jumlah tunai yang diterima. Aplikasi akan menghitung uang kembalian secara otomatis."
            },
            {
              subtitle: "Cetak & Kirim Struk",
              desc: "Setelah transaksi berhasil, Anda dapat mencetak nota langsung ke Printer Bluetooth atau membagikannya dalam bentuk teks/PDF ke WhatsApp pembeli."
            }
          ]}
        />

        {/* 2. Dashboard Analisis */}
        <GuideSection
          title="Dashboard & Analistik"
          badge="Laporan Live"
          icon="chart-arc"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            {
              subtitle: "Ringkasan Keuangan Realtime",
              desc: "Pantau total Omset Penjualan, Laba Bersih (Keuntungan), dan Jumlah Transaksi hari ini secara langsung dari database."
            },
            {
              subtitle: "Filter Periode",
              desc: "Pilih filter Tanggal, Bulan, atau Tahun untuk menganalisis performa toko pada periode tertentu."
            },
            {
              subtitle: "Grafik Visual & Produk Terlaris",
              desc: "Grafik tren transaksi dan daftar produk paling laku membantu Anda menentukan strategi belanja stok barang."
            }
          ]}
        />

        {/* 3. Gudang & Produk */}
        <GuideSection
          title="Gudang & Manajemen Stok"
          badge="Katalog"
          icon="package-variant-closed"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            {
              subtitle: "Pendataan Produk",
              desc: "Masudkan Nama Produk, Barcode, Kategori, Satuan (Pcs/Pack/Kg), Harga Modal (Kulakan), dan Harga Jual."
            },
            {
              subtitle: "Akumulasi Laba Bersih",
              desc: "Pastikan Harga Modal terisi akurat karena selisih antara Harga Jual dan Harga Modal digunakan untuk kalkulasi Laba Bersih toko."
            },
            {
              subtitle: "Peringatan Stok Menipis",
              desc: "Produk yang mencapai batas minimum stok akan ditandai dengan warna merah agar Anda tahu kapan harus kulakan lagi."
            },
            {
              subtitle: "Cetak Barcode Offline",
              desc: "Anda dapat mencetak stiker Barcode untuk produk yang belum memiliki barcode dari pabrik."
            }
          ]}
        />

        {/* 4. Laporan Penjualan */}
        <GuideSection
          title="Laporan & Ekspor Excel"
          badge="Data SQL"
          icon="file-document-outline"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            {
              subtitle: "Rekap Harian & Bulanan",
              desc: "Lihat rekapitulasi total Omset dan Laba Bersih yang dihitung secara presisi menggunakan agregasi SQL."
            },
            {
              subtitle: "Cetak Ulang Struk Masa Lalu",
              desc: "Ketuk salah satu riwayat transaksi untuk melihat detail belanjaan, lalu cetak ulang atau bagikan nota ke pelanggan."
            },
            {
              subtitle: "Ekspor ke File CSV / Excel",
              desc: "Tekan tombol 'Ekspor CSV' untuk mengunduh seluruh data riwayat penjualan ke file yang bisa dibuka di Microsoft Excel atau Google Sheets."
            }
          ]}
        />

        {/* 5. Format Nota & Printer */}
        <GuideSection
          title="Setting Nota & Printer Bluetooth"
          badge="Struk Belanja"
          icon="receipt"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            {
              subtitle: "Koneksi Printer Thermal",
              desc: "Nyalakan Bluetooth HP dan Printer Thermal (58mm/80mm), lalu sambungkan alamat printer di menu Pengaturan."
            },
            {
              subtitle: "Pengaturan Header & Footer",
              desc: "Sesuaikan Nama Toko, Alamat, No. Telp/WA, serta Pesan Penutup (contoh: 'Barang yang sudah dibeli tidak dapat ditukar')."
            }
          ]}
        />

        {/* 6. Backup & Restore Data */}
        <GuideSection
          title="Backup & Restore Data (Pure Offline)"
          badge="Keamanan Data"
          icon="database-sync"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            {
              subtitle: "Ekspor Backup (.json)",
              desc: "Buka menu Pengaturan -> 'Cadangkan Data (Backup)'. File berformat `.json` berisi seluruh produk, stok, dan riwayat transaksi akan dibuat di HP Anda."
            },
            {
              subtitle: "Simpan di Luar Perangkat",
              desc: "Bagikan file backup tersebut ke WhatsApp sendiri, Google Drive, atau flashdisk agar data aman jika HP rusak/hilang."
            },
            {
              subtitle: "Pulihkan Data (Restore)",
              desc: "Saat pindah ke HP Android baru, pilih 'Pulihkan Data (Restore)', lalu pilih file backup `.json` untuk mengembalikan seluruh data toko secara instan."
            }
          ]}
        />

        {/* Footer Info */}
        <View style={styles.footerWrap}>
          <MaterialCommunityIcons name="shield-check" size={18} color={colors.primary} />
          <Text style={styles.footerText}>
            MarketPos - 100% Pure Offline Kasir Android
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    gap: 14,
  },
  headerIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  badgeWrap: {
    backgroundColor: colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },
  cardContent: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bulletNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  bulletText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemSubtitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  listText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  footerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});

export default PanduanScreen;
