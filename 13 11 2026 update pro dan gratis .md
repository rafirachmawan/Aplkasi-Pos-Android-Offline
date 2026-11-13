# RENCANA UPDATE TIER — GRATIS & PRO (SAAS MANUAL)

> **Tanggal dokumen:** 13 November 2026
> **Status dokumen:** DRAFT — hasil diskusi, **belum ada kode yang diubah**
> **Terkait:** `09 november 2026 rencan offline .md` (mode offline-first), `ROADMAP_UPDATE_DAN_ATURAN_RILIS_AMAN.md` (Golden Rules), `admin-api/docs/PLAN_OPSI_C.md` (aksi lisensi + audit log)
> **Prinsip:** Zero Downtime & Zero Data Loss. Perubahan database **add-only**, fungsi server lama **tidak diubah**, data yang sudah ada **tidak pernah dihapus atau dirusak**.
> **Catatan Expo:** sebelum menulis kode, baca docs Expo versi yang berlaku di `TokoKelontong/AGENTS.md` (v57). Proyek saat ini memakai Expo 54.

---

## 1. Tujuan

Aplikasi kasir dijual dengan model **SaaS manual**:

1. Akun toko dibagi dua tier: **GRATIS** dan **PRO**.
2. Tier **GRATIS** memiliki sebagian fitur terkunci; tier **PRO** membuka semua fitur.
3. Pembayaran dilakukan **manual via WhatsApp** ke pemilik project.
4. Setelah pembayaran diterima, pemilik **mengaktifkan akun menjadi PRO** dari dashboard admin.
5. Saat diaktifkan, sistem **otomatis menghitung mundur masa aktif** dan menampilkan **tanggal mulai** serta **tanggal berakhir**.
6. Setelah masa aktif habis, akun **otomatis turun kembali ke GRATIS**. Jualan dan data tetap berjalan normal.

---

## 2. Keputusan yang Sudah Disepakati

| No | Keputusan | Hasil |
|---|---|---|
| K-01 | Jumlah tier | Dua: **Gratis** dan **Pro**. |
| K-02 | Titik paksa (enforcement) | **Lokal di HP + cek server saat online.** Plan dan tanggal berakhir disimpan di HP sehingga berfungsi penuh offline. |
| K-03 | Granulitas langganan | **Per toko.** Satu pembayaran berlaku untuk seluruh HP kasir dalam satu toko. |
| K-04 | Pro habis masa berlaku | **Turun ke Gratis.** Fitur Pro terkunci, data dan jualan tetap jalan normal. |
| K-05 | Trial 14 hari | **Dihapus.** Semua akun baru mulai dari tier Gratis. |
| K-06 | Klien lama (lifetime) | **Ikut model baru.** Berstatus Gratis, fitur Pro dikunci. |
| K-07 | Pembagian fitur | Pakai daftar di Bagian 4. |
| K-08 | Batasan kuantitatif di Gratis | **Tanpa batas jumlah produk.** Tidak ada batas kuantitatif lain. |
| K-09 | Harga & masa aktif | **Diisi manual** oleh pemilik di dashboard (bukan hardcode). |
| K-10 | Aktivasi | **Tombol "Aktifkan Pro"** di dashboard admin, dengan pilihan durasi. |
| K-11 | Data klien lama | **Tidak boleh rusak/hilang.** Kunci fitur hanya memblokir aksi baru, tidak pernah menghapus atau menyembunyikan data lama. |
| K-12 | Fitur Pro yang sudah dipakai klien lama | **Read-only** — masih bisa dilihat, tidak bisa ditambah. |
| K-13 | Menu admin | **`Lisensi & Perangkat` diganti menjadi `Langganan`** (status Gratis/Pro per toko). |

### 2.1 Asumsi default (rekomendasi, bisa diubah)

| No | Asumsi | Catatan |
|---|---|---|
| A-01 | **Masa tenggang klien lama:** langsung terkunci tanpa tenggang. | Alternatif: beri tenggang 1 bulan. **Perlu konfirmasi (D-01).** |
| A-02 | **Batas HP kasir di tier Gratis: 1 HP.** | Multi-HP hanya untuk Pro. **Perlu konfirmasi (D-02).** |
| A-03 | **Pro kedaluwarsa → terkunci langsung**, disertai banner "Pro berakhir pada …". | Alternatif: pengingat 7 hari dulu. **Perlu konfirmasi (D-03).** |
| A-04 | **Harga** diisi manual per aktivasi (belum ada angka tetap). | Bisa berubah kapan saja tanpa rilis. |
| A-05 | **Durasi default 30 hari**, pilihan 30/90/180/365 hari. | Mengikuti modal perpanjangan yang sudah ada di `admin-web`. |

