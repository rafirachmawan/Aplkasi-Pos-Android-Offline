// Layanan cetak langsung ke printer thermal Bluetooth (ESC/POS).
// Dipakai untuk cetak nota transaksi (Kasir), struk dapur (Kitchen), label barcode produk, dan tes printer.
// Printer dipilih dari daftar perangkat Bluetooth terpairing di menu Pengaturan.
//
// CATATAN PENTING: library native dimuat secara LAZY (require di dalam
// fungsi) supaya aplikasi tetap bisa dibuka di Expo Go. Di Expo Go modul
// native ini tidak ada, sehingga fitur cetak Bluetooth otomatis disembunyikan
// dan baru aktif pada development build / APK.
import { Platform, PermissionsAndroid, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PRINTER_ADDRESS_KEY = "printerAddress";
const PRINTER_NAME_KEY = "printerName";
const LINE_WIDTH = 32; // lebar kolom printer thermal 58mm
const DEFAULT_PRINTER_LABEL = "Printer Bluetooth";

// ── Pemuatan library native secara lazy ─────────────────────────────────────
let cachedLib = null;
let libChecked = false;

const getLib = () => {
  if (!libChecked) {
    libChecked = true;
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
export const isBluetoothPrintingSupported = () =>
  Platform.OS === "android" && !!getLib();

const rp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

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

/**
 * Menormalkan alamat MAC Bluetooth ke huruf kapital sesuai kebutuhan
 * BluetoothAdapter.getRemoteDevice di Android.
 */
export const normalizeMacAddress = (address) =>
  String(address || "").trim().toUpperCase();

/**
 * Mengurai daftar perangkat Bluetooth terpairing dari berbagai bentuk respons
 * modul native (`enableBluetooth()` mengembalikan array JSON string).
 */
export const parsePairedDeviceList = (raw) => {
  let list = [];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && Array.isArray(parsed.paired)) {
        list = parsed.paired;
      } else if (parsed && typeof parsed.paired === "string") {
        list = JSON.parse(parsed.paired);
      }
    } catch {
      list = [];
    }
  } else if (Array.isArray(raw)) {
    list = raw;
  } else if (raw && typeof raw === "object") {
    if (Array.isArray(raw.paired)) {
      list = raw.paired;
    } else if (typeof raw.paired === "string") {
      try {
        list = JSON.parse(raw.paired);
      } catch {
        list = [];
      }
    }
  }

  const seen = new Set();
  const normalized = [];
  for (const entry of list) {
    let device = entry;
    if (typeof device === "string") {
      try {
        device = JSON.parse(device);
      } catch {
        device = null;
      }
    }
    if (!device || typeof device !== "object") continue;
    const address = normalizeMacAddress(device.address);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    const rawName = typeof device.name === "string" ? device.name.trim() : "";
    normalized.push({
      name: rawName || DEFAULT_PRINTER_LABEL,
      address,
    });
  }
  return normalized;
};

/**
 * Mengubah pesan error native modul Bluetooth menjadi pesan bahasa Indonesia
 * yang jelas penyebab dan langkah perbaikannya.
 */
export const mapBluetoothError = (err, fallbackMsg) => {
  const code = String(err?.code || "").toUpperCase();
  const rawMsg = String(err?.message || err || "").trim();
  const upperMsg = rawMsg.toUpperCase();

  if (
    code === "EVENT_BLUETOOTH_NOT_SUPPORT" ||
    upperMsg.includes("EVENT_BLUETOOTH_NOT_SUPPORT")
  ) {
    return "Perangkat ini tidak mendukung koneksi Bluetooth.";
  }
  if (
    upperMsg.includes("BT NOT ENABLED") ||
    upperMsg.includes("COMMAND_NOT_SEND") ||
    code === "ERR"
  ) {
    return "Bluetooth HP belum aktif atau printer belum siap. Aktifkan Bluetooth lalu coba lagi.";
  }
  if (upperMsg.includes("UNABLE TO CONNECT")) {
    return "Printer tidak merespons. Pastikan printer thermal sudah menyala dan berada dekat HP.";
  }
  return rawMsg || fallbackMsg || "Terjadi kesalahan pada koneksi Bluetooth.";
};

