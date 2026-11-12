# Panduan QA Lapangan, Rilis, dan Rollback — Mode Offline-First

> **Dibuat:** 10 November 2026
> **Terkait:** `09 november 2026 rencan offline .md` (OF-12, T-O-01 s/d T-O-19), `ROADMAP_UPDATE_DAN_ATURAN_RILIS_AMAN.md`
> **Status kode saat dokumen ini dibuat:** semua OF-xx 🟨 (kode ada, belum diuji di HP)
> **Aturan utama:** klien aktif tidak boleh kehilangan data dan tidak boleh berhenti bisa bertransaksi.

---

## 1. Gerbang Rilis (Go / No-Go)

Rilis ke klien **hanya boleh** bila semua kotak ini tercentang.

- [x] **G-1** Migrasi v8 sudah dijalankan di Supabase (sudah, oleh pemilik).
- [x] **G-2** Cek native `expo-sqlite` di APK klien (Bagian 2) → **HASIL: ADA** (`libexpo-sqlite.so` terpasang di semua arch, runtimeVersion `"1.0.0"`). Jalur A berlaku.
- [ ] **G-3** Semua skenario **WAJIB** di Bagian 5 lulus di minimal 1 HP uji.
- [ ] **G-4** Query pemeriksaan server (Bagian 6) menunjukkan nol duplikat setelah uji.
- [ ] **G-5** APK klien versi lama masih bisa checkout (T-O-17) setelah v8.
- [ ] **G-6** Backup database terbaru ada (Supabase Dashboard → Database → Backups, atau ekspor manual).
- [ ] **G-7** Sudah tahu cara rollback (Bagian 8) dan klien diminta mengirim semua transaksi sebelum update.

Bila ada satu saja yang gagal: **tahan rilis**, catat di Log Progres dokumen rencana, ubah status OF terkait ke 🔁 Revisi.

---

## 2. Cek Native: Apakah APK Klien Sudah Punya `expo-sqlite`? (OF-00)

**Kenapa penting:** OTA (`eas update`) hanya mengirim kode JavaScript. Modul native tidak ikut terkirim. Bila APK klien dibuat **tanpa** `expo-sqlite`, bundle baru akan error saat app dibuka (layar putih / langsung menutup).

**Cara cek (tanpa menyentuh HP klien):**

1. Ambil file APK yang dibagikan ke klien (atau unduh dari halaman build EAS).
2. Jalankan di PowerShell:
   ```powershell
   # ganti nama file sesuai APK Anda
   Add-Type -AssemblyName System.IO.Compression.FileSystem
   $zip = [IO.Compression.ZipFile]::OpenRead("D:\path\ke\marketpos.apk")
   $zip.Entries | Where-Object { $_.FullName -match "sqlite" } | Select-Object FullName
   $zip.Dispose()
   ```
3. Hasil:
   - Ada file seperti `lib/arm64-v8a/libexpo-sqlite.so` (atau nama berisi `sqlite`) → **modul ada**. Lanjut.
   - Tidak ada hasil → **modul TIDAK ada**. Wajib jalur B di bawah.

**Jalur A — modul ada:** boleh rilis lewat OTA sesuai Bagian 7.

**Jalur B — modul tidak ada:**
1. Naikkan `runtimeVersion` di `app.json` (misal `"1.0.0"` → `"1.1.0"`) dan naikkan `version`.
2. Build APK baru (`eas build -p android --profile apk`).
3. Bagikan APK baru ke klien. **APK lama tidak akan menerima bundle baru** (runtimeVersion berbeda), jadi mereka tetap aman dan tetap bisa bertransaksi.
4. Jangan jalankan `eas update` ke runtime lama.

> Catatan: perubahan di `app.json` harus dilakukan dengan sadar. Tanyakan dulu bila ragu.

---

## 3. Persiapan Uji

| Kebutuhan | Keterangan |
|---|---|
| Akun uji | Akun **dummy**, bukan toko klien. Sebaiknya project Supabase dummy; bila pakai project produksi, pakai toko uji terpisah dan hapus datanya setelah selesai. |
| HP uji | Minimal 2 HP Android (untuk T-O-09, T-O-11). 1 HP cukup untuk skenario lain. |
| Build uji | APK `preview`/`apk` yang berisi kode baru. **Bukan OTA ke production.** |
| Data uji | Minimal 20 produk, 1 produk stok 0, 1 produk stok kecil (misal 2). Satu uji dengan 2.000+ produk (T-O-15). |
| Printer | Printer Bluetooth fisik (T-O-18). |
| Alat | Akses Supabase SQL Editor untuk query pemeriksaan (Bagian 6). |

