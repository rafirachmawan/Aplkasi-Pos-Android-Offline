import { delay, licenses, products, stores, transactions } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import { paginate, DEFAULT_PAGE_SIZE } from '@/lib/pagination'
import type { Paginated, StoreDetail, StoreStatus, StoreSummary } from '@/types/domain'

export interface StoreListQuery {
  search?: string
  status?: StoreStatus | 'all'
  page?: number
  pageSize?: number
}

export async function fetchStores({
  search = '',
  status = 'all',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: StoreListQuery): Promise<Paginated<StoreSummary>> {
  if (env.isApi) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status,
    })
    if (search.trim()) params.set('search', search.trim())

    return apiRequest<Paginated<StoreSummary>>(`/api/stores?${params.toString()}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(280)

  const keyword = search.trim().toLowerCase()

  const filtered = stores.filter((store) => {
    const matchKeyword =
      !keyword ||
      store.storeName.toLowerCase().includes(keyword) ||
      store.username.toLowerCase().includes(keyword)
    const matchStatus = status === 'all' || store.status === status
    return matchKeyword && matchStatus
  })

  return paginate(filtered, page, pageSize)
}

export async function fetchStoreDetail(storeId: string): Promise<StoreDetail> {
  if (env.isApi) {
    return apiRequest<StoreDetail>(`/api/stores/${encodeURIComponent(storeId)}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(260)

  const store = stores.find((item) => item.id === storeId)
  if (!store) throw new Error('Toko tidak ditemukan.')

  return {
    store,
    products: products
      .filter((product) => product.storeId === storeId)
      .sort((a, b) => a.productName.localeCompare(b.productName)),
    transactions: transactions.filter((row) => row.storeId === storeId).slice(0, 12),
    licenses: licenses.filter((row) => row.storeId === storeId),
  }
}
