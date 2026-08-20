-- =====================================================================
-- Migrasi v4: tanggal nomor nota mengikuti zona waktu Indonesia (WIB)
--
-- Masalah: v_date_key memakai now() dalam UTC server, sehingga transaksi
-- jam 00:00-06:59 WIB mendapat nomor nota bertanggal hari sebelumnya.
-- Perbaikan: pakai waktu Asia/Jakarta, sama dengan pengelompokan tanggal
-- lokal di aplikasi.
--
-- Cara pakai: jalankan seluruh isi file ini di Supabase Dashboard →
-- SQL Editor → Run. Hanya mengganti fungsi checkout; data tidak berubah.
-- =====================================================================

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

  -- c) nomor nota unik per toko per hari (zona waktu Indonesia/WIB,
  --    sesuai pengelompokan tanggal lokal di aplikasi)
  v_date_key := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD');
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