**Cara mematikan internet dengan benar:** gunakan **mode pesawat** (Wi-Fi dan data mati sekaligus). Jangan hanya mematikan data seluler bila Wi-Fi masih aktif.

---

## 4. Cara Membaca Hasil di Aplikasi

- **Banner "N Transaksi Belum Terkirim"** di Beranda dan Kasir = jumlah transaksi di HP yang belum diterima server.
- **Ketuk banner** → layar *Transaksi Belum Terkirim*: daftar `Menunggu kirim`, `Perlu ditinjau`, dan 20 `Terkirim` terakhir.
- **Kirim Sekarang** = paksa kirim dan abaikan jeda tunggu.
- Banner **hilang** = semua sudah terkirim.
- Status `Perlu ditinjau` = server menolak karena data (bukan jaringan). Data tetap aman di HP. **Catat pesan errornya** lalu laporkan.

---

## 5. Skenario Uji Lapangan

Tandai ✅ lulus / ❌ gagal. **WAJIB** = harus lulus sebelum rilis.

### A. Jual tanpa internet (inti)

**T-O-01 — Buka app offline (WAJIB)**
1. Login normal (online), buka Kasir, tunggu produk muncul.
2. Aktifkan mode pesawat. Tutup app paksa (Recent apps → geser).
3. Buka app lagi.
- **Harapan:** langsung masuk Beranda (tidak ke layar login). Kasir menampilkan produk. Scan barcode dan cari nama berjalan.
- Hasil: ☐

**T-O-02 — Checkout offline (WAJIB)**
1. Masih mode pesawat. Jual 2 barang, bayar tunai.
2. Catat nomor nota di struk. Catat stok barang tersebut sebelum dan sesudah.
3. Tutup paksa app, buka lagi.
- **Harapan:** struk tampil (nomor nota format `INV/YYYYMMDD/XX-0001`). Stok berkurang sesuai qty. Banner menunjukkan 1 transaksi belum terkirim, juga setelah app dibuka ulang.
- Hasil: ☐

**T-O-03 — Online kembali (WAJIB)**
1. Matikan mode pesawat. Tunggu maksimal 1 menit (atau ketuk **Kirim Sekarang**).
- **Harapan:** banner hilang. Transaksi di layar *Transaksi Belum Terkirim* berstatus `Terkirim`. Cek server (Bagian 6): 1 baris, bukan 2. Stok di server = stok di HP.
- Hasil: ☐

**T-O-07 — Jual saat stok 0 atau minus (WAJIB)**
1. Jual produk berstok 0. Jual lagi sampai minus.
- **Harapan:** tidak ditolak. Stok tampil `Stok: -n`. Setelah sync, stok server juga minus dan sama dengan HP.
- Hasil: ☐

**T-O-18 — Cetak Bluetooth offline**
1. Mode pesawat (Bluetooth tetap menyala). Checkout lalu cetak struk, lalu cetak struk dapur (mode F&B).
- **Harapan:** keduanya tercetak.
- Hasil: ☐

### B. Keamanan data dan duplikat

**T-O-06 — Kirim berulang tidak membuat ganda (WAJIB)**
1. Buat 3 transaksi offline. Online. Ketuk **Kirim Sekarang** 3 kali berturut-turut.
- **Harapan:** server hanya memuat 3 transaksi. Stok berkurang sekali per transaksi.
- Hasil: ☐

**T-O-05 — Koneksi putus saat mengirim (WAJIB)**
1. Buat 1 transaksi offline. Online, ketuk **Kirim Sekarang**, lalu **segera** aktifkan mode pesawat (dalam 1 detik). Ulangi beberapa kali bila perlu sampai banner tidak hilang.
2. Online kembali, tunggu sync.
- **Harapan:** tetap 1 transaksi di server. Tidak ada yang hilang. Tidak ada yang ganda.
- Hasil: ☐

**T-O-08 — Tanggal transaksi benar**
1. Buat transaksi offline hari ini. Kirim besok (atau ubah tanggal HP dengan hati-hati, lalu kembalikan).
- **Harapan:** di laporan, transaksi masuk ke **tanggal saat dijual**, bukan tanggal sync.
- Hasil: ☐

