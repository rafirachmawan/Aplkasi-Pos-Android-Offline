interface ImportMetaEnv {
  readonly VITE_DATA_MODE?: 'mock' | 'api' | 'supabase'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
