import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/colors';

const { width } = Dimensions.get('window');

const ONBOARDING_COMPLETED_KEY = '@TokoKelontong:HasCompletedOnboarding';

const SLIDES = [
  {
    id: '1',
    tag: 'KASIR POS OFFLINE',
    icon: 'storefront-outline',
    title: 'Selamat Datang di MarketPos',
    subtitle: 'Aplikasi kasir praktis tanpa internet untuk transaksi, pencatatan stok, dan laporan laba toko Anda.',
    features: [
      { icon: 'wifi-off', label: '100% Offline (Tanpa Kuota)' },
      { icon: 'shield-check-outline', label: 'Data Tersimpan Aman di HP' },
      { icon: 'lightning-bolt-outline', label: 'Transaksi Cepat & Akurat' },
      { icon: 'cellphone-check', label: 'Gratis Tanpa Biaya Bulanan' },
    ],
  },
  {
    id: '2',
    tag: 'FITUR LENGKAP & CANGGIH',
    icon: 'cash-register',
    title: 'Fitur Kasir Modern',
    subtitle: 'Lengkapi kebutuhan toko Anda dengan alat transaksi digital serba bisa.',
    features: [
      { icon: 'barcode-scan', label: 'Scan Barcode via Kamera HP' },
      { icon: 'printer-pos-network', label: 'Cetak Nota Printer Bluetooth' },
      { icon: 'chart-line', label: 'Rekap Otomatis Laba & Rugi' },
      { icon: 'archive-outline', label: 'Kelola Stok & Alert Barang Habis' },
    ],
  },
  {
    id: '3',
    tag: 'SIAP MEMULAI TOKO',
    icon: 'book-open-page-variant-outline',
    title: 'Panduan Singkat Penggunaan',
    subtitle: 'Disarankan membaca Buku Panduan agar Anda paham seluruh alur penggunaan MarketPos.',
    steps: [
      { num: '1', text: 'Atur Nama Toko & Header Nota' },
      { num: '2', text: 'Tambah Data Barang & Stok' },
      { num: '3', text: 'Mulai Transaksi Pertama Anda' },
    ],
  },
];

const OnboardingScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  const completeOnboarding = async (targetScreen = 'Home') => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (e) {
      console.error(e);
    }
    if (targetScreen === 'Panduan') {
      navigation.reset({
        index: 1,
        routes: [{ name: 'Home' }, { name: 'Panduan' }],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    }
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      completeOnboarding('Home');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const topPadding = Platform.OS === 'android'
    ? Math.max(insets.top, StatusBar.currentHeight || 24) + 6
    : Math.max(insets.top, 12);

  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom + 16, 24)
    : Math.max(insets.bottom + 12, 16);

  const renderSlide = ({ item }) => (
    <View style={[styles.slideContainer, { width }]}>
      <ScrollView
        contentContainerStyle={styles.scrollSlideContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.cardWrapper}>
          {/* Tagline Badge */}
          <View style={styles.tagBadge}>
            <Text style={styles.tagBadgeText}>{item.tag}</Text>
          </View>

          {/* Hero Icon */}
          <View style={styles.heroCircle}>
            <MaterialCommunityIcons name={item.icon} size={38} color="#0F172A" />
          </View>

          {/* Title & Subtitle */}
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>

          {/* Feature List (Vertical Stack - No Overflow) */}
          {item.features && (
            <View style={styles.featuresList}>
              {item.features.map((feat, idx) => (
                <View key={idx} style={styles.featureRow}>
                  <View style={styles.featureIconBox}>
                    <MaterialCommunityIcons name={feat.icon} size={18} color="#0F172A" />
                  </View>
                  <Text style={styles.featureRowText}>{feat.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Steps List */}
          {item.steps && (
            <View style={styles.stepsList}>
              {item.steps.map((st, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{st.num}</Text>
                  </View>
                  <Text style={styles.stepRowText}>{st.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <View style={styles.brandGroup}>
          <View style={styles.brandLogoBox}>
            <MaterialCommunityIcons name="store" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>MarketPos</Text>
        </View>

        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => completeOnboarding('Home')}
            activeOpacity={0.6}
          >
            <Text style={styles.skipText}>Lewati</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Carousel FlatList */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        style={{ flex: 1 }}
      />

      {/* Bottom Area Controls */}
      <View style={[styles.bottomArea, { paddingBottom: bottomPadding }]}>
        {/* Indicator Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        {currentIndex === 2 ? (
          <View style={styles.btnGroup}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => completeOnboarding('Panduan')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="book-open-page-variant" size={18} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>BUKA BUKU PANDUAN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => completeOnboarding('Home')}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryBtnText}>Langsung ke Dashboard Kasir</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#475569" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Lanjut</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandLogoBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  skipText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  slideContainer: {
    flex: 1,
  },
  scrollSlideContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  cardWrapper: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  tagBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 14,
  },
  tagBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#334155',
    letterSpacing: 0.6,
  },
  heroCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  featuresList: {
    width: '100%',
    gap: 8,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  featureIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureRowText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#1E293B',
    flex: 1,
  },
  stepsList: {
    width: '100%',
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  stepRowText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#334155',
    flex: 1,
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  dot: {
    height: 5,
    borderRadius: 2.5,
  },
  activeDot: {
    width: 20,
    backgroundColor: '#0F172A',
  },
  inactiveDot: {
    width: 5,
    backgroundColor: '#CBD5E1',
  },
  btnGroup: {
    gap: 8,
  },
  primaryBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  secondaryBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#475569',
  },
});

export default OnboardingScreen;