**T-O-13 — Antrean lama AsyncStorage (WAJIB bila ada klien dengan antrean lama)**
1. Pasang APK **lama**. Buat 2 transaksi offline (tercatat di antrean lama). Jangan sync.
2. Update ke build baru (tanpa hapus data).
3. Online.
- **Harapan:** banner menunjukkan 2. Terkirim tanpa ganda. Tidak ada yang hilang.
- Hasil: ☐

**T-O-09 — Dua HP menjual barang terakhir**
1. Dua HP, produk stok 1. Keduanya offline, masing-masing jual 1.
2. Keduanya online.
- **Harapan:** 2 transaksi masuk, stok server `-1`. Tidak ada transaksi hilang.
- Hasil: ☐

### C. Login dan sesi

**T-O-04 — Sesi kedaluwarsa + offline**
- Idealnya di project dummy dengan masa JWT pendek (misal 5 menit). Login, tunggu token kedaluwarsa, mode pesawat, tutup paksa, buka.
- **Harapan:** masuk Beranda (bukan layar login). Bisa jual.
- Hasil: ☐

**T-O-10 — Logout dengan transaksi belum terkirim (WAJIB)**
1. Buat transaksi offline. Pengaturan → Keluar Akun.
- **Harapan:** muncul peringatan jumlah transaksi belum terkirim. Setelah keluar, login lagi dengan akun yang sama → transaksi masih ada dan terkirim.
- Ulangi dalam keadaan online dan offline (logout offline harus tetap berhasil keluar).
- Hasil: ☐

**T-O-11 — Password diganti dari perangkat lain**
1. HP A offline. Ganti password akun dari HP B / Supabase.
2. HP A tetap menjual offline. Lalu online.
- **Harapan:** HP A diarahkan login ulang. Outbox masih ada. Setelah login ulang, terkirim.
- Hasil: ☐

**T-O-12 — Login toko lain di HP yang sama**
1. HP punya transaksi belum terkirim milik Toko A. Logout, login Toko B.
- **Harapan:** transaksi Toko A **tidak** terkirim ke Toko B. Login lagi ke Toko A → terkirim di Toko A.
- Hasil: ☐

### D. Tampilan dan batasan

**T-O-14 — Laporan gabungan**
1. Buat 2 transaksi offline. Buka Laporan dan Beranda.
- **Harapan:** omzet termasuk 2 transaksi itu. Setelah sync, angka **tidak** bertambah dua kali.
- Hasil: ☐

**T-O-15 — Katalog besar**
1. Akun uji dengan 2.000+ produk. Login, tunggu sync. Mode pesawat, buka Kasir.
- **Harapan:** semua produk ada (tidak terpotong 1.000).
- Hasil: ☐

**T-O-16 — Sinyal jelek**
1. Gunakan sinyal lemah (jauh dari router, atau throttle jaringan).
- **Harapan:** Kasir tetap terbuka cepat dari cache. Checkout tidak menunggu internet. Tidak ada layar kosong lama.
- Hasil: ☐

**T-O-19 — Pergantian hari**
1. Jual sebelum dan sesudah tengah malam saat offline.
- **Harapan:** nomor nota urut baru per hari, tanpa bentrok.
- Hasil: ☐

**Uji tambahan (tidak ada di rencana awal):**

| No | Skenario | Harapan | Hasil |
|---|---|---|---|
| X-01 | Kasbon saat offline | Muncul pesan "Kasbon membutuhkan koneksi internet". Tidak ada transaksi setengah jadi. | ☐ |
| X-02 | Kasbon saat online | Berhasil, hutang tercatat di Buku Kasbon dengan transaksi yang benar. | ☐ |
| X-03 | Tambah/ubah/hapus barang saat offline | Pesan butuh internet. Gudang tetap menampilkan barang. | ☐ |
| X-04 | Edit nama barang berstok minus | Stok **tetap minus**, tidak berubah jadi 0. | ☐ |
| X-05 | PIN terkunci saat offline | Menu yang dikunci tetap meminta PIN. Tidak bisa dilewati. | ☐ |
| X-06 | Pertama kali buka app baru, **tanpa** pernah login di build baru, dan offline | Wajar bila tidak bisa masuk. Tidak crash. | ☐ |
| X-07 | Ketuk **Kirim Sekarang** saat offline | Pesan gagal yang jelas. Data tetap ada. | ☐ |

