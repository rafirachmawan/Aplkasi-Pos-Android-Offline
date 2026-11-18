/**
 * Format angka menjadi format Rupiah tanpa spasi setelah Rp (PUEBI / RX-FE-12)
 */
export const formatRupiah = (number) => {
  const num = Number(number ?? 0);
  if (!Number.isFinite(num)) return 'Rp0';
  const sign = num < 0 ? '-' : '';
  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
  }).format(Math.abs(num));
  return `${sign}Rp${formatted}`;
};

/**
 * Format input angka menjadi tampilan Rupiah langsung saat mengetik (Rp50.000).
 * Mengembalikan "" bila kosong atau nol agar placeholder "Rp0" terlihat rapi.
 */
export const formatToRpInput = (raw) => {
  const num = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!num) return '';
  return 'Rp' + num.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * Mengambil nilai angka murni dari string input Rupiah ("Rp50.000" -> 50000).
 */
export const parseRpInput = (formatted) => {
  const num = String(formatted || '').replace(/\D/g, '');
  return parseInt(num, 10) || 0;
};

const ID_MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const MONTH_NAME_TO_NUMBER = {
  jan: 1,
  januari: 1,
  january: 1,
  feb: 2,
  februari: 2,
  peb: 2,
  pebruari: 2,
  february: 2,
  mar: 3,
  maret: 3,
  mart: 3,
  march: 3,
  apr: 4,
  april: 4,
  mei: 5,
  may: 5,
  jun: 6,
  juni: 6,
  june: 6,
  jul: 7,
  juli: 7,
  july: 7,
  agu: 8,
  agt: 8,
  ags: 8,
  agustus: 8,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  oct: 10,
  october: 10,
  nov: 11,
  nop: 11,
  november: 11,
  nopember: 11,
  des: 12,
  desember: 12,
  dec: 12,
  december: 12,
};

const pad2 = (n) => String(n).padStart(2, '0');

const formatYmdDisplay = (year, month, day) =>
  `${day} ${ID_MONTHS_SHORT[month - 1]} ${year}`;

const buildValidatedYmd = (year, month, day) => {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return {
    iso: `${year}-${pad2(month)}-${pad2(day)}`,
    display: formatYmdDisplay(year, month, day),
  };
};

const resolveYearWhenOmitted = (month, day, refDate) => {
  const refYear = refDate.getFullYear();
  const todayMidnight = new Date(
    refYear,
    refDate.getMonth(),
    refDate.getDate(),
  );
  for (let offset = 0; offset <= 4; offset += 1) {
    const candidateYear = refYear + offset;
    const built = buildValidatedYmd(candidateYear, month, day);
    if (!built) continue;
    const candidateDate = new Date(candidateYear, month - 1, day);
    if (candidateDate >= todayMidnight) {
      return built;
    }
  }
  return buildValidatedYmd(refYear + 1, month, day);
};

const normalizeYearToken = (rawYear) => {
  const y = parseInt(rawYear, 10);
  if (Number.isNaN(y)) return NaN;
  if (String(rawYear).length <= 2) return 2000 + y;
  return y;
};

/**
 * Mengurai tanggal jatuh tempo bebas dalam format Indonesia maupun angka:
 * - "12 januari", "12 jan", "12 Januari 2027", "januari 12"
 * - "12-01", "12/01", "12-01-2027", "2027-01-12"
 * - "besok", "lusa", "hari ini", atau kosong (opsional)
 * Mengembalikan YYYY-MM-DD yang kompatibel dengan kolom Postgres `date`.
 */
