import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import qrcode from "qrcode-generator";
import { escapeHtml } from "./helpers";
import {
  isBluetoothPrintingSupported,
  printTableQRCodeViaBluetooth,
} from "./bluetoothPrinter";

export const DEFAULT_ORDER_BASE_URL = "https://marketpos-admin.vercel.app";

/**
 * Menghasilkan URL pemesanan mandiri untuk meja tertentu
 */
export const getTableOrderUrl = (storeId, tableNumber, baseUrl = DEFAULT_ORDER_BASE_URL) => {
  const cleanBase = (baseUrl || DEFAULT_ORDER_BASE_URL).replace(/\/+$/, "");
  return `${cleanBase}/order/${storeId}/${tableNumber}`;
};

/**
 * Cetak satu nomor meja via Thermal Bluetooth
 */
export const printSingleTableBluetooth = async ({
  storeName,
  storeId,
  tableNumber,
  baseUrl = DEFAULT_ORDER_BASE_URL,
}) => {
  if (!isBluetoothPrintingSupported()) {
    Alert.alert(
      "Bluetooth Tidak Tersedia",
      "Cetak Bluetooth langsung hanya aktif pada build APK / development build."
    );
    return false;
  }

  const url = getTableOrderUrl(storeId, tableNumber, baseUrl);
  await printTableQRCodeViaBluetooth({
    storeName,
    tableNumber,
    url,
  });
  return true;
};

/**
 * Generate lembar PDF berisi kartu QR Meja siap cetak/laminating
 */
export const generateAndShareTableQRPdf = async ({
  storeName,
  storeId,
  totalTables = 10,
  baseUrl = DEFAULT_ORDER_BASE_URL,
}) => {
  try {
    const tablesCount = Math.max(1, Math.min(100, parseInt(totalTables, 10) || 10));
    const cardsHtml = [];

    const safeStoreName = escapeHtml(storeName || "MarketPos Resto");
    const safeDocTitleStore = escapeHtml(storeName || "MarketPos");

    for (let i = 1; i <= tablesCount; i++) {
      const url = getTableOrderUrl(storeId, i, baseUrl);
      const qr = qrcode(0, "M");
      qr.addData(url);
      qr.make();
      const qrSvg = qr.createSvgTag({
        cellSize: 5,
        margin: 2,
        scalable: true,
      });

      cardsHtml.push(`
        <div class="qr-card">
          <div class="store-badge">${safeStoreName}</div>
          <div class="table-title">MEJA ${i}</div>
          <div class="qr-wrapper">
            ${qrSvg}
          </div>
          <div class="instruction">Scan kamera HP untuk pesan menu &amp; bayar</div>
          <div class="url-text">${escapeHtml(url)}</div>
        </div>
      `);
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Barcode QR Meja - ${safeDocTitleStore}</title>
        <style>
          @page {
            size: A4;
            margin: 12mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #ffffff;
            margin: 0;
            padding: 0;
            color: #0f172a;
          }
          .header-doc {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
          }
          .doc-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
          }
          .doc-subtitle {
            font-size: 12px;
            color: #64748b;
            margin-top: 4px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .qr-card {
            border: 2px dashed #0284c7;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            background: #f8fafc;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .store-badge {
            background: #e0f2fe;
            color: #0369a1;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .table-title {
            font-size: 24px;
            font-weight: 900;
            margin: 8px 0;
            color: #0f172a;
          }
          .qr-wrapper {
            background: #ffffff;
            padding: 8px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            margin: 6px 0;
            display: inline-block;
          }
          .qr-img,
          .qr-wrapper svg {
            width: 160px;
            height: 160px;
            display: block;
          }
          .instruction {
            font-size: 12px;
            font-weight: 600;
            color: #334155;
            margin-top: 8px;
          }
          .url-text {
            font-size: 8px;
            color: #94a3b8;
            word-break: break-all;
            margin-top: 4px;
            max-width: 90%;
          }
        </style>
      </head>
      <body>
        <div class="header-doc">
          <div class="doc-title">${safeStoreName} - QR Code Meja</div>
          <div class="doc-subtitle">Gunting dan letakkan kartu QR ini di masing-masing meja pelanggan</div>
        </div>
        <div class="grid">
          ${cardsHtml.join("")}
        </div>
      </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
        dialogTitle: `Bagikan Lembar QR Meja (${tablesCount} Meja)`,
      });
    } else {
      Alert.alert("PDF Dibuat", `File PDF berhasil dibuat di: ${uri}`);
    }
    return true;
  } catch (err) {
    Alert.alert("Gagal Cetak PDF", err.message || "Terjadi kesalahan saat membuat PDF.");
    return false;
  }
};