---

## 6. Query Pemeriksaan Server (Supabase SQL Editor)

Jalankan setelah uji. Ganti `<STORE_ID>` dengan id toko uji.

```sql
-- 1. HARUS KOSONG: tidak boleh ada client_tx_id ganda per toko
select store_id, client_tx_id, count(*)
from public.transactions
where client_tx_id is not null
group by store_id, client_tx_id
having count(*) > 1;

-- 2. Transaksi terbaru toko uji (cek waktu, nomor nota, total)
select invoice_number, client_tx_id, created_at, client_created_at,
       grand_total, payment_method, is_offline_sync
from public.transactions
where store_id = '<STORE_ID>'
order by created_at desc
limit 30;

-- 3. HARUS KOSONG: nomor nota ganda per toko
select store_id, invoice_number, count(*)
from public.transactions
group by store_id, invoice_number
having count(*) > 1;

-- 4. Stok minus (wajar bila memang terjual saat stok 0)
select product_name, stock_quantity
from public.products
where store_id = '<STORE_ID>' and stock_quantity < 0
order by stock_quantity;

-- 5. Detail satu transaksi (ganti id)
select product_name, quantity, price_at_sale, capital_at_sale
from public.transaction_details
where transaction_id = '<TRANSACTION_ID>';
```

**Rekonsiliasi stok (T-O-03):** stok awal − total qty terjual = stok server sekarang.

---

## 7. Urutan Rilis ke Klien

**Prasyarat:** Gerbang G-1 s/d G-7 (Bagian 1) lulus.

1. **Backup database** Supabase (catat waktunya).
2. **Pastikan v8 sudah ada** (sudah dijalankan).
3. **Uji APK lama masih checkout** (T-O-17) di HP yang memakai APK lama.
4. **Pilih jalur** sesuai hasil Bagian 2:
   - **Jalur A (OTA):**
     1. Terbitkan dulu ke branch uji, bukan production: `eas update --branch offline-test --message "offline-first uji"`.
     2. Setelah QA lulus, baru: `eas update --branch production --message "offline-first v1"`.
     3. Sesuai Golden Rule 4 di roadmap: jangan ke `production` sebelum QA selesai.
   - **Jalur B (APK baru):** bagikan APK baru. Klien lama tetap berjalan di versi lama.
5. **Rilis bertahap:** mulai dari **1 klien** yang kooperatif. Pantau 24 jam. Baru ke klien lain.
6. **Minta klien (sebelum update):**
   - Pastikan ada internet, buka app, tunggu semua transaksi terkirim (tidak ada banner "belum terkirim").
   - Setelah update, **buka app sekali dengan internet** (agar data login tersimpan untuk mode offline).
7. **Jangan** menyuruh klien menghapus data aplikasi atau uninstall (lihat Bagian 8, risiko data hilang).

### Teks pesan ke klien (contoh)

> Halo, ada pembaruan MarketPOS: kasir sekarang tetap bisa dipakai saat internet mati. Transaksi tersimpan di HP dan terkirim otomatis saat internet kembali.
> Sebelum update: buka aplikasi dengan internet menyala sampai tidak ada tulisan "Transaksi Belum Terkirim".
> Setelah update: buka aplikasi sekali dengan internet menyala.
> Mohon **jangan hapus data aplikasi / uninstall** bila masih ada transaksi belum terkirim.

---

## 8. Rollback

### 8.1 Server (database)
- Migrasi v8 **add-only** (2 kolom nullable, 1 index, 1 fungsi). **Tidak perlu di-rollback.** APK lama tetap memakai `checkout` lama dan tidak terpengaruh.
- **Jangan** menghapus kolom `client_tx_id` / `client_created_at` / index. Kolom itu berisi riwayat idempotensi.
- Fungsi `checkout_v2` baru boleh dihapus **hanya** bila semua klien sudah kembali ke versi lama **dan** tidak ada transaksi belum terkirim di HP mana pun. Bila tidak yakin, biarkan.
- **Jangan** mencabut izin `checkout_v2` saat klien baru masih aktif: sync mereka akan gagal terus (data aman di HP, tetapi tidak terkirim).

