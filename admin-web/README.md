# MarketPos Admin Console

Web admin terpisah dari aplikasi Android `TokoKelontong`. Default berjalan di localhost dengan
**data mock**; tersedia juga mode `api` untuk membaca data asli lewat backend lokal read-only
(Opsi B) tanpa mengubah database client.

## Menjalankan

```bash
cd admin-web
npm install
npm run dev
```

Buka http://localhost:5173

Akun demo:

```
username: admin
password: admin123
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Jalankan dev server (localhost) |
| `npm run build` | Type-check + build produksi ke `dist/` |
| `npm run preview` | Pratinjau hasil build |
| `npm run typecheck` | Cek TypeScript tanpa build |

## Struktur

```
src/
  app/          router, providers, guard login
  components/   ui/ (primitif) + layout/ (shell, sidebar, topbar)
  config/       nav.ts (menu sidebar)
  features/     satu folder per domain: auth, dashboard, stores,
                licenses, transactions, devices, settings
  hooks/        hook generik (useDebounce)
  lib/          supabase, env, format, pagination, label, util
  mocks/        dataset lokal + seed deterministik
  pages/        404
  types/        tipe domain & tipe tabel DB
```

Aturan yang dipakai:

- Halaman tidak memanggil Supabase langsung; semua lewat `features/<domain>/api.ts`.
- Setiap akses data dibungkus hook TanStack Query (`useStores`, `useKpi`, dst).
- Komponen UI tidak tahu sumber data; mode mock/Supabase ditukar lewat `lib/env.ts`.
- Satu file dijaga tetap kecil dan fokus.

## Mode data

`.env.local` (tidak di-commit):

```
VITE_DATA_MODE=mock
```

| Mode | Sumber data | Status |
|---|---|---|
| `mock` | dataset lokal di `src/mocks` | default, tanpa koneksi database |
| `api` | `admin-api` lokal (Opsi B) | read-only, data asli |
| `supabase` | Supabase langsung (Opsi C) | belum diaktifkan |

### Menghubungkan data asli (Opsi B)

1. Jalankan backend lokal lebih dulu:

   ```powershell
   cd ../admin-api
   npm install
   npm run dev
   ```

   Ikuti `admin-api/README.md` untuk mengisi `SUPABASE_SERVICE_ROLE_KEY`.

2. Ubah `admin-web/.env.local`:

   ```
   VITE_DATA_MODE=api
   VITE_API_BASE_URL=http://127.0.0.1:8787
   ```

3. Restart `npm run dev`, lalu login memakai akun dari `admin-api/.env`
   (default `admin` / `admin123`).

Pada mode `api`, console bersifat **read-only**: tombol perpanjang/cabut lisensi dinonaktifkan.
`service_role` hanya berada di server lokal dan tidak pernah masuk bundle browser.

Untuk arsitektur final, lihat [`../admin-api/docs/PLAN_OPSI_C.md`](../admin-api/docs/PLAN_OPSI_C.md).

## Catatan keamanan

- Folder ini terpisah total dari `TokoKelontong/`; tidak ada file aplikasi Android yang diubah.
- Tidak ada operasi hapus data toko/transaksi.
- Aksi lisensi (perpanjang/cabut) hanya mengubah status lisensi perangkat, bukan data penjualan.
- Frontend hanya boleh memakai **anon key**. Jangan pernah menaruh `service_role` key di sini.

## Fase lanjutan (belum dikerjakan)

1. Migrasi Opsi C: `admin_users`, `is_super_admin()`, policy admin, 6 RPC, audit log.
   Rencana lengkap ada di `../admin-api/docs/PLAN_OPSI_C.md`.
2. Ganti adapter Supabase di `features/*/api.ts` (mode `supabase`).
3. Isi `app_licenses.store_id` dari aplikasi client agar lisensi terpetakan ke toko.
4. Heartbeat perangkat dari app Android (perubahan terpisah, dengan persetujuan).
