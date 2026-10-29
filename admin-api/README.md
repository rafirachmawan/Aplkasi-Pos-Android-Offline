# MarketPos Admin API (Opsi B)

Backend lokal **read-only** yang menjadi jembatan antara `admin-web` dan Supabase.
Tujuannya: console bisa menampilkan data asli tanpa mengubah skema, policy RLS, atau
kode aplikasi client `TokoKelontong`.

```
Browser (localhost:5173)
        │  GET /api/...
        ▼
admin-api (localhost:8787)  ← service_role key hanya di .env server
        │  SELECT (tanpa RLS)
        ▼
Supabase Postgres
```

## Kenapa service_role?

RLS existing hanya mengizinkan setiap toko membaca datanya sendiri. Console admin perlu
membaca lintas toko. `service_role` melewati RLS, jadi tidak perlu migrasi policy.

Konsekuensinya kunci ini sangat sensitif:

- Hanya ada di `admin-api/.env`, **tidak pernah** di `VITE_*` milik `admin-web`.
- Server hanya mendengarkan `127.0.0.1`.
- Semua endpoint data wajib token sesi.
- Server menolak semua metode tulis (kecuali login).
- Jangan deploy folder ini ke internet apa adanya.

## Prasyarat

- Node.js 20 atau lebih baru.
- Database client sudah memiliki kolom dari migrasi v5 (`payment_method`) dan v7
  (`order_type`, `app_licenses`). Bila belum, jalankan migrasi tersebut lebih dulu
  (bukan bagian dari Opsi B).
- Supabase project dapat diakses dari laptop.

## Setup

1. Salin `.env.example` menjadi `.env`.

   ```powershell
   cd admin-api
   Copy-Item .env.example .env
   ```

2. Isi dari Supabase Dashboard → **Project Settings → API**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (bagian **service_role**, bukan anon)

3. Ganti `ADMIN_PASSWORD` bila tidak ingin memakai default `admin123`.

4. Jalankan:

   ```powershell
   npm install
   npm run dev
   ```

5. Buka `http://127.0.0.1:8787/health`. Harus muncul `"ok": true`.

6. Di terminal lain, jalankan console:

   ```powershell
   cd admin-web
   npm run dev
   ```

7. Ubah `admin-web/.env.local`:

   ```
   VITE_DATA_MODE=api
   VITE_API_BASE_URL=http://127.0.0.1:8787
   ```

8. Login dengan `ADMIN_USERNAME` / `ADMIN_PASSWORD` dari `admin-api/.env`
   (default `admin` / `admin123`).

## Endpoint

Semua endpoint data memakai header `x-api-token` yang didapat dari respons login.

| Metode | Path | Isi |
|---|---|---|
| `GET` | `/health` | status server, tanpa token |
| `POST` | `/api/auth/login` | `{ username, password }` → `{ token, session }` |
| `GET` | `/api/auth/session` | validasi token |
| `GET` | `/api/kpi` | ringkasan dashboard + seri 30 hari |
| `GET` | `/api/stores` | daftar toko (`search`, `status`, `page`, `pageSize`) |
| `GET` | `/api/stores/:id` | detail toko, produk, transaksi, lisensi |
| `GET` | `/api/transactions` | nota lintas toko (`search`, `storeId`, `from`, `to`, `page`, `pageSize`) |
| `GET` | `/api/licenses` | daftar lisensi (`search`, `status`) |
| `GET` | `/api/devices` | kosong sampai heartbeat client tersedia |

Semua respons mengikuti tipe di `src/types.ts`, yang disinkronkan dengan
`admin-web/src/types/domain.ts`.

## Konfigurasi penting

| Variabel | Fungsi |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | kunci server; wajib `service_role` (divalidasi saat start) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | kredensial console lokal |
| `API_TOKEN` | opsional; bila kosong dibuat acak setiap start dan dikirim saat login |
| `CACHE_TTL_MS` | cache dataset (default 30 detik) agar banyak tab tidak membebani DB |
| `MAX_SCAN_ROWS` | batas baris per permintaan (default 20.000) |

## Perilaku data

- **Read-only.** Perpanjang/cabut lisensi dinonaktifkan di console selama mode `api`.
- Query memakai pagination PostgREST dan batas baris; tidak ada `select *`.
- Agregasi ringkasan dilakukan di server dari dataset yang di-cache.
- Zona waktu laporan: **Asia/Jakarta (WIB)**.
- `app_licenses.store_id` sering kosong karena client belum mengirimkannya. Lisensi
  seperti itu tampil sebagai **“Tidak terhubung”** dan tidak muncul di detail toko.
- `GET /api/devices` selalu kosong karena aplikasi client belum mengirim heartbeat.
  Console menampilkan “—” pada kolom terakhir aktif.

## Batasan Opsi B

- Hanya cocok untuk data kecil/menengah dan pemakaian lokal.
- Server harus berjalan di laptop; kalau laptop mati, console tidak bisa mengambil data.
- Tidak ada audit log database.
- Agregasi dilakukan di Node; saat transaksi tumbuh puluhan ribu, pindah ke Opsi C.
- Index `transactions(created_at)` belum ada (baru dibuat di Opsi C), sehingga filter tanggal
  global bisa memindai tabel. Untuk data saat ini masih cepat; jangan dipakai untuk data besar.
- Lisensi yang `store_id`-nya kosong tidak bisa dipetakan ke toko.

Rencana migrasi ke arsitektur final ada di [`docs/PLAN_OPSI_C.md`](docs/PLAN_OPSI_C.md).

## Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| `Tidak bisa menghubungi admin-api` | server belum jalan, port beda, atau `VITE_API_BASE_URL` salah |
| `Sesi API tidak valid` | server restart (token dibuat ulang) → login lagi |
| `SUPABASE_SERVICE_ROLE_KEY bukan service_role key` | memakai anon key |
| `Gagal membaca toko: fetch failed` | URL/network Supabase salah |
| `Data ... melebihi batas` | naikkan `MAX_SCAN_ROWS` atau pindah ke Opsi C |

## Keamanan

- `.env` sudah masuk `.gitignore`. Jangan commit.
- Jangan menyalin `service_role` ke chat, screenshot, atau file frontend.
- Bila kunci pernah bocor: rotate di Supabase Dashboard, lalu restart server.
- Hapus `.env` bila laptop dipakai bersama.
