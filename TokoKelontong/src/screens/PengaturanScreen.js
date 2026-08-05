import React, { useState, useContext, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Modal,
  Platform,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useContext(AppContext);

  const [storeNameInput, setStoreNameInput] = useState(state.storeName || '');
  const [printerInput, setPrinterInput] = useState(state.printerAddress || '');
  const [logoUri, setLogoUri] = useState(state.storeLogo || null);
  const [saved, setSaved] = useState(false);
  const [showImageSourceModal, setShowImageSourceModal] = useState(false);

  // Backup & Restore states
  const [isExporting, setIsExporting] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setStoreNameInput(state.storeName || '');
    setPrinterInput(state.printerAddress || '');
    setLogoUri(state.storeLogo || null);
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
            Alert.alert('Akses Ditolak', 'Izin akses galeri diperlukan.');
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

      // Selaraskan ke StoreProfile object
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

  // Export Backup
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

  // Buka file picker dari dalam modal
  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const pickedFile = result.assets?.[0];
      if (!pickedFile || !pickedFile.uri) {
        Alert.alert('Error', 'Tidak dapat membaca file yang dipilih.');
        return;
      }

      setSelectedBackupFile(pickedFile);
    } catch (e) {
      Alert.alert('Error', 'Gagal membuka pengelola file: ' + e.message);
    }
  };

  // Eksekusi pemulihan data setelah file dipilih
  const handleExecuteRestore = async () => {
    if (!selectedBackupFile) {
      Alert.alert('Peringatan', 'Silakan pilih file backup (.json) terlebih dahulu.');
      return;
    }

    Alert.alert(
      '⚠️ Konfirmasi Restore Data',
      `File: "${selectedBackupFile.name || 'backup.json'}"\n\nMemulihkan data akan memperbarui seluruh produk, stok, dan riwayat transaksi. Apakah Anda yakin?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Pulihkan Sekarang',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsRestoring(true);

              const jsonString = await FileSystem.readAsStringAsync(selectedBackupFile.uri, {
                encoding: 'utf8',
              });

              const res = await BackupService.restoreBackupFromJson(jsonString);
              if (res.success) {
                const newStoreName = (await AsyncStorage.getItem('storeName')) || 'MarketPos';
                const newLogo = await AsyncStorage.getItem('storeLogo');
                const newPrinter = await AsyncStorage.getItem('printerAddress');

                dispatch({ type: 'SET_STORE_NAME', payload: newStoreName });
                dispatch({ type: 'SET_STORE_LOGO', payload: newLogo });
                dispatch({ type: 'SET_PRINTER_ADDRESS', payload: newPrinter });

                setStoreNameInput(newStoreName);
                setLogoUri(newLogo);
                setPrinterInput(newPrinter || '');

                setShowRestoreModal(false);
                setSelectedBackupFile(null);

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

  const handleResetData = () => {
    Alert.alert(
      '⚠️ Reset Database',
      'PERINGATAN: Semua data produk dan transaksi akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus Semua Data',
          style: 'destructive',
          onPress: () => Alert.alert('Info', 'Fitur ini aman dikunci pada versi rilis untuk mencegah data terhapus tak sengaja.'),
        },
      ]
    );
  };

  const bottomPadding = Platform.OS === 'android'
    ? Math.max(insets.bottom + 24, 40)
    : Math.max(insets.bottom + 16, 28);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomPadding }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Store Profile Card ── */}
      <View style={styles.profileCard}>
        <View style={styles.avatarWrap}>
          <TouchableOpacity style={styles.avatarBtn} onPress={handlePickLogo} activeOpacity={0.8}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.avatarImg} />
            ) : (
              <MaterialCommunityIcons name="storefront-outline" size={32} color="#0F172A" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraBadge} onPress={handlePickLogo} activeOpacity={0.8}>
            <MaterialCommunityIcons name="camera" size={12} color="#FFFFFF" />
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity style={styles.removeLogoBadge} onPress={() => setLogoUri(null)} activeOpacity={0.7}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileInfo}>
          <Text style={styles.profileStoreName}>{state.storeName || 'MarketPos'}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.greenDot} />
            <Text style={styles.badgeText}>Sistem POS Offline Aktif</Text>
          </View>
        </View>
      </View>

      {/* ── Informasi Toko ── */}
      <Text style={styles.sectionTitle}>INFORMASI TOKO</Text>
      <View style={styles.card}>
        <SettingRow icon="store-edit-outline" iconColor="#0F172A" iconBg="#F1F5F9" label="Nama Toko">
          <TextInput
            style={styles.input}
            value={storeNameInput}
            onChangeText={setStoreNameInput}
            placeholder="Masukkan nama toko Anda"
            placeholderTextColor="#94A3B8"
          />
        </SettingRow>
      </View>

      {/* ── Hardware & Printer ── */}
      <Text style={styles.sectionTitle}>PRINTER BLUETOOTH</Text>
      <View style={styles.card}>
        <SettingRow icon="printer-pos-network-outline" iconColor="#0F172A" iconBg="#F1F5F9" label="Alamat MAC Printer (Opsional)">
          <TextInput
            style={styles.input}
            value={printerInput}
            onChangeText={setPrinterInput}
            placeholder="Contoh: 00:11:22:33:44:55"
            placeholderTextColor="#94A3B8"
            autoCapitalize="characters"
          />
        </SettingRow>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => {
            if (Platform.OS === 'android') {
              Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(() => {
                Linking.openSettings();
              });
            } else {
              Linking.openSettings();
            }
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#F1F5F9' }]}>
            <MaterialCommunityIcons name="bluetooth-connect" size={20} color="#0F172A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Buka Pengaturan Bluetooth HP</Text>
            <Text style={styles.linkSubText}>Pasangkan printer Bluetooth dari sini</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* ── Backup & Restore ── */}
      <Text style={styles.sectionTitle}>BACKUP & RESTORE DATA</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={handleExportBackup}
          disabled={isExporting}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <MaterialCommunityIcons name="export-variant" size={20} color="#2563EB" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Ekspor Backup File (.json)</Text>
            <Text style={styles.linkSubText}>Simpan data ke WA, Google Drive, atau Memori HP</Text>
          </View>
          <MaterialCommunityIcons name="share-variant-outline" size={18} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.linkRow, isRestoring && { opacity: 0.5 }]}
          onPress={() => {
            setSelectedBackupFile(null);
            setShowRestoreModal(true);
          }}
          disabled={isRestoring}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#F0FDF4' }]}>
            <MaterialCommunityIcons name="file-upload-outline" size={20} color="#16A34A" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Impor / Restore Data Backup</Text>
            <Text style={styles.linkSubText}>Upload file backup (.json) dari memori HP</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* ── Bantuan & Onboarding ── */}
      <Text style={styles.sectionTitle}>BANTUAN & INFORMASI</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Panduan')}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#FEF3C7' }]}>
            <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#D97706" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Buku Panduan Kasir</Text>
            <Text style={styles.linkSubText}>Panduan operasional fitur & alur transaksi</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => navigation.navigate('Onboarding')}
          activeOpacity={0.7}
        >
          <View style={[styles.settingIconWrap, { backgroundColor: '#EEF2FF' }]}>
            <MaterialCommunityIcons name="presentation-play" size={20} color="#4F46E5" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkText}>Putar Ulang Onboarding</Text>
            <Text style={styles.linkSubText}>Tampilkan kembali slide pengenalan aplikasi</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* ── Tombol Simpan ── */}
      <TouchableOpacity
        style={[styles.saveBtn, saved && { backgroundColor: '#059669' }]}
        onPress={handleSave}
        activeOpacity={0.85}
      >
        <MaterialCommunityIcons
          name={saved ? 'check-circle-outline' : 'content-save-outline'}
          size={20}
          color="#FFFFFF"
        />
        <Text style={styles.saveBtnText}>{saved ? 'TERSIMPAN!' : 'SIMPAN PENGATURAN'}</Text>
      </TouchableOpacity>

      {/* ── Zona Risiko ── */}
      <Text style={styles.sectionTitle}>ZONA RISIKO</Text>
      <View style={[styles.card, { borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }]}>
        <TouchableOpacity style={styles.dangerRow} onPress={handleResetData} activeOpacity={0.7}>
          <View style={styles.dangerIconWrap}>
            <MaterialCommunityIcons name="delete-forever-outline" size={20} color="#DC2626" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerText}>Reset Semua Data Database</Text>
            <Text style={styles.dangerSubText}>Hapus seluruh produk & riwayat transaksi</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>

      {/* ── Footer ── */}
      <Text style={styles.versionText}>MarketPos - 100% Pure Offline Kasir Android</Text>

      {/* ── Modal Pilih Foto Logo ── */}
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
            <Text style={styles.sourceModalTitle}>Pilih Foto Logo Toko</Text>
            <Text style={styles.sourceModalDesc}>Foto akan ditampilkan di header aplikasi & nota cetak.</Text>

            <View style={styles.sourceOptionsRow}>
              <TouchableOpacity style={styles.sourceOptionBtn} onPress={() => launchPicker('gallery')}>
                <View style={styles.sourceIconWrap}>
                  <MaterialCommunityIcons name="image-outline" size={28} color="#0F172A" />
                </View>
                <Text style={styles.sourceOptionText}>Galeri HP</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.sourceOptionBtn} onPress={() => launchPicker('camera')}>
                <View style={styles.sourceIconWrap}>
                  <MaterialCommunityIcons name="camera-outline" size={28} color="#0F172A" />
                </View>
                <Text style={styles.sourceOptionText}>Kamera HP</Text>
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
      {/* ── Modal Upload Restore Backup ── */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowRestoreModal(false);
          setSelectedBackupFile(null);
        }}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.restoreModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={[styles.settingIconWrap, { backgroundColor: '#F0FDF4' }]}>
                <MaterialCommunityIcons name="file-upload-outline" size={22} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.restoreTitle}>Restore Data Kasir</Text>
                <Text style={styles.restoreSub}>Upload file backup (.json) dari memori HP</Text>
              </View>
              <TouchableOpacity onPress={() => {
                setShowRestoreModal(false);
                setSelectedBackupFile(null);
              }}>
                <MaterialCommunityIcons name="close-circle" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Dropzone Upload Box */}
            <TouchableOpacity
              style={[
                styles.uploadDropZone,
                selectedBackupFile && styles.uploadDropZoneActive,
              ]}
              onPress={handleSelectFile}
              activeOpacity={0.7}
            >
              {selectedBackupFile ? (
                <View style={styles.selectedFileWrap}>
                  <View style={styles.selectedFileIconCircle}>
                    <MaterialCommunityIcons name="file-check" size={28} color="#16A34A" />
                  </View>
                  <Text style={styles.selectedFileName} numberOfLines={1}>
                    {selectedBackupFile.name || 'backup.json'}
                  </Text>
                  <Text style={styles.selectedFileSub}>
                    {selectedBackupFile.size
                      ? `${(selectedBackupFile.size / 1024).toFixed(1)} KB • File Siap Dipulihkan`
                      : 'File Backup Siap Dipulihkan'}
                  </Text>
                  <View style={styles.changeFileChip}>
                    <MaterialCommunityIcons name="folder-sync-outline" size={14} color="#2563EB" />
                    <Text style={styles.changeFileChipText}>Ketuk untuk Ganti File</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyUploadWrap}>
                  <View style={styles.cloudUploadIconWrap}>
                    <MaterialCommunityIcons name="cloud-upload-outline" size={32} color="#2563EB" />
                  </View>
                  <Text style={styles.uploadBoxTitle}>Pilih File Backup (.json)</Text>
                  <Text style={styles.uploadBoxSub}>
                    Ketuk di sini untuk membuka galeri / pengelola file HP
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.restoreActions}>
              <TouchableOpacity
                style={styles.cancelRestoreBtn}
                onPress={() => {
                  setShowRestoreModal(false);
                  setSelectedBackupFile(null);
                }}
              >
                <Text style={styles.cancelRestoreText}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.confirmRestoreBtn,
                  (!selectedBackupFile || isRestoring) && { backgroundColor: '#94A3B8', opacity: 0.6 },
                ]}
                onPress={handleExecuteRestore}
                disabled={!selectedBackupFile || isRestoring}
              >
                <Text style={styles.confirmRestoreText}>
                  {isRestoring ? 'Memulihkan Data...' : 'Pulihkan Data'}
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
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Profile Header Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarBtn: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    backgroundColor: '#0F172A',
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  removeLogoBadge: {
    position: 'absolute',
    top: -5,
    left: -5,
    backgroundColor: '#FFFFFF',
    borderRadius: 9,
  },
  profileInfo: {
    flex: 1,
  },
  profileStoreName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: '#0F172A',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  greenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  badgeText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: '#64748B',
  },

  // Section Headers
  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 56,
  },

  // Setting Row
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },

  // Link Row Button
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  linkText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#0F172A',
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
    marginTop: 22,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 14,
    letterSpacing: 0.4,
  },

  // Danger Row
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  dangerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#DC2626',
  },
  dangerSubText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#EF4444',
    marginTop: 2,
  },

  versionText: {
    textAlign: 'center',
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 20,
    marginBottom: 10,
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
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  sourceModalTitle: {
    fontSize: 17,
    fontFamily: fonts.extraBold,
    color: '#0F172A',
    marginBottom: 4,
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
    gap: 28,
    width: '100%',
    marginBottom: 20,
  },
  sourceOptionBtn: {
    alignItems: 'center',
  },
  sourceIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  sourceOptionText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#0F172A',
  },
  sourceCancelBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  sourceCancelText: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: '#64748B',
  },

  // Restore Modal
  restoreModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
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
    color: '#0F172A',
  },
  restoreSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
  },
  uploadDropZone: {
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    borderStyle: 'dashed',
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  uploadDropZoneActive: {
    borderColor: '#86EFAC',
    borderStyle: 'solid',
    backgroundColor: '#F0FDF4',
  },
  emptyUploadWrap: {
    alignItems: 'center',
  },
  cloudUploadIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  uploadBoxTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#1E40AF',
    marginBottom: 4,
  },
  uploadBoxSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  selectedFileWrap: {
    alignItems: 'center',
    width: '100%',
  },
  selectedFileIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectedFileName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 2,
    textAlign: 'center',
  },
  selectedFileSub: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: '#16A34A',
    marginBottom: 10,
  },
  changeFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  changeFileChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#2563EB',
  },
  restoreActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelRestoreBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
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
    borderRadius: 12,
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
