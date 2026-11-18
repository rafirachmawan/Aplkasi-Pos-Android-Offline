-- =====================================================================
-- Migrasi v12 (Tahap 2 — PENGUNCIAN RLS ANON):
-- PERINGATAN URUTAN DEPLOY (WAJIB DIPATUHI AGAR TIDAK PUTUS):
--   1. Pastikan migration_v11_security_hardening_phase1_rpc.sql SUDAH dijalankan.
--   2. Pastikan admin-web terbaru (yang memanggil RPC get_public_store_menu &
--      submit_public_table_order) SUDAH di-deploy dan aktif di Vercel.
--   3. Baru jalankan skrip ini untuk mencabut izin baca langsung `anon`.
--
-- Catatan kolom security_pin plaintext (baris paling bawah):
--   Baris opsional penghapusan kolom plaintext dikomentari agar APK lama yang
--   masih berjalan di HP klien TIDAK terkunci sampai seluruh klien update APK/OTA.
-- =====================================================================

-- 1. Cabut akses SELECT/INSERT terbuka untuk role anon pada tabel sensitif
drop policy if exists "products_select_public_menu" on public.products;
drop policy if exists "stores_select_public_menu" on public.stores;
drop policy if exists "table_orders_select_public" on public.table_orders;
drop policy if exists "table_orders_insert_public" on public.table_orders;

-- 2. Pastikan kasir login (`authenticated`) tetap hanya melihat data tokonya sendiri
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own"
  on public.products for select
  to authenticated
  using (store_id = public.current_store_id());

drop policy if exists "table_orders_select_cashier" on public.table_orders;
create policy "table_orders_select_cashier"
  on public.table_orders for select
  to authenticated
  using (store_id = public.current_store_id());

drop policy if exists "table_orders_update_cashier" on public.table_orders;
create policy "table_orders_update_cashier"
  on public.table_orders for update
  to authenticated
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- 3. OPSIONAL (Jalankan HANYA setelah seluruh HP klien update ke app dengan security_pin_hash):
-- update public.stores
-- set security_pin = null
-- where security_pin_hash is not null and security_pin is not null;
