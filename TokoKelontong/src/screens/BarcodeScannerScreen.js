import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { CameraView, useCameraPermissions } from 'expo-camera';

/**
 * BarcodeScannerScreen
 * Layar kamera untuk scan barcode.
 * Menerima route.params.onBarcodeScanned(barcode) callback.
 */
const BarcodeScannerScreen = ({ navigation, route }) => {
  const { onBarcodeScanned } = route.params || {};
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const isScannedRef = React.useRef(false);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission]);

  const handleBarCodeScanned = ({ type, data }) => {
    if (isScannedRef.current) return;
    isScannedRef.current = true;
    setScanned(true);
    if (onBarcodeScanned) {
      onBarcodeScanned(data);
    }
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera-off" size={64} color={colors.textSecondary} />
        <Text style={styles.errorText}>Scan barcode tidak tersedia di versi web.</Text>
        <Text style={styles.subText}>Gunakan build Android untuk fitur kamera.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera" size={48} color={colors.textSecondary} />
        <Text style={styles.errorText}>Meminta izin kamera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <MaterialCommunityIcons name="camera-off" size={64} color={colors.error} />
        <Text style={styles.errorText}>Izin kamera ditolak.</Text>
        <Text style={styles.subText}>Aktifkan izin kamera di Pengaturan HP.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay UI */}
      <View style={styles.overlay}>
        {/* Viewfinder */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        <Text style={styles.hint}>Arahkan kamera ke barcode produk</Text>

        {scanned && (
          <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
            <MaterialCommunityIcons name="barcode-scan" size={18} color="#fff" />
            <Text style={styles.rescanText}>Scan Lagi</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tombol Tutup */}
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;
const FRAME_SIZE = 240;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  errorText: { fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 16, textAlign: 'center' },
  subText: { fontSize: 13, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  backBtn: {
    marginTop: 20, backgroundColor: colors.primary,
    paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10,
  },
  backBtnText: { color: '#fff', fontWeight: 'bold' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanFrame: {
    width: FRAME_SIZE, height: FRAME_SIZE,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderColor: '#fff', borderWidth: CORNER_THICKNESS,
  },
  topLeft: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  topRight: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  bottomLeft: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  bottomRight: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  hint: {
    color: '#fff', fontSize: 14, marginTop: 20, textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8,
  },
  rescanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 10, marginTop: 16,
  },
  rescanText: { color: '#fff', fontWeight: 'bold' },

  closeBtn: {
    position: 'absolute', top: 48, right: 20,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
});

export default BarcodeScannerScreen;
