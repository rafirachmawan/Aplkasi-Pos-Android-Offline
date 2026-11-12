# RENCANA MODE OFFLINE-FIRST — MARKETPOS

> **Tanggal dokumen:** 9 November 2026
> **Status dokumen:** DRAFT — hasil diskusi, **belum ada kode yang diubah**
> **Terkait:** `RENCANA_PERBAIKAN_PRODUKSI_2026-10-31.md` (item P0-01, P0-02, P0-06, P1-02, P1-07) dan `ROADMAP_UPDATE_DAN_ATURAN_RILIS_AMAN.md` (Golden Rules)
> **Prinsip:** Zero Downtime & Zero Data Loss untuk 1 klien aktif. Perubahan database **add-only**, fungsi server lama **tidak diubah**, APK lama tetap bisa bertransaksi.
> **Catatan Expo:** sebelum menulis kode, baca docs Expo versi yang berlaku di `TokoKelontong/AGENTS.md` (v57). Proyek saat ini memakai Expo 54.

---

## 1. Tujuan

Aplikasi kasir harus **tidak wajib internet**:

1. Kasir bisa membuka app dan berjualan **tanpa internet**, termasuk setelah app di-kill atau HP di-restart.
2. Saat internet ada, app tetap berjalan normal.
3. Saat internet putus, transaksi **tersimpan di HP**.
4. Saat internet kembali, data **terkirim otomatis** ke database, dengan indikator progres.
5. Stok memakai **stok terakhir di HP**. Barang tetap bisa dijual walau stok sistem 0 atau minus, dan **angka minus ditampilkan apa adanya**.

---

## 2. Keputusan yang Sudah Disepakati

| No | Keputusan | Hasil |
|---|---|---|
| K-01 | Jalur tulis checkout | **Local-first.** Selalu simpan ke SQLite HP dulu, lalu kirim di latar belakang. Tidak ada lagi jalur "coba server, gagal baru antre". |
| K-02 | Penyimpanan | **SQLite** (`expo-sqlite` sudah ada di dependencies) untuk katalog dan outbox transaksi. |
| K-03 | Stok saat jual | Memakai stok lokal terakhir. **Stok minus diizinkan, selalu** (online maupun offline), tanpa konfirmasi tambahan. Angka minus **ditampilkan** (contoh `-3`). |
| K-04 | Login pertama | Butuh internet sekali. Setelahnya app jalan penuh offline, termasuk cold start. |
| K-05 | Status login offline | Tetap masuk bila ada sesi tersimpan di HP, walau token kedaluwarsa dan HP offline. Hanya **logout eksplisit** atau penolakan dari server yang mengeluarkan user. |
| K-06 | Indikator sync | **Banner non-blocking** ("Mengirim 3/10 transaksi…"). Kasir tetap bisa melayani pelanggan. |
| K-07 | Logout | Bila ada transaksi belum terkirim, **tampilkan peringatan** (atau blokir). Outbox tidak dihapus saat logout. |
| K-08 | Konflik stok saat sync | Server **menerima** transaksi dan stok boleh minus. Tidak ada penolakan `insufficient_stock` untuk jalur baru. |

### 2.1 Asumsi default (belum dikonfirmasi, bisa diubah)

| No | Asumsi | Catatan |
|---|---|---|
| A-01 | **Cakupan offline tahap 1:** penjualan, hold bill, struk, dan laporan gabungan. | Edit produk dan kasbon baru online-only dulu (lihat Bagian 8). |
| A-02 | **Nomor nota** memakai nomor lokal per HP dengan kode perangkat, misalnya `INV/20261109/A7-0001`. Nomor ini yang dicetak dan disimpan di server. | Satu transaksi punya satu nomor. |
| A-03 | **Lebih dari satu HP kasir** dianggap mungkin. | Karena itu kode perangkat dipakai di nomor nota. |
| A-04 | Tahap 1 **tidak menambah paket native baru** (mis. NetInfo). Deteksi online memakai percobaan kirim + timer + AppState. | Supaya mungkin dikirim lewat OTA. Harus diverifikasi (Bagian 11, R-09). |

---

## 3. Kondisi Saat Ini (Hasil Audit Kode)

| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| 1 | Semua baca produk, laporan, dan kasbon langsung ke Supabase, tanpa cache. | `productRepository.js:47-105`, `transactionRepository.js` | Offline = katalog kosong, tidak bisa mulai jualan. |
| 2 | Antrean berupa **satu array JSON** di satu key AsyncStorage dengan pola baca → push → tulis. | `offlineQueue.js:41-69` | Dua enqueue berdekatan bisa saling menimpa. |
| 3 | Sync hanya lewat tombol manual. Tidak ada NetInfo dan tidak ada auto-retry. | `transactionRepository.js:209`, `HomeScreen`, `KasirScreen`, `PengaturanScreen` | Transaksi bisa mengendap berhari-hari. |
| 4 | Tidak ada `client_tx_id`. `isNetworkError` menganggap `timeout` sebagai offline. | `transactionRepository.js:46-57, 183-200` | Server sudah commit tapi respons putus → transaksi dobel saat sync. |
| 5 | RPC `checkout` tidak menerima waktu transaksi. `created_at` dan `date_key` nota memakai `now()` server. | `migration_v7...sql:125-163` | Transaksi offline yang di-sync besoknya tercatat di tanggal sync, sehingga **laporan harian salah**. |
| 6 | Sync gagal `insufficient_stock` → item tetap di antrean tanpa status, dicoba terus. | `transactionRepository.js:219-257` | Item macet tanpa ada yang tahu. |
| 7 | Satu transaksi punya dua nomor: `OFF-...` di struk dan `INV/...` di server. | `offlineQueue.js:8-15` | Nota pelanggan sulit dilacak. |
| 8 | Kasir **menolak** jual saat stok ≤ 0 dan saat qty ≥ stok. | `KasirScreen.js:206-218, 771-787` | Bertentangan dengan keputusan K-03. |
| 9 | Saat cold start offline dengan token kedaluwarsa, `getSession()` mengembalikan `session: null` (berdasarkan source `auth-js` terbaru). `AppNavigator` lalu menampilkan layar Login yang butuh internet. | `AuthContext.js:36-41`, `AppNavigator.js:51-57` | Kasir tidak bisa masuk saat offline. **Perlu diuji** pada versi terpasang (2.112.3). |
| 10 | `getSession()` tanpa timeout. Di sinyal "ada tapi tidak jalan", `ready` tidak kunjung `true` dan app menampilkan layar kosong. | `AuthContext.js`, `AppNavigator.js:45-47` | App tampak hang saat startup. |
| 11 | `clearStoreLocalSession()` menghapus `StoreProfile`, `HeldOrders`, dll. saat sesi null. | `authService.js:15-29`, `AuthContext.js:43-51` | Data lokal bisa hilang saat logout. |
| 12 | Setelah checkout, nota dicari ulang lewat query tanggal. | `KasirScreen.js` (post-checkout) | Bug nota hilang dekat tengah malam (diagnosa 2.8). Local-first menghapus masalah ini. |

---

## 4. Arsitektur yang Dituju

### 4.1 Alur checkout (local-first)

```
Kasir tekan "Bayar"
  └─ [SQLite, satu transaksi atomik]
       ├─ buat client_tx_id (UUID) dan nomor nota lokal berurutan
       ├─ simpan outbox_transactions + outbox_items (status = pending)
       └─ naikkan penghitung nomor nota harian perangkat
  └─ tampilkan struk / cetak (tanpa menunggu internet)
  └─ [latar belakang] picu sync
        ├─ ada internet + token valid → kirim ke server
        │      ├─ sukses → tandai synced, refresh katalog dari server
        │      └─ gagal jaringan → tetap pending, coba lagi (backoff)
        └─ tidak ada internet → tetap pending
```

Saat online, kasir hampir tidak merasakan perbedaan: transaksi terkirim dalam hitungan detik di belakang layar.

### 4.2 Stok efektif (hindari pengurangan ganda)

Cache katalog menyimpan **stok snapshot dari server**. Stok yang ditampilkan dihitung:

```
stok_efektif = stok_snapshot_server − jumlah qty pada outbox yang belum synced
```

- Tidak perlu mengubah angka stok di tabel katalog saat checkout.
- Setelah refresh katalog dari server, tidak ada risiko stok berkurang dua kali.
- Hasil bisa minus dan ditampilkan apa adanya.

### 4.3 Strategi baca

| Layar | Strategi |
|---|---|
| Kasir (katalog) | **Cache-first**, refresh di latar belakang (saat fokus, setelah sync, dan interval). |
| Gudang | Network-first dengan timeout pendek, fallback ke cache (read-only saat offline). |
| Laporan, Home, Dashboard | Server + transaksi outbox (gabungan). Saat offline, tampil dari data lokal. |

Refresh katalog **harus berhalaman** (`.range()`), karena batas default PostgREST 1.000 baris.

---

## 5. Skema SQLite Lokal (Usulan)

> Semua tabel memiliki `store_id` supaya data toko berbeda tidak tercampur di satu HP.

