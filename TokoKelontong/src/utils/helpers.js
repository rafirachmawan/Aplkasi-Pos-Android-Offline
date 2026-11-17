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
