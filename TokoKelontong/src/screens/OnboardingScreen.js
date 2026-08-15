import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  ScrollView,
  TextInput,
  Linking,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/colors';

const { width } = Dimensions.get('window');

const ONBOARDING_COMPLETED_KEY = '@TokoKelontong:HasCompletedOnboarding';
const STORE_PROFILE_KEY = '@TokoKelontong:StoreProfile';

const CATEGORIES = [
  {
    id: 'kelontong',
    title: 'Toko Kelontong / Minimarket',
    desc: 'Sembako, jajanan, barang harian',
    icon: 'storefront-outline',
  },
  {
    id: 'fnb',
    title: 'Warung Makan & F&B',
    desc: 'Resto, warkop, kedai minuman',
    icon: 'silverware-fork-knife',
  },
  {
    id: 'pakaian',
    title: 'Pakaian & Aksesoris',
    desc: 'Boutique, distro, toko sepatu',
    icon: 'tshirt-crew-outline',
  },
  {
    id: 'konter',
    title: 'Konter HP & Pulsa',
    desc: 'Gadget, aksesoris, paket data',
    icon: 'cellphone-cog',
  },
  {
    id: 'lainnya',
    title: 'Usaha Retail Lainnya',
    desc: 'Jasa, grosir, toko spesialis',
    icon: 'briefcase-outline',
  },
];

const OnboardingScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('kelontong');
  const [storeName, setStoreName] = useState('Toko Berkah Jaya');
  const [storeContact, setStoreContact] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const insets = useSafeAreaInsets();

  const completeOnboarding = async (targetScreen = 'Home') => {
    try {
      // Save store profile
      const finalStoreName = storeName.trim() || 'Toko Berkah Jaya';
      const selectedCatObj = CATEGORIES.find((c) => c.id === selectedCategory);
      
      const profileData = {
        storeName: finalStoreName,
        storeCategory: selectedCatObj ? selectedCatObj.title : 'Toko Kelontong',
        storeContact: storeContact.trim(),
        storeAddress: storeAddress.trim(),
        footerMessage: 'Terima kasih telah berbelanja!',
      };

      await AsyncStorage.setItem(STORE_PROFILE_KEY, JSON.stringify(profileData));
      await AsyncStorage.setItem('storeName', finalStoreName);
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
    } catch (e) {
      console.error('Error saving onboarding setup:', e);
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

  const handleOpenWhatsApp = () => {
    const phone = '6285707185783';
    const message = encodeURIComponent(
      'Halo Gapai Digital, saya tertarik dengan jasa pembuatan website / custom aplikasi kasir.'
    );
    const url = `https://wa.me/${phone}?text=${message}`;

    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Info', 'Tidak dapat membuka WhatsApp.');
        }
      })
      .catch(() => Alert.alert('Info', 'Tidak dapat membuka link WhatsApp.'));
  };

  const handleOpenWebsite = () => {
    const url = 'https://www.gapaidigital.my.id/';
    Linking.openURL(url).catch(() =>
      Alert.alert('Info', 'Tidak dapat membuka browser.')
    );
  };

  const topPadding =
    Platform.OS === 'android'
      ? Math.max(insets.top, StatusBar.currentHeight || 24) + 6
      : Math.max(insets.top, 12);

  const bottomPadding =
    Platform.OS === 'android'
      ? Math.max(insets.bottom + 16, 24)
      : Math.max(insets.bottom + 12, 16);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Navigation Bar */}
      <View style={[styles.topBar, { paddingTop: topPadding }]}>
        <View style={styles.brandGroup}>
          <View style={styles.brandLogoBox}>
            <MaterialCommunityIcons name="store" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>MarketPos</Text>
        </View>

        <TouchableOpacity
          style={styles.skipBtn}
          onPress={() => completeOnboarding('Home')}
          activeOpacity={0.6}
        >
          <Text style={styles.skipText}>Lewati</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Bar Header */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: step === 1 ? '33%' : step === 2 ? '66%' : '100%' },
            ]}
          />
        </View>
        <Text style={styles.progressStepText}>Langkah {step} dari 3</Text>
      </View>

      {/* Scrollable Step Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================= STEP 1: PILIH JENIS USAHA ================= */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.badgeLabel}>
                <Text style={styles.badgeLabelText}>PENYIAPAN AWAL 1/3</Text>
              </View>
              <Text style={styles.stepTitle}>Apa Jenis Usaha Anda?</Text>
              <Text style={styles.stepSubtitle}>
                Pilih kategori usaha agar tampilan & kebutuhan kasir disesuaikan untuk toko Anda.
              </Text>
            </View>

            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryCard,
                      isSelected && styles.categoryCardSelected,
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.categoryIconWrap,
                        isSelected && styles.categoryIconWrapSelected,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={cat.icon}
                        size={22}
                        color={isSelected ? '#FFFFFF' : '#0F172A'}
                      />
                    </View>
                    <View style={styles.categoryTextWrap}>
                      <Text
                        style={[
                          styles.categoryTitle,
                          isSelected && styles.categoryTitleSelected,
                        ]}
                      >
                        {cat.title}
                      </Text>
                      <Text
                        style={[
                          styles.categoryDesc,
                          isSelected && styles.categoryDescSelected,
                        ]}
                      >
                        {cat.desc}
                      </Text>
                    </View>
                    <View style={styles.radioCheck}>
                      <MaterialCommunityIcons
                        name={
                          isSelected
                            ? 'check-circle'
                            : 'checkbox-blank-circle-outline'
                        }
                        size={20}
                        color={isSelected ? '#0F172A' : '#CBD5E1'}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ================= STEP 2: IDENTITAS TOKO & STRUK PREVIEW ================= */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={styles.badgeLabel}>
                <Text style={styles.badgeLabelText}>PENYIAPAN AWAL 2/3</Text>
              </View>
              <Text style={styles.stepTitle}>Identitas Toko Anda</Text>
              <Text style={styles.stepSubtitle}>
                Isi nama toko agar otomatis tampil di header Struk / Nota belanja pelanggan.
              </Text>
            </View>

            {/* Input Form */}
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>
                Nama Toko <Text style={{ color: colors.error }}>*</Text>
              </Text>
              <View style={styles.inputBox}>
                <MaterialCommunityIcons
                  name="storefront"
                  size={18}
                  color="#64748B"
                />
                <TextInput
                  style={styles.textInput}
                  value={storeName}
                  onChangeText={setStoreName}
                  placeholder="Misal: Toko Berkah Jaya"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <Text style={styles.inputLabel}>No. Telepon / WA (Opsional)</Text>
              <View style={styles.inputBox}>
                <MaterialCommunityIcons
                  name="phone-outline"
                  size={18}
                  color="#64748B"
                />
                <TextInput
                  style={styles.textInput}
                  value={storeContact}
                  onChangeText={setStoreContact}
                  placeholder="Misal: 08123456789"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>

              <Text style={styles.inputLabel}>Alamat Toko (Opsional)</Text>
              <View style={styles.inputBox}>
                <MaterialCommunityIcons
                  name="map-marker-outline"
                  size={18}
                  color="#64748B"
                />
                <TextInput
                  style={styles.textInput}
                  value={storeAddress}
                  onChangeText={setStoreAddress}
                  placeholder="Misal: Jl. Mawar No. 12"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Live Mini Receipt Preview */}
            <View style={styles.receiptPreviewWrap}>
              <View style={styles.receiptHeaderRow}>
                <MaterialCommunityIcons name="eye-outline" size={14} color="#64748B" />
                <Text style={styles.receiptPreviewTag}>PREVIEW HEADER STRUK</Text>
              </View>
              <View style={styles.receiptBox}>
                <Text style={styles.receiptStoreTitle}>
                  {storeName.trim() || 'NAMA TOKO ANDA'}
                </Text>
                {storeAddress.trim() !== '' && (
                  <Text style={styles.receiptSubText}>{storeAddress.trim()}</Text>
                )}
                {storeContact.trim() !== '' && (
                  <Text style={styles.receiptSubText}>Telp: {storeContact.trim()}</Text>
                )}
                <View style={styles.receiptDivider} />
                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptItemName}>1x Sampel Produk</Text>
                  <Text style={styles.receiptItemPrice}>Rp 10.000</Text>
                </View>
                <View style={styles.receiptDivider} />
                <View style={styles.receiptItemRow}>
                  <Text style={styles.receiptTotalLabel}>TOTAL</Text>
                  <Text style={styles.receiptTotalPrice}>Rp 10.000</Text>
                </View>
                <Text style={styles.receiptFooterMsg}>Terima kasih telah berbelanja!</Text>
              </View>
            </View>
          </View>
        )}

        {/* ================= STEP 3: KONFIRMASI & PROMO GAPAI DIGITAL ================= */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <View style={styles.stepHeader}>
              <View style={[styles.badgeLabel, { backgroundColor: '#DEF7EC' }]}>
                <Text style={[styles.badgeLabelText, { color: '#03543F' }]}>
                  SIAP DIGUNAKAN 🎉
                </Text>
              </View>
              <Text style={styles.stepTitle}>Toko Anda Siap Beroperasi!</Text>
              <Text style={styles.stepSubtitle}>
                MarketPos 100% Offline tanpa butuh kuota internet. Semua data aman di HP Anda.
              </Text>
            </View>

            {/* Summary Box */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryIconBox}>
                  <MaterialCommunityIcons name="store" size={20} color="#0F172A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Nama Toko</Text>
                  <Text style={styles.summaryValue}>
                    {storeName.trim() || 'Toko Berkah Jaya'}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryIconBox}>
                  <MaterialCommunityIcons name="tag-outline" size={20} color="#0F172A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Kategori Usaha</Text>
                  <Text style={styles.summaryValue}>
                    {CATEGORIES.find((c) => c.id === selectedCategory)?.title ||
                      'Toko Kelontong'}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryIconBox}>
                  <MaterialCommunityIcons name="wifi-off" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.summaryLabel}>Sistem Operasional</Text>
                  <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                    100% Offline (Bebas Biaya Bulanan)
                  </Text>
                </View>
              </View>
            </View>

            {/* Developer Contact & Startup Promo Card */}
            <View style={styles.promoCard}>
              <View style={styles.promoBadge}>
                <MaterialCommunityIcons name="rocket-launch-outline" size={14} color="#0F172A" />
                <Text style={styles.promoBadgeText}>CUSTOM SOFTWARE & WEBSITE</Text>
              </View>

              <Text style={styles.promoTitle}>
                Butuh Custom Aplikasi Kasir atau Pembuatan Website?
              </Text>
              <Text style={styles.promoDesc}>
                Kembangkan bisnis Anda bersama <Text style={{ fontWeight: '700' }}>Gapai Digital</Text>. Kami melayani jasa pembuatan website profesional, aplikasi mobile custom, & sistem POS sesuai kebutuhan usaha Anda.
              </Text>

              <View style={styles.promoBtnRow}>
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={handleOpenWhatsApp}
                  activeOpacity={0.85}
                >
                  <MaterialCommunityIcons name="whatsapp" size={18} color="#FFFFFF" />
                  <Text style={styles.waBtnText}>WhatsApp (+6285707185783)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.webBtn}
                  onPress={handleOpenWebsite}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="web" size={16} color="#0F172A" />
                  <Text style={styles.webBtnText}>gapaidigital.my.id</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Area Controls */}
      <View style={[styles.bottomArea, { paddingBottom: bottomPadding }]}>
        {step === 1 && (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setStep(2)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Lanjut ke Identitas Toko</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}

        {step === 2 && (
          <View style={styles.twoBtnRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setStep(1)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="arrow-left" size={18} color="#475569" />
              <Text style={styles.backBtnText}>Kembali</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { flex: 1 }]}
              onPress={() => setStep(3)}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Simpan & Lanjut</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.finalBtnGroup}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => completeOnboarding('Home')}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="cash-register" size={20} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>LANGSUNG KE KASIR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => completeOnboarding('Panduan')}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="book-open-page-variant-outline"
                size={16}
                color="#475569"
              />
              <Text style={styles.secondaryBtnText}>Buka Buku Panduan Aplikasi</Text>
            </TouchableOpacity>
          </View>
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 3,
  },
  progressStepText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#64748B',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexGrow: 1,
  },
  stepContainer: {
    flex: 1,
  },
  stepHeader: {
    marginBottom: 16,
  },
  badgeLabel: {
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  badgeLabelText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#334155',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 19,
  },
  categoryGrid: {
    gap: 10,
    marginTop: 4,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  categoryCardSelected: {
    backgroundColor: '#F1F5F9',
    borderColor: '#0F172A',
  },
  categoryIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryIconWrapSelected: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  categoryTextWrap: {
    flex: 1,
  },
  categoryTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: '#1E293B',
    marginBottom: 2,
  },
  categoryTitleSelected: {
    color: '#0F172A',
  },
  categoryDesc: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: '#64748B',
  },
  categoryDescSelected: {
    color: '#475569',
  },
  radioCheck: {
    paddingLeft: 4,
  },
  formCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  inputLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: '#0F172A',
  },
  receiptPreviewWrap: {
    marginTop: 4,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  receiptPreviewTag: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#64748B',
    letterSpacing: 0.5,
  },
  receiptBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  receiptStoreTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: '#78350F',
    textAlign: 'center',
  },
  receiptSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
    marginTop: 1,
  },
  receiptDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#FDE68A',
    marginVertical: 8,
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  receiptItemName: {
    fontFamily: fonts.medium,
    fontSize: 11.5,
    color: '#78350F',
  },
  receiptItemPrice: {
    fontFamily: fonts.semiBold,
    fontSize: 11.5,
    color: '#78350F',
  },
  receiptTotalLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#78350F',
  },
  receiptTotalPrice: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#78350F',
  },
  receiptFooterMsg: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: '#B45309',
    marginTop: 6,
    fontStyle: 'italic',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryLabel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
  },
  summaryValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0F172A',
  },
  promoCard: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 16,
  },
  promoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  promoBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  promoTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 6,
    lineHeight: 20,
  },
  promoDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 14,
  },
  promoBtnRow: {
    gap: 8,
  },
  waBtn: {
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 8,
  },
  waBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  webBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  webBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#0F172A',
  },
  bottomArea: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
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
  },
  twoBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 6,
  },
  backBtnText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#475569',
  },
  finalBtnGroup: {
    gap: 8,
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
