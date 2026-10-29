# Rencana Opsi C — Admin Console Terhubung Supabase

Status: **rencana, belum dieksekusi**  
Target: menggantikan backend lokal Opsi B dengan akses Supabase langsung dari
`admin-web`, tanpa mengubah data atau alur kasir aplikasi client `TokoKelontong`.

---

## 1. Ringkasan

Opsi B membuktikan bahwa console bisa menampilkan data asli, tetapi masih bergantung pada
laptop yang menjalankan `admin-api` dengan `service_role`. Opsi C memindahkan tanggung jawab
itu ke database:

- Admin login memakai **Supabase Auth** (email + password).
- Role admin disimpan di tabel baru `admin_users`.
- Fungsi bantuan `is_super_admin()` dipakai policy RLS dan RPC.
- Console membaca data lewat **RPC read-only** yang sudah dipaginasi dan diagregasi di SQL.
- Satu-satunya operasi tulis: **perpanjang / cabut lisensi**, dengan audit log.
- Aplikasi client tidak diubah. Policy lamanya tetap berlaku.

Hasil akhirnya: console bisa di-deploy, tidak ada `service_role` di laptop, dan beban query
dibatasi oleh index serta `LIMIT`.

---

## 2. Kondisi saat ini

| Aspek | Kondisi |
|---|---|
| RLS toko | Setiap user hanya membaca `store_id` miliknya |
| Role admin | Belum ada |
| `app_licenses.store_id` | Sering `NULL` karena client belum mengirimkannya |
| Index `transactions(created_at)` | Belum ada (index existing: `store_id, created_at`) |
| Audit log | Belum ada |
| Heartbeat perangkat | Belum ada di client |
| `admin-web` | Mode `mock` dan `api` sudah berjalan |

### Gap yang harus diselesaikan

1. **Identitas admin.** `profiles.store_id` NOT NULL, jadi admin tidak bisa memakai tabel itu.
2. **Policy lintas toko.** Butuh policy tambahan yang hanya aktif untuk admin.
3. **Agregasi.** Dashboard tidak boleh menarik semua transaksi ke browser.
4. **Lisensi tanpa toko.** `app_licenses.store_id` harus diisi agar lisensi bisa dipetakan.
5. **Audit.** Aksi perpanjang/cabut harus tercatat siapa pelakunya.

---

## 3. Sasaran & batasan

### Sasaran

- Admin dapat membaca seluruh toko, produk, transaksi, dan lisensi.
- Admin dapat memperpanjang/mencabut lisensi dengan audit log.
- Console berjalan dengan **anon key + RLS**, bukan `service_role`.
- Data client lama tidak berubah.

### Batasan keras

- Tidak ada `DROP`/perubahan pada tabel atau policy client.
- Tidak menjalankan ulang `supabase/schema.sql` di produksi.
- Tidak mengubah kode `TokoKelontong/` pada fase ini.
- Migrasi hanya menambah objek baru.
- Semua uji dilakukan di staging lebih dulu.

---

## 4. Arsitektur target

```
Browser (admin-web)
   │  anon key + JWT Supabase Auth
   ▼
Supabase PostgREST
   │  RPC admin_*  ──► is_super_admin() ──► admin_users
   ▼
Postgres (RLS + fungsi security definer)
   ▲
   │  policy client lama tetap aktif
Aplikasi client TokoKelontong (tidak berubah)
```

Tidak ada backend tambahan. `admin-api` tetap tersedia sebagai fallback lokal.

---

## 5. Objek database baru

### 5.1 Tabel `admin_users`

```sql
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null unique,
  role       text not null default 'super_admin'
             check (role in ('super_admin')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
-- Tidak ada policy insert/update/delete.
-- Baris ditambahkan manual lewat SQL Editor / service role.
```

### 5.2 Fungsi `is_super_admin()`

```sql
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
      and role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;
```

Karena `security definer`, fungsi ini membaca `admin_users` tanpa memicu rekursi RLS.

### 5.3 Policy tambahan

Semua policy memakai `(select public.is_super_admin())` agar fungsi dievaluasi sekali per
query, bukan per baris. Policy client tidak disentuh.

| No | Nama policy | Tabel | Aksi |
|---|---|---|---|
| 1 | `admin_users_select_self` | `admin_users` | select baris sendiri |
| 2 | `admin_stores_select` | `stores` | select semua |
| 3 | `admin_profiles_select` | `profiles` | select semua |
| 4 | `admin_products_select` | `products` | select semua |
| 5 | `admin_transactions_select` | `transactions` | select semua |
| 6 | `admin_transaction_details_select` | `transaction_details` | select semua |
| 7 | `admin_app_licenses_select` | `app_licenses` | select semua |
| 8 | `admin_audit_log_select` | `admin_audit_log` | select semua |

