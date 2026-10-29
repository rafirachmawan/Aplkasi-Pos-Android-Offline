-- =====================================================================
-- Migrasi v6 (Fase 2): Kasbon / Buku Hutang, Shift Kasir, & Harga Grosir
--
-- JAMINAN BACKWARD COMPATIBILITY:
-- 1. Semua tabel & kolom baru memiliki default value dan constraint aman.
-- 2. Menggunakan "if not exists" di setiap deklarasi sehingga aman
--    dijalankan berulang kali tanpa merusak data yang sudah ada.
-- 3. Aplikasi dilengkapi zero-failure fallback: jika klien belum
--    menjalankan script ini di Supabase, aplikasi otomatis menyimpan data
--    di penyimpanan lokal perangkat (AsyncStorage / SQLite) tanpa error.
--
-- CARA PAKAI:
--   Buka Supabase Dashboard → SQL Editor → Paste seluruh isi file ini → Run.
-- =====================================================================

-- 1. Tambah kolom harga grosir (wholesale_rules) pada tabel products
-- Format JSONB: [{"min_qty": 10, "price": 2800}, {"min_qty": 50, "price": 2500}]
alter table public.products
  add column if not exists wholesale_rules jsonb default '[]'::jsonb;

-- 2. Tabel Buku Kasbon / Hutang Pelanggan (Customer Debts)
create table if not exists public.customer_debts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_name text not null,
  customer_phone text default '',
  transaction_id uuid references public.transactions(id) on delete set null,
  invoice_number text default '',
  total_debt integer not null default 0,
  remaining_debt integer not null default 0,
  due_date date default null,
  notes text default '',
  status text not null default 'unpaid', -- 'unpaid' | 'partially_paid' | 'paid'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indeks performa pencarian kasbon per toko & nama pelanggan
create index if not exists idx_customer_debts_store on public.customer_debts(store_id);
create index if not exists idx_customer_debts_status on public.customer_debts(status);
create index if not exists idx_customer_debts_name on public.customer_debts(customer_name);

-- 3. Tabel Riwayat Pembayaran / Cicilan Kasbon
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  debt_id uuid not null references public.customer_debts(id) on delete cascade,
  payment_amount integer not null,
  payment_method text not null default 'cash',
  notes text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_debt_payments_debt on public.debt_payments(debt_id);

-- 4. Tabel Manajemen Shift Kasir & Rekonsiliasi Uang Laci
create table if not exists public.cashier_shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  cashier_name text not null,
  start_time timestamptz not null default now(),
  end_time timestamptz default null,
  starting_cash integer not null default 0,      -- Modal awal uang kembalian di laci
  expected_cash integer default 0,              -- Modal awal + Tunai Masuk - Kas Keluar
  actual_cash integer default null,             -- Uang fisik dihitung kasir saat tutup shift
  difference integer default 0,                 -- actual - expected (lebih/kurang)
  total_cash_sales integer default 0,           -- Penjualan tunai selama shift
  total_non_cash_sales integer default 0,       -- Penjualan QRIS/TF/Debit selama shift
  total_expenses integer default 0,             -- Total pengeluaran kas kecil
  status text not null default 'open',          -- 'open' | 'closed'
  notes text default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_cashier_shifts_store on public.cashier_shifts(store_id);
create index if not exists idx_cashier_shifts_status on public.cashier_shifts(status);

-- 5. Tabel Pengeluaran Kas Kecil dari Laci (Petty Cash / Operasional Shift)
create table if not exists public.shift_expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  shift_id uuid not null references public.cashier_shifts(id) on delete cascade,
  amount integer not null,
  category text not null default 'operasional', -- 'operasional' | 'belanja' | 'kebersihan' | 'lainnya'
  description text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_shift_expenses_shift on public.shift_expenses(shift_id);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================
alter table public.customer_debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.cashier_shifts enable row level security;
alter table public.shift_expenses enable row level security;

-- Policy Customer Debts
drop policy if exists "Store member can manage debts" on public.customer_debts;
create policy "Store member can manage debts"
  on public.customer_debts for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- Policy Debt Payments
drop policy if exists "Store member can manage debt payments" on public.debt_payments;
create policy "Store member can manage debt payments"
  on public.debt_payments for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- Policy Cashier Shifts
drop policy if exists "Store member can manage shifts" on public.cashier_shifts;
create policy "Store member can manage shifts"
  on public.cashier_shifts for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());

-- Policy Shift Expenses
drop policy if exists "Store member can manage shift expenses" on public.shift_expenses;
create policy "Store member can manage shift expenses"
  on public.shift_expenses for all
  using (store_id = public.current_store_id())
  with check (store_id = public.current_store_id());
