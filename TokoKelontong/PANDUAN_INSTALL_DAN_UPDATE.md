# PANDUAN INSTALL & UPDATE APLIKASI MARKETPOS

> Panduan lengkap cara memasang aplikasi MarketPos untuk pertama kali,
> dan cara memperbarui aplikasi **tanpa install ulang** (update OTA).
> Ditujukan untuk developer/pemilik toko. User akhir hanya perlu mengikuti
> Bagian D.

---

## Daftar Isi

1. [Konsep: Kenapa Bisa Update Tanpa Install?](#1-konsep-kenapa-bisa-update-tanpa-install)
2. [Persiapan Developer (Sekali Saja)](#2-persiapan-developer-sekali-saja)
3. [Build APK "Base" — Install Manual Terakhir](#3-build-apk-base--install-manual-terakhir)
4. [Menerbitkan Update (OTA) dari Komputer Anda](#4-menerbitkan-update-ota-dari-komputer-anda)
5. [Cara User Melakukan Update di HP](#5-cara-user-melakukan-update-di-hp)
6. [Apa yang BISA dan TIDAK BISA Di-update via OTA](#6-apa-yang-bisa-dan-tidak-bisa-di-update-via-ota)
7. [Kapan Tetap Butuh APK Baru](#7-kapan-tetap-butuh-apk-baru)
8. [Testing Saat Pengembangan](#8-testing-saat-pengembangan)
9. [Pemecahan Masalah (Troubleshooting)](#9-pemecahan-masalah-troubleshooting)
10. [Ringkasan Perintah Cepat](#10-ringkasan-perintah-cepat)

---

## 1. Konsep: Kenapa Bisa Update Tanpa Install?

Aplikasi React Native/Expo terdiri dari dua lapisan:

```
┌─────────────────────────────────────────────┐
│  KODE JAVASCRIPT + ASET                      │  ← layar, logika, tampilan,
│  (screen kasir, gudang, laporan, dll.)       │    perbaikan bug, fitur baru
├─────────────────────────────────────────────┤
│  SHELL NATIVE (APK)                          │  ← mesin Android, library
│  (Bluetooth, kamera, database, expo-updates) │    native, permission
└─────────────────────────────────────────────┘
```

- Lapisan **JavaScript** bisa dikirim ulang lewat internet kapan saja
  (disebut **OTA update / Over-The-Air**). Inilah yang dipakai fitur
  "Periksa Update" di layar Pengaturan.
- Lapisan **native** hanya bisa diganti dengan APK baru (jarang terjadi).

APK "base" yang Anda bagikan ke user sudah mengandung mesin
`expo-updates`. Sejak saat itu:

1. Anda mengubah kode di komputer → terbitkan dengan satu perintah
   `eas update`.
2. Aplikasi di HP user (saat online) mendeteksi versi baru.
3. User tap **Periksa Update → Update** di Pengaturan → bundle terunduh →
   aplikasi restart → langsung versi baru.
4. **Tidak ada install ulang. Data produk, transaksi, dan pengaturan
   tidak tersentuh sama sekali.**

Istilah penting:

| Istilah | Arti |
|---|---|
| **Channel** | "Jalur" distribusi update. Proyek ini memakai channel `production`. APK yang di-build dengan channel ini hanya menerima update yang diterbitkan ke channel yang sama. |
| **runtimeVersion** | Versi mesin native (`1.0.0` di `app.json`). Update OTA hanya dikirim ke APK dengan runtimeVersion yang sama — supaya update tidak pernah dikirim ke mesin yang tidak cocok. |
| **EAS** | Layanan cloud Expo yang menjalankan build APK (`eas build`) dan menyebarkan update (`eas update`). |

---

## 2. Persiapan Developer (Sekali Saja)

### 2.1 Yang dibutuhkan

- **Node.js** (sudah terpasang di komputer Anda).
- **Akun Expo** — pemilik proyek: `rafirachmawan`
  (terdaftar di `app.json` field `owner`, projectId sudah tertanam).
- **EAS CLI** — jalankan sekali:

  ```
  npm install -g eas-cli
  ```

### 2.2 Login ke akun Expo

```
eas login
```

Masukkan email & password akun Expo `rafirachmawan`.
Cek sudah login dengan:

```
eas whoami
```

### 2.3 Konfigurasi proyek — SUDAH SELESAI, jangan diubah

Hal-hal berikut **sudah dikonfigurasi** di proyek ini. Cukup ketahui
keberadaannya; mengubahnya sembarangan dapat memutus alur update.

- `app.json`:
  - `"runtimeVersion": "1.0.0"`
  - `"updates": { "enabled": true, "checkOnLaunch": "always", ... }`
    (aplikasi otomatis mengecek update setiap dibuka)
  - `updates.url` menunjuk ke projectId Expo Anda.
- `eas.json`: profil `apk`, `preview`, dan `production` sudah di-set ke
  `"channel": "production"`.
- Layar **Pengaturan** aplikasi sudah memiliki bagian
  **UPDATE APLIKASI → Periksa Update**.

---

## 3. Build APK "Base" — Install Manual Terakhir

APK yang saat ini beredar **belum** mengandung mesin update, jadi harus
di-build ulang **sekali**. Setelah langkah ini, user tidak perlu install
manual lagi selamanya.

### Langkah-langkah

1. Pastikan semua perubahan kode sudah disimpan & di-commit:

   ```
   git add .
   git commit -m "siap rilis: fitur update OTA"
   ```

2. Build APK di cloud Expo (±10–15 menit, tidak butuh JDK/Android Studio
   di komputer Anda):

   ```
   eas build -p android --profile apk
   ```

3. Setelah selesai, terminal menampilkan **link download APK**.
   Buka link itu di browser dan unduh file `.apk`.

4. Pasang ke HP user:
   - Kirim APK (WhatsApp/ShareIt/USB), buka file di HP.
   - HP akan meminta izin *"install dari sumber tidak dikenal"* → izinkan
     **sekali**.
   - Install seperti biasa.

5. **Selesai.** APK ini adalah install manual terakhir. Mulai sekarang
   semua pembaruan mengalir lewat tombol **Periksa Update**.

> Catatan: build lewat EAS memakai kunci penandatanganan yang disimpan di
> akun Expo Anda. Selama build tetap dari akun yang sama, APK baru apa pun
> nanti akan "menimpa mulus" aplikasi lama tanpa menghapus data.

### 3.1 Bila kuota build cloud habis

Akun gratis Expo punya batas build Android per bulan (cek
**expo.dev → Account → Billing → Current usage**). Bila muncul error
*"This account has used its Android builds from the Free plan this month"*,
solusinya sederhana: **tunggu tanggal reset** (awal bulan berikutnya,
tertulis di pesan error) lalu jalankan ulang `eas build -p android --profile apk`.

Catatan penting:
- Kuota yang habis hanya kuota **build**. Menerbitkan update OTA
  (`eas update`) **tidak** memotong kuota build dan tetap bisa dilakukan
  kapan saja — tetapi update hanya diterima oleh APK yang sudah berisi
  mesin update (APK base hasil langkah 3 di atas).
- Alternatif tanpa menunggu: build lokal di Windows terbukti bekerja
  lewat script `_build_apk_local.bat` (double-click di File Explorer).
  Script menyalin proyek ke folder path-pendek `D:\tkb`, menyuntikkan
  mirror Aliyun untuk dependensi, dan menaruh semua cache di drive D.
  Build pertama ±10-25 menit; build berikutnya cepat (incremental).
  APK hasil tersalin ke `TokoKelontong\app-release.apk`.
  Catatan: APK build lokal ditandatangani keystore debug Android —
  berbeda dengan tanda tangan build EAS — jadi di perangkat, aplikasi
  lama harus di-uninstall dulu sebelum pasang APK lokal ini.

---

## 4. Menerbitkan Update (OTA) dari Komputer Anda

Lakukan ini setiap kali ada **perubahan kode JavaScript/aset**
(perbaikan bug, fitur baru, ubahan tampilan, teks, harga default, dll.).

### Langkah-langkah

1. Edit kode seperti biasa di folder `TokoKelontong/src/...`.

2. (Disarankan) Naikkan nomor versi tampilan di `app.json` agar user
   melihat versi baru, misal `"version": "1.1.0"`.
   (Ini hanya angka tampilan; yang mengatur kompatibilitas adalah
   `runtimeVersion` — **jangan** mengubah `runtimeVersion`.)

3. Commit perubahan:

   ```
   git add .
   git commit -m "versi 1.1.0: perbaikan laporan harian"
   ```

4. Terbitkan update:

   ```
   eas update --channel production -m "v1.1.0: perbaikan laporan harian"
   ```

5. Selesai. Dalam ±1–2 menit update sudah tersedia untuk **semua HP**
   yang memasang APK base. Tidak ada langkah lain.

### Apa yang terjadi di sisi user setelah Anda publish?

- **Cek otomatis:** setiap aplikasi dibuka (saat HP online), aplikasi
  mengecek update di latar belakang. Bila terunduh, versi baru aktif
  otomatis saat aplikasi dibuka berikutnya.
- **Tombol manual:** user bisa kapan saja membuka
  **Pengaturan → UPDATE APLIKASI → Periksa Update** dan menekan
  **Update** untuk memasang saat itu juga (aplikasi restart sendiri).

---

## 5. Cara User Melakukan Update di HP

(Bagian ini bisa Anda fotokopi/teruskan ke kasir.)

1. Pastikan HP **terhubung internet** (Wi-Fi atau data seluler).
2. Buka aplikasi **MarketPos**.
3. Masuk ke layar **Pengaturan** (ikon gerigi).
4. Gulir ke bagian **UPDATE APLIKASI**.
5. Ketuk **Periksa Update**.
   - Jika muncul *"Sudah Terbaru"* → tidak ada yang perlu dilakukan.
   - Jika muncul *"Update Tersedia"* → ketuk **Update**.
6. Tunggu unduhan selesai (biasanya hanya beberapa MB).
7. Aplikasi **restart sendiri** dan langsung menjadi versi baru.
   Nomor versi di bawah tombol akan berubah.

**Tidak ada install ulang, tidak adahapus data.** Produk, riwayat
transaksi, dan pengaturan toko tetap utuh.

---

## 6. Apa yang BISA dan TIDAK BISA Di-update via OTA

### ✅ BISA (cukup `eas update`, user tidak install apa-apa)

- Perbaikan bug logika (kasir, stok, laporan, sinkronisasi).
- Perubahan tampilan: warna, tata letak, teks, terjemahan.
- Menambah layar/fitur baru berbasis JavaScript
  (mis. grafik laporan baru, format nota baru).
- Mengubah/menambah aset (gambar, ikon, font yang sudah terdaftar).
- Perubahan alur kerja aplikasi.

### ❌ TIDAK BISA (butuh APK baru — lihat Bagian 7)

- Menambah **library native** baru (contoh dulu: printer Bluetooth).
- Menambah/mengubah **permission** Android (mis. izin baru di manifest).
- Menaikkan versi **React Native / Expo SDK**.
- Mengubah `runtimeVersion`.

Praktiknya ±95% pembaruan sehari-hari masuk kategori "BISA".

---

## 7. Kapan Tetap Butuh APK Baru

Hanya pada kasus "TIDAK BISA" di atas. Caranya:

1. Lakukan perubahan native + (opsional) naikkan `runtimeVersion`
   di `app.json` bila mesin memang berubah.
2. Build ulang: `eas build -p android --profile apk`.
3. Bagikan APK baru ke user **sekali** (install menimpa aplikasi lama —
   data tetap aman karena kunci penandatanganan sama).
4. Setelah itu update OTA mengalir normal lagi.

> Bila `runtimeVersion` dinaikkan, APK lama tetap berfungsi tetapi tidak
> menerima update OTA versi baru — mereka akan terus memakai versi OTA
> terakhir yang cocok, sampai dipasang APK baru.

---

## 8. Testing Saat Pengembangan

### Lewat Expo Go (paling mudah, untuk tes fitur JS)

```
cd TokoKelontong
npx expo start
```

Scan QR dengan aplikasi **Expo Go** di HP (Wi-Fi sama dengan komputer).
Catatan: di Expo Go tombol **Periksa Update** akan menampilkan pesan
*"Update otomatis hanya tersedia pada build APK"* — ini **normal**,
karena OTA memang hanya berjalan di APK hasil build.

### Lewat emulator / HP via build lokal

```
TokoKelontong\_run_build.bat
```

(Membutuhkan JDK 17 — sudah terpasang — dan emulator menyala lewat
`_run_emulator.bat`.)

---

## 9. Pemecahan Masalah (Troubleshooting)

| Gejala | Penyebab & Solusi |
|---|---|
| Tombol update menampilkan *"Update otomatis hanya tersedia pada build APK"* | Aplikasi sedang dijalankan di **Expo Go**, bukan APK build. Normal. Build APK base (Bagian 3) agar fitur aktif. |
| *"Gagal Memeriksa / Tidak dapat memeriksa update"* di HP user | HP sedang **offline**. Minta user terhubung internet lalu coba lagi. Aplikasi tetap bisa dipakai offline seperti biasa. |
| *"Sudah Terbaru"* padahal Anda baru publish | 1) Tunggu 1–2 menit setelah publish. 2) Pastikan publish ke channel yang benar: `eas update --channel production`. 3) Pastikan APK user di-build dengan profil ber-channel `production`. |
| `eas update` error "not logged in" | Jalankan `eas login` dulu (Bagian 2.2). |
| `eas update` error "channel not found" | Pastikan menulis `--channel production` persis seperti di `eas.json`. |
| `eas build` lama / antre | Normal pada akun gratis — ada antrean build. Tunggu; link APK muncul sendiri di terminal & dashboard expo.dev. |
| User install APK baru tapi data hilang | Berarti APK di-build dari akun/kunci berbeda. Pastikan selalu build dari akun Expo `rafirachmawan` yang sama. |
| Lupa apakah update sudah publish | Cek riwayat di dashboard **expo.dev → Updates**, atau jalankan `eas update:list --channel production` (bila tersedia di versi CLI Anda). |

---

## 10. Ringkasan Perintah Cepat

Semua dijalankan dari folder `TokoKelontong`.

| Kapan | Perintah |
|---|---|
| Login Expo (sekali) | `eas login` |
| Build APK base / APK native baru | `eas build -p android --profile apk` |
| **Terbitkan update OTA** (rutin) | `eas update --channel production -m "catatan versi"` |
| Testing cepat di HP | `npx expo start` |
| Build lokal ke emulator | `_run_build.bat` |

### Alur kerja rutin Anda ke depan

```
edit kode → commit → eas update --channel production → selesai
                            ↓
        semua HP user: Pengaturan → Periksa Update → Update
```

Selamat berjualan! 🛒
