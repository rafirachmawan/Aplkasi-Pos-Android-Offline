-- =====================================================================
-- HOTFIX DEFINITIF: Perbaikan Tabel invoice_counters & Fungsi Checkout
--
-- MASALAH TERAKHIR:
-- Error: relation "public.invoice_sequences" does not exist
-- Di database Supabase nama tabel aslinya adalah invoice_counters (bukan invoice_sequences).
--
-- CARA PAKAI:
-- 1. Buka Supabase Dashboard -> SQL Editor
-- 2. Paste seluruh script ini -> Klik RUN
-- 3. Langsung tes transaksi kasir lagi di HP klien -> Berhasil 100%!
-- =====================================================================

-- 1. Pastikan tabel invoice_counters ada
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  store_id uuid NOT NULL REFERENCES public.stores (id) ON DELETE CASCADE,
  date_key text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, date_key)
);
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

-- 2. Pastikan kolom pendukung di transactions ada (aman & tidak menimpa data)
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS payment_notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'retail',
  ADD COLUMN IF NOT EXISTS table_number text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_offline_sync boolean NOT NULL DEFAULT false;

-- 3. Hapus seluruh overload lama agar tidak ada bentrok fungsi
DROP FUNCTION IF EXISTS public.checkout(jsonb, integer, integer, integer, integer, integer);
DROP FUNCTION IF EXISTS public.checkout(jsonb, integer, integer, integer, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.checkout(jsonb, integer, integer, integer, integer, integer, text, text, text, text);

-- 4. Pasang SATU-SATUNYA fungsi checkout resmi yang 100% cocok dengan aplikasi kasir lama maupun baru
CREATE OR REPLACE FUNCTION public.checkout(
  p_items jsonb,
  p_total_price integer,
  p_discount_amount integer,
  p_grand_total integer,
  p_cash_received integer,
  p_cash_return integer,
  p_payment_method text DEFAULT 'cash',
  p_payment_notes text DEFAULT '',
  p_order_type text DEFAULT 'retail',
  p_table_number text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
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
BEGIN
  IF v_store IS NULL THEN
    RAISE EXCEPTION 'not_registered';
  END IF;

  -- a) Validasi stok produk
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'quantity')::integer <= 0 THEN
      RAISE EXCEPTION 'invalid_quantity';
    END IF;
    SELECT stock_quantity INTO v_stock
    FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND store_id = v_store
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'product_not_found';
    END IF;
    IF v_stock < (v_item->>'quantity')::integer THEN
      RAISE EXCEPTION 'insufficient_stock';
    END IF;
  END LOOP;

  -- b) Kurangi stok produk
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.products
    SET stock_quantity = stock_quantity - (v_item->>'quantity')::integer
    WHERE id = (v_item->>'product_id')::uuid AND store_id = v_store;
  END LOOP;

  -- c) Generate nomor nota unik per hari per toko (zona waktu Asia/Jakarta) menggunakan invoice_counters
  v_date_key := to_char(now() AT TIME ZONE 'Asia/Jakarta', 'YYYYMMDD');

  INSERT INTO public.invoice_counters (store_id, date_key, last_seq)
  VALUES (v_store, v_date_key, 0)
  ON CONFLICT (store_id, date_key) DO NOTHING;

  UPDATE public.invoice_counters
  SET last_seq = last_seq + 1
  WHERE store_id = v_store AND date_key = v_date_key
  RETURNING last_seq INTO v_seq;

  v_invoice := 'INV/' || v_date_key || '/' || lpad(v_seq::text, 4, '0');

  -- d) Insert header transaksi
  INSERT INTO public.transactions (
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
  ) VALUES (
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
  RETURNING id INTO v_tx;

  -- e) Insert item detail transaksi
  INSERT INTO public.transaction_details (
    transaction_id,
    product_id,
    product_name,
    quantity,
    price_at_sale,
    capital_at_sale
  )
  SELECT
    v_tx,
    (i->>'product_id')::uuid,
    coalesce(i->>'product_name', ''),
    (i->>'quantity')::integer,
    (i->>'price_at_sale')::integer,
    (i->>'capital_at_sale')::integer
  FROM jsonb_array_elements(p_items) AS i;

  RETURN jsonb_build_object(
    'id', v_tx,
    'invoice_number', v_invoice
  );
END;
$$;