```sql
-- Katalog produk (cache dari server)
products_cache (
  store_id text not null,
  id text not null,
  barcode text, product_name text,
  selling_price integer, capital_price integer,
  stock_snapshot integer,            -- stok terakhir dari server
  min_stock_threshold integer, unit text, category text,
  image_uri text, wholesale_rules text,   -- JSON
  server_updated_at text, cached_at text,
  primary key (store_id, id)
);

-- Transaksi menunggu / sudah terkirim
outbox_transactions (
  client_tx_id text primary key,     -- UUID atau 'legacy-<id lama>'
  store_id text not null,
  invoice_number text not null,      -- nomor nota lokal (dicetak di struk)
  created_at_client text not null,   -- ISO, waktu transaksi sebenarnya
  total_price integer, discount_amount integer, grand_total integer,
  cash_received integer, cash_return integer,
  payment_method text, payment_notes text,
  order_type text, table_number text,
  status text not null,              -- pending | syncing | synced | needs_review
  attempts integer default 0,
  last_error text, last_attempt_at text,
  server_tx_id text, synced_at text
);

outbox_items (
  id integer primary key autoincrement,
  client_tx_id text not null references outbox_transactions(client_tx_id),
  product_id text, product_name text, unit text,
  quantity integer, price_at_sale integer, capital_at_sale integer
);

-- Penghitung nomor nota per perangkat per hari
invoice_seq ( date_key text primary key, last_seq integer );

-- Metadata sederhana
meta ( key text primary key, value text );  -- device_code, last_catalog_sync, dll.
```

- Transaksi `synced` disimpan **14 hari** (usulan) untuk riwayat dan laporan offline, lalu dibersihkan.
- Semua penulisan checkout dibungkus **satu transaksi SQLite** supaya atomik.

---

## 6. Perubahan Server (Supabase) — Add-Only

### 6.1 Prinsip
- **Jangan mengubah `public.checkout(...)` yang sudah ada.** Tambah fungsi **baru** (usulan nama: `checkout_v2`) supaya tidak menimbulkan ambiguitas overload. Repo sudah punya `supabase/HOTFIX_FIX_CHECKOUT_AMBIGUITY.sql`, dan migrasi v7 sebelumnya memakai `DROP FUNCTION ... checkout`. Pola itu tidak boleh diulang.
- Semua kolom baru punya `DEFAULT`.
- Uji dulu di project Supabase dummy.

### 6.2 Migrasi `migration_v8_offline_first.sql` (arah, bukan script final)

```sql
-- Idempotensi transaksi
alter table public.transactions
  add column if not exists client_tx_id text,
  add column if not exists client_created_at timestamptz;

create unique index if not exists transactions_client_tx_uniq
  on public.transactions (store_id, client_tx_id)
  where client_tx_id is not null;
```

### 6.3 Fungsi baru `checkout_v2` (perilaku)

| Aspek | Perilaku |
|---|---|
| Parameter | `p_client_tx_id`, `p_client_created_at`, `p_invoice_number`, `p_items`, total, pembayaran, `p_order_type`, `p_table_number` |
| Idempotensi | Jika `(store_id, client_tx_id)` sudah ada → kembalikan transaksi lama, **tanpa** mengurangi stok lagi. |
| Stok | **Tidak ada** cek `insufficient_stock`. Stok dikurangi dan boleh minus. |
| Waktu | `created_at` = `least(p_client_created_at, now())` (tolak waktu masa depan). `date_key` nota memakai waktu ini, zona `Asia/Jakarta`. |
| Nomor nota | Pakai `p_invoice_number` bila ada. Bila kosong, generate seperti fungsi lama. |
| Produk tidak ada (sudah dihapus) | **Perlu cek skema:** bila `transaction_details.product_id` nullable, simpan detail tanpa mengurangi stok. Bila tidak, tandai `needs_review`. |
| Validasi | Tolak `grand_total <= 0` (selaras P1-03) dan `quantity <= 0`. |
| Hasil | `{ id, invoice_number, already_synced }` |

### 6.4 Kompatibilitas
- APK lama tetap memanggil `checkout` lama dan tidak terpengaruh.
- APK baru memanggil `checkout_v2`. Bila fungsi belum ada (`PGRST202` / `42883`), transaksi **tetap pending** dan tidak ditandai gagal. Urutan rilis: **SQL dulu, baru APK/OTA** (Bagian 12).

---

## 7. Auth dan Sesi Saat Offline

