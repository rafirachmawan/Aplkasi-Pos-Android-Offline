import { env } from '../env'
import { cached } from '../lib/cache'
import { startOfJakartaDay } from '../lib/dates'
import { fetchAll } from '../lib/fetchAll'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { summarizeStores } from '../lib/mapping'
import type { LicenseRecord, ProfileRow, StoreRow, StoreSummary, Transaction30dRow } from '../types'

export interface Dataset {
  stores: StoreRow[]
  profiles: ProfileRow[]
  licenses: LicenseRecord[]
  transactions30d: Transaction30dRow[]
  loadedAt: string
}

/**
 * Dataset inti yang dipakai hampir semua halaman: toko, akun, lisensi, dan
 * transaksi 30 hari terakhir. Dimuat sekali lalu di-cache singkat.
 */
export async function loadDataset(): Promise<Dataset> {
  return cached('dataset', env.cacheTtlMs, async () => {
    const since = startOfJakartaDay(new Date(), -29).toISOString()

    const [stores, profiles, licenses, transactions30d] = await Promise.all([
      fetchAll<StoreRow>('toko', (from, to) =>
        supabaseAdmin
          .from('stores')
          .select('id, store_name, created_at')
          .order('created_at', { ascending: false })
          .range(from, to),
      ),
      fetchAll<ProfileRow>('profil toko', (from, to) =>
        supabaseAdmin.from('profiles').select('store_id, username').range(from, to),
      ),
      fetchAll<LicenseRecord>('lisensi', (from, to) =>
        supabaseAdmin
          .from('app_licenses')
          .select(
            'id, device_id, store_id, license_type, status, activated_at, expires_at, notes, created_at',
          )
          .order('activated_at', { ascending: false })
          .range(from, to),
      ),
      fetchAll<Transaction30dRow>('transaksi 30 hari', (from, to) =>
        supabaseAdmin
          .from('transactions')
          .select('store_id, grand_total, created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: true })
          .range(from, to),
      ),
    ])

    return {
      stores,
      profiles,
      licenses,
      transactions30d,
      loadedAt: new Date().toISOString(),
    }
  })
}

export function buildSummaries(dataset: Dataset): StoreSummary[] {
  return summarizeStores(dataset.stores, dataset.profiles, dataset.licenses, dataset.transactions30d)
}