Contoh:

```sql
create policy admin_stores_select
  on public.stores for select
  to authenticated
  using ((select public.is_super_admin()));
```

Karena policy bersifat **permissive** dan digabung dengan OR, client biasa tidak mendapat
akses tambahan: `is_super_admin()` bernilai false untuk mereka.

### 5.4 Tabel `admin_audit_log`

```sql
create table if not exists public.admin_audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_email text,
  action      text not null,
  target_type text not null,
  target_id   text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
```

Tidak ada policy insert untuk client; penulisan hanya dari RPC security definer.

### 5.5 Index tambahan

Dijalankan **di luar transaksi** dan **CONCURRENTLY** agar kasir tetap bisa checkout:

```sql
create index concurrently if not exists transactions_created_idx
  on public.transactions (created_at desc);

create index concurrently if not exists app_licenses_status_idx
  on public.app_licenses (status);

create index concurrently if not exists app_licenses_store_idx
  on public.app_licenses (store_id);

create index concurrently if not exists profiles_store_idx
  on public.profiles (store_id);
```

Setelah selesai:

```sql
analyze public.transactions;
analyze public.app_licenses;
analyze public.profiles;
```

---

## 6. RPC

Semua RPC:

- `security definer`, `set search_path = public`
- diawali guard `if not public.is_super_admin() then raise exception ... using errcode = '42501'; end if;`
- `revoke all from public, anon` lalu `grant execute to authenticated`
- mengembalikan `jsonb` agar bentuknya sama dengan tipe domain `admin-web`

| RPC | Parameter | Fungsi |
|---|---|---|
| `admin_kpi()` | — | total toko, toko aktif, transaksi/omzet hari ini, seri 30 hari, top 5 toko |
| `admin_stores(...)` | `p_search`, `p_status`, `p_page`, `p_page_size` | daftar toko + jumlah produk + omzet 30 hari |
| `admin_store_detail(p_store_id)` | uuid | toko + produk + 12 transaksi + lisensi |
| `admin_transactions(...)` | `p_search`, `p_store_id`, `p_from`, `p_to`, `p_page`, `p_page_size` | nota + item + ringkasan |
| `admin_licenses(...)` | `p_search`, `p_status` | daftar lisensi + nama toko |
| `admin_license_action(...)` | `p_device_id`, `p_action`, `p_days`, `p_notes` | perpanjang/cabut + audit |

### 6.1 Bentuk respons

Harus identik dengan `admin-web/src/types/domain.ts`, misalnya:

```json
{
  "rows": [],
  "total": 0,
  "page": 1,
  "pageSize": 8
}
```

### 6.2 Contoh kerangka RPC

```sql
create or replace function public.admin_stores(
  p_search text default '',
  p_status text default 'all',
  p_page int default 1,
  p_page_size int default 8
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page int := greatest(1, coalesce(p_page, 1));
  v_size int := least(200, greatest(1, coalesce(p_page_size, 8)));
  v_result jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Akses ditolak' using errcode = '42501';
  end if;

  -- CTE: agregasi omzet 30 hari + jumlah produk + status lisensi
  -- Lalu LIMIT v_size OFFSET (v_page - 1) * v_size
  -- Total dihitung dengan count(*) over ().

  return v_result;
end;
$$;

revoke all on function public.admin_stores(text, text, int, int) from public, anon;
grant execute on function public.admin_stores(text, text, int, int) to authenticated;
```

### 6.3 Aturan aksi lisensi

`admin_license_action`:

1. Guard admin.
2. `p_action` hanya `extend` atau `revoke`.
3. `extend`:
   - `p_days` dibatasi 1–3650.
   - `expires_at` baru = `greatest(now(), expires_at)` + `p_days`.
   - `status = 'active'`.
   - `lifetime` tidak diubah masa berlakunya (tetap `NULL`).
4. `revoke`: `status = 'revoked'`.
5. Hanya kolom `status`, `expires_at`, `notes` yang diubah.
6. Tulis `admin_audit_log` berisi nilai sebelum/sesudah.
7. Kembalikan baris lisensi terbaru.

`license_key` dan `device_id` tidak boleh berubah dari console.

---

## 7. Login admin

1. Buat user di Supabase Dashboard → Authentication → Users.
   Email yang dipakai: `admin@marketpos.app` (atau email lain yang disetujui).
