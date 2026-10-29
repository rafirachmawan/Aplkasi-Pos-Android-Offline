export type DataMode = 'mock' | 'api' | 'supabase'

const rawMode = import.meta.env.VITE_DATA_MODE
const mode: DataMode = rawMode === 'supabase' ? 'supabase' : rawMode === 'api' ? 'api' : 'mock'

export const env = {
  dataMode: mode,
  isMock: mode === 'mock',
  isApi: mode === 'api',
  isSupabase: mode === 'supabase',
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, ''),
  /**
   * Opsi B hanya membaca data. Aksi tulis lisensi baru aktif setelah
   * migrasi Opsi C (Supabase + role super_admin).
   */
  canManageLicenses: mode !== 'api',
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
} as const

export const DATA_MODE_LABEL: Record<DataMode, string> = {
  mock: 'Mock',
  api: 'API lokal',
  supabase: 'Supabase',
}

export function assertSupabaseConfigured(): void {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error(
      'Mode Supabase belum siap. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di .env.local.',
    )
  }
}