| Hal | Rencana |
|---|---|
| Snapshot login | Simpan `@TokoKelontong:AuthSnapshot` = `{ user_id, username, store_id, store_name, saved_at }` setiap login/profil berhasil dimuat. Hapus hanya saat logout eksplisit. |
| Startup | Bungkus `getSession()` dengan **timeout 3–5 detik**. Bila hasilnya `session: null` dengan `error` bertipe retryable (`AuthRetryableFetchError`) atau timeout, dan snapshot ada → masuk **mode login offline**. Bila `session: null` tanpa error → benar-benar logout. |
| Mode login offline | Flag `offlineAuthed` di `AuthContext`. `AppNavigator` menampilkan Home/Kasir. **Tidak** membuat sesi palsu untuk client Supabase. |
| Pemulihan | Saat internet kembali, auto-refresh/`refreshSession()` memulihkan sesi. `TOKEN_REFRESHED`/`SIGNED_IN` mengembalikan mode normal. |
| `store_id` | Diambil dari snapshot saat offline. Repository tidak boleh memanggil `rpc('current_store_id')` di jalur offline. |
| Sesi dicabut server (password diganti, dll.) | Setelah online, refresh ditolak → `SIGNED_OUT` → layar login. **Outbox tidak dihapus.** Setelah login ulang dengan toko yang sama, sync lanjut. Bila login dengan toko lain, outbox lama **tidak dikirim** dan user diberi peringatan. |
| Logout | Bila ada transaksi pending → dialog peringatan. Saat offline pakai `signOut({ scope: 'local' })` sebagai cadangan, karena scope global gagal saat offline. |
| `clearStoreLocalSession` | **Tidak boleh** menghapus outbox, katalog, dan `StoreProfile` (selaras P0-06). Hapus hanya lewat aksi eksplisit "Reset Data Lokal". |

Catatan: mengganti password mencabut sesi di perangkat lain, tetapi **baru terasa saat token berikutnya diperbarui** (paling lama sekitar 1 jam saat online). HP offline tetap bisa dipakai sampai online lagi.

---

## 8. Cakupan Fitur Offline

| Fitur | Tahap 1 | Catatan |
|---|---|---|
| Kasir: scan/cari produk, keranjang | ✅ | Dari cache katalog. |
| Checkout tunai / QRIS / Transfer / Debit | ✅ | Lewat outbox. |
| Checkout **Kasbon** | ⛔ Dinonaktifkan saat offline | Menghindari data kasbon "menggantung". Masuk Tahap 2 (outbox menyimpan data kasbon, dibuat setelah transaksi tersinkron). **Perlu konfirmasi (D-01).** |
| Mode F&B, struk dapur | ✅ | Data sudah di outbox. |
| Hold bill | ✅ | Sudah lokal. |
| Cetak struk Bluetooth / WA / PDF | ✅ | Dibangun dari data lokal, bukan query ulang. |
| Laporan, Home, Dashboard | ✅ gabungan | Server + outbox, dengan badge "termasuk N transaksi belum terkirim". |
| Gudang (lihat stok) | ✅ read-only | Banner "data offline, terakhir diperbarui …". |
| Tambah / edit / hapus produk, ubah stok | ❌ online-only | Tombol menampilkan pesan "butuh internet". |
| Buku Kasbon (lihat / bayar cicilan) | ❌ online-only | Tahap 2. |
| Login pertama, daftar akun, lupa password | ❌ online-only | |

---

## 9. Perubahan UI yang Diperlukan

| Area | Perubahan |
|---|---|
| Kartu produk Kasir (`KasirScreen.js:771-787`) | Hapus `disabled` dan opacity redup untuk stok ≤ 0. Tampilkan `Stok: -3` (merah) bila minus. |
| `addToCart` (`KasirScreen.js:205-218`) | Hapus penolakan "Stok Habis" dan "Stok Tidak Cukup". |
| `ProductCard.js`, `GudangScreen.js` | Tampilkan angka stok sebenarnya (termasuk minus), bukan hanya label "Habis". Hitung "habis" sebagai stok ≤ 0. |
| `DashboardScreen.js:617-630` | Ganti label tetap `Habis (0)` dengan nilai sebenarnya. |
| Banner status | Online/offline, jumlah transaksi belum terkirim, dan progres "Mengirim n/N…" di Home dan Kasir. |
| Layar "Transaksi Belum Terkirim" | Daftar transaksi `pending`/`needs_review` beserta alasan dan tombol "Kirim sekarang". |
| Indikator katalog | "Data offline, terakhir diperbarui <waktu>" bila cache dipakai tanpa refresh. |
| Dialog logout | Peringatan bila ada transaksi pending. |
| `PanduanScreen.js` | Perbarui klaim "100% Pure Offline" (selaras P1-18). |

