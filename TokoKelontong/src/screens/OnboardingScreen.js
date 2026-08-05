import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../theme/colors';

const { width } = Dimensions.get('window');

const ONBOARDING_COMPLETED_KEY = '@TokoKelontong:HasCompletedOnboarding';

const SLIDES = [
  {
    id: '1',
    icon: 'storefront-outline',
    iconBg: '#F1F5F9',
    iconColor: '#0F172A',
    title: 'Selamat Datang',
    subtitle: 'Aplikasi kasir offline untuk mempermudah pencatatan penjualan dan stok barang toko Anda.',
    note: '100% Offline • Tanpa Internet',
  },
  {
    id: '2',
    icon: 'cash-register',
    iconBg: '#F1F5F9',
    iconColor: '#0F172A',
    title: 'Fitur Kasir Lengkap',
    subtitle: 'Mendukung scan barcode, hitung kembalian otomatis, cetak nota printer bluetooth, dan rekap laba rugi.',
    note: 'Transaksi Cepat & Akurat',
  },
  {
    id: '3',
    icon: 'book-open-variant',
    iconBg: '#F1F5F9',
    iconColor: '#0F172A',
    title: 'Penting Sebelum Mulai',
    subtitle: 'Sangat disarankan membaca Buku Panduan terlebih dahulu agar Anda paham seluruh alur penggunaan aplikasi.',
    note: 'Buka Panduan Dulu Agar Mengerti',
  },
];

const OnboardingScreen = ({ navigation }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

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

  const renderSlide = ({ item }) => (
    <View style={styles.slide}>
      <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
        <MaterialCommunityIcons name={item.icon} size={42} color={item.iconColor} />
      </View>

      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>

      <View style={styles.notePill}>
        <Text style={styles.noteText}>{item.note}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Top Header */}
      <View style={styles.topBar}>
        <Text style={styles.appName}>MarketPos</Text>
      </View>

      {/* Carousel */}
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
      />

      {/* Bottom Area */}
      <View style={styles.bottomArea}>
        {/* Dots */}
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
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="book-open-page-variant" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>BUKA BUKU PANDUAN</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.textBtn}
              onPress={() => completeOnboarding('Home')}
              activeOpacity={0.6}
            >
              <Text style={styles.textBtnText}>Langsung ke Dashboard</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Lanjut</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 12 : 12,
    paddingBottom: 8,
  },
  appName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0.3,
  },
  skipText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  slide: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  notePill: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noteText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 6,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 20,
    backgroundColor: colors.text,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#CBD5E1',
  },
  primaryBtn: {
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  btnGroup: {
    gap: 10,
  },
  textBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  textBtnText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});

export default OnboardingScreen;
