import { delay, stores } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import type { Plan, SubscriptionRow } from '@/types/domain'

export interface SubscriptionQuery {
  search?: string
  plan?: Plan | 'all'
}

export interface ActivatePlanInput {
  storeId: string
  days: number
  note?: string
}

export interface ResetPlanInput {
  storeId: string
  note?: string
}

const DAY_MS = 86_400_000

/**
 * Baris langganan mode mock: seluruh toko diangkat dari dataset mock,
 * sehingga tampilan halaman tetap teruji tanpa backend.
 */
const mockSubscriptions = (): SubscriptionRow[] =>
  stores.map((store) => ({
    storeId: store.id,
    storeName: store.storeName,
    username: store.username,
    plan: 'free' as Plan,
    planStartedAt: null,
    planExpiresAt: null,
    updatedAt: store.createdAt,
    updatedBy: '',
    daysRemaining: null,
  }))

export async function fetchSubscriptions({
  search = '',
  plan = 'all',
}: SubscriptionQuery = {}): Promise<SubscriptionRow[]> {
  if (env.isApi) {
    const params = new URLSearchParams({ plan })
    if (search.trim()) params.set('search', search.trim())

    return apiRequest<SubscriptionRow[]>(`/api/subscriptions?${params.toString()}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(260)

  const keyword = search.trim().toLowerCase()

  return mockSubscriptions().filter((row) => {
    const matchKeyword =
      !keyword ||
      row.storeName.toLowerCase().includes(keyword) ||
      row.username.toLowerCase().includes(keyword)
    const matchPlan = plan === 'all' || row.plan === plan
    return matchKeyword && matchPlan
  })
}

/**
 * Aktifkan atau perpanjang Pro.
 * Mode mock menghitung sendiri mundur 30/90/180/365 hari dari sekarang.
 */
export async function activatePlan({
  storeId,
  days,
  note = '',
}: ActivatePlanInput): Promise<SubscriptionRow> {
  if (env.isApi) {
    return apiRequest<SubscriptionRow>(`/api/stores/${encodeURIComponent(storeId)}/plan`, {
      method: 'POST',
      body: { days, note },
    })
  }

  if (!env.isMock) supabaseNotReady()
  await delay(420)

  const row = mockSubscriptions().find((item) => item.storeId === storeId)
  if (!row) throw new Error('Toko tidak ditemukan.')

  const now = new Date()
  return {
    ...row,
    plan: 'pro',
    planStartedAt: now.toISOString(),
    planExpiresAt: new Date(now.getTime() + days * DAY_MS).toISOString(),
    updatedAt: now.toISOString(),
    updatedBy: 'admin',
    daysRemaining: days,
  }
}

/** Kembalikan toko ke tier Gratis. Data toko tidak disentuh. */
export async function resetPlan({ storeId, note = '' }: ResetPlanInput): Promise<SubscriptionRow> {
  if (env.isApi) {
    return apiRequest<SubscriptionRow>(`/api/stores/${encodeURIComponent(storeId)}/plan`, {
      method: 'DELETE',
      body: { note },
    })
  }

  if (!env.isMock) supabaseNotReady()
  await delay(380)

  const row = mockSubscriptions().find((item) => item.storeId === storeId)
  if (!row) throw new Error('Toko tidak ditemukan.')

  return {
    ...row,
    plan: 'free',
    planStartedAt: null,
    planExpiresAt: null,
    updatedAt: new Date().toISOString(),
    updatedBy: 'admin',
    daysRemaining: null,
  }
}
