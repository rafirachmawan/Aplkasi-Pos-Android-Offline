import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  Image,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../context/AppContext';
import { colors, fonts } from '../theme/colors';
import { BackupService } from '../utils/backupService';

const SettingRow = ({ icon, iconColor = colors.primary, iconBg = '#F1F5F9', label, children }) => (
  <View style={styles.settingRow}>
    <View style={[styles.settingIconWrap, { backgroundColor: iconBg }]}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingContent}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  </View>
);

const PengaturanScreen = ({ navigation }) => {
  const { state, dispatch } = useContext(AppContext);
  const [storeNameInput, setStoreNameInput] = useState(state.storeName);
  const [printerInput, setPrinterInput] = useState(state.printerAddress || '');
  const [logoUri, setLogoUri] = useState(state.storeLogo);
  const [autoSync, setAutoSync] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);

  // Backup & Restore states
  const [isExporting, setIsExporting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreJsonInput, setRestoreJsonInput] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setStoreNameInput(state.storeName);
    setPrinterInput(state.printerAddress || '');
    setLogoUri(state.storeLogo);
  }, [state.storeName, state.printerAddress, state.storeLogo]);

  const handlePickLogo = () => {
    setShowImageSourceModal(true);
  };

  const launchPicker = async (source) => {
    setShowImageSourceModal(false);
    setTimeout(async () => {
      try {
        if (source === 'gallery') {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Akses Ditolak', 'Izin galeri diperlukan.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
          });
          if (!result.canceled) setLogoUri(result.assets[0].uri);
        } else {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Akses Ditolak', 'Izin kamera diperlukan.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: false,
            quality: 0.8,
          });
          if (!result.canceled) setLogoUri(result.assets[0].uri);
        }
      } catch (e) {
        Alert.alert('Error', 'Gagal membuka ' + source);
      }
    }, 300);
  };

  const handleSave = async () => {
    if (!storeNameInput.trim()) {
      Alert.alert('Error', 'Nama toko tidak boleh kosong.');
      return;
    }
    try {
      await AsyncStorage.setItem('storeName', storeNameInput.trim());
      await AsyncStorage.setItem('printerAddress', printerInput.trim());
      if (logoUri) {
        await AsyncStorage.setItem('storeLogo', logoUri);
      } else {
        await AsyncStorage.removeItem('storeLogo');
      }

      // Selaraskan juga ke objek @TokoKelontong:StoreProfile agar nota & laporan konsisten
      const storeProfileObj = {
        name: storeNameInput.trim(),
        printerAddress: printerInput.trim() || null,
        logo: logoUri || null,
      };
      await AsyncStorage.setItem('@TokoKelontong:StoreProfile', JSON.stringify(storeProfileObj));

      dispatch({ type: 'SET_STORE_NAME', payload: storeNameInput.trim() });
      dispatch({ type: 'SET_PRINTER_ADDRESS', payload: printerInput.trim() || null });
      dispatch({ type: 'SET_STORE_LOGO', payload: logoUri || null });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan pengaturan: ' + e.message);
    }
  };

  // 📦 Handle Export Backup
  const handleExportBackup = async () => {
    try {
      setIsExporting(true);
      const res = await BackupService.exportBackup();
      if (res.success) {
        Alert.alert(
          '✅ Backup Berhasil Dibuat!',
          `File backup "${res.fileName}" berhasil dibuat.\n\n📊 Ringkasan Data:\n• ${res.counts.products} Produk / Barang\n• ${res.counts.transactions} Riwayat Transaksi\n\nFile siap dikirim ke WhatsApp / Google Drive / disalin ke memori HP.`,
          [{ text: 'Selesai', style: 'default' }]
        );
      }
    } catch (e) {
      Alert.alert('Gagal Backup', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  // 📥 Handle Process Restore
  const handleProcessRestore = async () => {
    if (!restoreJsonInput.trim()) {
      Alert.alert('Peringatan', 'Silakan tempel (paste) kode JSON backup ke dalam kolom.');
      return;
    }

    Alert.alert(
      '⚠️ Konfirmasi Restore Data',
      'Memulihkan data akan memperbarui seluruh produk, stok, dan riwayat transaksi dengan data dari file backup. Apakah Anda yakin?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Pulihkan Sekarang',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRestoring(true);
              const res = await BackupService.restoreBackupFromJson(restoreJsonInput.trim());
              if (res.success) {
                // Refresh App Context
                const newStoreName = (await AsyncStorage.getItem('storeName')) || 'Toko Kelontong';
                const newLogo = await AsyncStorage.getItem('storeLogo');
                const newPrinter = await AsyncStorage.getItem('printerAddress');

                dispatch({ type: 'SET_STORE_NAME', payload: newStoreName });
                dispatch({ type: 'SET_STORE_LOGO', payload: newLogo });
                dispatch({ type: 'SET_PRINTER_ADDRESS', payload: newPrinter });

                setStoreNameInput(newStoreName);
                setLogoUri(newLogo);
                setPrinterInput(newPrinter || '');

                setShowRestoreModal(false);
                setRestoreJsonInput('');

                Alert.alert(
                  '🎉 Restore Berhasil!',
                  `Semua data berhasil dipulihkan:\n• ${res.restoredProducts} Produk\n• ${res.restoredTransactions} Transaksi`,
                  [{ text: 'Mantap!', style: 'default' }]
                );
              }
            } catch (e) {
              Alert.alert('Gagal Restore', e.message);
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const handleManualSync = () => {
    Alert.alert(
      '🔄 Sinkronisasi Manual',
      'Fitur sinkronisasi cloud belum terhubung ke server. Di versi MVP ini, semua data disimpan lokal di perangkat.\n\nPastikan koneksi internet aktif untuk versi berikutnya.',
      [{ text: 'Mengerti', style: 'default' }]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      '⚠️ Reset Database',
      'PERINGATAN: Semua data produk dan transaksi akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua Data',
          style: 'destructive',
          onPress: () => Alert.alert('Info', 'Fitur ini aman dikunci di mode demo.'),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Profile Toko Hero Header ── */}
      <View style={styles.profileHeaderCard}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity style={styles.storeAvatar} onPress={handlePickLogo} activeOpacity={0.8}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.storeLogoImage} />
            ) : (
              <MaterialCommunityIcons name="store-outline" size={32} color={colors.primary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBadge} onPress={handlePickLogo} activeOpacity={0.8}>
            <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" />
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity
              style={styles.removeLogoBtn}
              onPress={() => setLogoUri(null)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close-circle" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileTextContainer}>
          <Text style={styles.storeName}>{state.storeName}</Text>
          <View style={styles.badgeOffline}>
            <View style={styles.dotOffline} />
            <Text style={styles.storeSubtitle}>System POS Offline Active</Text>
          </View>
        </View>
      </View>

      {/* ── Seksi Informasi Toko ── */}
      <Text style={styles.sectionHeaderTitle}>INFORMASI TOKO</Text>
      <View style={styles.card}>
        <SettingRow icon="store-edit-outline" label="Nama Toko">
          <TextInput
            style={styles.input}
            value={storeNameInput}
            onChangeText={setStoreNameInput}
            placeholder="Masukkan nama toko"
            placeholderTextColor="#94A3B8"
          />
        </SettingRow>
      </View>

      {/* ── Seksi Hardware & Printer ── */}
      <Text style={styles.sectionHeaderTitle}>PRINTER BLUETOOTH</Text>
      <View style={styles.card}>
        <SettingRow icon="printer-wireless" label="Alamat MAC Printer (opsional)">
          <TextInput
            style={styles.input}
            value={printerInput}
            onChangeText={setPrinterInput}
            placeholder="Contoh: 00:11:22:33:44:55"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
        </SettingRow>
        <View style={styles.cardDivider} />
        <TouchableOpacity
          style={styles.linkRowBtn}
          onPress={() => Alert.alert('Scan Bluetooth', 'Fitur scan perangkat tersedia di build Android native.')}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#F1F5F9' }]}>
            <MaterialCommunityIcons name="bluetooth-connect" size={20} color={colors.primary} />
          </View>
          <Text style={styles.linkRowText}>Cari perangkat Bluetooth tersedia</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* ── Seksi Backup & Restore File ── */}
      <Text style={styles.sectionHeaderTitle}>BACKUP & RESTORE DATA LOKAL</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRowBtn}
          onPress={handleExportBackup}
          disabled={isExporting}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <MaterialCommunityIcons name="export-variant" size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkRowText}>Buat File Backup (.json)</Text>
            <Text style={styles.linkSubText}>Simpan data ke WA / Google Drive / Memori HP</Text>
          </View>
          <MaterialCommunityIcons name="share-variant-outline" size={18} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <TouchableOpacity
          style={styles.linkRowBtn}
          onPress={() => setShowRestoreModal(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#F0FDF4' }]}>
            <MaterialCommunityIcons name="import" size={20} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkRowText}>Restore Data dari Backup</Text>
            <Text style={styles.linkSubText}>Pulihkan database toko dari kode / file backup</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>
      {/* ── Seksi Bantuan & Panduan ── */}
      <Text style={styles.sectionHeaderTitle}>BANTUAN & PANDUAN</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRowBtn}
          onPress={() => navigation.navigate('Panduan')}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkRowText}>Buku Panduan Kasir</Text>
            <Text style={styles.linkSubText}>Penjelasan rinci seluruh fitur & alur toko</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.cardDivider} />

        <TouchableOpacity
          style={styles.linkRowBtn}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#EEF2FF' }]}>
            <MaterialCommunityIcons name="presentation-play" size={20} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkRowText}>Tampilkan Onboarding Awal</Text>
            <Text style={styles.linkSubText}>Ulangi 3 slide perkenalan aplikasi</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>
      {/* ── Tombol Simpan ── */}
      <TouchableOpacity
        style={[styles.saveBtn, saved && { backgroundColor: '#059669' }]}
        onPress={handleSave}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name={saved ? 'check-circle-outline' : 'content-save-outline'} size={20} color="#FFFFFF" />
        <Text style={styles.saveBtnText}>{saved ? 'Tersimpan!' : 'SIMPAN PENGATURAN'}</Text>
      </TouchableOpacity>

      {/* ── Zona Berbahaya ── */}
      <Text style={styles.sectionHeaderTitle}>ZONA BERBAHAYA</Text>
      <View style={[styles.card, { borderColor: '#FEE2E2' }]}>
        <TouchableOpacity style={styles.dangerRowBtn} onPress={handleResetData} activeOpacity={0.7}>
          <View style={styles.dangerIconWrap}>
            <MaterialCommunityIcons name="delete-forever-outline" size={20} color="#DC2626" />
          </View>
          <Text style={styles.dangerRowText}>Reset Semua Data Database</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* ── Footer Version Info ── */}
      <Text style={styles.versionText}>TokoKelontong POS v1.0.0 · Pro Offline Edition</Text>

      {/* ── Modal Pilih Sumber Gambar ── */}
      <Modal
        visible={showImageSourceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageSourceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlayCenter}
          activeOpacity={1}
          onPress={() => setShowImageSourceModal(false)}
        >
          <View style={styles.sourceModalCard}>
            <Text style={styles.sourceModalTitle}>Pilih Sumber Foto</Text>
            <Text style={styles.sourceModalDesc}>Pilih dari mana Anda ingin mengambil foto logo toko.</Text>

            <View style={styles.sourceOptionsRow}>
              <TouchableOpacity style={styles.sourceOptionBtn} onPress={() => launchPicker('gallery')}>
                <View style={styles.sourceIconWrap}>
                  <MaterialCommunityIcons name="image-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.sourceOptionText}>Galeri</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sourceOptionBtn} onPress={() => launchPicker('camera')}>
                <View style={styles.sourceIconWrap}>
                  <MaterialCommunityIcons name="camera-outline" size={28} color={colors.primary} />
                </View>
                <Text style={styles.sourceOptionText}>Kamera</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.sourceCancelBtn}
              onPress={() => setShowImageSourceModal(false)}
            >
              <Text style={styles.sourceCancelText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal Restore Backup JSON ── */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.restoreModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.settingIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="import" size={20} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restoreTitle}>Restore Data Kasir</Text>
                <Text style={styles.restoreSub}>Tempelkan isi file backup (.json)</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRestoreModal(false)}>
                <MaterialCommunityIcons name="close-circle" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.jsonTextArea}
              multiline
              numberOfLines={8}
              value={restoreJsonInput}
              onChangeText={setRestoreJsonInput}
              placeholder="Tempel (paste) kode JSON file backup di sini..."
              placeholderTextColor="#94A3B8"
              textAlignVertical="top"
            />

            <View style={styles.restoreActions}>
              <TouchableOpacity
                style={styles.cancelRestoreBtn}
                onPress={() => setShowRestoreModal(false)}
              >
                <Text style={styles.cancelRestoreText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmRestoreBtn, isRestoring && { opacity: 0.6 }]}
                onPress={handleProcessRestore}
                disabled={isRestoring}
              >
                <Text style={styles.confirmRestoreText}>
                  {isRestoring ? 'Memulihkan...' : 'Pulihkan Data'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Profile Header Card
  profileHeaderCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    borderRadius: 20,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarContainer: {
    position: 'relative',
  },
  storeAvatar: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  storeLogoImage: {
    width: '100%',
    height: '100%',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0F172A',
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  removeLogoBtn: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  profileTextContainer: {
    flex: 1,
  },
  storeName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.text,
    marginBottom: 4,
  },
  badgeOffline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotOffline: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  storeSubtitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748B',
  },

  // Section Headers
  sectionHeaderTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.07)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 64,
  },

  // Setting Row Items
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
    backgroundColor: '#F8FAFC',
  },

  // Link Row Button
  linkRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  linkRowText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.text,
  },
  linkSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },

  // Primary Save Button
  saveBtn: {
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // Danger Row
  dangerRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    backgroundColor: '#FEF2F2',
  },
  dangerIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerRowText: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#DC2626',
  },

  versionText: {
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 20,
    marginBottom: 8,
  },

  // Modal Source Options
  modalOverlayCenter: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  sourceModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  sourceModalTitle: {
    fontSize: 18,
    fontFamily: fonts.extraBold,
    color: colors.text,
    marginBottom: 6,
  },
  sourceModalDesc: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },
  sourceOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    width: '100%',
    marginBottom: 20,
  },
  sourceOptionBtn: {
    alignItems: 'center',
  },
  sourceIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sourceOptionText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: colors.text,
  },
  sourceCancelBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  sourceCancelText: {
    fontSize: 14,
    fontFamily: fonts.bold,
    color: '#64748B',
  },

  // Restore Modal
  restoreModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  restoreTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.text,
  },
  restoreSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
  },
  jsonTextArea: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    padding: 12,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.text,
    minHeight: 120,
    marginBottom: 16,
  },
  restoreActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelRestoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelRestoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#64748B',
  },
  confirmRestoreBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmRestoreText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

export default PengaturanScreen;
