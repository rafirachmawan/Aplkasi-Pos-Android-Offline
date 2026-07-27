import { Platform } from 'react-native';
import { formatRupiah } from './helpers';

/**
 * Memformat teks struk untuk printer thermal 32 kolom (58mm) atau 48 kolom (80mm)
 */
const COLS = 32; // untuk printer 58mm

const padEnd = (str, len) => String(str).substring(0, len).padEnd(len);
const padStart = (str, len) => String(str).substring(0, len).padStart(len);
const center = (str) => str.substring(0, COLS).padStart(Math.floor((COLS + str.length) / 2)).padEnd(COLS);
const divider = () => '-'.repeat(COLS);

export const buildReceiptText = (storeName, invoiceNumber, items, totalPrice, discount, grandTotal, cashReceived, cashReturn) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const lines = [];
  lines.push(center(storeName));
  lines.push(center('Toko Kelontong'));
  lines.push(divider());
  lines.push(`Nota : ${invoiceNumber}`);
  lines.push(`Tgl  : ${dateStr} ${timeStr}`);
  lines.push(divider());

  // Items
  items.forEach((item) => {
    const name = item.product_name.substring(0, COLS);
    lines.push(name);
    const qtyPrice = `  ${item.quantity} x ${formatRupiah(item.selling_price)}`;
    const subtotal = formatRupiah(item.selling_price * item.quantity);
    const space = COLS - qtyPrice.length - subtotal.length;
    lines.push(qtyPrice + ' '.repeat(Math.max(1, space)) + subtotal);
  });

  lines.push(divider());

  const addCalcRow = (label, value) => {
    const valStr = formatRupiah(value);
    const space = COLS - label.length - valStr.length;
    lines.push(label + ' '.repeat(Math.max(1, space)) + valStr);
  };

  addCalcRow('Subtotal', totalPrice);
  if (discount > 0) addCalcRow('Diskon', -discount);
  addCalcRow('TOTAL', grandTotal);
  lines.push(divider());
  addCalcRow('Bayar', cashReceived);
  addCalcRow('Kembali', cashReturn);
  lines.push(divider());
  lines.push(center('Terima Kasih!'));
  lines.push(center('Barang yang dibeli'));
  lines.push(center('tidak dapat dikembalikan'));
  lines.push('');
  lines.push('');

  return lines.join('\n');
};

/**
 * Cetak struk via Bluetooth ke printer thermal
 * Hanya berfungsi di Android native
 */
export const printReceipt = async (storeName, invoiceNumber, items, totalPrice, discount, grandTotal, cashReceived, cashReturn, printerAddress) => {
  if (Platform.OS === 'web') {
    const text = buildReceiptText(storeName, invoiceNumber, items, totalPrice, discount, grandTotal, cashReceived, cashReturn);
    console.log('=== STRUK (Web Preview) ===\n', text);
    return { success: false, message: 'Cetak struk hanya tersedia di Android.' };
  }

  try {
    const { BluetoothEscposPrinter, BluetoothManager } = require('react-native-bluetooth-escpos-printer');

    if (!printerAddress) {
      return { success: false, message: 'Alamat printer Bluetooth belum diatur di Pengaturan.' };
    }

    // Konek ke printer
    await BluetoothManager.connect(printerAddress);

    // Cetak header
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.printText(storeName + '\n', { fonttype: 1, widthtimes: 1, heigthtimes: 1 });
    await BluetoothEscposPrinter.printText('Toko Kelontong\n', {});
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
    await BluetoothEscposPrinter.printText('-'.repeat(32) + '\n', {});
    await BluetoothEscposPrinter.printText(`Nota : ${invoiceNumber}\n`, {});

    const now = new Date();
    await BluetoothEscposPrinter.printText(
      `Tgl  : ${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}\n`, {}
    );
    await BluetoothEscposPrinter.printText('-'.repeat(32) + '\n', {});

    // Items
    for (const item of items) {
      await BluetoothEscposPrinter.printText(`${item.product_name}\n`, {});
      await BluetoothEscposPrinter.printColumn(
        [16, 8, 8],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT, BluetoothEscposPrinter.ALIGN.RIGHT],
        [`  ${item.quantity}x${formatRupiah(item.selling_price)}`, '', formatRupiah(item.selling_price * item.quantity)],
        {}
      );
    }

    await BluetoothEscposPrinter.printText('-'.repeat(32) + '\n', {});
    await BluetoothEscposPrinter.printColumn(
      [16, 16],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Subtotal', formatRupiah(totalPrice)], {}
    );
    if (discount > 0) {
      await BluetoothEscposPrinter.printColumn(
        [16, 16],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Diskon', `-${formatRupiah(discount)}`], {}
      );
    }
    await BluetoothEscposPrinter.printColumn(
      [16, 16],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['TOTAL', formatRupiah(grandTotal)], { fonttype: 1 }
    );
    await BluetoothEscposPrinter.printText('-'.repeat(32) + '\n', {});
    await BluetoothEscposPrinter.printColumn(
      [16, 16],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Bayar', formatRupiah(cashReceived)], {}
    );
    await BluetoothEscposPrinter.printColumn(
      [16, 16],
      [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
      ['Kembali', formatRupiah(cashReturn)], {}
    );
    await BluetoothEscposPrinter.printText('-'.repeat(32) + '\n', {});
    await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
    await BluetoothEscposPrinter.printText('Terima Kasih!\n', {});
    await BluetoothEscposPrinter.printText('Barang tidak dapat\ndikembalikan\n\n\n', {});

    return { success: true };
  } catch (e) {
    console.error('Print error:', e);
    return { success: false, message: `Gagal cetak: ${e.message}` };
  }
};