---

## 3. Fitur: Gratis vs Pro

### 3.1 Tier GRATIS — "Cukup untuk jualan"

| Fitur | Catatan |
|---|---|
| Kasir: cari/scan produk, keranjang | Inti bisnis, **tidak pernah dikunci** |
| Checkout tunai / QRIS / Transfer / Debit | Lewat outbox offline-first |
| Stok & Gudang (lihat, tambah, edit produk) | |
| Hold bill | |
| Struk cetak Bluetooth / WA / PDF | |
| Mode offline penuh + sinkronisasi | Nilai jual utama, **tidak boleh dikunci** |
| Laporan harian **dasar** (omzet & jumlah transaksi hari ini) | |
| Pengaturan nota dasar | |
| 1 HP kasir (asumsi A-02) | |

### 3.2 Tier PRO — "Untuk toko yang serius"

| Fitur | Alasan layak bayar | Lokasi kode / migrasi |
|---|---|---|
| **Buku Kasbon** (utang piutang pelanggan) | Fitur paling bernilai | `BukuKasbonScreen.js`, `migration_v6` |
| **Shift kasir & kas keluar** | Kontrol kebocoran uang | `migration_v6` (`cashier_shifts`, `shift_expenses`) |
| **Laporan lanjutan**: per periode, per produk, per kategori, export CSV | Pemilik butuh untuk keputusan beli stok | `LaporanScreen.js` |
| **Dashboard analitik**: produk terlaris, jam ramai, tren | | `DashboardScreen.js` |
| **Mode F&B** (dine-in, nomor meja, struk dapur) | Segmen kafe/resto | `migration_v7` (`order_type`, `table_number`) |
| **Harga grosir / partai** | | `wholesale_rules` |
| **Multi-payment + PIN kasir** | | `migration_v5` |
| **Multi-perangkat** (2+ HP kasir sinkron) | Paling mudah dijual: bayar = tambah HP | |
| **Kustomisasi nota** (logo, footer, nama toko) | | `SettingNotaScreen.js` |

**Prinsip:** fitur yang membuat toko *tetap bisa jualan* tidak pernah dikunci. Yang dikunci adalah fitur *manajemen dan analisis*.

---

## 4. Kondisi Saat Ini (Hasil Audit Kode)

| # | Temuan | Lokasi | Dampak |
|---|---|---|---|
| 1 | Tabel lisensi unik di `device_id` (per HP), `store_id` sering NULL | `supabase/migration_v7_phase3_fnb_offline_license.sql:33` | Tidak cocok untuk langganan per toko (K-03) |
| 2 | `licenseService.js` memberi status `lifetime` otomatis ke klien pra-v7 | `TokoKelontong/src/services/licenseService.js:67-96` | Semua klien lama jadi Pro gratis selamanya (melanggar K-06) |
| 3 | Trial 14 hari masih aktif | `licenseService.js:121-142`, `TRIAL_DAYS = 14` | Melanggar K-05 |
| 4 | Aktivasi serial key menulis `license_type: "lifetime"` | `licenseService.js:189-215` | Jalur lama harus dinonaktifkan |
| 5 | Menu Lisensi & Perangkat hanya **baca**, aksi extend/revoke hanya jalan di mode mock | `admin-web/src/features/licenses/api.ts:53-57` | Belum ada aktivasi Pro yang nyata |
| 6 | `admin-api` hanya punya `GET /api/licenses` | `admin-api/src/routes/licenses.ts` | Belum ada endpoint ubah plan |
| 7 | Tidak ada mekanisme tier sama sekali di app | pencarian `isPro\|featureFlag\|tier` → 0 hasil | Belum ada yang bisa dikunci |
| 8 | Data plan tidak disimpan di HP | — | Enforcement offline (K-02) belum bisa jalan |

---

## 5. Arsitektur yang Dituju

### 5.1 Alur aktivasi

```
Toko bayar via WhatsApp
  → pemilik buka dashboard admin → Toko → "Aktifkan Pro (30 hari)"
  → store_subscriptions: plan=pro, mulai=13 Nov, berakhir=13 Des
       ↓
HP kasir (saat online: login, foreground, pasca-sync)
  → ambil plan dari server → simpan cache di HP
  → Pengaturan menampilkan: "Pro — aktif s/d 13 Des 2026 (sisa 30 hari)"
       ↓
13 Des 2026 lewat (bahkan saat HP offline)
  → usePlan() menghitung: expiresAt < now → GRATIS
  → fitur Pro terkunci otomatis, jualan tetap jalan
       ↓
Perpanjangan via WA → HP ambil lagi → Pro aktif kembali
```

