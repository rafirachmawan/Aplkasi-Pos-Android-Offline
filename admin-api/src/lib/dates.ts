const DAY_MS = 86_400_000
/** WIB tidak memakai daylight saving, jadi offset tetap aman. */
const JAKARTA_OFFSET_MS = 7 * 3_600_000

/** Awal hari menurut Asia/Jakarta, dikembalikan sebagai Date UTC. */
export function startOfJakartaDay(base = new Date(), offsetDays = 0): Date {
  const shifted = new Date(base.getTime() + JAKARTA_OFFSET_MS)
  shifted.setUTCHours(0, 0, 0, 0)
  return new Date(shifted.getTime() - JAKARTA_OFFSET_MS + offsetDays * DAY_MS)
}

/** Kunci tanggal YYYY-MM-DD menurut Asia/Jakarta. */
export function jakartaDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? ''

  return `${pick('year')}-${pick('month')}-${pick('day')}`
}

/** YYYY-MM-DD -> awal hari WIB. Null bila format tidak valid. */
export function parseJakartaDateKey(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  const date = new Date(`${value}T00:00:00+07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

export { DAY_MS }
