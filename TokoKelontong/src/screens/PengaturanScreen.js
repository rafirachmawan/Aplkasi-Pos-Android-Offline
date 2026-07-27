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
  Platform,
  Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppContext } from '../context/AppContext';
import { colors } from '../theme/colors';

const SettingRow = ({ icon, iconColor, iconBg, label, children }) => (
  <View style={styles.settingRow}>
    <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
      <MaterialCommunityIcons name={icon} size={20} color={iconColor} />
    </View>
    <View style={styles.settingContent}>
      <Text style={styles.settingLabel}>{label}</Text>
      {children}
    </View>
  </View>
);

const PengaturanScreen = () => {
  const { state, dispatch } = useContext(AppContext);
  const [storeNameInput, setStoreNameInput] = useState(state.storeName);
  const [printerInput, setPrinterInput] = useState(state.printerAddress || '');
  const [logoUri, setLogoUri] = useState(state.storeLogo);
  const [autoSync, setAutoSync] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStoreNameInput(state.storeName);
    setPrinterInput(state.printerAddress || '');
    setLogoUri(state.storeLogo);
  }, [state.storeName, state.printerAddress, state.storeLogo]);

  const handlePickLogo = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLogoUri(result.assets[0].uri);
      }
    } catch (e) {
      Alert.alert('Error', 'Gagal membuka galeri');
    }
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
      
      dispatch({ type: 'SET_STORE_NAME', payload: storeNameInput.trim() });
      dispatch({ type: 'SET_PRINTER_ADDRESS', payload: printerInput.trim() || null });
      dispatch({ type: 'SET_STORE_LOGO', payload: logoUri || null });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      Alert.alert('Error', 'Gagal menyimpan pengaturan: ' + e.message);
    }
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
      contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Info Toko */}
      <View style={styles.headerCard}>
        <View style={{ position: 'relative' }}>
          <TouchableOpacity style={styles.storeAvatar} onPress={handlePickLogo}>
            {logoUri ? (
              <Image source={{ uri: logoUri }} style={styles.storeLogoImage} />
            ) : (
              <MaterialCommunityIcons name="camera-plus" size={30} color={colors.primaryContainer} />
            )}
          </TouchableOpacity>
          {logoUri && (
            <TouchableOpacity 
              style={styles.removeLogoBtn} 
              onPress={() => setLogoUri(null)}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="close-circle" size={24} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.storeName}>{state.storeName}</Text>
          <Text style={styles.storeSubtitle}>Aplikasi Kasir & Stok Offline</Text>
        </View>
      </View>

      {/* Seksi Informasi Toko */}
      <Text style={styles.sectionTitle}>Informasi Toko</Text>
      <View style={styles.card}>
        <SettingRow icon="store-edit" iconColor={colors.primary} iconBg="#D1FAE5" label="Nama Toko">
          <TextInput
            style={styles.input}
            value={storeNameInput}
            onChangeText={setStoreNameInput}
            placeholder="Masukkan nama toko"
            placeholderTextColor={colors.textSecondary}
          />
        </SettingRow>
      </View>

      {/* Seksi Printer */}
      <Text style={styles.sectionTitle}>Printer Bluetooth</Text>
      <View style={styles.card}>
        <SettingRow icon="printer-wireless" iconColor="#8B5CF6" iconBg="#EDE9FE" label="Alamat MAC Printer (opsional)">
          <TextInput
            style={styles.input}
            value={printerInput}
            onChangeText={setPrinterInput}
            placeholder="Contoh: 00:11:22:33:44:55"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />
        </SettingRow>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.linkBtn} onPress={() => Alert.alert('Scan Bluetooth', 'Fitur scan perangkat tersedia di build Android native.')}>
          <MaterialCommunityIcons name="bluetooth-connect" size={18} color={colors.secondary} />
          <Text style={styles.linkText}>Cari perangkat Bluetooth tersedia</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Seksi Sinkronisasi */}
      <Text style={styles.sectionTitle}>Sinkronisasi & Backup</Text>
      <View style={styles.card}>
        <SettingRow icon="cloud-sync" iconColor={colors.secondary} iconBg="#DBEAFE" label="Sinkronisasi Otomatis (background)">
          <Switch
            value={autoSync}
            onValueChange={(val) => {
              setAutoSync(val);
              if (val) Alert.alert('Info', 'Sinkronisasi otomatis akan aktif di build Android native.');
            }}
            trackColor={{ false: colors.border, true: colors.primaryContainer }}
            thumbColor={autoSync ? colors.primary : '#f4f3f4'}
          />
        </SettingRow>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.linkBtn} onPress={handleManualSync}>
          <MaterialCommunityIcons name="sync" size={18} color={colors.primary} />
          <Text style={styles.linkText}>Sinkronisasi Manual Sekarang</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Tombol Simpan */}
      <TouchableOpacity style={[styles.saveBtn, saved && { backgroundColor: '#059669' }]} onPress={handleSave}>
        <MaterialCommunityIcons name={saved ? 'check' : 'content-save'} size={20} color="#fff" />
        <Text style={styles.saveBtnText}>{saved ? 'Tersimpan!' : 'SIMPAN PENGATURAN'}</Text>
      </TouchableOpacity>

      {/* Zona Berbahaya */}
      <Text style={styles.sectionTitle}>Zona Berbahaya</Text>
      <View style={[styles.card, { borderColor: '#FEE2E2', borderWidth: 1 }]}>
        <TouchableOpacity style={styles.dangerBtn} onPress={handleResetData}>
          <MaterialCommunityIcons name="delete-forever" size={20} color={colors.error} />
          <Text style={styles.dangerText}>Reset Semua Data Database</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Versi App */}
      <Text style={styles.versionText}>TokoKelontong v1.0.0 MVP · Offline-First</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingVertical: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTextContainer: {
    flex: 1,
  },
  storeAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)',
  },
  storeLogoImage: {
    width: '100%', height: '100%', borderRadius: 32,
  },
  removeLogoBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  storeName: { fontSize: 24, fontWeight: '800', color: colors.text },
  storeSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
  },

  card: {
    backgroundColor: colors.surface,
    marginHorizontal: 12, borderRadius: 14,
    overflow: 'hidden', elevation: 1,
    borderWidth: 1, borderColor: colors.border,
  },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 52 },

  settingRow: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 12,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 14, color: colors.text, backgroundColor: colors.background,
  },

  linkBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 10,
  },
  linkText: { flex: 1, fontSize: 14, color: colors.text },

  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 16, padding: 14, borderRadius: 14, gap: 8, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, gap: 10,
  },
  dangerText: { flex: 1, fontSize: 14, color: colors.error, fontWeight: '600' },

  versionText: {
    textAlign: 'center', fontSize: 12,
    color: colors.textSecondary, marginTop: 8, marginBottom: 16,
  },
});

export default PengaturanScreen;
