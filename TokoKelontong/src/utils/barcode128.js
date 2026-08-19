import { CODE128 } from "jsbarcode/src/barcodes/CODE128";

/**
 * Encode nilai menjadi barcode Code128 ASLI (algoritma standar industri,
 * sama dengan pustaka JsBarcode — bukan bar visual dari kode karakter).
 *
 * Mengembalikan string biner ("110100..."): karakter '1' = bar hitam,
 * '0' = spasi putih. Sudah termasuk kode start, checksum, dan stop,
 * sehingga siap dibaca scanner barcode sungguhan.
 *
 * @param {string} value - isi barcode
 * @returns {string|null} string biner, atau null bila tidak bisa di-encode
 */
export const encodeCode128 = (value) => {
  try {
    if (!value) return null;
    // Options {} wajib — kelas CODE128 membaca options.ean128 saat encode
    const encoded = new CODE128(String(value), {}).encode();
    return encoded.data;
  } catch (e) {
    return null;
  }
};
