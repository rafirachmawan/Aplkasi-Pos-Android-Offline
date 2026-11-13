-- =====================================================================
-- Migrasi v9: Tier Langganan — GRATIS & PRO (SaaS manual)
--
-- JAMINAN KEAMANAN DATA (ADD-ONLY):
-- 1. Tidak ada DROP TABLE, DROP COLUMN, RENAME, TRUNCATE, atau UPDATE
--    pada tabel yang sudah ada (stores, profiles, products, transactions,
--    transaction_details, invoice_counters, app_licenses, customer_debts,
--    debt_payments, cashier_shifts, shift_expenses, dll).
-- 2. Hanya MENAMBAH 2 tabel baru (store_subscriptions, subscription_audit_log),
--    3 fungsi baru, dan 2 trigger baru (1 pada `stores`, 1 pada tabel baru).
--    Trigger pada `stores` HANYA menambah baris di tabel BARU, tidak
--    mengubah satu pun nilai pada tabel `stores`.
-- 3. Semua toko yang sudah ada otomatis berstatus 'free' (gratis).
--    TIDAK ADA toko yang tiba-tiba menjadi 'pro'.
-- 4. Aman dijalankan berulang kali (IF NOT EXISTS / ON CONFLICT DO NOTHING).
--
-- TIDAK MENYENTUH HAK KLIEN LAMA:
--   Tabel `app_licenses` TETAP ADA dan tidak diubah. Fungsinya sebagai
--   pemberi hak dinonaktifkan dari sisi APLIKASI (licenseService.js),
--   bukan dari sisi database. Riwayat lisensi lama tetap terbaca.
--
-- URUTAN RILIS:
--   1. Backup database.
--   2. Jalankan file ini di project Supabase DUMMY terlebih dahulu.
--   3. Jalankan pemeriksaan di Bagian 10 (verifikasi tidak ada yang 'pro').
--   4. Jalankan di production (jam sepi).
--   5. Rilis admin-api + admin-web.
--   6. Baru kirim APK/OTA versi tier.
--
-- CARA PAKAI:
--   Supabase Dashboard -> SQL Editor -> Paste seluruh isi file ini -> Run.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABEL LANGGANAN PER TOKO
--    1 baris per toko. Menyimpan tier (free/pro) dan masa aktif Pro.
-- ---------------------------------------------------------------------
create table if not exists public.store_subscriptions (
  store_id          uuid primary key references public.stores (id) on delete cascade,
  plan              text not null default 'free',
  plan_started_at   timestamptz,
  plan_expires_at   timestamptz,
  updated_at        timestamptz not null default now(),
  updated_by        text not null default '',
  constraint store_subscriptions_plan_check
    check (plan in ('free', 'pro')),
  -- Konsistensi: tier 'free' tidak boleh punya tanggal masa aktif.
  constraint store_subscriptions_free_dates_check
    check (plan <> 'free' or (plan_started_at is null and plan_expires_at is null)),
  -- Tier 'pro' wajib punya tanggal berakhir (hitung mundur bulanan).
  constraint store_subscriptions_pro_expiry_check
    check (plan <> 'pro' or plan_expires_at is not null)
);

comment on table public.store_subscriptions is
  'Langganan per toko: free | pro. Diubah hanya oleh service_role (admin-api), tidak pernah dari aplikasi kasir.';

comment on column public.store_subscriptions.plan is
  'free = tier Gratis. pro = tier Pro aktif sampai plan_expires_at.';

comment on column public.store_subscriptions.plan_started_at is
  'Tanggal mulai masa aktif Pro (dihitung saat aktivasi/perpanjangan).';

comment on column public.store_subscriptions.plan_expires_at is
  'Tanggal berakhir masa aktif Pro. Setelah lewat waktu ini, tier efektif kembali ke free.';

comment on column public.store_subscriptions.updated_by is
  'Catatan pelaku perubahan plan, mis. "admin: aktivasi 30 hari".';

-- Index untuk pencarian & filter di halaman Langganan
create index if not exists store_subscriptions_plan_idx
  on public.store_subscriptions (plan);

create index if not exists store_subscriptions_expires_idx
  on public.store_subscriptions (plan_expires_at)
  where plan_expires_at is not null;


-- ---------------------------------------------------------------------
-- 2. OTOMATIS updated_at
-- ---------------------------------------------------------------------
drop trigger if exists store_subscriptions_updated_at on public.store_subscriptions;
create trigger store_subscriptions_updated_at
  before update on public.store_subscriptions
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 3. BACKFILL: semua toko yang sudah ada mendapat baris 'free'.
--    Ini MENAMBAH baris baru di tabel BARU. Tidak ada data lama yang
--    diubah, dipindah, atau dihapus.
--    ON CONFLICT DO NOTHING -> aman dijalankan berulang kali.
-- ---------------------------------------------------------------------
insert into public.store_subscriptions (store_id, plan, updated_by)
select s.id, 'free', 'backfill migrasi v9'
from public.stores s
where not exists (
  select 1 from public.store_subscriptions ss where ss.store_id = s.id
)
on conflict (store_id) do nothing;


