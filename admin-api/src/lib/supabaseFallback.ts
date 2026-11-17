import { parseJakartaDateKey } from './dates'
import { HttpError } from './errors'

export interface SupabaseErrorLike {
  code?: string | null
  message?: string | null
}

/** Mendeteksi tabel opsional yang belum dibuat pada project Supabase lama. */
export function isMissingTableError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  const msg = String(error.message ?? '').toLowerCase()
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    (msg.includes('does not exist') && msg.includes('relation')) ||
    msg.includes('could not find the table')
  )
}

/** Mendeteksi kolom opsional yang belum dimigrasi pada project Supabase lama. */
export function isMissingColumnError(error: SupabaseErrorLike | null | undefined): boolean {
  if (!error) return false
  const code = String(error.code ?? '')
  const msg = String(error.message ?? '').toLowerCase()
  return code === '42703' || code === 'PGRST204' || msg.includes('column')
}

export function sanitizeSearchKeyword(keyword: string): string {
  return keyword.replace(/[,()%]/g, ' ').trim()
}

export function buildJakartaDateRange(
  from?: string,
  to?: string,
): { fromIso?: string; toIso?: string } {
  let fromIso: string | undefined
  let toIso: string | undefined

  if (from) {
    const start = parseJakartaDateKey(from)
    if (!start) throw new HttpError(400, 'Parameter from harus berformat YYYY-MM-DD.')
    fromIso = start.toISOString()
  }

  if (to) {
    const end = parseJakartaDateKey(to)
    if (!end) throw new HttpError(400, 'Parameter to harus berformat YYYY-MM-DD.')
    end.setUTCDate(end.getUTCDate() + 1)
    toIso = end.toISOString()
  }

  return { fromIso, toIso }
}
