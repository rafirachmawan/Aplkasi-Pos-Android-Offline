-- =====================================================================
-- MARKETPOS — SKEMA DATABASE SUPABASE (FASE 1)
-- =====================================================================
-- CARA PAKAI:
--   1. Buka Supabase Dashboard → project MarketPos
--   2. Menu SQL Editor → New query
--   3. Paste SELURUH file ini → Run (cukup sekali)
--
-- ISI:
--   - Tabel: stores, profiles, products, transactions,
--            transaction_details, invoice_counters
--   - Fungsi: register_store, checkout (stok atomik + nota unik),
--             current_store_id, set_updated_at
--   - RLS: isolasi data per toko (store_id)
--   - Realtime: products, transactions, transaction_details
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABEL
-- ---------------------------------------------------------------------

-- Data toko (1 baris per toko)
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  store_name text not null,
  created_at timestamptz not null default now()
);

-- Akun pengguna (1 akun = 1 toko; role sementara 'kasir')
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  role text not null default 'kasir',
  store_id uuid not null references public.stores (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Master barang (cermin skema lokal + store_id, id jadi UUID)
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  barcode text,
  product_name text not null,
  capital_price integer not null default 0,
  selling_price integer not null default 0,
  stock_quantity integer not null default 0,
  min_stock_threshold integer not null default 5,
  category text not null default 'makanan',
  unit text not null default 'pack',
  image_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_store_idx on public.products (store_id);
-- Barcode unik per toko (hanya bila terisi)
create unique index if not exists products_barcode_uniq
  on public.products (store_id, barcode)
  where barcode is not null and barcode <> '';

-- Nota penjualan
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  invoice_number text not null,
  total_price integer not null default 0,
  discount_amount integer not null default 0,
  grand_total integer not null default 0,
  cash_received integer not null default 0,
  cash_return integer not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, invoice_number)
);

create index if not exists transactions_store_created_idx
  on public.transactions (store_id, created_at);

-- Detail barang per nota (nama & harga di-snapshot agar riwayat aman)
create table if not exists public.transaction_details (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null,
  price_at_sale integer not null,
  capital_at_sale integer not null
);

create index if not exists details_transaction_idx
  on public.transaction_details (transaction_id);

-- Penghitung nomor nota per toko per hari (dipakai fungsi checkout)
create table if not exists public.invoice_counters (
  store_id uuid not null references public.stores (id) on delete cascade,
  date_key text not null,
  last_seq integer not null default 0,
  primary key (store_id, date_key)
);

-- ---------------------------------------------------------------------
-- 2. FUNGSI BANTUAN
-- ---------------------------------------------------------------------

-- store_id milik user yang sedang login (dipakai oleh semua policy RLS)
create or replace function public.current_store_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select store_id from public.profiles where id = auth.uid();
$$;

