import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../theme/colors';

const STORE_PROFILE_KEY = '@TokoKelontong:StoreProfile';

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

const SettingNotaScreen = ({ navigation }) => {
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeContact, setStoreContact] = useState('');
  const [footerMessage, setFooterMessage] = useState('Terima kasih telah berbelanja!');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORE_PROFILE_KEY);
      if (saved !== null) {
        const data = JSON.parse(saved);
        setStoreName(data.storeName || '');
        setStoreAddress(data.storeAddress || '');
        setStoreContact(data.storeContact || '');
        setFooterMessage(data.footerMessage || 'Terima kasih telah berbelanja!');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    try {
      const data = { storeName, storeAddress, storeContact, footerMessage };
      await AsyncStorage.setItem(STORE_PROFILE_KEY, JSON.stringify(data));
      if (storeName.trim()) {
        await AsyncStorage.setItem('storeName', storeName.trim());
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      Alert.alert('Error', 'Gagal menyimpan pengaturan nota');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header Info */}
      <View style={styles.headerCard}>
        <View style={styles.headerIconWrap}>
          <MaterialCommunityIcons name="receipt-text" size={30} color={colors.primary} />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Pengaturan Nota</Text>
          <Text style={styles.headerSubtitle}>
            Info toko yang tampil di struk belanja
          </Text>
        </View>
      </View>

      {/* Identitas Toko */}
      <Text style={styles.sectionTitle}>Identitas Toko</Text>
      <View style={styles.card}>
        <SettingRow icon="store" iconColor={colors.iconColor} iconBg={colors.iconBg} label="Nama Toko">
          <TextInput
            style={styles.input}
            value={storeName}
            onChangeText={setStoreName}
            placeholder="Misal: Toko Berkah Jaya"
            placeholderTextColor={colors.textSecondary}
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow icon="map-marker" iconColor={colors.iconColor} iconBg={colors.iconBg} label="Alamat Toko">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={storeAddress}
            onChangeText={setStoreAddress}
            placeholder="Misal: Jl. Mawar No. 12, Jakarta"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </SettingRow>
        <View style={styles.divider} />
        <SettingRow icon="phone" iconColor={colors.iconColor} iconBg={colors.iconBg} label="Nomor Telepon / WA (Opsional)">
          <TextInput
            style={styles.input}
            value={storeContact}
            onChangeText={setStoreContact}
            placeholder="Misal: 08123456789"
            placeholderTextColor={colors.textSecondary}
            keyboardType="phone-pad"
          />
        </SettingRow>
      </View>

      {/* Format Nota */}
      <Text style={styles.sectionTitle}>Format Struk</Text>
      <View style={styles.card}>
        <SettingRow icon="message-text" iconColor={colors.iconColor} iconBg={colors.iconBg} label="Pesan Penutup (Footer)">
          <TextInput
            style={styles.input}
            value={footerMessage}
            onChangeText={setFooterMessage}
            placeholder="Misal: Terima kasih atas kunjungan Anda"
            placeholderTextColor={colors.textSecondary}
          />
        </SettingRow>
        <View style={styles.divider} />
        <View style={styles.previewRow}>
          <MaterialCommunityIcons name="information-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.previewText}>
            Pesan ini akan muncul di bagian bawah setiap struk / nota yang dicetak atau dibagikan.
          </Text>
        </View>
      </View>

      {/* Tombol Simpan */}
      <TouchableOpacity
        style={[styles.saveBtn, saved && { backgroundColor: '#059669' }]}
        onPress={handleSave}
      >
        <MaterialCommunityIcons name={saved ? 'check' : 'content-save'} size={20} color="#fff" />
        <Text style={styles.saveBtnText}>{saved ? 'Tersimpan!' : 'SIMPAN PENGATURAN'}</Text>
      </TouchableOpacity>

      <Text style={styles.versionText}>
        Data disimpan secara offline di perangkat Anda
      </Text>
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
  headerIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

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
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, gap: 12,
  },
  settingIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 14, color: colors.text, backgroundColor: colors.background,
  },
  textArea: {
    height: 72,
    textAlignVertical: 'top',
  },

  previewRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 12, gap: 8,
  },
  previewText: {
    flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18,
  },

  saveBtn: {
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    margin: 16, padding: 14, borderRadius: 14, gap: 8, elevation: 4,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  versionText: {
    textAlign: 'center', fontSize: 12,
    color: colors.textSecondary, marginTop: 4, marginBottom: 16,
  },
});

export default SettingNotaScreen;
