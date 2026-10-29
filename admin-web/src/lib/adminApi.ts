import { env } from './env'

const TOKEN_KEY = 'marketpos.admin.apiToken'
const REQUEST_TIMEOUT_MS = 20_000

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getStoredApiToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredApiToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredApiToken(): void {
  window.localStorage.removeItem(TOKEN_KEY)
}

interface RequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  auth?: boolean
}

interface ErrorPayload {
  error?: unknown
}

/**
 * Memanggil backend lokal. Token tidak pernah ditulis di bundle; nilainya
 * didapat dari respons login dan disimpan di localStorage.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {}
  const auth = options.auth ?? true

  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getStoredApiToken()
    if (token) headers['x-api-token'] = token
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    })

    const text = await response.text()
    let payload: unknown = null

    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = null
      }
    }

    if (!response.ok) {
      const message =
        payload && typeof payload === 'object' && 'error' in payload
          ? String((payload as ErrorPayload).error)
          : `Permintaan gagal (${response.status}).`
      throw new ApiError(message, response.status)
    }

    return payload as T
  } catch (error) {
    if (error instanceof ApiError) throw error

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError('Server lokal tidak merespons. Coba lagi.', 0)
    }

    throw new ApiError(
      'Tidak bisa menghubungi admin-api. Pastikan server lokal berjalan (npm run dev di folder admin-api).',
      0,
    )
  } finally {
    clearTimeout(timer)
  }
}