### 5.2 Hitung tier efektif (offline-first)

```
tier_efektif =
    plan === 'pro' AND expires_at > now()  →  PRO
    selain itu                             →  GRATIS
```

- Hitung dilakukan **lokal di HP**, tidak butuh internet.
- Masa aktif berjalan terus tanpa server (hitung mundur lokal).
- Server hanya berfungsi sebagai **sumber kebenaran saat online**.
- **Tidak pernah** memblokir checkout, struk, atau sinkronisasi.

### 5.3 Sinkronisasi plan

| Pemicu | Aksi |
|---|---|
| Login berhasil | Baca `store_subscriptions` → tulis cache |
| App kembali ke foreground (`AppState`) | Baca bila sudah lewat interval (mis. 5 menit) |
| Setelah sync outbox berhasil | Baca ulang |
| Tombol manual di Pengaturan | Baca ulang |
| Gagal / offline | Pakai cache terakhir, **tidak dianggap error** |

---

## 6. Skema Database — `migration_v9_saas_tier.sql`

> Add-only. Tabel dan fungsi lama **tidak diubah dan tidak dihapus**.

```sql
-- Langganan per toko (tier Gratis / Pro)
create table if not exists public.store_subscriptions (
  store_id          uuid primary key references public.stores(id) on delete cascade,
  plan              text not null default 'free',   -- 'free' | 'pro'
  plan_started_at   timestamptz,                    -- tanggal mulai Pro (null saat gratis)
  plan_expires_at   timestamptz,                    -- tanggal berakhir Pro (null saat gratis)
  updated_at        timestamptz not null default now(),
  updated_by        text not null default ''        -- catatan siapa yang mengaktifkan
);

alter table public.store_subscriptions enable row level security;

-- App (toko login) hanya boleh MEMBACA plan miliknya sendiri
create policy "store_subscriptions_select_own"
  on public.store_subscriptions for select
  using (auth.role() = 'authenticated' and store_id = public.current_store_id());

-- TIDAK ADA policy insert/update untuk authenticated.
-- Perubahan plan hanya lewat service_role (admin-api).
```

### 6.1 Catatan penting

- Semua toko existing **otomatis `free`** karena default. **Tidak ada yang tiba-tiba dapat Pro.**
- Tabel `app_licenses` **tetap ada, tidak dihapus** — hanya dimatikan fungsinya sebagai pemberi hak. Menjaga jejak historis (add-only).
- Kolom `plan` tidak ditaruh di `stores` supaya perubahan plan tidak menyentuh tabel transaksi/katalog.
- RLS **tanpa policy update** untuk `authenticated` = klien tidak bisa menaikkan tier sendiri dari HP.

---

## 7. Perubahan Admin Dashboard (`admin-web` + `admin-api`)

### 7.1 Menu

| Sebelum | Sesudah |
|---|---|
| `Lisensi & Perangkat` | **`Langganan`** |

Halaman lama (`LicenseListPage`) **dihapus dari menu**. Tabel `app_licenses` di database tetap disimpan.

### 7.2 Tampilan halaman `Langganan`

```
TOKO                     PLAN      MULAI          BERAKHIR        SISA     AKSI
Shining Sun Ngunut       Pro       13 Nov 2026    13 Des 2026    30 hari   [Perpanjang] [Kembali Gratis]
Ertiga Store             Gratis     —              —              —        [Aktifkan Pro]
```

- Filter: `Semua plan` / `Gratis` / `Pro`
- Pencarian tetap per nama toko / username
- Badge warna: Pro (hijau), Gratis (abu)