---

## 10. Mesin Sinkronisasi

| Aspek | Rencana |
|---|---|
| Pemicu | App dibuka, app kembali ke foreground (`AppState`), setelah setiap checkout, timer 30–60 detik selama ada pending, dan tombol manual. |
| Deteksi online | Tahap 1: **percobaan kirim itu sendiri** sebagai uji koneksi, dengan timeout eksplisit 10–15 detik (`AbortController`). Tanpa paket native baru. NetInfo menjadi opsi Tahap 2. |
| Konkurensi | Satu sync berjalan sekaligus (mutex). |
| Urutan | Transaksi paling lama dikirim lebih dulu. |
| Token | Sebelum sync pastikan token valid (`getSession`/`refreshSession`). Gagal retryable → tetap pending. Ditolak server → minta login, outbox aman. |
| Klasifikasi error | **Retryable** (jaringan, timeout, 5xx, fungsi belum ada): tetap `pending`, `attempts++`, backoff 5 dtk → 15 dtk → 1 mnt → 5 mnt (maks). **Non-retryable** (data tidak valid, produk tidak ada tanpa fallback): `needs_review` dengan `last_error`. |
| Idempotensi | `client_tx_id` dikirim setiap percobaan. Respons "sudah ada" dianggap sukses. |
| Setelah sukses | Tandai `synced`, simpan `server_tx_id`, lalu refresh katalog (stok server menjadi acuan baru). |
| Sinkron nomor nota | Nomor lokal dikirim sebagai `p_invoice_number`, sehingga struk dan laporan memakai nomor yang sama. |
| Tampilan progres | Banner non-blocking: "Mengirim 3/10…", lalu "Semua transaksi terkirim". |

### 10.1 Nomor nota

Format: `INV/<YYYYMMDD>/<KODE_PERANGKAT>-<URUTAN4>`, contoh `INV/20261109/A7-0001`.

- `KODE_PERANGKAT`: 2 karakter acak, dibuat sekali saat instalasi dan disimpan di `meta`.
- Urutan: dari `invoice_seq` per hari (zona WIB), naik di dalam transaksi SQLite yang sama dengan penyimpanan checkout.
- Nomor lama `INV/20261109/0001` (server) tetap tampil apa adanya di riwayat. Format campuran tidak masalah karena hanya string.

---

## 11. Risiko dan Mitigasi

| ID | Risiko | Mitigasi |
|---|---|---|
| R-01 | Data lokal yang belum terkirim **hilang** bila HP rusak, di-factory reset, uninstall, atau "Clear Data". | Banner "N transaksi belum terkirim" selalu terlihat. Peringatan saat logout. Dokumentasikan untuk klien. Pertimbangkan ekspor outbox ke file (P2-01). |
| R-02 | Sinyal jelek (ada tapi tidak jalan) membuat request menggantung. | Timeout eksplisit, backoff, mutex, `client_tx_id`. |
| R-03 | Sesi pulih gagal karena respons refresh token hilang di jaringan buruk. | Uji lapangan. Dokumentasi Supabase mencatat ini bisa mengakhiri sesi mendadak. Outbox tetap aman dan login ulang tidak menghapusnya. |
| R-04 | Migrasi antrean lama (`@TokoKelontong:OfflineQueue`) gagal atau dobel. | Migrasi sekali dengan flag. `client_tx_id = 'legacy-' + id lama` sehingga idempotent. **Key lama tidak dihapus** di rilis ini. |
| R-05 | Jam HP salah → `client_created_at` salah. | Server memakai `least(client, now())`. Pertimbangkan peringatan bila selisih jam besar. |
| R-06 | Produk dihapus di server saat transaksi offline belum terkirim. | Lihat 6.3 (perlu cek skema). Fallback `needs_review`. |
| R-07 | Stok minus tidak disadari pemilik. | Tampilkan merah di kartu, Gudang, dan Dashboard. Opname absolut (P1-06) untuk koreksi. |
| R-08 | Dua HP offline menjual barang terakhir bersamaan. | Diterima sesuai K-03/K-08, dan stok menjadi minus. |
| R-09 | Rilis lewat OTA tidak cocok dengan build native klien. | Verifikasi dulu bahwa `expo-sqlite` sudah ada di APK klien (ada di `package.json` dan plugin `app.json`) dan `runtimeVersion` cocok. Jika belum, wajib APK baru. |
| R-10 | Perilaku `getSession` offline pada versi terpasang (2.112.3) berbeda dari source terbaru. | Uji nyata di HP (QA T-O-04) sebelum mengandalkan rancangan Bagian 7. |