### 8.2 Aplikasi (OTA)
1. Cari update sebelumnya: `eas update:list --branch production`.
2. Terbitkan ulang grup sebelumnya: `eas update:republish --group <ID_GRUP_SEBELUMNYA> --branch production`.
   (Alternatif: `eas update:rollback`. Cek `eas update --help` untuk opsi di versi EAS CLI Anda.)
3. Klien menerima saat membuka app berikutnya (`checkOnLaunch: always`), biasanya perlu buka app dua kali.

### 8.3 PENTING: transaksi belum terkirim saat rollback
Versi lama **tidak membaca** database SQLite versi baru. Akibatnya:

| Kondisi | Dampak | Tindakan |
|---|---|---|
| Klien sudah mengirim semua transaksi (banner kosong) | Aman. | Rollback bebas. |
| Klien masih punya transaksi belum terkirim | Data **tidak hilang**, tetapi **tidak terlihat dan tidak terkirim** oleh versi lama. | **Sebelum rollback**, minta klien buka app dengan internet sampai banner hilang. Bila tidak bisa, **jangan** biarkan klien uninstall atau "Hapus data". Pasang kembali versi baru nanti, transaksi akan terkirim. |
| Klien uninstall atau "Hapus data aplikasi" saat masih ada transaksi belum terkirim | **Transaksi belum terkirim hilang permanen.** | Hindari. Ini satu-satunya jalur kehilangan data. |
| Antrean lama sudah dipindahkan tapi belum terkirim, lalu klien kembali ke versi lama | Versi lama masih punya salinan antrean dan mengirimnya dengan jalur lama (tanpa penanda idempotensi). Bila nanti pakai versi baru lagi, bisa terkirim ganda. | Setelah rollback, cek duplikat dengan query nomor 3 (Bagian 6) dan bandingkan dengan catatan klien. |

### 8.4 Bila ada transaksi `Perlu ditinjau`
1. Jangan hapus apa pun.
2. Catat pesan error di layar *Transaksi Belum Terkirim*.
3. Penyebab umum: `store_mismatch` (login toko berbeda), data tidak valid. Perbaiki penyebab, lalu ketuk **Kirim Sekarang** (akan dicoba ulang).

---

## 9. Pemantauan 48 Jam Pertama

| Cek | Cara | Normal |
|---|---|---|
| Duplikat transaksi | Query 1 dan 3 (Bagian 6) | Kosong |
| Transaksi `is_offline_sync = true` | `select count(*) from transactions where is_offline_sync` per hari | Muncul bila klien memang pernah offline |
| Keluhan "layar putih / crash saat buka" | Tanya klien | Nol. Satu laporan = hentikan rilis (cek Bagian 2) |
| Keluhan "transaksi tidak terkirim" | Minta screenshot layar *Transaksi Belum Terkirim* | Nol yang `Perlu ditinjau` |
| Keluhan "stok aneh/minus" | Cek query 4 | Minus hanya untuk barang yang dijual saat stok 0 |

---

## 10. Batasan yang Diketahui (sampaikan ke klien bila ditanya)

1. **Login pertama** di HP (atau setelah update dari versi lama) butuh internet.
2. **Kasbon**, tambah/ubah/hapus barang, dan ganti pengaturan toko butuh internet.
3. **Laporan** menampilkan data server ditambah transaksi di HP yang belum terkirim. Transaksi dari HP **lain** yang belum terkirim tidak terlihat sampai HP itu online.
4. Stok yang tampil = stok server terakhir dikurangi penjualan di HP yang belum terkirim. Penjualan di HP lain baru terlihat setelah katalog diperbarui.
5. Kode perangkat pada nomor nota hanya 2 karakter acak. Bila bentrok, server memberi nomor nota sendiri (penjualan tidak gagal), jadi nomor nota di struk bisa berbeda dari nomor di laporan untuk kasus langka itu.
6. Uninstall atau "Hapus data" menghapus transaksi yang belum terkirim.

---

## 11. Log Hasil QA

| Tanggal | Penguji | HP / Android | Build | Skenario | Hasil | Catatan |
|---|---|---|---|---|---|---|
|  |  |  |  |  |  |  |
|  |  |  |  |  |  |  |

Setelah semua WAJIB lulus: ubah status OF-xx di dokumen rencana dari 🟨 ke ✅ dan tambahkan baris di Log Progres.