### 7.3 Endpoint baru `admin-api`

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/api/subscriptions` | Daftar plan seluruh toko (gabung `stores` + `store_subscriptions`) |
| `POST` | `/api/stores/:id/plan` | Aktifkan/perpanjang Pro. Body: `{ days: 30\|90\|180\|365, note? }` |
| `DELETE` | `/api/stores/:id/plan` | Kembalikan ke Gratis |

**Aturan perpanjangan** (selaras `PLAN_OPSI_C.md` §6.3):

```
plan_started_at  = coalesce(greatest(now(), plan_expires_at), now())
plan_expires_at  = plan_started_at + p_days
plan             = 'pro'
```

- Bayar telat **tidak memotong** masa aktif (dihitung dari `greatest(now(), expires_at)`).
- `p_days` dibatasi 1–3650.
- Kembalikan ke Gratis: `plan='free'`, tanggal dikosongkan. **Data toko tidak disentuh.**
- Setiap aksi menulis **audit log** (nilai sebelum/sesudah, waktu, aktor).

### 7.4 Keamanan

- Semua endpoint memakai guard auth `admin-api` yang sudah ada (`middleware/auth.ts`).
- Mengubah plan **hanya bisa dari admin**, tidak ada jalur dari aplikasi kasir.
- `service_role` hanya dipakai di server, tidak pernah dibundel ke APK (aturan yang sudah ada di `admin-web/README.md`).

---

## 8. Perubahan Aplikasi Android (`TokoKelontong`)

### 8.1 Penyimpanan plan

```
AsyncStorage key: @TokoKelontong:StorePlan
Isi: { plan, startedAt, expiresAt, syncedAt }
```

- Dibersihkan **hanya** saat logout eksplisit (selaras P0-06 — jangan hapus bersamaan dengan data toko).

### 8.2 `usePlan()` hook

Mengembalikan:

```js
{
  tier: 'free' | 'pro',
  isActive: boolean,        // tier === 'pro'
  expiresAt: string | null,
  startedAt: string | null,
  daysRemaining: number,    // 0 bila gratis
  source: 'server' | 'cache',
  lastSyncedAt: string,
}
```

- Perhitungan **lokal**, tanpa jaringan.
- Tidak pernah melempar error saat offline.

### 8.3 Komponen `<ProLock>`

```jsx
<ProLock feature="kasbon">
  <BukuKasbonScreen />
</ProLock>
```

| Kondisi | Perilaku |
|---|---|
| `tier === 'pro'` | Render anaknya normal |
| `tier === 'free'` | Tampilkan panel kunci: judul fitur, ikon gembok, penjelasan singkat, tombol **"Upgrade via WhatsApp"** |

**Aturan keras:**

1. Kunci **tidak pernah** memblokir: Kasir, checkout, struk, hold bill, stok, sinkronisasi, laporan hari ini.
2. Kunci **tidak pernah** menghapus atau menyembunyikan data yang sudah ada.
3. Untuk fitur yang sudah berisi data (kasbon, shift), mode Gratis bersifat **read-only**: data lama **bisa dilihat**, aksi tambah/ubah yang baru dikunci.
4. Panel kunci selalu menyertakan **jalur kontak WhatsApp** ke pemilik.

### 8.4 Layar Pengaturan — status langganan

```
┌──────────────────────────────────────────┐
│  PAKET ANDA                              │
│  ● PRO                                   │
│  Berlaku s/d 13 Des 2026 (sisa 30 hari)  │
│  Terakhir disinkronkan: 13 Nov, 11:20    │
│  [ Perpanjang via WhatsApp ]             │
└──────────────────────────────────────────┘
```

Saat Gratis:

```
  PAKET ANDA
  ● GRATIS
  Fitur Pro terkunci. Jualan tetap berjalan normal.
  [ Upgrade ke Pro ]