---

## 12. Urutan Pengerjaan dan Dashboard Progres

Status: ⬜ Belum · 🟨 Sedang · ✅ Selesai (lulus DoD + QA) · ⛔ Ditunda · 🔁 Revisi

| ID | Item | Status | Estimasi | Depends on | Catatan |
|---|---|---|---|---|---|
| OF-00 | Verifikasi: skema FK `transaction_details`, build native klien (expo-sqlite, runtimeVersion), perilaku `getSession` offline di HP | ✅ | 0,5–1 hari | — | FK verified; getSession audited; build native APK klien (D:\tkb\app-release.apk) diverifikasi sudah memuat libexpo-sqlite.so untuk semua arch dan runtimeVersion 1.0.0 cocok (Jalur A berlaku). |
| OF-01 | Modul SQLite: skema, inisialisasi, versi skema, helper transaksi | 🟨 | 1 hari | OF-00 | Kode selesai: localDb.js. Belum diuji di HP. |
| OF-02 | Migrasi antrean lama AsyncStorage → SQLite | 🟨 | 0,5 hari | OF-01 | Kode selesai (importLegacyQueue). Antrean lama hanya dihapus setelah sukses terkirim. Belum diuji. |
| OF-03 | Migrasi server v8 + `checkout_v2` (uji di Supabase dummy) | 🟨 | 1–1,5 hari | OF-00 | File supabase/migration_v8_offline_first.sql sudah dijalankan pemilik. checkout_v2 terdeteksi di server (probe tanpa login ditolak not_registered, tidak menulis data). Uji idempotensi dengan login asli belum dilakukan. |
| OF-04 | Katalog cache: refresh berhalaman, baca cache-first, stok efektif | 🟨 | 1–1,5 hari | OF-01 | Kode selesai: katalog cache, stok efektif, paginasi. Belum diuji. |
| OF-05 | Checkout local-first + nomor nota lokal + struk dari data lokal | 🟨 | 1–1,5 hari | OF-01, OF-04 | Kode selesai: checkout local-first, nota lokal, penolakan stok dihapus. Belum diuji. |
| OF-06 | Mesin sync: mutex, backoff, klasifikasi error, idempotensi, auto-trigger | 🟨 | 1,5–2 hari | OF-03, OF-05 | Kode selesai: syncService.js. Belum diuji di HP. |
| OF-07 | Auth offline: snapshot login, timeout startup, mode offline, logout aman | 🟨 | 1–1,5 hari | OF-00 | Kode selesai: snapshot sesi, timeout startup, logout offline, PIN offline. Belum diuji. |
| OF-08 | UI: banner status/progres, layar transaksi belum terkirim, tampilan stok minus | 🟨 | 1–1,5 hari | OF-05, OF-06 | Kode selesai: banner Kasir/Home, layar TransaksiPending (daftar belum terkirim + terkirim 20 terakhir), stok minus. Belum diuji. |
| OF-09 | Laporan/Home/Dashboard gabungan server + outbox (dedupe `client_tx_id`) | 🟨 | 1–1,5 hari | OF-05, OF-03 | Kode selesai: laporan, ringkasan Home/Dashboard, dan ekspor CSV menggabungkan transaksi pending (tanpa badge). Saat offline memakai data lokal. Belum diuji. |
| OF-10 | Pembatasan fitur offline (Gudang read-only, kasbon online-only) + pesan | 🟨 | 0,5 hari | OF-07 | Kode selesai: kasbon online-only; Gudang read-only dengan banner offline + pencegahan tambah/ubah/hapus saat offline. Belum diuji. |
| OF-11 | Perbarui Panduan/Onboarding (klaim offline) | 🟨 | 0,25 hari | OF-08 | Teks Pure Offline dihapus, ditambah bagian Berjualan Tanpa Internet di Panduan. Onboarding belum dicek. |
| OF-12 | QA lapangan + dokumentasi rilis dan rollback | 🟨 | 1–2 hari | semua | Dokumen panduan QA, rilis, dan rollback sudah dibuat: PANDUAN_QA_DAN_RILIS_OFFLINE_FIRST.md. Pengujian di HP belum dilakukan. |

Estimasi total kasar (1 developer): **± 10–14 hari kerja**. Ini perkiraan, bukan komitmen.

### 12.1 Milestone

