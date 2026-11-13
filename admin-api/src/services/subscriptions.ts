import { HttpError } from '../lib/errors'
import { clearCache } from '../lib/cache'
import { fetchAll } from '../lib/fetchAll'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import type { Plan, ProfileRow, StoreRow, SubscriptionDto, SubscriptionRecord } from '../types'

const MS_PER_DAY = 86_400_000

export interface SubscriptionListQuery {
  search: string
  plan: Plan | 'all'
}

/** Pesan yang menandakan migrasi v9 belum dijalankan. */
function isMigrationMissing(message: string): boolean {
  return (
    message.includes('store_subscriptions') ||
    message.includes('admin_set_store_plan') ||
    message.includes('admin_reset_store_plan') ||
    message.includes('PGRST202')
  )
}

function toPlan(value: string): Plan {
  return value === 'pro' ? 'pro' : 'free'
}

function countDaysRemaining(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  // Dibulatkan ke atas supaya "sisa 1 hari" tidak langsung jadi 0 di tengah hari.
  return Math.max(0, Math.ceil(diff / MS_PER_DAY))
}

/**
 * Daftar langganan seluruh toko, digabung dengan nama toko + username.
 * Baris toko yang belum punya entri di `store_subscriptions` (migrasi v9
 * belum di-backfill) tetap ditampilkan sebagai 'free'.
 */
export async function listSubscriptions({
  search,
  plan,
}: SubscriptionListQuery): Promise<SubscriptionDto[]> {
  const [stores, profiles, subscriptions] = await Promise.all([
    fetchAll<StoreRow>('toko', (from, to) =>
      supabaseAdmin
        .from('stores')
        .select('id, store_name, created_at')
        .order('store_name', { ascending: true })
        .range(from, to),
    ),
    fetchAll<ProfileRow>('profil toko', (from, to) =>
      supabaseAdmin.from('profiles').select('store_id, username').range(from, to),
    ),
    fetchAll<SubscriptionRecord>('langganan', (from, to) =>
      supabaseAdmin
        .from('store_subscriptions')
        .select('store_id, plan, plan_started_at, plan_expires_at, updated_at, updated_by')
        .order('plan', { ascending: false })
        .range(from, to),
    ).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      if (isMigrationMissing(message)) return [] as SubscriptionRecord[]
      throw error
    }),
  ])

  const subscriptionByStore = new Map(
    subscriptions.map((row) => [row.store_id, row] as const),
  )
  const usernameByStore = new Map(
    profiles.map((row) => [row.store_id, row.username] as const),
  )

  const keyword = search.trim().toLowerCase()

  return stores
    .map((store): SubscriptionDto => {
      const row = subscriptionByStore.get(store.id)
      const subscriptionPlan = row ? toPlan(row.plan) : 'free'

      return {
        storeId: store.id,
        storeName: store.store_name,
        username: usernameByStore.get(store.id) ?? '',
        plan: subscriptionPlan,
        planStartedAt: row?.plan_started_at ?? null,
        planExpiresAt: row?.plan_expires_at ?? null,
        updatedAt: row?.updated_at ?? store.created_at,
        updatedBy: row?.updated_by ?? '',
        daysRemaining:
          subscriptionPlan === 'pro' ? countDaysRemaining(row?.plan_expires_at ?? null) : null,
      }
    })
    .filter((row) => {
      const matchKeyword =
        !keyword ||
        row.storeName.toLowerCase().includes(keyword) ||
        row.username.toLowerCase().includes(keyword)
      const matchPlan = plan === 'all' || row.plan === plan
      return matchKeyword && matchPlan
    })
}

interface PlanResult {
  storeId: string
  plan: Plan
  plan_started_at: string | null
  plan_expires_at: string | null
  action: string
}

/** Ambil pesan error Supabase yang aman ditampilkan ke admin. */
function messageOf(error: { message?: string } | null): string {
  return error?.message ?? 'tidak diketahui'
}

/**
 * Aktifkan atau perpanjang tier Pro untuk satu toko.
 * Durasi dihitung oleh fungsi SQL `admin_set_store_plan`:
 * perpanjangan lanjut dari `plan_expires_at` yang masih berjaku.
 */
export async function activatePlan(
  storeId: string,
  days: number,
  actor: string,
  note = '',
): Promise<SubscriptionDto> {
  const { data, error } = await supabaseAdmin.rpc('admin_set_store_plan', {
    p_store_id: storeId,
    p_days: days,
    p_actor: actor,
    p_note: note,
  })

  if (error) {
    const message = messageOf(error)
    if (isMigrationMissing(message)) {
      throw new HttpError(
        503,
        'Migrasi v9 (store_subscriptions) belum dijalankan di database.',
      )
    }
    if (message.includes('subscription_not_found')) {
      throw new HttpError(404, 'Langganan toko tidak ditemukan. Jalankan migrasi v9.')
    }
    if (message.includes('invalid_days')) {
      throw new HttpError(400, 'Durasi tidak valid. Gunakan 1 sampai 3650 hari.')
    }
    throw new HttpError(502, `Gagal mengaktifkan Pro: ${message}`)
  }

  const result = data as PlanResult
  clearCache()

  return readSubscription(storeId, result)
}

/** Kembalikan toko ke tier Gratis. Data toko tidak disentuh. */
export async function resetPlan(
  storeId: string,
  actor: string,
  note = '',
): Promise<SubscriptionDto> {
  const { data, error } = await supabaseAdmin.rpc('admin_reset_store_plan', {
    p_store_id: storeId,
    p_actor: actor,
    p_note: note,
  })

  if (error) {
    const message = messageOf(error)
    if (isMigrationMissing(message)) {
      throw new HttpError(
        503,
        'Migrasi v9 (store_subscriptions) belum dijalankan di database.',
      )
    }
    if (message.includes('subscription_not_found')) {
      throw new HttpError(404, 'Langganan toko tidak ditemukan. Jalankan migrasi v9.')
    }
    throw new HttpError(502, `Gagal mengembalikan ke Gratis: ${message}`)
  }

  clearCache()

  return readSubscription(storeId, data as PlanResult)
}

/** Baca ulang baris langganan + nama toko setelah perubahan. */
async function readSubscription(storeId: string, result: PlanResult): Promise<SubscriptionDto> {
  const [storeResult, subscriptionResult] = await Promise.all([
    supabaseAdmin
      .from('stores')
      .select('store_name')
      .eq('id', storeId)
      .maybeSingle(),
    supabaseAdmin
      .from('store_subscriptions')
      .select('store_id, plan, plan_started_at, plan_expires_at, updated_at, updated_by')
      .eq('store_id', storeId)
      .maybeSingle(),
  ])

  if (storeResult.error || subscriptionResult.error) {
    throw new HttpError(502, 'Gagal membaca ulang data langganan setelah perubahan.')
  }

  const store = storeResult.data as { store_name: string } | null
  const row = subscriptionResult.data as SubscriptionRecord | null
  const plan = row ? toPlan(row.plan) : 'free'

  return {
    storeId,
    storeName: store?.store_name ?? '',
    username: '',
    plan,
    planStartedAt: row?.plan_started_at ?? result.plan_started_at ?? null,
    planExpiresAt: row?.plan_expires_at ?? result.plan_expires_at ?? null,
    updatedAt: row?.updated_at ?? new Date().toISOString(),
    updatedBy: row?.updated_by ?? '',
    daysRemaining: plan === 'pro' ? countDaysRemaining(row?.plan_expires_at ?? null) : null,
  }
}
