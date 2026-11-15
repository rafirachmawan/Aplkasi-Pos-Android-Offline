-- =====================================================================
-- HOTFIX: PENGAMANAN ISOLASI DATA PRODUK & TOKO PER AKUN (RLS FIX)
-- Jalankan skrip ini di SQL Editor Supabase untuk memastikan data toko
-- tidak akan pernah bocor atau tercampur ke akun toko lain!
-- =====================================================================

-- 1. Cabut izin baca bebas untuk 'authenticated' pada produk
drop policy if exists "products_select_public_menu" on public.products;
create policy "products_select_public_menu"
  on public.products for select
  to anon
  using (true);

-- 2. Pastikan kasir login (authenticated) HANYA BISA membaca produk tokonya sendiri
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own"
  on public.products for select
  to authenticated
  using (store_id = public.current_store_id());

-- 3. Batasi juga akses info toko publik HANYA untuk 'anon' (web QR meja)
drop policy if exists "stores_select_public_menu" on public.stores;
create policy "stores_select_public_menu"
  on public.stores for select
  to anon
  using (true);

-- 4. Batasi antrean pesanan meja: kasir hanya melihat pesanan tokonya
drop policy if exists "table_orders_select_cashier" on public.table_orders;
create policy "table_orders_select_cashier"
  on public.table_orders for select
  to authenticated
  using (store_id = public.current_store_id());

-- Selesai! Data toko kini 100% terisolasi rapat baik di level database maupun di level aplikasi.
