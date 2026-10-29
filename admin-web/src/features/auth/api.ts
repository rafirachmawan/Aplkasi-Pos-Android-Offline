import { apiRequest, clearStoredApiToken, getStoredApiToken, setStoredApiToken } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'

export interface AdminSession {
  name: string
  username: string
  role: 'super_admin'
  loggedInAt: string
}

export interface SignInInput {
  username: string
  password: string
}

const SESSION_KEY = 'marketpos.admin.session'

/** Kredensial demo untuk localhost. Hanya dipakai saat mode mock. */
const DEMO_ACCOUNT = {
  username: 'admin',
  password: 'admin123',
  name: 'Super Admin',
}

export function readSession(): AdminSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AdminSession>
    if (parsed.role !== 'super_admin' || !parsed.username) return null

    // Sesi API hanya valid bila token untuk server yang sedang berjalan ada.
    if (env.isApi && !getStoredApiToken()) return null

    return {
      name: parsed.name ?? 'Super Admin',
      username: parsed.username,
      role: 'super_admin',
      loggedInAt: parsed.loggedInAt ?? new Date().toISOString(),
    }
  } catch {
    return null
  }
}

function persistSession(session: AdminSession): void {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

function clearSession(): void {
  window.localStorage.removeItem(SESSION_KEY)
}

export async function signIn(input: SignInInput): Promise<AdminSession> {
  if (env.isApi) {
    const result = await apiRequest<{ token: string; session: AdminSession }>('/api/auth/login', {
      method: 'POST',
      body: { username: input.username.trim(), password: input.password },
      auth: false,
    })

    setStoredApiToken(result.token)
    persistSession(result.session)
    return result.session
  }

  if (env.isSupabase) supabaseNotReady()

  await new Promise((resolve) => setTimeout(resolve, 350))

  const username = input.username.trim().toLowerCase()
  if (username !== DEMO_ACCOUNT.username || input.password !== DEMO_ACCOUNT.password) {
    throw new Error('Username atau password salah.')
  }

  const session: AdminSession = {
    name: DEMO_ACCOUNT.name,
    username: DEMO_ACCOUNT.username,
    role: 'super_admin',
    loggedInAt: new Date().toISOString(),
  }

  persistSession(session)
  return session
}

export async function signOut(): Promise<void> {
  clearSession()
  clearStoredApiToken()
}

/**
 * Memastikan sesi tersimpan masih diterima server. Token admin-api dibuat
 * ulang setiap server restart, sehingga sesi lama bisa menjadi tidak valid.
 */
export async function validateSession(): Promise<AdminSession | null> {
  const stored = readSession()
  if (!stored) return null
  if (!env.isApi) return stored

  try {
    const result = await apiRequest<{ session: AdminSession }>('/api/auth/session')
    persistSession(result.session)
    return result.session
  } catch {
    clearSession()
    clearStoredApiToken()
    return null
  }
}
