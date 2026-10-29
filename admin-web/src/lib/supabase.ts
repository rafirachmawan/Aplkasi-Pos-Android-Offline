import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/db'
import { env } from './env'

/**
 * Client Supabase untuk admin.
 * Hanya memakai anon key — keamanan data dijaga oleh RLS, bukan oleh kode frontend.
 * Nilainya null selama aplikasi berjalan di mode mock.
 */
export const supabase: SupabaseClient<Database> | null =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null
