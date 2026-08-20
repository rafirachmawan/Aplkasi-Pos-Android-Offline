import { Platform } from 'react-native';

/**
 * Konversi array of objects ke string CSV
 */
const toCSV = (data) => {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const val = row[h] == null ? '' : String(row[h]);
      // Escape koma dan tanda kutip
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
};

/**
 * Ekspor data ke file CSV dan buka share dialog
 * Di web: download via browser
 * Di Android: simpan ke cache lalu share
 */
export const exportToCSV = async (data, filename) => {
  const csvContent = toCSV(data);
  if (!csvContent) {
    return { success: false, message: 'Tidak ada data untuk diekspor.' };
  }

  if (Platform.OS === 'web') {
    try {
      // Download via browser
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return { success: true, message: 'File CSV berhasil diunduh.' };
    } catch (e) {
      return { success: false, message: 'Gagal mengunduh: ' + e.message };
    }
  }

  // Android / iOS native
  try {
    // SDK 54: API lama (cacheDirectory, writeAsStringAsync, EncodingType)
    // hanya tersedia di subpath legacy.
    const FileSystem = require('expo-file-system/legacy');
    const Sharing = require('expo-sharing');

    const fileUri = `${FileSystem.cacheDirectory}${filename}`;
    // Tambahkan BOM untuk Excel agar encoding UTF-8 terbaca
    await FileSystem.writeAsStringAsync(fileUri, '\uFEFF' + csvContent, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return { success: false, message: 'Fitur share tidak tersedia di perangkat ini.' };
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Bagikan ${filename}`,
      UTI: 'public.comma-separated-values-text',
    });

    return { success: true };
  } catch (e) {
    console.error('Export CSV error:', e);
    return { success: false, message: 'Gagal ekspor: ' + e.message };
  }
};