1. **M1 — Fondasi** (OF-00 s/d OF-03): SQLite, migrasi antrean lama, server v8 siap dan teruji di dummy.
2. **M2 — Jual tanpa internet** (OF-04, OF-05, OF-07): cold start offline, katalog cache, checkout local-first.
3. **M3 — Kirim otomatis** (OF-06, OF-08): sync stabil dengan banner progres.
4. **M4 — Laporan dan penyelesaian** (OF-09 s/d OF-12).

### 12.2 Urutan rilis ke klien aktif
1. Backup database Supabase, lalu jalankan migrasi v8 di production (add-only, jam sepi).
2. Pastikan APK lama tetap bisa checkout.
3. Kirim APK/OTA baru (sesuai hasil OF-00).
4. Pantau antrean dan error selama 24–48 jam.
5. Simpan APK versi sebelumnya untuk rollback. Jangan menjalankan `eas update --branch production` sebelum checklist QA lulus.

---

## 13. Rencana Pengujian

| No | Skenario | Ekspektasi | Status |
|---|---|---|---|
| T-O-01 | Mode pesawat + force stop → buka app → Kasir | Katalog dari cache muncul, bisa scan dan cari. | ⬜ |
| T-O-02 | Checkout offline lalu restart app | Transaksi ada di outbox, stok efektif berkurang, struk tercetak dengan nomor lokal. | ⬜ |
| T-O-03 | Online kembali | Banner progres, semua terkirim, tidak dobel, stok server dan lokal cocok. | ⬜ |
| T-O-04 | Token kedaluwarsa + offline + force stop (uji pada project dummy dengan JWT pendek) | App masuk Kasir (mode login offline), bukan layar login. | ⬜ |
| T-O-05 | Putus koneksi tepat setelah server commit (respons hilang) | Sync berikutnya tidak membuat transaksi kedua. | ⬜ |
| T-O-06 | Sync diulang 3× pada data sama | Tetap 1 transaksi di server. | ⬜ |
| T-O-07 | Jual saat stok 0 | Boleh, stok tampil `-n` merah di Kasir, Gudang, Dashboard. | ⬜ |
| T-O-08 | Transaksi offline Senin di-sync Selasa | Laporan Senin memuat transaksi itu (`created_at` benar). | ⬜ |
| T-O-09 | Dua HP offline jual barang terakhir | Keduanya masuk, stok server minus, tidak ada transaksi hilang. | ⬜ |
| T-O-10 | Logout dengan transaksi pending (online dan offline) | Ada peringatan. Outbox tetap ada setelah logout. | ⬜ |
| T-O-11 | Password diganti dari perangkat lain, HP A offline | HP A tetap bisa jual. Setelah online, diarahkan login, outbox masih ada, sync lanjut setelah login ulang. | ⬜ |
| T-O-12 | Login toko lain di HP yang punya outbox toko pertama | Outbox lama tidak terkirim ke toko baru, ada peringatan. | ⬜ |
| T-O-13 | Antrean lama AsyncStorage (data klien) | Terpindah ke SQLite, terkirim tanpa dobel, tidak ada yang hilang. | ⬜ |
| T-O-14 | Laporan gabungan | Omzet termasuk transaksi pending (badge belum ada, hanya status di layar Transaksi Belum Terkirim). Tidak dobel setelah sync. | ⬜ |
| T-O-15 | 2.000+ produk | Refresh katalog berhalaman, tidak terpotong 1.000. | ⬜ |
| T-O-16 | Sinyal jelek (ada tapi lambat) | Tidak ada layar kosong lama. Timeout dan backoff berjalan. | ⬜ |
| T-O-17 | APK lama tetap `checkout` setelah migrasi v8 | Berhasil (kompatibilitas mundur). | ⬜ |
| T-O-18 | Cetak Bluetooth saat offline | Struk dan struk dapur tetap tercetak. | ⬜ |
| T-O-19 | Hari berganti saat offline (lewat tengah malam WIB) | Nomor nota urut baru per hari, tanpa bentrok. | ⬜ |

**Data uji:** akun dummy terpisah dari klien, project Supabase dummy, minimal 2 HP Android, printer Bluetooth fisik.

---

## 14. Keputusan yang Masih Terbuka

