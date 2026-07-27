/**
 * Menghasilkan nomor invoice berdasarkan tanggal (INV/YYYYMMDD/XXXX)
 */
export const generateInvoiceNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  // Untuk simulasi cepat, menggunakan random number. 
  // Idealnya ini menggunakan Auto Increment atau counter dari database untuk hari yang sama.
  const randomId = Math.floor(1000 + Math.random() * 9000); 
  
  return `INV/${year}${month}${day}/${randomId}`;
};

/**
 * Format angka menjadi format Rupiah
 */
export const formatRupiah = (number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(number);
};
