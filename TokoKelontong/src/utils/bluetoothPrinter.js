// Layanan cetak langsung ke printer thermal Bluetooth (ESC/POS).
// Dipakai untuk cetak nota transaksi (Kasir) dan label barcode produk.
// Printer harus sudah dipairing di pengaturan Bluetooth HP, lalu alamat
// MAC-nya dipilih di layar Pengaturan aplikasi.
//
// CATATAN PENTING: library native dimuat secara LAZY (require di dalam
// fungsi) supaya aplikasi tetap bisa dibuka di Expo Go. Di Expo Go modul
// native ini tidak ada, sehingga fitur cetak Bluetooth otomatis disembunyikan
// dan baru aktif pada development build / APK.
import { Platform, PermissionsAndroid, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PRINTER_ADDRESS_KEY = "printerAddress";
const LINE_WIDTH = 32; // lebar kolom printer thermal 58mm

// ── Pemuatan library native secara lazy ─────────────────────────────────────
let cachedLib = null;
let libChecked = false;

const getLib = () => {
  if (!libChecked) {
    libChecked = true;
    // Library HANYA boleh di-require bila modul native-nya benar-benar
    // terdaftar (build APK / development build). Di Expo Go modul native
    // tidak ada, dan mengevaluasi modul JS library-nya saja sudah melempar
    // error ("Cannot set property 'DIRECTION' of null"), jadi kita hindari
    // require sama sekali.
    if (
      NativeModules.BluetoothManager &&
      NativeModules.BluetoothEscposPrinter
    ) {
      try {
        // eslint-disable-next-line global-require
        const mod = require("react-native-bluetooth-escpos-printer");
        if (mod && mod.BluetoothManager && mod.BluetoothEscposPrinter) {
          cachedLib = mod;
        }
      } catch {
        cachedLib = null;
      }
    }
  }
  return cachedLib;
};

// Apakah cetak Bluetooth bisa dipakai di lingkungan saat ini?
// (Android + modul native tersedia; false di Expo Go, web, iOS)
export const isBluetoothPrintingSupported = () =>
  Platform.OS === "android" && !!getLib();

const rp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

const dash = () => "-".repeat(LINE_WIDTH);

// Susun baris "kiri .... kanan" selebar 32 kolom.
const row = (left, right) => {
  const l = String(left ?? "");
  const r = String(right ?? "");
  const space = LINE_WIDTH - l.length - r.length;
  if (space < 1) {
    return l.slice(0, Math.max(1, LINE_WIDTH - r.length - 1)) + " " + r;
  }
  return l + " ".repeat(space) + r;
};

const formatLocalDateTime = (iso) => {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
};

// Android 12+ butuh izin runtime BLUETOOTH_CONNECT/SCAN, versi lebih lama
// butuh ACCESS_FINE_LOCATION untuk membaca daftar perangkat.
const ensureBluetoothPermissions = async () => {
  if (Platform.OS !== "android") return false;
  const sdk =
    typeof Platform.Version === "number"
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);
  try {
    if (sdk >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      ]);
      return Object.values(result).every(
        (v) => v === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const NOT_SUPPORTED_MSG =
  "Cetak Bluetooth tidak tersedia di Expo Go. Fitur ini aktif pada build APK / development build.";

// Apakah sudah ada alamat printer tersimpan?
export const isPrinterConfigured = async () => {
  try {
    const addr = await AsyncStorage.getItem(PRINTER_ADDRESS_KEY);
    return !!(addr && addr.trim());
  } catch {
    return false;
  }
};

// Ambil daftar perangkat Bluetooth yang sudah dipairing di HP.
export const getPairedPrinters = async () => {
  const lib = getLib();
  if (!lib) throw new Error(NOT_SUPPORTED_MSG);
  const ok = await ensureBluetoothPermissions();
  if (!ok) {
    throw new Error(
      "Izin Bluetooth ditolak. Aktifkan izin Bluetooth untuk aplikasi ini di pengaturan HP.",
    );
  }
  const enabled = await lib.BluetoothManager.isBluetoothEnabled();
  if (!enabled) {
    throw new Error("Bluetooth HP belum aktif. Nyalakan Bluetooth terlebih dahulu.");
  }
  // enableBluetooth() resolve dengan daftar perangkat yang sudah dipairing
  // bila Bluetooth sudah menyala (tiap elemen berupa string JSON).
  const raw = await lib.BluetoothManager.enableBluetooth();
  const devices = [];
  (raw || []).forEach((item) => {
    try {
      const d = typeof item === "string" ? JSON.parse(item) : item;
      if (d && d.address) {
        devices.push({ name: d.name || "Perangkat", address: d.address });
      }
    } catch {
      // abaikan entri yang tidak valid
    }
  });
  return devices;
};

const connectToPrinter = async () => {
  const lib = getLib();
  if (!lib) throw new Error(NOT_SUPPORTED_MSG);
  const address = ((await AsyncStorage.getItem(PRINTER_ADDRESS_KEY)) || "").trim();
  if (!address) {
    throw new Error(
      "Printer belum diatur. Buka Pengaturan → Printer Bluetooth untuk memilih printer.",
    );
  }
  try {
    await lib.BluetoothManager.connect(address);
  } catch {
    throw new Error(
      "Tidak bisa terhubung ke printer. Pastikan printer menyala dan sudah dipairing dengan HP.",
    );
  }
  return lib;
};

const TEXT_OPTS = { encoding: "UTF-8", codepage: 0 };

// Cetak nota transaksi langsung ke printer thermal.
export const printReceiptViaBluetooth = async (tx, details, storeProfile = {}) => {
  const lib = await connectToPrinter();
  const printer = lib.BluetoothEscposPrinter;
  await printer.printerInit();
  await printer.setWidth(384); // 58mm = 384 dot

  // ── Header toko ──
  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.setBlob(1);
  await printer.printText(
    `${storeProfile.storeName || storeProfile.name || "Toko Kelontong"}\n`,
    TEXT_OPTS,
  );
  await printer.setBlob(0);
  if (storeProfile.storeAddress) {
    await printer.printText(`${storeProfile.storeAddress}\n`, TEXT_OPTS);
  }
  if (storeProfile.storeContact) {
    await printer.printText(`Telp: ${storeProfile.storeContact}\n`, TEXT_OPTS);
  }

  // ── No nota & tanggal ──
  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printText(dash() + "\n", TEXT_OPTS);
  await printer.printText(
    row(
      `No: ${tx?.invoice_number || "-"}`,
      tx?.created_at ? formatLocalDateTime(tx.created_at) : "",
    ) + "\n",
    TEXT_OPTS,
  );
  await printer.printText(dash() + "\n", TEXT_OPTS);

  // ── Daftar item ──
  for (const item of details || []) {
    await printer.printText(`${item.product_name}\n`, TEXT_OPTS);
    await printer.printText(
      row(
        `  ${item.quantity} x ${rp(item.price_at_sale)}`,
        rp(item.quantity * item.price_at_sale),
      ) + "\n",
      TEXT_OPTS,
    );
  }

  // ── Ringkasan pembayaran ──
  await printer.printText(dash() + "\n", TEXT_OPTS);
  await printer.printText(row("Subtotal", rp(tx?.total_price)) + "\n", TEXT_OPTS);
  if ((tx?.discount_amount || 0) > 0) {
    await printer.printText(
      row("Diskon", "-" + rp(tx.discount_amount)) + "\n",
      TEXT_OPTS,
    );
  }
  await printer.setBlob(1);
  await printer.printText(row("TOTAL", rp(tx?.grand_total)) + "\n", TEXT_OPTS);
  await printer.setBlob(0);
  await printer.printText(row("Tunai", rp(tx?.cash_received)) + "\n", TEXT_OPTS);
  await printer.printText(row("Kembalian", rp(tx?.cash_return)) + "\n", TEXT_OPTS);
  await printer.printText(dash() + "\n", TEXT_OPTS);

  // ── Footer & dorong kertas ──
  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.printText(
    `${storeProfile.footerMessage || "Terima kasih telah berbelanja!"}\n`,
    TEXT_OPTS,
  );
  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printAndFeed(120);
};

// Cetak label barcode produk langsung ke printer thermal.
export const printBarcodeLabelViaBluetooth = async ({
  barcode,
  productName,
  priceText,
}) => {
  const lib = await connectToPrinter();
  const printer = lib.BluetoothEscposPrinter;
  await printer.printerInit();
  await printer.setWidth(384);

  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.setBlob(1);
  await printer.printText(`${productName}\n`, TEXT_OPTS);
  await printer.setBlob(0);
  if (priceText) {
    await printer.printText(`${priceText}\n`, TEXT_OPTS);
  }
  // Barcode hardware CODE128 (GS k m=73), lebar 2, tinggi 80 dot,
  // angka dicetak di bawah barcode. Wajib di-await agar data barcode
  // sampai ke printer sebelum kertas dimajukan.
  await printer.printBarCode(String(barcode), printer.BARCODETYPE.CODE128, 2, 80, 0, 2);
  await printer.printAndFeed(60);
};
