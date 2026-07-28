# 🚀 Panduan Rilis & Build APK (MARKETPOS)

Dokumen ini berisi panduan *step-by-step* tentang cara melakukan update aplikasi dan mencetak file APK baru menggunakan Expo Application Services (EAS). Semua error pada library Bluetooth lama sudah diatasi secara permanen menggunakan sistem *patch-package*, jadi proses build ke depannya dijamin lancar.

---

## 📝 Langkah 1: Ubah Nomor Versi Aplikasi

Setiap kali kamu membuat perubahan fitur dan ingin merilis APK baru, **kamu wajib menaikkan nomor versi aplikasi**. Jika tidak dinaikkan, HP Android akan menolak menginstal update karena menganggap aplikasinya masih versi lama.

1. Buka file `app.json` di VS Code.
2. Cari baris berikut:
   ```json
   "version": "1.0.0",
   ```
   *Ubah menjadi versi yang lebih tinggi (contoh: `"1.1.0"` atau `"2.0.0"`). Angka ini adalah versi yang akan dilihat oleh pengguna.*

3. Kemudian, cari bagian `android` di file yang sama:
   ```json
   "android": {
     "versionCode": 1,
     ...
   }
   ```
   *Tambahkan `versionCode` dengan kelipatan **+1** (contoh: dari `1` menjadi `2`). Ini adalah nomor identifikasi mesin, sangat wajib dinaikkan setiap rilis APK.*

---

## 💾 Langkah 2: Simpan Perubahan ke Git (Commit)

Sistem EAS Build mengambil file dari Git. Jadi, pastikan semua kode baru dan perubahan versimu sudah disimpan ke dalam riwayat Git.

Buka terminal VS Code dan ketik secara berurutan:
```powershell
git add .
```
Lalu buat catatan rilisnya:
```powershell
git commit -m "Rilis Update APK Versi 2: Menambahkan fitur X dan Y"
```

---

## 🛠️ Langkah 3: Eksekusi Build APK di Cloud (EAS)

Setelah semuanya tersimpan di Git, jalankan satu baris perintah sakti ini di terminal untuk menyuruh server Expo mencetak APK:

```powershell
eas build -p android --profile apk --clear-cache
```

**Penjelasan Perintah:**
- `-p android`: Menargetkan build untuk platform Android.
- `--profile apk`: Menggunakan pengaturan `apk` yang sudah kita buat di `eas.json` (agar hasilnya berupa file `.apk` langsung install, bukan `.aab` untuk Play Store).
- `--clear-cache`: (Opsional tapi sangat disarankan) Membersihkan cache server Expo untuk mencegah error aneh dari build sebelumnya.

---

## ⏳ Langkah 4: Tunggu dan Download

1. Setelah menjalankan perintah di atas, biarkan terminal terbuka.
2. Proses ini akan memakan waktu sekitar **5 - 10 menit**.
3. Jika proses sudah selesai, terminal akan memunculkan teks hijau **`✓ Build finished`**.
4. Akan ada link URL yang muncul di terminal (berakhiran `.apk`). Tekan `Ctrl + Click` pada link tersebut untuk mendownload APK-nya ke laptopmu.
5. Kirim file APK tersebut ke HP Android-mu (lewat WhatsApp, kabel USB, atau Google Drive) dan instal!

---

### ⚠️ Catatan Penting
Jika suatu saat kamu menjalankan perintah `npm install` (misalnya saat menambah library baru), pastikan tulisan di terminal tidak menunjukkan error pada bagian `patch-package`. Sistem *patch-package* ini bertugas menyuntikkan perbaikan otomatis ke library printer Bluetooth jadul agar tidak error saat di-build.
