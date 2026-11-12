-- =====================================================================
-- Migrasi v8: Offline-First (checkout idempotent untuk sinkronisasi)
--
-- JAMINAN KEAMANAN DATA (ADD-ONLY):
-- 1. Tidak ada DROP / RENAME / UPDATE data lama.
-- 2. Hanya MENAMBAH 2 kolom nullable di `transactions` dan 1 fungsi baru
--    `checkout_v2`. Fungsi `checkout` lama TIDAK disentuh sama sekali,
--    sehingga APK lama tetap bisa bertransaksi seperti biasa.
-- 3. Aman dijalankan berulang kali (IF NOT EXISTS / CREATE OR REPLACE).
--
-- URUTAN RILIS:
--   1. Backup database.
--   2. Jalankan file ini di Supabase SQL Editor.
--   3. Pastikan APK lama masih bisa checkout.
--   4. Baru kirim APK/OTA versi offline-first.
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> Paste seluruh isi file ini -> Run.
-- =====================================================================

-- 1. Kolom pendukung idempotensi (nullable, tanpa default -> data lama utuh)
alter table public.transactions
  add column if not exists client_tx_id text,
  add column if not exists client_created_at timestamptz;

-- 2. Unik per toko: satu transaksi dari HP hanya bisa masuk satu kali.
--    Partial index: baris lama (client_tx_id NULL) tidak ikut dibatasi.
create unique index if not exists transactions_store_client_tx_uniq
  on public.transactions (store_id, client_tx_id)
  where client_tx_id is not null;

-- 3. Fungsi checkout idempotent untuk sinkronisasi dari outbox HP.
--    - Kirim ulang client_tx_id yang sama -> mengembalikan transaksi yang
--      sudah ada (duplicate = true), TIDAK membuat transaksi/ stok ganda.
--    - Tidak menolak karena stok kurang (penjualan sudah terjadi di toko).
--      Stok boleh menjadi minus dan akan terlihat apa adanya.
--    - Waktu transaksi = waktu HP, dibatasi tidak melewati waktu server.
--    - Produk yang sudah dihapus: transaksi tetap tersimpan (product_id NULL).
create or replace function public.checkout_v2(
  p_client_tx_id text,
  p_items jsonb,
  p_total_price integer,
  p_discount_amount integer,
  p_grand_total integer,
  p_cash_received integer,
  p_cash_return integer,
  p_payment_method text default 'cash',
  p_payment_notes text default '',
  p_order_type text default 'retail',
  p_table_number text default '',
  p_invoice_number text default null,
  p_client_created_at timestamptz default null,
  p_expected_store uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id();
  v_tx uuid;
  v_invoice text;
  v_existing record;
  v_date_key text;
  v_seq integer;
  v_item jsonb;
  v_pid uuid;
  v_created timestamptz;
  v_method text := coalesce(nullif(trim(p_payment_method), ''), 'cash');
  v_notes text := coalesce(trim(p_payment_notes), '');
  v_order_type text := coalesce(nullif(trim(p_order_type), ''), 'retail');
  v_table_num text := coalesce(trim(p_table_number), '');
begin
  if v_store is null then
    raise exception 'not_registered';
  end if;

  if p_expected_store is not null and p_expected_store <> v_store then
    raise exception 'store_mismatch';
  end if;

  if p_client_tx_id is null or length(trim(p_client_tx_id)) = 0 then
    raise exception 'invalid_client_tx_id';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'invalid_items';
  end if;

  -- Serialkan permintaan ganda dengan client_tx_id yang sama
  perform pg_advisory_xact_lock(hashtext(v_store::text || ':' || p_client_tx_id));

  select id, invoice_number into v_existing
  from public.transactions
  where store_id = v_store and client_tx_id = p_client_tx_id;

  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'invoice_number', v_existing.invoice_number,
      'duplicate', true
    );
  end if;

  -- Validasi kuantitas
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    if (v_item->>'quantity')::integer <= 0 then
      raise exception 'invalid_quantity';
    end if;
  end loop;

  -- Kurangi stok (boleh minus). Produk yang tidak ditemukan dilewati.
  for v_item in select * from jsonb_array_elements(p_items)
  loop
    update public.products
    set stock_quantity = stock_quantity - (v_item->>'quantity')::integer
    where store_id = v_store
      and id::text = coalesce(v_item->>'product_id', '');
  end loop;

  -- Nomor nota: pakai nomor dari HP bila belum dipakai, selain itu buat di server
  v_invoice := nullif(trim(coalesce(p_invoice_number, '')), '');
  if v_invoice is not null and exists (
    select 1 from public.transactions
    where store_id = v_store and invoice_number = v_invoice
  ) then
    v_invoice := null;
  end if;

  if v_invoice is null then
    v_date_key := to_char(now() at time zone 'Asia/Jakarta', 'YYYYMMDD');

    insert into public.invoice_counters (store_id, date_key, last_seq)
    values (v_store, v_date_key, 0)
    on conflict (store_id, date_key) do nothing;

    update public.invoice_counters
    set last_seq = last_seq + 1
    where store_id = v_store and date_key = v_date_key
    returning last_seq into v_seq;

    v_invoice := 'INV/' || v_date_key || '/' || lpad(v_seq::text, 4, '0');
  end if;

  v_created := least(coalesce(p_client_created_at, now()), now());

  insert into public.transactions (
    store_id, invoice_number, total_price, discount_amount, grand_total,
    cash_received, cash_return, payment_method, payment_notes,
    order_type, table_number, is_offline_sync,
    client_tx_id, client_created_at, created_at
  ) values (
    v_store, v_invoice, p_total_price, p_discount_amount, p_grand_total,
    p_cash_received, p_cash_return, v_method, v_notes,
    v_order_type, v_table_num, (p_client_created_at is not null),
    p_client_tx_id, p_client_created_at, v_created
  )
  returning id into v_tx;

  insert into public.transaction_details (
    transaction_id, product_id, product_name, quantity,
    price_at_sale, capital_at_sale
  )
  select
    v_tx,
    (select p.id from public.products p
       where p.store_id = v_store and p.id::text = coalesce(i->>'product_id', '')),
    coalesce(i->>'product_name', ''),
    (i->>'quantity')::integer,
    coalesce((i->>'price_at_sale')::integer, 0),
    coalesce((i->>'capital_at_sale')::integer, 0)
  from jsonb_array_elements(p_items) as i;

  return jsonb_build_object(
    'id', v_tx,
    'invoice_number', v_invoice,
    'duplicate', false
  );
end;
$$;

revoke execute on function public.checkout_v2(
  text, jsonb, integer, integer, integer, integer, integer,
  text, text, text, text, text, timestamptz, uuid
) from public, anon;

grant execute on function public.checkout_v2(
  text, jsonb, integer, integer, integer, integer, integer,
  text, text, text, text, text, timestamptz, uuid
) to authenticated;
