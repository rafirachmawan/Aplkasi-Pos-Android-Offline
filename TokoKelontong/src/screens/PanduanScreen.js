import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, fonts } from '../theme/colors';

const GuideSection = ({ title, icon, iconBg, iconColor, content }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <View style={[styles.iconWrapper, { backgroundColor: iconBg }]}>
        <MaterialCommunityIcons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
    </View>
    <View style={styles.cardContent}>
      {content.map((text, idx) => (
        <View key={idx} style={styles.listItem}>
          <View style={styles.bullet} />
          <Text style={styles.listText}>{text}</Text>
        </View>
      ))}
    </View>
  </View>
);

const PanduanScreen = () => {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Buku Panduan</Text>
          <Text style={styles.headerSubtitle}>Pelajari cara menggunakan setiap fitur di aplikasi ini untuk mempermudah operasional tokomu.</Text>
        </View>

        <GuideSection
          title="Buka Kasir (POS)"
          icon="cart-arrow-right"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            "Pilih barang dari daftar atau gunakan fitur Scan Barcode dari kamera jika barang sudah memiliki barcode.",
            "Tekan tombol Plus (+) atau Minus (-) untuk mengatur jumlah kuantitas barang yang dibeli.",
            "Jika ingin memberi potongan harga, masukkan jumlah diskon pada kolom yang tersedia di bagian ringkasan.",
            "Tekan 'Bayar' dan masukkan jumlah uang yang diterima dari pelanggan untuk menghitung kembalian otomatis."
          ]}
        />

        <GuideSection
          title="Dashboard"
          icon="chart-arc"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            "Melihat ringkasan total penjualan dan keuntungan yang didapat hari ini.",
            "Grafik akan menunjukkan performa transaksi secara visual.",
            "Pantau terus dashboard untuk mengetahui total transaksi dan produk apa saja yang keluar."
          ]}
        />

        <GuideSection
          title="Gudang Stok"
          icon="package-variant-closed"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            "Gunakan menu ini untuk mendata semua barang dagangan secara permanen ke database offline.",
            "Pilih 'Tambah Produk', lalu isi nama, barcode, harga modal (kulakan), harga jual, dan stok saat ini.",
            "Perbedaan Harga Jual dan Harga Modal akan digunakan untuk menghitung keuntungan bersih di menu Laporan."
          ]}
        />

        <GuideSection
          title="Laporan Penjualan"
          icon="file-document-outline"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            "Semua transaksi kasir yang telah selesai akan otomatis masuk dan terekap di halaman Laporan.",
            "Buka laporan untuk melihat total omset, total profit (keuntungan bersih), dan daftar seluruh transaksi masa lalu.",
            "Kamu bisa menekan transaksi manapun untuk melihat detail struk belanja pada saat itu."
          ]}
        />

        <GuideSection
          title="Format Nota (Printer)"
          icon="receipt"
          iconBg={colors.iconBg}
          iconColor={colors.iconColor}
          content={[
            "Masuk ke menu ini untuk menghubungkan aplikasi dengan Printer Thermal Bluetooth.",
            "Nyalakan bluetooth HP dan printer, lalu cari nama printer di daftar perangkat yang muncul.",
            "Kamu bisa merangkai Header (contoh: Nama & Alamat Toko) dan Footer (contoh: Ucapan Terima Kasih) yang akan tercetak di bagian atas dan bawah struk."
          ]}
        />

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
    padding: 20,
    paddingBottom: 40,
  },
  headerInfo: {
    marginBottom: 24,
  },
  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    elevation: 0,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardContent: {
    paddingLeft: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginRight: 12,
  },
  listText: {
    fontFamily: fonts.regular,
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});

export default PanduanScreen;
