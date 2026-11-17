export const colors = {
  primary: '#EA580C',          // Warm Vibrant Orange (Utama, selaras logo)
  primaryBright: '#F97316',    // Bright Orange (Hover/Highlight/Accent)
  primaryDark: '#C2410C',      // Deep Orange (Pressed/Kontras AA di latar peach)
  primaryContainer: '#FFF7ED', // Warm Peach lembut (Background badge/chip/ikon)
  primaryBorder: '#FED7AA',    // Border oranye lembut
  primaryBorderSoft: '#FFEDD5',// Border oranye sangat lembut
  primaryPlaceholder: '#FDBA74',// Aksen huruf awal placeholder produk tanpa foto
  primaryTextDark: '#9A3412',  // Teks oranye gelap kontras tinggi
  secondary: '#1E293B',        // Deep Logo Navy (Teks sekunder tegas / elemen kontras)
  background: '#FFFDFB',       // Clean Warm White (Nyaman di mata seharian)
  surface: '#FFFFFF',          // Putih bersih untuk kartu
  surfaceMuted: '#F8FAFC',     // Abu sangat muda untuk input/section
  surfaceSubtle: '#F1F5F9',    // Abu lembut untuk badge/chip netral
  error: '#DC2626',
  errorDark: '#B91C1C',        // Merah kontras AA di atas errorContainer
  errorTextDark: '#991B1B',    // Merah gelap kontras tinggi (>= 7.6:1)
  errorContainer: '#FFF1F2',   // Latar error/bahaya lembut
  errorSoftBg: '#FEF2F2',      // Latar kartu peringatan/kurang bayar
  errorBannerBg: '#FEE2E2',    // Latar tombol hapus sekunder
  errorBorder: '#FECDD3',      // Border error/bahaya lembut
  errorSoftBorder: '#FECACA',  // Border kartu error/kurang bayar
  errorBorderStrong: '#FCA5A5',// Border tombol tolak pesanan
  warning: '#D97706',
  warningDot: '#F59E0B',       // Titik indikator offline
  warningContainer: '#FFFBEB', // Latar status offline/peringatan lembut
  warningBannerBg: '#FEF3C7',  // Latar banner pesanan ditahan
  warningBorder: '#FDE68A',    // Border status offline/peringatan lembut
  warningBannerBorder: '#FCD34D', // Border banner pesanan meja
  warningText: '#B45309',      // Teks kontras AA di atas warningContainer
  warningTextDark: '#92400E',  // Teks kuning cokelat gelap kontras tinggi
  warningTextMuted: '#FEF3C7', // Teks pendukung di atas banner amber
  text: '#0F172A',             // Deep Navy untuk keterbacaan tajam
  textDark: '#334155',         // Slate tua untuk item list & teks sekunder kuat
  textBodySecondary: '#475569',// Slate gelap kontras >= 6.9:1 di atas badge netral
  textSecondary: '#64748B',    // Slate untuk label pendukung
  textMuted: '#94A3B8',        // Abu netral untuk ikon penunjuk sekunder
  border: '#E2E8F0',           // Garis pemisah bersih
  borderStrong: '#CBD5E1',     // Garis tepi input & pembatas lebih tegas
  // ─ Clean Modern Tokens ─
  iconBg: '#FFF7ED',           // Background hangat untuk ikon
  iconColor: '#EA580C',        // Warna utama ikon
  success: '#10B981',          // Semantik: sukses/positif
  successStrong: '#16A34A',    // Hijau tombol aksi aktif F&B
  successButtonDark: '#15803D',// Hijau kontras AA (>= 5.0:1) untuk tombol cetak/WA
  successContainer: '#ECFDF5', // Latar hijau lembut status online/sukses
  successSoftBg: '#F0FDF4',    // Latar lembut mode F&B
  successBadgeBg: '#DCFCE7',   // Latar badge harga grosir
  successPillBg: '#D1FAE5',    // Latar badge metode bayar tunai F&B
  successBorder: '#A7F3D0',    // Border hijau lembut
  successSoftBorder: '#BBF7D0',// Border mode F&B
  successText: '#047857',      // Teks kontras AA di atas successContainer
  successDark: '#166534',      // Teks hijau gelap kontras tinggi (>= 6.4:1)
  successAltDark: '#065F46',   // Teks kembalian kasir lunas (>= 7.2:1)
  info: '#0284C7',             // Aksen biru info / non-tunai
  infoContainer: '#F0F9FF',    // Latar kartu non-tunai / bukti QRIS
  infoSurfaceActive: '#EFF6FF',// Latar item aktif modal kategori
  infoBorder: '#BAE6FD',       // Border kartu info
  infoBorderSoft: '#E0F2FE',   // Border lembut sub-kartu info
  infoBadgeBg: '#DBEAFE',      // Latar badge QRIS F&B
  infoBadgeText: '#1D4ED8',    // Teks biru gelap kontras AA
  infoText: '#0369A1',         // Teks info kontras AA di atas infoContainer
  cardBorder: '#F1F5F9',       // Border tipis card
  receiptDash: '#9CA3AF',      // Garis putus-putus struk termal
  // ─ On-Color & Translucent Surface Tokens ─
  onPrimary: '#FFFFFF',
  onPrimarySoft: 'rgba(255, 255, 255, 0.94)',
  onDarkMuted: 'rgba(255, 255, 255, 0.80)',
  heroDecorCircle: 'rgba(255, 255, 255, 0.08)',
  heroControlBg: 'rgba(15, 23, 42, 0.22)',
  heroMetricBg: 'rgba(15, 23, 42, 0.24)',
  floatingBarBg: 'rgba(255, 253, 251, 0.94)',
  overlayBackdrop: 'rgba(15, 23, 42, 0.65)',
  modalBackdrop: 'rgba(0, 0, 0, 0.5)',
  proofBackdrop: 'rgba(0, 0, 0, 0.9)',
  proofCloseBg: 'rgba(255, 255, 255, 0.2)',
  stockBadgeOverlay: 'rgba(15, 23, 42, 0.80)',
  stockBadgeLowOverlay: 'rgba(220, 38, 38, 0.92)',
  cameraBg: '#000000',
  cameraScrim: 'rgba(15, 23, 42, 0.54)',
  cameraPillBg: 'rgba(15, 23, 42, 0.82)',
  cameraPillBorder: 'rgba(255, 255, 255, 0.24)',
  // ─ Category Visual Swatches ─
  categorySwatches: {
    makanan: '#EF4444',
    minuman: '#3B82F6',
    kebersihan: '#10B981',
    batik: '#F59E0B',
    baju: '#EC4899',
    aksesoris: '#8B5CF6',
    sepatu: '#06B6D4',
    tas: '#84CC16',
    elektronik: '#6366F1',
    'alat tulis': '#14B8A6',
    lainnya: '#64748B',
  },
  categoryCardSwatches: {
    makanan: '#DC2626',
    minuman: '#2563EB',
    kebersihan: '#059669',
    batik: '#D97706',
    baju: '#DB2777',
    aksesoris: '#7C3AED',
    sepatu: '#0891B2',
    tas: '#65A30D',
    elektronik: '#4F46E5',
    'alat tulis': '#0D9488',
    lainnya: '#475569',
  },
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
};