2. Ambil `id` user, lalu jalankan:

   ```sql
   insert into public.admin_users (user_id, email)
   select id, email from auth.users where email = 'admin@marketpos.app'
   on conflict (user_id) do nothing;
   ```

3. Nonaktifkan pendaftaran publik (Authentication → Providers → Email → disable signup)
   agar tidak ada yang bisa membuat akun sendiri.
4. `admin-web` login dengan `supabase.auth.signInWithPassword`.
5. Setelah sesi terbentuk, console memanggil `admin_kpi()` atau membaca
   `admin_users` miliknya untuk memastikan role.

Tidak ada registrasi admin dari console.

---

## 8. Perubahan di `admin-web`

| Area | Perubahan |
|---|---|
| `lib/env.ts` | mode `supabase` memakai URL + anon key |
| `features/auth/api.ts` | ganti mock login dengan Supabase Auth |
| `AuthProvider` | `onAuthStateChange`, refresh sesi, logout |
| `features/*/api.ts` | branch `supabase` memanggil `.rpc()` |
| `useLicenseAction` | RPC `admin_license_action`, lalu invalidate query |
| `lib/adminApi.ts` | tetap ada untuk Opsi B |
| Mock | tetap tersedia lewat `VITE_DATA_MODE=mock` |

Rencana urutan:

1. Tambahkan adapter Supabase tanpa menghapus cabang mock/api.
2. Uji di staging dengan data hasil restore.
3. Baru arahkan `.env.local` produksi ke `supabase`.

---

## 9. File migrasi

| File | Isi | Transaksi |
|---|---|---|
| `supabase/migration_v8a_admin_core.sql` | tabel, fungsi, policy, RPC | Ya |
| `supabase/migration_v8b_admin_indexes.sql` | index `CONCURRENTLY` | Tidak |
| `supabase/migration_v8c_admin_analyze.sql` | `analyze` | Tidak |
| `supabase/migration_v8_rollback.sql` | drop objek v8 | Ya |
| `supabase/migration_v8_preflight_queries.sql` | cek kondisi sebelum migrasi | Hanya baca |

### Preflight minimal

- Versi PostgreSQL.
- Daftar policy existing per tabel.
- Jumlah baris `stores`, `profiles`, `products`, `transactions`, `app_licenses`.
- Jumlah `app_licenses.store_id IS NULL`.
- Index existing pada `transactions`, `app_licenses`, `profiles`.
- Apakah `admin_users` / `is_super_admin` sudah ada (jangan dobel).
- Ukuran tabel dan durasi query agregat 30 hari.

---

## 10. Runbook staging

1. **Backup produksi** (Dashboard → Database → Backups, atau `pg_dump`).
2. Restore backup ke project staging.
3. Jalankan `migration_v8_preflight_queries.sql` di staging dan simpan hasilnya.
4. Jalankan `migration_v8a_admin_core.sql` (dalam transaksi).
5. Jalankan `migration_v8b_admin_indexes.sql` (di luar transaksi).
6. Jalankan `migration_v8c_admin_analyze.sql`.
7. Buat user admin staging dan baris `admin_users`.
8. Arahkan `admin-web` staging ke project staging.
9. Uji seluruh halaman dan aksi lisensi.
10. Uji negatif: akun client tidak bisa membaca toko lain.
11. Uji rollback di staging, lalu jalankan ulang migrasi.
12. Catat waktu eksekusi dan ukuran index.

Jangan lanjut ke produksi bila ada satu pun uji gagal.

---

## 11. Runbook produksi

1. Pastikan backup terbaru tersedia dan bisa direstore.
2. Pilih jam sepi (misalnya setelah tutup toko).
3. Jalankan v8a; bila error, transaksi otomatis rollback.
4. Jalankan v8b; pantau Supabase Reports (CPU, IOPS, koneksi).
5. Jalankan v8c.
6. Buat akun admin produksi + baris `admin_users`.
7. Deploy/ubah `admin-web` ke `VITE_DATA_MODE=supabase`.
8. Verifikasi:
   - login admin,
   - dashboard, toko, transaksi, lisensi,
   - perpanjang satu lisensi uji,
   - audit log bertambah,
   - client bisa login dan checkout.
9. Pantau 15–30 menit setelah migrasi.
10. Simpan catatan waktu, output, dan hasil verifikasi.

---

## 12. Pengujian

### Fungsional admin