| No | Pertanyaan | Rekomendasi |
|---|---|---|
| D-01 | Kasbon saat offline: nonaktifkan di Tahap 1 atau langsung didukung lewat outbox? | Nonaktifkan dulu. Tambah di Tahap 2. |
| D-02 | Konfirmasi format nomor nota lokal `INV/YYYYMMDD/KODE-0001`. | Setuju bila format berubah sedikit bisa diterima klien. |
| D-03 | Paket native (NetInfo/`expo-network`) boleh ditambah? Perlu APK baru. | Tidak di Tahap 1. |
| D-04 | Lama penyimpanan transaksi `synced` di HP. | 14 hari. |
| D-05 | Perlu batas maksimal hari offline atau tidak? | Tidak perlu untuk toko satu pemilik. PIN tetap melindungi menu sensitif. |
| D-06 | Produk yang dihapus saat ada transaksi offline: simpan detail tanpa produk atau `needs_review`? | Tentukan setelah OF-00 (cek FK). |
| D-07 | Cache gambar produk untuk offline. | Tahap 2 (di luar cakupan sekarang). |

---

## 15. File yang Kemungkinan Disentuh

- Baru: `TokoKelontong/src/database/localDb.js`, `TokoKelontong/src/services/syncService.js`, `TokoKelontong/src/database/localCatalog.js`, `supabase/migration_v8_offline_first.sql`
- Diubah: `src/database/transactionRepository.js`, `src/database/productRepository.js`, `src/utils/offlineQueue.js` (hanya untuk migrasi), `src/context/AuthContext.js`, `src/services/authService.js`, `src/navigation/AppNavigator.js`, `src/screens/KasirScreen.js`, `HomeScreen.js`, `LaporanScreen.js`, `DashboardScreen.js`, `GudangScreen.js`, `PengaturanScreen.js`, `PanduanScreen.js`, `src/components/ProductCard.js`, `src/utils/receiptGenerator.js`

---

## 16. Di Luar Cakupan Dokumen Ini

- Edit produk, kasbon, dan pembayaran cicilan secara offline (Tahap 2).
- Cache gambar produk.
- Void/refund, shift kasir, dan kartu stok (item P1 pada rencana produksi).
- Role owner/kasir dan audit log (P2-02).
- Backup/restore penuh ke file (P2-01).
- Upgrade Expo 54 → 57 (P2-10).

---

## 17. Log Progres

| Tanggal | ID | Status | Catatan | Oleh |
|---|---|---|---|---|
| 2026-11-09 | — | 📄 | Dokumen rencana dibuat dari hasil diskusi. Belum ada kode yang diubah. | Diskusi |
| 2026-11-10 | OF-00..08, 10 | 🟨 | Kode ditulis dan lolos cek sintaks Babel. Belum diuji di HP dan SQL belum dijalankan di Supabase dummy. OF-09, OF-11, OF-12 belum dikerjakan. | Agent |
| 2026-11-10 | OF-03, 08, 09, 10, 11 | 🟨 | Migrasi v8 dijalankan pemilik dan checkout_v2 terdeteksi. Ditambah: layar Transaksi Belum Terkirim, laporan gabungan, pesan butuh internet di Gudang, teks Panduan. Stok edit di form barang tidak lagi dipaksa >= 0. Belum diuji di HP. | Agent |
| 2026-11-10 | OF-12 | 🟨 | Dibuat PANDUAN_QA_DAN_RILIS_OFFLINE_FIRST.md (gerbang rilis, cek native expo-sqlite, skenario uji, query server, urutan rilis, rollback). QA di HP belum dijalankan. | Agent |
| 2026-11-10 | OF-00, 10 | 🟨 | OF-00 selesai: APK rilis D:\tkb\app-release.apk diverifikasi memuat modul native expo-sqlite di semua arch dan runtimeVersion 1.0.0 cocok (Jalur A berlaku). GudangScreen dilengkapi banner offline status + pencegahan aksi mutasi saat offline. | Agent |
| 2026-11-10 | OF-02, 08, 09, 10, 11 | 🟨 | Penyelesaian menyeluruh: izin checkout_v2 diperketat (`revoke execute ... from public, anon`), paginasi >1000 baris + deduplikasi `client_tx_id` + ekspor CSV offline di `transactionRepository.js`, badge `Belum terkirim`/`Perlu ditinjau` + banner + auto-refresh di `LaporanScreen.js`, deteksi fallback cache + `readOnly` tombol/FAB + sinkron katalog pasca-ubah/hapus di Gudang & form produk (termasuk simpan stok minus saat edit), status antrean/offline live di `PengaturanScreen.js`, dan perbaikan teks di `PanduanScreen.js`, `AuthScreen.js`, `securityPin.js`. Siap QA perangkat (G-3..G-7). | Agent |

**Cara update log:** setelah satu item selesai dan lulus DoD + QA, ubah status di Bagian 12 dan tambahkan satu baris di sini (tanggal, ID, status, ringkasan, nama pengembang). Bila gagal QA, ubah ke 🔁 Revisi dan tulis penyebabnya.