-- Otomatis isi updated_at saat produk diubah
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. FUNGSI REGISTRASI (dipanggil setelah signup auth)
--    Membuat toko + profile dalam satu transaksi atomik.
-- ---------------------------------------------------------------------
create or replace function public.register_store(
  p_username text,
  p_store_name text
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_store uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'already_registered';
  end if;
  if coalesce(trim(p_username), '') = '' then
    raise exception 'username_required';
  end if;
  if exists (select 1 from public.profiles where username = trim(p_username)) then
    raise exception 'username_taken';
  end if;

  insert into public.stores (store_name)
  values (coalesce(nullif(trim(p_store_name), ''), 'Toko Kelontong'))
  returning id into v_store;

  insert into public.profiles (id, username, store_id)
  values (auth.uid(), trim(p_username), v_store);

  return v_store;
end $$;

-- ---------------------------------------------------------------------
-- 4. FUNGSI CHECKOUT (inti anti-bentrok)
--    Dalam SATU transaksi database:
--      a) kunci baris produk & validasi stok semua item
--      b) kurangi stok (atomik — mustahil double-sell)
--      c) generate nomor nota unik per toko per hari (INV/YYYYMMDD/XXXX)
--      d) simpan transactions + transaction_details
--    Return: jsonb { id, invoice_number }
-- ---------------------------------------------------------------------
create or replace function public.checkout(
  p_items jsonb,          -- [{product_id, product_name, quantity, price_at_sale, capital_at_sale}]
  p_total_price integer,
  p_discount_amount integer,
  p_grand_total integer,
  p_cash_received integer,
  p_cash_return integer
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_store uuid := public.current_store_id();
  v_tx uuid;
  v_invoice text;
  v_date_key text;
  v_seq integer;
  v_item jsonb;
  v_stock integer;
begin
  if v_store is null then
    raise exception 'not_registered';
  end if;

  -- a) validasi stok dengan row-lock (item lain menunggu, tidak bentrok)
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::integer <= 0 then
      raise exception 'invalid_quantity';
    end if;
    select stock_quantity into v_stock
    from public.products
    where id = (v_item->>'product_id')::uuid and store_id = v_store
    for update;
    if not found then
      raise exception 'product_not_found';
    end if;
    if v_stock < (v_item->>'quantity')::integer then
      raise exception 'insufficient_stock';
    end if;
  end loop;

  -- b) kurangi stok
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update public.products
    set stock_quantity = stock_quantity - (v_item->>'quantity')::integer
    where id = (v_item->>'product_id')::uuid and store_id = v_store;
  end loop;

  -- c) nomor nota unik per toko per hari
  v_date_key := to_char(now(), 'YYYYMMDD');
  insert into public.invoice_counters (store_id, date_key, last_seq)
  values (v_store, v_date_key, 0)
  on conflict (store_id, date_key) do nothing;

  update public.invoice_counters
  set last_seq = last_seq + 1
  where store_id = v_store and date_key = v_date_key
  returning last_seq into v_seq;

  v_invoice := 'INV/' || v_date_key || '/' || lpad(v_seq::text, 4, '0');

  -- d) simpan nota + detail
  insert into public.transactions (
    store_id, invoice_number, total_price, discount_amount,
    grand_total, cash_received, cash_return
  )
  values (
    v_store, v_invoice, p_total_price, p_discount_amount,
    p_grand_total, p_cash_received, p_cash_return
  )
  returning id into v_tx;

  insert into public.transaction_details (
    transaction_id, product_id, product_name,
    quantity, price_at_sale, capital_at_sale
  )
  select
    v_tx,
    (i->>'product_id')::uuid,
    coalesce(i->>'product_name', ''),
    (i->>'quantity')::integer,
    (i->>'price_at_sale')::integer,
    (i->>'capital_at_sale')::integer
  from jsonb_array_elements(p_items) as i;

  return jsonb_build_object('id', v_tx, 'invoice_number', v_invoice);
end $$;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (isolasi per toko)
-- ---------------------------------------------------------------------
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_details enable row level security;
alter table public.invoice_counters enable row level security;

drop policy if exists stores_select_own on public.stores;
create policy stores_select_own on public.stores
  for select using (id = public.current_store_id());

drop policy if exists stores_update_own on public.stores;
create policy stores_update_own on public.stores
  for update using (id = public.current_store_id())
  with check (id = public.current_store_id());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

drop policy if exists products_select_own on public.products;
create policy products_select_own on public.products
  for select using (store_id = public.current_store_id());

drop policy if exists products_insert_own on public.products;
create policy products_insert_own on public.products
  for insert with check (store_id = public.current_store_id());

drop policy if exists products_update_own on public.products;
create policy products_update_own on public.products
  for update using (store_id = public.current_store_id());

drop policy if exists products_delete_own on public.products;
create policy products_delete_own on public.products
  for delete using (store_id = public.current_store_id());

-- Transaksi hanya bisa DIBUAT lewat fungsi checkout (anti manipulasi),
-- tapi bebas dibaca oleh anggota toko.
drop policy if exists transactions_select_own on public.transactions;
create policy transactions_select_own on public.transactions
  for select using (store_id = public.current_store_id());

drop policy if exists details_select_own on public.transaction_details;
create policy details_select_own on public.transaction_details
  for select using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_details.transaction_id
        and t.store_id = public.current_store_id()
    )
  );

-- invoice_counters hanya diakses fungsi security-definer (tanpa policy)

-- ---------------------------------------------------------------------
-- 6. REALTIME (jalankan SEKALI — error bila diulang)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.products;
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.transaction_details;

-- =====================================================================
-- SELESAI. Cek di Table Editor: stores, profiles, products,
-- transactions, transaction_details, invoice_counters sudah ada.
-- =====================================================================