```

Saat Pro mau habis (≤ 7 hari): badge kuning + hitung mundur.

### 8.5 Sumber fitur yang dikunci

| Fitur | File | Mode Gratis |
|---|---|---|
| Buku Kasbon | `screens/BukuKasbonScreen.js` | Read-only |
| Shift kasir / kas keluar | (via `HomeScreen`/`PengaturanScreen`) | Read-only |
| Laporan lanjutan + CSV | `screens/LaporanScreen.js` | Hanya laporan hari ini |
| Dashboard analitik | `screens/DashboardScreen.js` | Ringkasan dasar saja |
| Mode F&B | `screens/KasirScreen.js` | Hanya `retail` |
| Harga grosir | `screens/KasirScreen.js` | Harga satuan saja |
| Multi-payment + PIN | `screens/KasirScreen.js` | Pembayaran tunggal |
| Multi-perangkat | `navigation/AppNavigator.js` | 1 HP (asumsi A-02) |
| Kustomisasi nota | `screens/SettingNotaScreen.js` | Template bawaan |

### 8.6 Perubahan `licenseService.js`

| Aksi | Detail |
|---|---|
| Nonaktifkan `ensureLegacyClientProtected()` | Fungsi `licenseService.js:67-96` tidak lagi memberi `lifetime` |
| Hapus jalur trial | `TRIAL_DAYS` dan pembacaan `TRIAL_START_KEY` dihapus |
| Nonaktifkan `activateSerialKey()` | Jalur `license_type: "lifetime"` dimatikan |
| Ganti sumber status | `getLicenseInfo()` membaca dari `StorePlan` (Bagian 8.1) |

> **Penting:** penonaktifan ini hanya mengubah **pemberian hak**, bukan data. Data lama tetap utuh.

---

## 9. Urutan Rilis (Aman)

1. **Backup database** Supabase.
2. Jalankan `migration_v9_saas_tier.sql` di **project dummy** dulu, uji RLS.
3. Jalankan di **production** (add-only, jam sepi).
4. Semua toko otomatis `free` → **verifikasi tidak ada yang tiba-tiba Pro**.
5. Set manual toko yang berhak Pro gratis (bila ada, keputusan manual pemilik).
6. Rilis **admin-api + admin-web** → uji aktivasi.
7. Rilis **APK/OTA** baru → uji enforcement offline.
8. **Komunikasikan ke klien via WA** sebelum atau bersamaan dengan rilis (lihat D-01).
9. Pantau 24–48 jam. Simpan APK versi sebelumnya untuk rollback.

**Aturan:** SQL dulu, baru APK/OTA. Jangan menjalankan `eas update --branch production` sebelum checklist QA lulus.

---

## 10. Rencana Pengujian

| No | Skenario | Ekspektasi | Status |
|---|---|---|---|
| T-S-01 | Aktifkan Pro 30 hari dari dashboard | Tanggal mulai & berakhir terisi, sisa hari benar | ⬜ |
| T-S-02 | HP kasir online setelah aktivasi | Pengaturan menampilkan "Pro s/d … (sisa N hari)" | ⬜ |
| T-S-03 | Aktifkan Pro lalu HP masuk mode pesawat | Tier tetap Pro dari cache, fitur terbuka | ⬜ |
| T-S-04 | Ubah jam HP lewat tanggal berakhir (offline) | Tier jadi Gratis, fitur Pro terkunci, **jualan tetap jalan** | ⬜ |
| T-S-05 | Perpanjangan setelah kedaluwarsa | `greatest(now, expires)` → tidak memotong masa aktif | ⬜ |
| T-S-06 | Perpanjangan sebelum kedaluwarsa | Tanggal berakhir bertambah, tidak menimpa yang sudah jalan | ⬜ |
| T-S-07 | Kembalikan ke Gratis | Plan `free`, **data toko utuh** | ⬜ |
| T-S-08 | Toko Gratis buka Buku Kasbon berisi data | Data **bisa dilihat** (read-only), aksi tambah terkunci | ⬜ |
| T-S-09 | Toko Gratis checkout 10 transaksi | Berhasil, struk tercetak, offline tetap jalan | ⬜ |
| T-S-10 | Klien lama (sekarang Gratis) login | Tidak ada `lifetime`, semua data lama utuh | ⬜ |
| T-S-11 | HP mencoba UPDATE `store_subscriptions` sendiri | **Ditolak RLS** | ⬜ |
| T-S-12 | Dua HP dalam 1 toko Pro | Keduanya dapat Pro (per toko, bukan per HP) | ⬜ |
| T-S-13 | Trial 14 hari | **Tidak ada** — akun baru langsung Gratis | ⬜ |
| T-S-14 | Tombol "Upgrade via WhatsApp" | Membuka chat WA ke pemilik | ⬜ |
| T-S-15 | Rilis ke production | Tidak ada toko yang berubah plan secara tak terduga | ⬜ |

**Data uji:** akun dummy terpisah dari klien, project Supabase dummy, minimal 2 HP Android.

---

## 11. Risiko dan Mitigasi

| ID | Risiko | Mitigasi |
|---|---|---|
| RS-01 | Klien lama marah karena fiturnya tiba-tiba terkunci | Komunikasikan via WA sebelum rilis; pertimbangkan masa tenggang (D-01) |
| RS-02 | Klien lama tidak bisa menambah kasbon/shift baru | Read-only, bukan tersembunyi; data lama tetap terbaca (K-12) |
| RS-03 | Tier bisa dibobol dengan mengubah data lokal HP | Diterima untuk skala manual 1 klien; RLS sudah mencegah update via server. Bisa diperketat nanti dengan cek periodik |
| RS-04 | Masa aktif tidak terdeteksi saat HP lama offline | Hitung mundur lokal (K-02); banner sisa hari di Pengaturan |
| RS-05 | Tidak sengaja menghapus data klien | Kunci fitur **hanya memblokir aksi**, tidak pernah menghapus; migrasi add-only; rollback disiapkan |
| RS-06 | `app_licenses` lama masih menulis `lifetime` | Nonaktifkan `activateSerialKey()` dan `ensureLegacyClientProtected()` di rilis yang sama |
| RS-07 | Klien Pro habis masa berlaku di tengah operasional | Turun ke Gratis, **bukan blokir** (K-04). Jualan tidak terganggu |
| RS-08 | Perubahan plan bocor ke aplikasi kasir | Tidak ada endpoint tulis plan di sisi app; RLS tanpa policy update |

---

## 12. Keputusan yang Masih Terbuka

| No | Pertanyaan | Rekomendasi |
|---|---|---|
| D-01 | Masa tenggang klien lama: langsung terkunci atau diberi 1 bulan? | **Langsung terkunci**, asalkan dikomunikasikan dulu via WA |
| D-02 | Batas HP kasir di tier Gratis: 1 HP atau tidak dibatasi? | **1 HP** — mendorong upgrade, masuk akal untuk harga SaaS |
| D-03 | Pro kedaluwarsa: terkunci langsung atau pengingat 7 hari dulu? | **Pengingat 7 hari + terkunci tepat di tanggal berakhir** |
| D-04 | Harga Pro per bulan? | Diisi manual di dashboard saat aktivasi (K-09) |
| D-05 | Nama menu admin: `Langganan` atau `Paket & Langganan`? | `Langganan` |
| D-06 | Isi pesan tombol WhatsApp (template pesan upgrade)? | Disusun saat implementasi |

---

## 13. File yang Kemungkinan Disentuh

**Baru**
- `supabase/migration_v9_saas_tier.sql`
- `TokoKelontong/src/hooks/usePlan.js`
- `TokoKelontong/src/components/ProLock.js`
- `admin-web/src/features/subscriptions/` (api, hooks, pages, components)
- `admin-api/src/routes/subscriptions.ts`
- `admin-api/src/services/subscriptions.ts`

**Diubah**
- `admin-api/src/server.ts` (daftar router), `admin-api/src/types.ts`
- `admin-web/src/app/router.tsx`, `admin-web/src/config/nav.ts`
- `admin-web/src/types/domain.ts`, `admin-web/src/types/db.ts`
- `TokoKelontong/src/services/licenseService.js`
- `TokoKelontong/src/context/AuthContext.js` atau `AppContext.js`
- `TokoKelontong/src/screens/PengaturanScreen.js`, `LaporanScreen.js`, `DashboardScreen.js`, `KasirScreen.js`, `BukuKasbonScreen.js`, `SettingNotaScreen.js`
- `TokoKelontong/src/navigation/AppNavigator.js`

---

## 14. Di Luar Cakupan Dokumen Ini

- Pembayaran otomatis (payment gateway, Midtrans/dsb). Masih **manual via WhatsApp**.
- Notifikasi otomatis via WA/SMS saat Pro mau habis.
- Multi-cabang dalam satu akun pemilik.
- Model harga per fitur (add-on) — masih satu paket Pro.
- Perubahan fitur offline-first (lihat `09 november 2026 rencan offline .md`).

---

## 15. Log Progres

| Tanggal | ID | Status | Catatan | Oleh |
|---|---|---|---|---|
| 2026-11-13 | — | 📄 | Dokumen rencana dibuat dari hasil diskusi. Keputusan K-01..K-13 disepakati. | Diskusi |
| 2026-11-13 | IMPL-01 | ✅ | Implementasi skema `store_subscriptions` (migration_v9), backend `admin-api` endpoint langganan, dan frontend `admin-web` menu Langganan. | Dev |
| 2026-11-13 | IMPL-02 | ✅ | Implementasi tier engine di `TokoKelontong` (`planConfig`, `planService`, `usePlan`, `ProLock`). Enforce status Pro/Gratis di `BukuKasbonScreen`, `HomeScreen`, `PengaturanScreen`, `LaporanScreen`, `DashboardScreen`, `SettingNotaScreen`, dan `KasirScreen`. Typecheck & build lulus. | Dev |

**Cara update log:** setelah satu item selesai dan lulus QA, tambahkan satu baris di sini (tanggal, ID, status, ringkasan, nama pengembang). Bila gagal QA, tulis penyebabnya.
