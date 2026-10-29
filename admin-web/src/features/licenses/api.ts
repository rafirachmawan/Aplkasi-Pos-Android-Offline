import { delay, licenses } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import type { LicenseRow, LicenseStatus } from '@/types/domain'

export interface LicenseQuery {
  search?: string
  status?: LicenseStatus | 'all'
}

export type LicenseAction = 'extend' | 'revoke'

export interface LicenseActionInput {
  deviceId: string
  action: LicenseAction
  days?: number
}

export async function fetchLicenses({
  search = '',
  status = 'all',
}: LicenseQuery): Promise<LicenseRow[]> {
  if (env.isApi) {
    const params = new URLSearchParams({ status })
    if (search.trim()) params.set('search', search.trim())

    return apiRequest<LicenseRow[]>(`/api/licenses?${params.toString()}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(260)

  const keyword = search.trim().toLowerCase()

  return licenses
    .filter((row) => {
      const matchKeyword =
        !keyword ||
        row.deviceId.toLowerCase().includes(keyword) ||
        row.storeName.toLowerCase().includes(keyword)
      const matchStatus = status === 'all' || row.status === status
      return matchKeyword && matchStatus
    })
    .map((row) => ({ ...row }))
}

export async function applyLicenseAction({
  deviceId,
  action,
  days = 30,
}: LicenseActionInput): Promise<LicenseRow> {
  if (env.isApi) {
    throw new Error(
      'Mode Opsi B bersifat baca. Perpanjang/cabut lisensi baru tersedia setelah migrasi Opsi C.',
    )
  }

  if (!env.isMock) supabaseNotReady()
  await delay(420)

  const row = licenses.find((item) => item.deviceId === deviceId)
  if (!row) throw new Error('Perangkat tidak ditemukan.')

  if (action === 'extend') {
    row.status = 'active'
    row.expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
    row.notes = `Diperpanjang ${days} hari dari admin console`
  } else {
    row.status = 'revoked'
    row.notes = 'Dicabut dari admin console'
  }

  return { ...row }
}
