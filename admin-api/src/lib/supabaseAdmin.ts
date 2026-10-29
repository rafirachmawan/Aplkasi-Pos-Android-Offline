import { createClient } from '@supabase/supabase-js'
import { env } from '../env'

const REQUEST_TIMEOUT_MS = 15_000

const fetchWithTimeout: typeof fetch = (input, init) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

/**
 * Client server-side memakai service_role sehingga melewati RLS.
 * Kunci ini tidak pernah dikirim ke browser dan seluruh route bersifat read-only.
 */
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    fetch: fetchWithTimeout,
  },
  db: {
    schema: 'public',
  },
})
