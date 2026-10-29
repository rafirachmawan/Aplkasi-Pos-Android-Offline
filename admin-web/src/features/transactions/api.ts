import { delay, transactions } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import { DEFAULT_PAGE_SIZE, paginate } from '@/lib/pagination'
import type { Paginated, TransactionRow, TransactionSummary } from '@/types/domain'

export interface TransactionQuery {
  search?: string
  storeId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface TransactionListResult {
  data: Paginated<TransactionRow>
  summary: TransactionSummary
}

function localDateKey(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function fetchTransactions({
  search = '',
  storeId = 'all',
  from = '',
  to = '',
  page = 1,
  pageSize = DEFAULT_PAGE_SIZE,
}: TransactionQuery): Promise<TransactionListResult> {
  if (env.isApi) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    })
    if (search.trim()) params.set('search', search.trim())
    if (storeId && storeId !== 'all') params.set('storeId', storeId)
    if (from) params.set('from', from)
    if (to) params.set('to', to)

    return apiRequest<TransactionListResult>(`/api/transactions?${params.toString()}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(280)

  const keyword = search.trim().toLowerCase()

  const filtered = transactions.filter((row) => {
    const matchKeyword =
      !keyword ||
      row.invoiceNumber.toLowerCase().includes(keyword) ||
      row.storeName.toLowerCase().includes(keyword)
    const matchStore = storeId === 'all' || row.storeId === storeId
    const dateKey = localDateKey(row.createdAt)
    const matchFrom = !from || dateKey >= from
    const matchTo = !to || dateKey <= to
    return matchKeyword && matchStore && matchFrom && matchTo
  })

  return {
    data: paginate(filtered, page, pageSize),
    summary: {
      count: filtered.length,
      revenue: filtered.reduce((sum, row) => sum + row.grandTotal, 0),
    },
  }
}