-- ---------------------------------------------------------------------
-- 4. TOKO BARU otomatis mendapat baris 'free'.
--    Trigger ini HANYA INSERT ke tabel BARU (store_subscriptions).
--    Tidak mengubah satu pun nilai pada tabel `stores`.
-- ---------------------------------------------------------------------
create or replace function public.fn_store_subscription_default()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.store_subscriptions (store_id, plan, updated_by)
  values (new.id, 'free', 'otomatis: toko baru')
  on conflict (store_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stores_subscription_default on public.stores;
create trigger stores_subscription_default
  after insert on public.stores
  for each row execute function public.fn_store_subscription_default();


-- ---------------------------------------------------------------------
-- 5. RLS
--    Aplikasi kasir: HANYA boleh MEMBACA baris miliknya sendiri.
--    TIDAK ADA policy insert/update/delete untuk `authenticated`,
--    sehingga klien TIDAK BISA menaikkan tier-nya sendiri ke 'pro'.
--    Perubahan plan hanya lewat service_role (admin-api).
-- ---------------------------------------------------------------------
alter table public.store_subscriptions enable row level security;

drop policy if exists "store_subscriptions_select_own"
  on public.store_subscriptions;

create policy "store_subscriptions_select_own"
  on public.store_subscriptions for select
  to authenticated
  using (store_id = public.current_store_id());


-- ---------------------------------------------------------------------
-- 6. AUDIT LOG AKTIVASI
--    Mencatat setiap perubahan plan (nilai sebelum/sesudah).
-- ---------------------------------------------------------------------
create table if not exists public.subscription_audit_log (
  id            bigint generated always as identity primary key,
  -- on delete set null, BUKAN cascade: riwayat aktivasi/pembayaran
  -- harus tetap ada walaupun baris toko dihapus.
  store_id      uuid references public.stores (id) on delete set null,
  action        text not null,          -- 'activate' | 'extend' | 'downgrade'
  plan_before   text not null default '',
  plan_after    text not null default '',
  expires_before timestamptz,
  expires_after  timestamptz,
  actor         text not null default '',
  note          text default '',
  created_at    timestamptz not null default now()
);

comment on table public.subscription_audit_log is
  'Riwayat perubahan langganan. Dibaca hanya oleh service_role.';

-- RLS aktif TANPA policy -> hanya service_role yang bisa membaca.
alter table public.subscription_audit_log enable row level security;

create index if not exists subscription_audit_log_store_idx
  on public.subscription_audit_log (store_id, created_at desc);


-- ---------------------------------------------------------------------
-- 7. FUNGSI AKTIVASI / PERPANJANGAN PRO
--    Aturan durasi (selaras PLAN_OPSI_C.md bagian 6.3):
--      plan_started_at = greatest(now(), plan_expires_at) saat masih pro
--                      = now()                          saat gratis
--      plan_expires_at = plan_started_at + p_days hari
--    -> Membayar telat TIDAK memotong masa aktif yang sudah berjalan.
--    Hanya service_role yang boleh memanggil (lihat revoke di bawah).
-- ---------------------------------------------------------------------
create or replace function public.admin_set_store_plan(
  p_store_id uuid,
  p_days integer default 30,
  p_actor text default '',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_started timestamptz;
  v_expires timestamptz;
  v_action text;
begin
  if p_store_id is null then
    raise exception 'store_required';
  end if;

  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'invalid_days';
  end if;

  select plan, plan_started_at, plan_expires_at
    into v_row
  from public.store_subscriptions
  where store_id = p_store_id
  for update;

  if not found then
    raise exception 'subscription_not_found';
  end if;

  if v_row.plan = 'pro' and v_row.plan_expires_at is not null
     and v_row.plan_expires_at > now() then
    -- Perpanjangan: lanjutkan dari tanggal berakhir yang masih berjaku.
    v_started := v_row.plan_expires_at;
    v_action  := 'extend';
  else
    -- Aktivasi baru (atau setelah kedaluwarsa).
    v_started := now();
    v_action  := 'activate';
  end if;

  v_expires := v_started + make_interval(days => p_days);

  update public.store_subscriptions
  set plan              = 'pro',
      plan_started_at   = v_started,
      plan_expires_at   = v_expires,
      updated_by        = coalesce(nullif(trim(p_actor), ''), 'admin')
  where store_id = p_store_id;

  insert into public.subscription_audit_log (
    store_id, action, plan_before, plan_after,
    expires_before, expires_after, actor, note
  ) values (
    p_store_id, v_action, v_row.plan, 'pro',
    v_row.plan_expires_at, v_expires,
    coalesce(nullif(trim(p_actor), ''), 'admin'),
    coalesce(trim(p_note), '')
  );

  return jsonb_build_object(
    'store_id', p_store_id,
    'plan', 'pro',
    'plan_started_at', v_started,
    'plan_expires_at', v_expires,
    'days', p_days,
    'action', v_action
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 8. FUNGSI KEMBALI KE GRATIS
--    Hanya mengubah baris di store_subscriptions + menulis audit log.
--    DATA TOKO (produk, transaksi, kasbon, shift) TIDAK DISENTUH.
-- ---------------------------------------------------------------------
create or replace function public.admin_reset_store_plan(
  p_store_id uuid,
  p_actor text default '',
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  if p_store_id is null then
    raise exception 'store_required';
  end if;

  select plan, plan_started_at, plan_expires_at
    into v_row
  from public.store_subscriptions
  where store_id = p_store_id
  for update;

  if not found then
    raise exception 'subscription_not_found';
  end if;

  update public.store_subscriptions
  set plan              = 'free',
      plan_started_at   = null,
      plan_expires_at   = null,
      updated_by        = coalesce(nullif(trim(p_actor), ''), 'admin')
  where store_id = p_store_id;

  insert into public.subscription_audit_log (
    store_id, action, plan_before, plan_after,
    expires_before, expires_after, actor, note
  ) values (
    p_store_id, 'downgrade', v_row.plan, 'free',
    v_row.plan_expires_at, null,
    coalesce(nullif(trim(p_actor), ''), 'admin'),
    coalesce(trim(p_note), '')
  );

  return jsonb_build_object(
    'store_id', p_store_id,
    'plan', 'free',
    'plan_started_at', null,
    'plan_expires_at', null
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 9. HAK PANGGIL FUNGSI
--    Dicabut dari public, anon, dan authenticated.
--    -> Aplikasi kasir TIDAK BISA mengubah plan miliknya sendiri.
--    -> Hanya service_role (admin-api) yang bisa.
-- ---------------------------------------------------------------------
revoke execute on function public.admin_set_store_plan(uuid, integer, text, text)
  from public, anon, authenticated;

revoke execute on function public.admin_reset_store_plan(uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.admin_set_store_plan(uuid, integer, text, text)
  to service_role;

grant execute on function public.admin_reset_store_plan(uuid, text, text)
  to service_role;


-- =====================================================================
-- 10. VERIFIKASI (jalankan terpisah setelah migrasi)
-- =====================================================================
-- 6a. Semua toko harus berstatus 'free'. KOLOM INI HARUS KOSONG:
--     select s.store_name, ss.plan, ss.plan_expires_at
--     from public.stores s
--     left join public.store_subscriptions ss on ss.store_id = s.id
--     order by s.store_name;
--
--     Catatan: jika muncul baris dengan plan = 'pro' yang TIDAK kamu
--     aktifkan sendiri, JANGAN lanjut rilis. Periksa dulu.
--
-- 6b. Tidak boleh ada toko tanpa baris langganan:
--     select s.id, s.store_name
--     from public.stores s
--     left join public.store_subscriptions ss on ss.store_id = s.id
--     where ss.store_id is null;
--     (harus 0 baris)
--
-- 6c. Data lama utuh — jumlah baris tidak boleh berubah:
--     select 'stores' t, count(*) from public.stores
--     union all select 'products', count(*) from public.products
--     union all select 'transactions', count(*) from public.transactions
--     union all select 'transaction_details', count(*) from public.transaction_details
--     union all select 'app_licenses', count(*) from public.app_licenses
--     union all select 'customer_debts', count(*) from public.customer_debts
--     union all select 'cashier_shifts', count(*) from public.cashier_shifts;
--     (bandingkan angkanya dengan SEBELUM migrasi dijalankan)
--
-- 6d. Uji RLS: login sebagai toko, coba ubah plan sendiri (harus gagal):
--     update public.store_subscriptions set plan = 'pro';
--     (harus 0 baris terpengaruh / ditolak)
--
-- 6e. Uji fungsi (dari SQL Editor, sebagai service_role):
--     select public.admin_set_store_plan('<store-uuid>', 30, 'admin', 'uji');
--     select public.admin_reset_store_plan('<store-uuid>', 'admin', 'uji');
--     -- Kembalikan ke kondisi awal. PERHATIKAN: jalankan ini hanya untuk
--     -- toko UJI. Untuk toko yang plan-nya memang harus 'free',
--     -- barisnya akan kembali persis seperti sebelum uji:
--     --     update public.store_subscriptions
--     --     set plan = 'free', plan_started_at = null, plan_expires_at = null,
--     --         updated_by = 'backfill migrasi v9'
--     --     where store_id = '<store-uuid-uji>';
--     -- Hapus jejak audit uji (hanya baris dengan note 'uji'):
--     delete from public.subscription_audit_log where note = 'uji';
--     -- JANGAN: delete from public.store_subscriptions ... tanpa filter toko,
--     -- karena itu bisa menghapus baris langganan toko yang asli.
-- =====================================================================
