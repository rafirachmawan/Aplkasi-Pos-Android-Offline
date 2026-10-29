-- =====================================================================
-- Migrasi v7 (Fase 3): Mode Kafe/F&B, Offline Queue Sync & Lisensi Perangkat
--
-- JAMINAN BACKWARD COMPATIBILITY & NON-DESTRUCTIVE:
-- 1. Semua kolom baru memiliki nilai DEFAULT ('retail', '', false).
-- 2. Fungsi checkout() mendukung default arguments untuk parameter baru,
--    sehingga aplikasi klien versi lama (6 atau 8 parameter) tetap berjalan 100% normal.
-- 3. Data lama tidak diubah/dihapus sama sekali.
--
-- CARA PAKAI:
--   Buka Supabase Dashboard → SQL Editor → Paste seluruh file ini → Run.
-- =====================================================================

-- 0. Pastikan tabel penghitung nomor nota invoice_counters ada
create table if not exists public.invoice_counters (
  store_id uuid not null references public.stores (id) on delete cascade,
  date_key text not null,
  last_seq integer not null default 0,
  primary key (store_id, date_key)
);
alter table public.invoice_counters enable row level security;

-- 1. Tambah kolom mode pesanan, nomor meja, dan penanda sinkronisasi offline di tabel transactions
alter table public.transactions
  add column if not exists order_type text not null default 'retail',
  add column if not exists table_number text default '',
  add column if not exists is_offline_sync boolean not null default false;

-- Index untuk mempermudah filter transaksi berdasarkan tipe dan meja
create index if not exists idx_transactions_order_type on public.transactions(order_type);

-- 2. Tabel untuk mencatat lisensi aktivasi perangkat komersial
create table if not exists public.app_licenses (
  id uuid primary key default gen_random_uuid(),
  device_id text not null unique,
  store_id uuid references public.stores(id) on delete set null,
  license_key text not null,
  license_type text not null default 'lifetime', -- 'lifetime', 'subscription', 'trial'
  status text not null default 'active',          -- 'active', 'expired', 'revoked'
  activated_at timestamptz not null default now(),
  expires_at timestamptz default null,
  notes text default '',
  created_at timestamptz not null default now()
);

alter table public.app_licenses enable row level security;

-- Policy RLS untuk app_licenses (bisa dibaca dan diaktivasi oleh toko yang login)
create policy "app_licenses_select"
  on public.app_licenses for select
  using (
    auth.role() = 'authenticated' and
    (store_id is null or store_id = public.current_store_id())
  );

create policy "app_licenses_insert"
  on public.app_licenses for insert
  with check (auth.role() = 'authenticated');

create policy "app_licenses_update"
  on public.app_licenses for update
  using (
    auth.role() = 'authenticated' and
    (store_id is null or store_id = public.current_store_id())
  );

-- 3. Hapus fungsi checkout versi lama agar tidak terjadi ambiguitas function overload di PostgreSQL
DROP FUNCTION IF EXISTS public.checkout(jsonb, integer, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.checkout(jsonb, integer, integer, integer, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.checkout(jsonb, integer, integer, integer, integer, integer, text, text, text, text);

-- 4. Perbarui fungsi checkout dengan backward compatibility (default arguments)
-- Parameter p_payment_method, p_payment_notes, p_order_type dan p_table_number diberi default value.
CREATE OR REPLACE FUNCTION public.checkout(
  p_items jsonb,              -- [{product_id, product_name, quantity, price_at_sale, capital_at_sale}]
  p_total_price integer,
  p_discount_amount integer,
  p_grand_total integer,
  p_cash_received integer,
  p_cash_return integer,
  p_payment_method text default 'cash',
  p_payment_notes text default '',
  p_order_type text default 'retail',   -- Baru: 'retail', 'dine_in', 'take_away'
  p_table_number text default ''        -- Baru: nomor/nama meja
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
  v_method text := coalesce(nullif(trim(p_payment_method), ''), 'cash');
  v_notes text := coalesce(trim(p_payment_notes), '');
  v_order_type text := coalesce(nullif(trim(p_order_type), ''), 'retail');
  v_table_num text := coalesce(trim(p_table_number), '');
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

  -- c) nomor nota unik per hari per toko (zona waktu Asia/Jakarta)
  v_date_key := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD');

  insert into public.invoice_counters (store_id, date_key, last_seq)
  values (v_store, v_date_key, 0)
  on conflict (store_id, date_key) do nothing;

  update public.invoice_counters
  set last_seq = last_seq + 1
  where store_id = v_store and date_key = v_date_key
  returning last_seq into v_seq;

  v_invoice := 'INV/' || v_date_key || '/' || lpad(v_seq::text, 4, '0');

  -- c) insert header transaksi
  insert into public.transactions (
    store_id,
    invoice_number,
    total_price,
    discount_amount,
    grand_total,
    cash_received,
    cash_return,
    payment_method,
    payment_notes,
    order_type,
    table_number
  ) values (
    v_store,
    v_invoice,
    p_total_price,
    p_discount_amount,
    p_grand_total,
    p_cash_received,
    p_cash_return,
    v_method,
    v_notes,
    v_order_type,
    v_table_num
  )
  returning id into v_tx;

  -- d) insert items & kurangi stok produk
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.transaction_details (
      transaction_id,
      product_id,
      product_name,
      quantity,
      price_at_sale,
      capital_at_sale
    ) values (
      v_tx,
      (v_item->>'product_id')::uuid,
      coalesce(v_item->>'product_name', ''),
      (v_item->>'quantity')::integer,
      (v_item->>'price_at_sale')::integer,
      (v_item->>'capital_at_sale')::integer
    );

    update public.products
    set stock_quantity = stock_quantity - (v_item->>'quantity')::integer
    where id = (v_item->>'product_id')::uuid and store_id = v_store;
  end loop;

  return jsonb_build_object(
    'id', v_tx,
    'invoice_number', v_invoice
  );
end;
$$;

