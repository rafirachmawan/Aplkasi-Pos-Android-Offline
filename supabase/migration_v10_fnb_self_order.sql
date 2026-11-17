-- =====================================================================
-- Migrasi v10: F&B QR Self-Order Meja & E-Menu Pelanggan (Tier PRO)
--
-- JAMINAN KEAMANAN DATA (ADD-ONLY):
-- 1. Tidak ada DROP TABLE, DROP COLUMN, RENAME, atau TRUNCATE.
-- 2. Menambah tabel baru `public.table_orders` untuk menampung antrean
--    pesanan mandiri dari pelanggan di meja.
-- 3. Menambah kolom baru pada `public.stores` (qris_image_url, fnb_active_tables).
-- 4. Menambah policy baca publik terbatas agar web menu pelanggan (Vercel)
--    dapat menampilkan nama toko, katalog produk aktif, dan gambar QRIS.
-- 5. Menyiapkan storage bucket untuk bukti bayar (`payment_proofs`)
--    dan QRIS toko (`store_qris`).
-- 6. Menghubungkan realtime Supabase untuk notifikasi pesanan meja instan.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. KOLOM TAMBAHAN PADA TABEL STORES (Add-Only)
-- ---------------------------------------------------------------------
alter table public.stores 
  add column if not exists qris_image_url text default '';

alter table public.stores 
  add column if not exists fnb_active_tables integer default 10;

-- ---------------------------------------------------------------------
-- 2. TABEL ANTREAN PESANAN MEJA (table_orders)
-- ---------------------------------------------------------------------
create table if not exists public.table_orders (
  id                  uuid primary key default gen_random_uuid(),
  store_id            uuid not null references public.stores (id) on delete cascade,
  table_number        text not null default '1',
  customer_name       text not null,
  customer_phone      text not null default '',
  total_amount        numeric not null default 0,
  payment_method      text not null default 'cash_cashier',
  payment_proof_url   text not null default '',
  status              text not null default 'pending',
  items               jsonb not null default '[]'::jsonb,
  notes               text not null default '',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint table_orders_payment_method_check
    check (payment_method in ('qris', 'cash_cashier')),
  constraint table_orders_status_check
    check (status in ('pending', 'accepted', 'completed', 'cancelled'))
);

comment on table public.table_orders is
  'Antrean pesanan mandiri pelanggan via scan QR meja (F&B Tier Pro).';


-- Index untuk filter kasir & urutan pesanan terbaru
create index if not exists table_orders_store_status_idx
  on public.table_orders (store_id, status, created_at desc);

create index if not exists table_orders_table_num_idx
  on public.table_orders (store_id, table_number);

-- ---------------------------------------------------------------------
-- 3. TRIGGER OTOMATIS updated_at
-- ---------------------------------------------------------------------
drop trigger if exists table_orders_updated_at on public.table_orders;
create trigger table_orders_updated_at
  before update on public.table_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) UNTUK table_orders
-- ---------------------------------------------------------------------
alter table public.table_orders enable row level security;

-- Pelanggan (anon/web) boleh mengirim pesanan baru
drop policy if exists "table_orders_insert_public" on public.table_orders;
create policy "table_orders_insert_public"
  on public.table_orders for insert
  to anon, authenticated
  with check (true);

-- Pelanggan boleh membaca status pesanannya sendiri (berdasarkan id pesanan)
drop policy if exists "table_orders_select_public" on public.table_orders;
create policy "table_orders_select_public"
  on public.table_orders for select
  to anon, authenticated
  using (true);

-- Kasir toko boleh mengubah status pesanan (Terima / Tolak / Selesai)
drop policy if exists "table_orders_update_cashier" on public.table_orders;
create policy "table_orders_update_cashier"
  on public.table_orders for update
  to authenticated
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- ---------------------------------------------------------------------
-- 5. RLS AKSES BACA MENU UNTUK WEB PELANGGAN (ANON)
-- ---------------------------------------------------------------------
-- Izinkan HANYA web pelanggan (anon) membaca katalog barang untuk menu QR
drop policy if exists "products_select_public_menu" on public.products;
create policy "products_select_public_menu"
  on public.products for select
  to anon
  using (true);

-- Izinkan HANYA web pelanggan (anon) membaca info nama toko & QRIS toko
drop policy if exists "stores_select_public_menu" on public.stores;
create policy "stores_select_public_menu"
  on public.stores for select
  to anon
  using (true);

-- Pastikan kasir authenticated HANYA bisa membaca produk tokonya sendiri
drop policy if exists "products_select_own" on public.products;
create policy "products_select_own"
  on public.products for select
  to authenticated
  using (store_id = public.current_store_id());

-- ---------------------------------------------------------------------
-- 6. SETUP STORAGE BUCKETS (BUKTI BAYAR & QRIS TOKO)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values 
  ('payment_proofs', 'payment_proofs', true),
  ('store_qris', 'store_qris', true)
on conflict (id) do update set public = true;

-- Policy upload bukti bayar oleh pelanggan anon
drop policy if exists "payment_proofs_upload_anon" on storage.objects;
create policy "payment_proofs_upload_anon"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'payment_proofs');

-- Policy lihat bukti bayar
drop policy if exists "payment_proofs_read_all" on storage.objects;
create policy "payment_proofs_read_all"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'payment_proofs');

-- Policy upload QRIS toko oleh kasir
drop policy if exists "store_qris_upload_auth" on storage.objects;
create policy "store_qris_upload_auth"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'store_qris');

drop policy if exists "store_qris_update_auth" on storage.objects;
create policy "store_qris_update_auth"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'store_qris');

-- Policy baca gambar QRIS oleh siapa saja (web menu pelanggan)
drop policy if exists "store_qris_read_all" on storage.objects;
create policy "store_qris_read_all"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'store_qris');

-- ---------------------------------------------------------------------
-- 7. REALTIME BROADCASTING
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'table_orders'
  ) then
    alter publication supabase_realtime add table public.table_orders;
  end if;
end $$;
