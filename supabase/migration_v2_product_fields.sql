-- =====================================================================
-- MARKETPOS — MIGRASI V2
-- Untuk project yang SUDAH terlanjur menjalankan schema.sql versi awal.
-- =====================================================================
-- CARA PAKAI: Supabase Dashboard → SQL Editor → New query
--             → paste SELURUH isi file ini → Run (cukup sekali)
-- Aman: semua perintah idempotent (tidak error bila dijalankan ulang).
-- =====================================================================

-- 1) Kolom produk yang dipakai aplikasi (kategori, satuan, foto)
alter table public.products add column if not exists category text not null default 'makanan';
alter table public.products add column if not exists unit text not null default 'pack';
alter table public.products add column if not exists image_uri text;

-- 2) Izin ganti nama toko dari aplikasi (menu Pengaturan Toko)
drop policy if exists stores_update_own on public.stores;
create policy stores_update_own on public.stores
  for update using (id = public.current_store_id())
  with check (id = public.current_store_id());

-- =====================================================================
-- SELESAI. Cek Table Editor → products: kolom category, unit,
-- image_uri sudah muncul.
-- =====================================================================