// Android 12+ butuh izin runtime BLUETOOTH_CONNECT & BLUETOOTH_SCAN.
// Android <= 11 memakai izin install-time BLUETOOTH/BLUETOOTH_ADMIN untuk
// membaca daftar perangkat terpairing dan terhubung ke printer.
const ensureBluetoothPermissions = async () => {
  if (Platform.OS !== "android") return false;
  const sdk =
    typeof Platform.Version === "number"
      ? Platform.Version
      : parseInt(String(Platform.Version), 10);
  if (sdk < 31) return true;

  const connectPerm =
    PermissionsAndroid.PERMISSIONS?.BLUETOOTH_CONNECT ||
    "android.permission.BLUETOOTH_CONNECT";
  const scanPerm =
    PermissionsAndroid.PERMISSIONS?.BLUETOOTH_SCAN ||
    "android.permission.BLUETOOTH_SCAN";
  try {
    const result = await PermissionsAndroid.requestMultiple([
      connectPerm,
      scanPerm,
    ]);
    return result?.[connectPerm] === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
};

const NOT_SUPPORTED_MSG =
  "Cetak Bluetooth tidak tersedia di Expo Go. Fitur ini aktif pada build APK / development build.";

// Apakah sudah ada printer Bluetooth yang tersimpan?
export const isPrinterConfigured = async () => {
  try {
    const addr = await AsyncStorage.getItem(PRINTER_ADDRESS_KEY);
    return !!(addr && addr.trim());
  } catch {
    return false;
  }
};

/**
 * Mengambil informasi printer Bluetooth yang sedang terpilih di perangkat.
 */
export const getSavedPrinter = async () => {
  try {
    const pairs = await AsyncStorage.multiGet([
      PRINTER_ADDRESS_KEY,
      PRINTER_NAME_KEY,
    ]);
    const map = Object.fromEntries(pairs);
    const address = normalizeMacAddress(map[PRINTER_ADDRESS_KEY]);
    if (!address) return null;
    const name = String(map[PRINTER_NAME_KEY] || "").trim() || null;
    return { address, name };
  } catch {
    return null;
  }
};

/**
 * Menyimpan printer Bluetooth terpilih ke penyimpanan lokal perangkat.
 */
export const savePrinterSelection = async (device) => {
  const address = normalizeMacAddress(device?.address);
  if (!address) {
    await AsyncStorage.multiRemove([PRINTER_ADDRESS_KEY, PRINTER_NAME_KEY]);
    return { address: null, name: null };
  }
  const name = String(device?.name || "").trim() || DEFAULT_PRINTER_LABEL;
  await AsyncStorage.multiSet([
    [PRINTER_ADDRESS_KEY, address],
    [PRINTER_NAME_KEY, name],
  ]);
  return { address, name };
};

/**
 * Menghapus pilihan printer Bluetooth tersimpan di perangkat.
 */
export const clearPrinterSelection = async () => {
  await AsyncStorage.multiRemove([PRINTER_ADDRESS_KEY, PRINTER_NAME_KEY]);
};

// Mengaktifkan Bluetooth bila belum aktif lalu membaca daftar perangkat terpairing.
export const getPairedPrinters = async () => {
  const lib = getLib();
  if (!lib) throw new Error(NOT_SUPPORTED_MSG);
  const ok = await ensureBluetoothPermissions();
  if (!ok) {
    throw new Error(
      "Izin Bluetooth belum diberikan. Izinkan akses Perangkat di Sekitar di pengaturan aplikasi HP.",
    );
  }
  const mgr = lib.BluetoothManager;
  let raw;
  try {
    // RNBluetoothManagerModule tidak mengekspor getPairedDevices(); method resminya
    // adalah enableBluetooth() yang mengaktifkan BT jika mati & mengembalikan perangkat terpairing.
    if (typeof mgr.enableBluetooth === "function") {
      raw = await mgr.enableBluetooth();
    } else if (typeof mgr.getPairedDevices === "function") {
      raw = await mgr.getPairedDevices();
    } else {
      throw new Error("Modul Bluetooth pada perangkat tidak mendukung daftar perangkat.");
    }
  } catch (err) {
    throw new Error(
      mapBluetoothError(err, "Gagal membaca daftar printer Bluetooth dari HP."),
    );
  }
  return parsePairedDeviceList(raw);
};

// Hubungkan ke printer Bluetooth yang tersimpan.
export const connectToPrinter = async () => {
  const lib = getLib();
  if (!lib) throw new Error(NOT_SUPPORTED_MSG);
  const addr = normalizeMacAddress(
    await AsyncStorage.getItem(PRINTER_ADDRESS_KEY),
  );
  if (!addr) {
    throw new Error(
      "Printer Bluetooth belum dipilih. Buka Pengaturan > Printer Bluetooth untuk memilih.",
    );
  }
  const ok = await ensureBluetoothPermissions();
  if (!ok) {
    throw new Error(
      "Izin Bluetooth belum diberikan. Izinkan akses Perangkat di Sekitar di pengaturan aplikasi HP.",
    );
  }
  const mgr = lib.BluetoothManager;
  try {
    if (typeof mgr.isBluetoothEnabled === "function") {
      const enabled = await mgr.isBluetoothEnabled();
      if (!enabled && typeof mgr.enableBluetooth === "function") {
        await mgr.enableBluetooth();
      }
    }
    await mgr.connect(addr);
  } catch (err) {
    throw new Error(
      mapBluetoothError(
        err,
        "Gagal terhubung ke printer. Pastikan printer thermal menyala dan berada dalam jangkauan.",
      ),
    );
  }
  return lib;
};

/**
 * Mencetak struk uji coba singkat untuk memastikan koneksi printer Bluetooth
 * dan hasil cetak thermal berjalan normal.
 */
export const printTestViaBluetooth = async ({
  storeName = "MarketPos",
  printerName = DEFAULT_PRINTER_LABEL,
} = {}) => {
  const lib = await connectToPrinter();
  const printer = lib.BluetoothEscposPrinter;
  await printer.printerInit();
  await printer.setWidth(384);

  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.setBlob(1);
  await printer.printText("MARKETPOS\n", TEXT_OPTS);
  await printer.printText("TES PRINTER BLUETOOTH\n", TEXT_OPTS);
  await printer.setBlob(0);
  await printer.printText(dash() + "\n", TEXT_OPTS);

  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printText(row("Status", "Terhubung & Siap") + "\n", TEXT_OPTS);
  await printer.printText(
    row("Toko", String(storeName || "MarketPos").slice(0, 22)) + "\n",
    TEXT_OPTS,
  );
  await printer.printText(
    row("Printer", String(printerName || DEFAULT_PRINTER_LABEL).slice(0, 22)) +
      "\n",
    TEXT_OPTS,
  );
  await printer.printText(
    row("Waktu", formatLocalDateTime(new Date().toISOString())) + "\n",
    TEXT_OPTS,
  );
  await printer.printText(dash() + "\n", TEXT_OPTS);

  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.printText("Printer siap digunakan.\n", TEXT_OPTS);
  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printAndFeed(100);
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
    `${storeProfile.storeName || storeProfile.name || "MarketPos"}\n`,
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

  // Info nomor meja & tipe pesanan jika F&B
  if (tx?.table_number || (tx?.order_type && tx?.order_type !== "retail")) {
    const typeStr = tx?.order_type === "dine_in" ? "Dine In" : "Take Away";
    await printer.printText(
      row(
        tx?.table_number ? `Meja: ${tx.table_number}` : "",
        tx?.order_type ? `[${typeStr}]` : "",
      ) + "\n",
      TEXT_OPTS,
    );
  }
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
  const payMethod = String(tx?.payment_method || "cash").toUpperCase();
  if (payMethod === "CASH" || payMethod === "TUNAI") {
    await printer.printText(row("Tunai", rp(tx?.cash_received)) + "\n", TEXT_OPTS);
    await printer.printText(row("Kembalian", rp(tx?.cash_return)) + "\n", TEXT_OPTS);
  } else {
    await printer.printText(row("Metode", payMethod) + "\n", TEXT_OPTS);
    await printer.printText(row("Bayar", rp(tx?.grand_total) + " (Lunas)") + "\n", TEXT_OPTS);
  }
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

// Cetak struk dapur (Kitchen Ticket) khusus staf dapur / barista (TANPA HARGA).
export const printKitchenTicketViaBluetooth = async (tx, details, storeProfile = {}) => {
  const lib = await connectToPrinter();
  const printer = lib.BluetoothEscposPrinter;
  await printer.printerInit();
  await printer.setWidth(384);

  // Header dapur
  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.setBlob(1);
  await printer.printText("*** STRUK DAPUR ***\n", TEXT_OPTS);
  await printer.setBlob(0);
  await printer.printText(
    `${storeProfile.storeName || storeProfile.name || "MarketPos"}\n`,
    TEXT_OPTS,
  );
  await printer.printText(dash() + "\n", TEXT_OPTS);

  // Nomor meja besar & tipe pesanan
  await printer.setBlob(1);
  if (tx?.table_number) {
    await printer.printText(`MEJA: ${tx.table_number}\n`, TEXT_OPTS);
  }
  const orderType = tx?.order_type === "dine_in"
    ? "[ DINE IN / MAKAN DI TEMPAT ]"
    : (tx?.order_type === "take_away" ? "[ TAKE AWAY / BUNGKUS ]" : "[ PESANAN DAPUR ]");
  await printer.printText(`${orderType}\n`, TEXT_OPTS);
  await printer.setBlob(0);

  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printText(
    row(
      `No: ${tx?.invoice_number || "-"}`,
      tx?.created_at ? formatLocalDateTime(tx.created_at) : "",
    ) + "\n",
    TEXT_OPTS,
  );
  await printer.printText(dash() + "\n", TEXT_OPTS);

  // Daftar item (hanya quantity & nama)
  for (const item of details || []) {
    await printer.setBlob(1);
    await printer.printText(`[ ${item.quantity}x ] ${item.product_name}\n`, TEXT_OPTS);
    await printer.setBlob(0);
  }

  // Catatan khusus
  if (tx?.payment_notes) {
    await printer.printText(dash() + "\n", TEXT_OPTS);
    await printer.printText(`Catatan: ${tx.payment_notes}\n`, TEXT_OPTS);
  }

  await printer.printText(dash() + "\n", TEXT_OPTS);
  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.printText("Harap Segera Dimasak\n", TEXT_OPTS);
  await printer.printerAlign(printer.ALIGN.LEFT);
  await printer.printAndFeed(100);
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
  await printer.printBarCode(String(barcode), printer.BARCODETYPE.CODE128, 2, 80, 0, 2);
  await printer.printAndFeed(60);
};

// Cetak Barcode / QR Code Meja langsung ke printer thermal Bluetooth.
export const printTableQRCodeViaBluetooth = async ({
  storeName,
  tableNumber,
  url,
}) => {
  const lib = await connectToPrinter();
  const printer = lib.BluetoothEscposPrinter;
  await printer.printerInit();
  await printer.setWidth(384);

  await printer.printerAlign(printer.ALIGN.CENTER);
  await printer.setBlob(1);
  await printer.printText(`${storeName || "MarketPos Resto"}\n`, TEXT_OPTS);
  await printer.printText(`*** MEJA ${tableNumber} ***\n`, TEXT_OPTS);
  await printer.setBlob(0);
  await printer.printText("Scan untuk pesan & bayar\n", TEXT_OPTS);
  await printer.printText(dash() + "\n", TEXT_OPTS);

  try {
    // ESC/POS printQRCode(url, size, errorCorrection)
    await printer.printQRCode(
      String(url),
      260,
      printer.ERROR_CORRECTION ? printer.ERROR_CORRECTION.L : 1
    );
  } catch (qrErr) {
    console.warn("ESC/POS printQRCode failed, fallback to text url:", qrErr);
    await printer.printText(`${url}\n`, TEXT_OPTS);
  }

  await printer.printText(dash() + "\n", TEXT_OPTS);
  await printer.printText("Buka kamera HP & scan QR diatas\n", TEXT_OPTS);
  await printer.printAndFeed(100);
};