export const parseFlexibleDueDate = (input, referenceDate = new Date()) => {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return { valid: true, iso: null, display: '' };
  }

  const normalized = trimmed.replace(/,/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  const relativeOffsets = { 'hari ini': 0, besok: 1, lusa: 2 };
  if (normalized in relativeOffsets) {
    const d = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth(),
      referenceDate.getDate() + relativeOffsets[normalized],
    );
    const built = buildValidatedYmd(
      d.getFullYear(),
      d.getMonth() + 1,
      d.getDate(),
    );
    return { valid: true, iso: built.iso, display: built.display };
  }

  // Format ISO YYYY-MM-DD
  const isoMatch = normalized.match(/^(\d{4})[-/.\s](\d{1,2})[-/.\s](\d{1,2})$/);
  if (isoMatch) {
    const built = buildValidatedYmd(
      parseInt(isoMatch[1], 10),
      parseInt(isoMatch[2], 10),
      parseInt(isoMatch[3], 10),
    );
    if (built) return { valid: true, ...built };
    return {
      valid: false,
      iso: null,
      display: '',
      error: 'Tanggal jatuh tempo tidak valid. Contoh: 12 Januari atau 12-01.',
    };
  }

  // Format: 12 Januari [2027] atau 12-jan-2027
  const dayMonthWordMatch = normalized.match(
    /^(\d{1,2})[\s\-/.]+([a-z]+)(?:[\s\-/.]+(\d{2,4}))?$/,
  );
  if (dayMonthWordMatch) {
    const day = parseInt(dayMonthWordMatch[1], 10);
    const month = MONTH_NAME_TO_NUMBER[dayMonthWordMatch[2]];
    if (month) {
      const built = dayMonthWordMatch[3]
        ? buildValidatedYmd(
            normalizeYearToken(dayMonthWordMatch[3]),
            month,
            day,
          )
        : resolveYearWhenOmitted(month, day, referenceDate);
      if (built) return { valid: true, ...built };
    }
    return {
      valid: false,
      iso: null,
      display: '',
      error: 'Format tanggal belum dikenali. Contoh: 12 Januari atau 12-01.',
    };
  }

  // Format: Januari 12 [2027]
  const monthWordDayMatch = normalized.match(
    /^([a-z]+)[\s\-/.]+(\d{1,2})(?:[\s\-/.]+(\d{2,4}))?$/,
  );
  if (monthWordDayMatch) {
    const month = MONTH_NAME_TO_NUMBER[monthWordDayMatch[1]];
    const day = parseInt(monthWordDayMatch[2], 10);
    if (month) {
      const built = monthWordDayMatch[3]
        ? buildValidatedYmd(
            normalizeYearToken(monthWordDayMatch[3]),
            month,
            day,
          )
        : resolveYearWhenOmitted(month, day, referenceDate);
      if (built) return { valid: true, ...built };
    }
    return {
      valid: false,
      iso: null,
      display: '',
      error: 'Format tanggal belum dikenali. Contoh: 12 Januari atau 12-01.',
    };
  }

  // Format angka: DD-MM, DD/MM, DD-MM-YYYY, DD/MM/YY
  const numericMatch = normalized.match(
    /^(\d{1,2})[-/.\s](\d{1,2})(?:[-/.\s](\d{2,4}))?$/,
  );
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10);
    const month = parseInt(numericMatch[2], 10);
    const built = numericMatch[3]
      ? buildValidatedYmd(normalizeYearToken(numericMatch[3]), month, day)
      : resolveYearWhenOmitted(month, day, referenceDate);
    if (built) return { valid: true, ...built };
    return {
      valid: false,
      iso: null,
      display: '',
      error: 'Tanggal jatuh tempo tidak valid. Contoh: 12 Januari atau 12-01.',
    };
  }

  return {
    valid: false,
    iso: null,
    display: '',
    error: 'Format tanggal belum dikenali. Contoh: 12 Januari, 12-01, atau kosongkan.',
  };
};

/**
 * Memformat nilai tanggal jatuh tempo (YYYY-MM-DD) menjadi tampilan Indonesia (12 Jan 2027).
 */
export const formatDueDateDisplay = (rawDate) => {
  const val = String(rawDate || '').trim();
  if (!val) return '';
  const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return formatYmdDisplay(year, month, day);
    }
  }
  return val;
};

/**
 * Meng-escape karakter HTML/SVG sensitif agar cetak struk & label QR aman
 * dari karakter seperti &, <, >, ", ' pada nama toko atau nama produk.
 */
export const escapeHtml = (raw) =>
  String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

function rotr(val, n) {
  return (val >>> n) | (val << (32 - n));
}

