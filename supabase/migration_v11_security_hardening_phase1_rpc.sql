-- =====================================================================
-- Migrasi v11 (Tahap 1 — ADD-ONLY / AMAN DIJALANKAN KAPAN SAJA):
-- Persiapan Pengamanan Menu QR Publik & Hashing PIN Keamanan Toko
--
-- JAMINAN KEAMANAN DATA & KOMPATIBILITAS KLIEN BERJALAN:
-- 1. 100% ADD-ONLY (tidak menghapus policy lama dan tidak mengubah nilai
--    kolom stores.security_pin lama).
-- 2. APK lama maupun admin-web versi sekarang TETAP BERJALAN NORMAL tanpa
--    downtime sedikit pun saat skrip ini dijalankan.
-- 3. Setelah skrip ini jalan + admin-web di-redeploy, barulah jalankan
--    migration_v12_security_lockdown_phase2_drop_anon.sql untuk menutup
--    akses SELECT terbuka role `anon`.
-- =====================================================================

-- 1. Kolom hash PIN (nullable, aman untuk data lama) + backfill otomatis
alter table public.stores
  add column if not exists security_pin_hash text default null;

update public.stores
set security_pin_hash = encode(sha256((id::text || ':' || security_pin)::bytea), 'hex')
where security_pin is not null
  and length(trim(security_pin)) >= 4
  and (security_pin_hash is null or trim(security_pin_hash) = '');

-- 2. RPC khusus web menu QR pelanggan (menggantikan SELECT langsung anon)
--    Hanya mengembalikan kolom publik: TIDAK membocorkan security_pin maupun capital_price!
create or replace function public.get_public_store_menu(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store jsonb;
  v_products jsonb;
begin
  if p_store_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', s.id,
    'store_name', s.store_name,
    'qris_image_url', s.qris_image_url,
    'fnb_active_tables', coalesce(s.fnb_active_tables, 10)
  )
  into v_store
  from public.stores s
  where s.id = p_store_id;

  if v_store is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'product_name', p.product_name,
        'selling_price', p.selling_price,
        'category', p.category,
        'image_uri', p.image_uri,
        'stock_quantity', p.stock_quantity
      )
      order by p.product_name asc
    ),
    '[]'::jsonb
  )
  into v_products
  from public.products p
  where p.store_id = p_store_id;

  return jsonb_build_object(
    'store', v_store,
    'products', v_products
  );
end;
$$;

grant execute on function public.get_public_store_menu(uuid) to anon, authenticated;

-- 3. RPC submit pesanan meja oleh pelanggan web:
--    - Memvalidasi store_id di server
--    - Mengambil harga satuan (selling_price) langsung dari tabel products (anti-manipulasi harga)
--    - Memaksa status awal selalu 'pending'
create or replace function public.submit_public_table_order(
  p_store_id uuid,
  p_table_number text,
  p_customer_name text,
  p_customer_phone text default '',
  p_payment_method text default 'cash_cashier',
  p_payment_proof_url text default null,
  p_items jsonb default '[]'::jsonb,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_exists boolean;
  v_item jsonb;
  v_prod record;
  v_qty integer;
  v_total integer := 0;
  v_clean_items jsonb := '[]'::jsonb;
  v_method text := case when p_payment_method = 'qris' then 'qris' else 'cash_cashier' end;
  v_order public.table_orders%rowtype;
begin
  if p_store_id is null then
    raise exception 'store_required';
  end if;
  if nullif(trim(coalesce(p_customer_name, '')), '') is null then
    raise exception 'customer_name_required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_required';
  end if;

  select exists(select 1 from public.stores where id = p_store_id) into v_store_exists;
  if not v_store_exists then
    raise exception 'store_not_found';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := coalesce((v_item->>'quantity')::integer, 0);
    if v_qty <= 0 then
      raise exception 'invalid_quantity';
    end if;

    select id, product_name, selling_price into v_prod
    from public.products
    where id::text = coalesce(v_item->>'product_id', '')
      and store_id = p_store_id;

    if not found then
      raise exception 'product_not_found';
    end if;

    v_total := v_total + (coalesce(v_prod.selling_price, 0) * v_qty);
    v_clean_items := v_clean_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_prod.id,
        'name', v_prod.product_name,
        'price', v_prod.selling_price,
        'quantity', v_qty,
        'notes', trim(coalesce(v_item->>'notes', ''))
      )
    );
  end loop;

  insert into public.table_orders (
    store_id,
    table_number,
    customer_name,
    customer_phone,
    total_amount,
    payment_method,
    payment_proof_url,
    status,
    items,
    notes
  )
  values (
    p_store_id,
    coalesce(nullif(trim(p_table_number), ''), '1'),
    trim(p_customer_name),
    trim(coalesce(p_customer_phone, '')),
    v_total,
    v_method,
    nullif(trim(coalesce(p_payment_proof_url, '')), ''),
    'pending',
    v_clean_items,
    trim(coalesce(p_notes, ''))
  )
  returning * into v_order;

  return jsonb_build_object(
    'id', v_order.id,
    'store_id', v_order.store_id,
    'table_number', v_order.table_number,
    'customer_name', v_order.customer_name,
    'total_amount', v_order.total_amount,
    'payment_method', v_order.payment_method,
    'status', v_order.status,
    'items', v_order.items,
    'created_at', v_order.created_at
  );
end;
$$;

grant execute on function public.submit_public_table_order(uuid, text, text, text, text, text, jsonb, text) to anon, authenticated;

-- 4. RPC atur & verifikasi PIN keamanan toko berbasis SHA-256
create or replace function public.set_store_security_pin(
  p_pin_hash text default null,
  p_legacy_pin text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id();
begin
  if v_store is null then
    raise exception 'not_registered';
  end if;

  update public.stores
  set security_pin_hash = nullif(trim(coalesce(p_pin_hash, '')), ''),
      security_pin = case
        when p_pin_hash is null or trim(p_pin_hash) = '' then null
        when p_legacy_pin is not null then nullif(trim(p_legacy_pin), '')
        else security_pin
      end
  where id = v_store;

  return true;
end;
$$;

grant execute on function public.set_store_security_pin(text, text) to authenticated;

create or replace function public.verify_store_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid := public.current_store_id();
  v_hash text;
  v_legacy text;
  v_expected text;
begin
  if v_store is null then
    return false;
  end if;

  select security_pin_hash, security_pin into v_hash, v_legacy
  from public.stores
  where id = v_store;

  if (v_hash is null or trim(v_hash) = '') and (v_legacy is null or trim(v_legacy) = '') then
    return true;
  end if;

  v_expected := encode(sha256((v_store::text || ':' || coalesce(p_pin, ''))::bytea), 'hex');
  if v_hash is not null and trim(v_hash) <> '' then
    return v_hash = v_expected;
  end if;

  return coalesce(v_legacy, '') = coalesce(p_pin, '');
end;
$$;

grant execute on function public.verify_store_pin(text) to authenticated;
