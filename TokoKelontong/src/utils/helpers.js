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