function utf8ToBytes(str) {
  const utf8 = unescape(encodeURIComponent(String(str ?? '')));
  const bytes = new Array(utf8.length);
  for (let i = 0; i < utf8.length; i++) {
    bytes[i] = utf8.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash SHA-256 murni JS (UTF-8 -> hex huruf kecil), identik di Hermes, Node, Web, & Postgres.
 */
export const sha256Hex = (input) => {
  const bytes = utf8ToBytes(input);
  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLenLo = (bytes.length * 8) >>> 0;

  bytes.push(0x80);
  while ((bytes.length + 8) % 64 !== 0) {
    bytes.push(0);
  }
  bytes.push(
    (bitLenHi >>> 24) & 0xff,
    (bitLenHi >>> 16) & 0xff,
    (bitLenHi >>> 8) & 0xff,
    bitLenHi & 0xff,
    (bitLenLo >>> 24) & 0xff,
    (bitLenLo >>> 16) & 0xff,
    (bitLenLo >>> 8) & 0xff,
    bitLenLo & 0xff,
  );

  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const W = new Array(64);

  for (let i = 0; i < bytes.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      W[t] =
        (bytes[i + t * 4] << 24) |
        (bytes[i + t * 4 + 1] << 16) |
        (bytes[i + t * 4 + 2] << 8) |
        bytes[i + t * 4 + 3];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0;
    H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0;
    H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0;
    H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0;
    H[7] = (H[7] + h) >>> 0;
  }

  return H.map((w) => w.toString(16).padStart(8, '0')).join('');
};

/**
 * Menghasilkan hash SHA-256 PIN keamanan terikat per store_id (`${storeId}:${pin}`).
 */
export const hashStorePin = (storeId, pin) => {
  const cleanPin = String(pin ?? '').trim();
  if (!cleanPin) return null;
  const scope = String(storeId || 'global').trim();
  return sha256Hex(`${scope}:${cleanPin}`);
};

export const PRINTER_PAPER_SIZE_KEY = 'printerPaperSize';

export const PAPER_SIZE_OPTIONS = [
  {
    id: '58mm',
    label: '58 mm',
    shortLabel: 'Thermal 58 mm',
    colLabel: '32 kolom',
    desc: 'Printer thermal kecil / saku (32 karakter per baris, 384 dot).',
    bluetoothDots: 384,
    bluetoothCols: 32,
    htmlPageCss: '58mm auto',
    htmlPageMargin: '2mm',
    htmlMaxWidth: '58mm',
    htmlPreviewWidth: '280px',
    isThermalHtml: true,
  },
  {
    id: '80mm',
    label: '80 mm',
    shortLabel: 'Thermal 80 mm',
    colLabel: '48 kolom',
    desc: 'Printer thermal meja lebar (48 karakter per baris, 576 dot).',
    bluetoothDots: 576,
    bluetoothCols: 48,
    htmlPageCss: '80mm auto',
    htmlPageMargin: '3mm',
    htmlMaxWidth: '80mm',
    htmlPreviewWidth: '370px',
    isThermalHtml: true,
  },
  {
    id: 'a4',
    label: 'A4 / PDF',
    shortLabel: 'Standar A4 / PDF',
    colLabel: 'Standar',
    desc: 'Format lengkap untuk simpan PDF & printer kantor (Bluetooth otomatis pakai 58 mm).',
    bluetoothDots: 384,
    bluetoothCols: 32,
    htmlPageCss: 'A4',
    htmlPageMargin: '12mm',
    htmlMaxWidth: '400px',
    htmlPreviewWidth: '400px',
    isThermalHtml: false,
  },
];

const PAPER_SPEC_MAP = Object.fromEntries(
  PAPER_SIZE_OPTIONS.map((opt) => [opt.id, opt]),
);

/**
 * Menormalkan pilihan ukuran kertas printer menjadi '58mm' | '80mm' | 'a4'.
 * Nilai kosong / tidak dikenal otomatis jatuh ke '58mm' demi kompatibilitas.
 */
export const normalizePaperSize = (value) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === '80' || raw === '80mm') return '80mm';
  if (raw === 'a4' || raw === 'pdf' || raw === 'standar') return 'a4';
  return '58mm';
};

/**
 * Mengambil spesifikasi lengkap ukuran kertas printer berdasarkan id atau nilai mentah.
 */
export const getPaperSpec = (value) =>
  PAPER_SPEC_MAP[normalizePaperSize(value)] || PAPER_SPEC_MAP['58mm'];
