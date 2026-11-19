-- =====================================================================
-- Migrasi v13 (ADD-ONLY / AMAN UNTUK SEMUA KLIEN YANG SEDANG BERJALAN):
-- Sinkronisasi Pengaturan "Menu yang Dikunci PIN" (locked_menus) per Toko
--
-- JAMINAN KOMPATIBILITAS:
-- 1. ADD-ONLY: Menambahkan kolom nullable `locked_menus jsonb` pada `public.stores`.
--    Data toko dan APK lama tetap berjalan normal tanpa gangguan.
-- 2. Bila `locked_menus` bernilai NULL, aplikasi tetap menggunakan perilaku lama
--    (preferensi lokal HP atau default bawaan aplikasi).
-- 3. Setelah user mengubah sakelar menu pada aplikasi baru, konfigurasi tersimpan
--    di server dan otomatis sama di semua HP/emulator yang memakai akun toko yang sama.
-- =====================================================================

alter table public.stores
  add column if not exists locked_menus jsonb default null;

create or replace function public.set_store_locked_menus(
  p_locked_menus jsonb default null
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

  if p_locked_menus is not null and jsonb_typeof(p_locked_menus) <> 'object' then
    raise exception 'invalid_locked_menus';
  end if;

  update public.stores
  set locked_menus = p_locked_menus
  where id = v_store;

  return true;
end;
$$;

grant execute on function public.set_store_locked_menus(jsonb) to authenticated;
