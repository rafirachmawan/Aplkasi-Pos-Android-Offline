-- =====================================================================
-- MARKETPOS — MIGRASI V3: STORAGE FOTO PRODUK
-- =====================================================================
-- CARA PAKAI:
--   1. Buka Supabase Dashboard → project MarketPos
--   2. Menu SQL Editor → New query
--   3. Paste SELURUH file ini → Run (cukup sekali)
--
-- ISI:
--   - Bucket publik 'product-images' untuk foto produk
--   - Policy: user login bisa upload/ubah/hapus foto di bucket ini,
--     semua orang (termasuk anonim) bisa membaca URL publiknya.
-- =====================================================================

-- 1. Buat bucket publik (idempoten — aman dijalankan ulang)
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- 2. Policy upload untuk user yang sudah login
drop policy if exists product_images_insert on storage.objects;
create policy product_images_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images');

-- 3. Policy update & hapus untuk user yang sudah login
drop policy if exists product_images_update on storage.objects;
create policy product_images_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists product_images_delete on storage.objects;
create policy product_images_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images');

-- 4. Policy baca untuk semua (bucket publik — agar URL publik
--    foto produk bisa dirender di semua HP tanpa login storage)
drop policy if exists product_images_select on storage.objects;
create policy product_images_select on storage.objects
  for select to public
  using (bucket_id = 'product-images');
