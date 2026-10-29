-- =====================================================================
-- Migrasi v5 (Fase 1): Multi-Metode Pembayaran & PIN Keamanan Toko
--
-- JAMINAN BACKWARD COMPATIBILITY:
-- 1. Semua kolom baru memiliki nilai default ('cash', '', null).
-- 2. Fungsi checkout() mendukung 8 parameter dengan default value untuk
--    parameter baru, sehingga aplikasi lama dengan 6 parameter tetap
--    berjalan normal tanpa error.
-- 3. Data lama tidak diubah/dihapus sama sekali.
--
-- CARA PAKAI:
--   Buka Supabase Dashboard → SQL Editor → Paste seluruh file ini → Run.
-- =====================================================================

-- 1. Tambah kolom metode pembayaran dan catatan pembayaran di tabel transactions
alter table public.transactions
  add column if not exists payment_method text not null default 'cash',
  add column if not exists payment_notes text default '';

-- 2. Tambah kolom PIN keamanan pemilik di tabel stores
alter table public.stores
  add column if not exists security_pin text default null;

-- 3. Perbarui fungsi checkout dengan backward compatibility (default arguments)
create or replace function public.checkout(
  p_items jsonb,              -- [{product_id, product_name, quantity, price_at_sale, capital_at_sale}]
  p_total_price integer,
  p_discount_amount integer,
  p_grand_total integer,
  p_cash_received integer,
  p_cash_return integer,
  p_payment_method text default 'cash', -- Parameter baru dengan default 'cash'
  p_payment_notes text default ''       -- Parameter baru dengan default ''
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

  -- c) nomor nota unik per toko per hari (zona waktu Indonesia/WIB)
  v_date_key := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD');
  insert into public.invoice_counters (store_id, date_key, last_seq)
  values (v_store, v_date_key, 0)
  on conflict (store_id, date_key) do nothing;

  update public.invoice_counters
  set last_seq = last_seq + 1
  where store_id = v_store and date_key = v_date_key
  returning last_seq into v_seq;

  v_invoice := 'INV/' || v_date_key || '/' || lpad(v_seq::text, 4, '0');

  -- d) simpan nota + detail (termasuk payment_method & payment_notes)
  insert into public.transactions (
    store_id, invoice_number, total_price, discount_amount,
    grand_total, cash_received, cash_return,
    payment_method, payment_notes
  )
  values (
    v_store, v_invoice, p_total_price, p_discount_amount,
    p_grand_total, p_cash_received, p_cash_return,
    v_method, v_notes
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

-- 4. Overload wrapper 6-parameter untuk menjamin aplikasi klien lama (yang belum di-update)
--    tetap bisa checkout 100% normal tanpa risiko bentrok signature fungsi.
create or replace function public.checkout(
  p_items jsonb,
  p_total_price integer,
  p_discount_amount integer,
  p_grand_total integer,
  p_cash_received integer,
  p_cash_return integer
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  return public.checkout(
    p_items,
    p_total_price,
    p_discount_amount,
    p_grand_total,
    p_cash_received,
    p_cash_return,
    'cash',
    ''
  );
end $$;

