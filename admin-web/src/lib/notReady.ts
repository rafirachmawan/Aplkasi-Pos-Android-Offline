/** Fase integrasi Supabase (Opsi C) belum diaktifkan; lihat admin-api/docs/PLAN_OPSI_C.md. */
export function supabaseNotReady(): never {
  throw new Error(
    'Mode Supabase belum diaktifkan. Gunakan VITE_DATA_MODE=mock, atau VITE_DATA_MODE=api dengan admin-api lokal.',
  )
}