- [ ] Login email/password berhasil.
- [ ] User non-admin ditolak RPC (`42501`).
- [ ] Dashboard menampilkan angka yang sama dengan query manual.
- [ ] Daftar toko: search, filter status, pagination.
- [ ] Detail toko: produk, 12 transaksi, lisensi.
- [ ] Transaksi: filter tanggal toko + pencarian nota.
- [ ] Lisensi: filter status, perpanjang, cabut.
- [ ] Audit log mencatat actor, aksi, target, payload.
- [ ] Timezone laporan = Asia/Jakarta.

### Regresi client

- [ ] Login kasir lama.
- [ ] Checkout tunai dan non-tunai.
- [ ] Tambah/edit/hapus produk.
- [ ] Sinkronisasi offline queue.
- [ ] Aktivasi lisensi perangkat.
- [ ] Client tidak bisa membaca data toko lain.
- [ ] Anon key tanpa login tidak bisa membaca tabel.

### Non-fungsional

- [ ] `EXPLAIN ANALYZE` RPC < 200 ms pada data uji.
- [ ] Tidak ada sequential scan pada tabel besar.
- [ ] Tidak ada error console browser.
- [ ] Rollback berhasil di staging.

---

## 13. Kinerja

- Agregasi dilakukan di SQL, bukan di browser.
- Semua daftar memakai `LIMIT` + `OFFSET` dengan batas ukuran halaman.
- Index `transactions(created_at desc)` dan `app_licenses(store_id)` wajib ada.
- Policy memakai `(select public.is_super_admin())` agar tidak dievaluasi per baris.
- `statement_timeout` sesi admin disarankan 15 detik.
- `admin-web` memakai `staleTime` 30 detik; tidak ada polling agresif.
- Jika data tumbuh besar, pertimbangkan read replica untuk query admin.

Estimasi saat ini (9 toko, ratusan transaksi): seluruh RPC < 50 ms. Migrasi index
`CONCURRENTLY` tidak memblokir tulis, tetapi menambah beban IO sementara.

---

## 14. Rollback

Karena v8 hanya menambah objek:

1. Jalankan `migration_v8_rollback.sql`:
   - drop 8 policy admin,
   - drop 6 RPC,
   - drop `admin_audit_log`,
   - drop `admin_users`,
   - drop `is_super_admin()`.
2. Drop index baru **CONCURRENTLY** (opsional; index tidak mengganggu client).
3. Ubah `admin-web` kembali ke `VITE_DATA_MODE=api` atau `mock`.
4. Client tidak perlu diubah.

Catatan: aksi lisensi yang sudah dilakukan tetap tersimpan di `app_licenses`. Bila perlu
dikembalikan, gunakan backup atau catatan audit.

---

## 15. Risiko & mitigasi

| Risiko | Mitigasi |
|---|---|
| Policy admin salah dan membocorkan data | uji negatif dengan akun client; review policy |
| `CREATE INDEX` memblokir tulis | `CONCURRENTLY`, di luar transaksi |
| RPC lambat | index, `EXPLAIN ANALYZE`, batas halaman |
| Admin lupa logout di perangkat bersama | sesi Supabase + logout; waktu sesi pendek |
| Lisensi tidak terpetakan ke toko | perbaiki `store_id` di client (fase terpisah) |
| Migrasi salah di produksi | staging + backup + rollback teruji |
| Kunci `service_role` bocor | Opsi C menghapus kebutuhan kunci ini dari laptop |

---

## 16. Yang perlu diputuskan sebelum eksekusi

- [ ] Email admin final.
- [ ] Project staging dan izin akses.
- [ ] Waktu backup + jendela migrasi produksi.
- [ ] Apakah `app_licenses.store_id` akan diperbaiki lewat update client (disarankan).
- [ ] Apakah heartbeat perangkat masuk fase terpisah.
- [ ] Siapa yang menjalankan SQL di produksi dan siapa yang memverifikasi.

---

## 17. Estimasi

| Tahap | Perkiraan |
|---|---|
| Tulis migrasi v8a/b/c + rollback | 0,5–1 hari |
| Uji staging + perbaikan | 0,5–1 hari |
| Implementasi adapter Supabase di `admin-web` | 0,5 hari |
| Migrasi produksi + verifikasi | 1–2 jam |
| Perbaikan `store_id` lisensi di client (terpisah) | 0,5 hari + rilis app |

---

## 18. Definition of done

- Admin bisa login dan membaca seluruh data tanpa `service_role` di browser.
- Aksi lisensi tercatat di audit log.
- Client lulus seluruh regresi checkout/login/lisensi.
- Tidak ada policy client yang berubah.
- Rollback terbukti berhasil di staging.
- Tidak ada error console di semua halaman admin.
