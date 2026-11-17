import { HttpError } from '../lib/errors'
import { fetchAll } from '../lib/fetchAll'
import { buildStoreNameMap, mapTableOrder } from '../lib/mapping'
import { paginate } from '../lib/pagination'
import {
  buildJakartaDateRange,
  isMissingTableError,
  sanitizeSearchKeyword,
} from '../lib/supabaseFallback'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import type {
  Paginated,
  TableOrderDto,
  TableOrderRecord,
  TableOrderStatus,
  TableOrderSummary,
} from '../types'
import { loadDataset } from './dataset'

export interface TableOrderListQuery {
  search: string
  storeId?: string
  status?: TableOrderStatus | 'all'
  from?: string
  to?: string
  page: number
  pageSize: number
}

const EMPTY_SUMMARY: TableOrderSummary = {
  count: 0,
  pendingCount: 0,
  activeCount: 0,
  completedCount: 0,
  totalAmount: 0,
}

export async function listTableOrders({
  search,
  storeId,
  status = 'all',
  from,
  to,
  page,
  pageSize,
}: TableOrderListQuery): Promise<{ data: Paginated<TableOrderDto>; summary: TableOrderSummary }> {
  const dataset = await loadDataset()
  const storeNameById = buildStoreNameMap(dataset.stores)
  const { fromIso, toIso } = buildJakartaDateRange(from, to)

  let records: TableOrderRecord[]
  try {
    records = await fetchAll<TableOrderRecord>('pesanan meja', (rangeFrom, rangeTo) => {
      let query = supabaseAdmin
        .from('table_orders')
        .select(
          'id, store_id, table_number, customer_name, customer_phone, total_amount, payment_method, payment_proof_url, status, items, notes, created_at',
        )
        .order('created_at', { ascending: false })
        .range(rangeFrom, rangeTo)

      if (storeId) query = query.eq('store_id', storeId)
      if (status && status !== 'all') query = query.eq('status', status)
      if (fromIso) query = query.gte('created_at', fromIso)
      if (toIso) query = query.lt('created_at', toIso)
      return query
    })
  } catch (err) {
    if (isMissingTableError(err as { message?: string })) {
      return { data: paginate([], page, pageSize), summary: EMPTY_SUMMARY }
    }
    throw err
  }

  const keyword = sanitizeSearchKeyword(search.toLowerCase())
  const filtered = keyword
    ? records.filter((row) => {
        const storeName = (storeNameById.get(row.store_id) ?? '').toLowerCase()
        return (
          row.customer_name.toLowerCase().includes(keyword) ||
          (row.table_number ?? '').toLowerCase().includes(keyword) ||
          (row.customer_phone ?? '').toLowerCase().includes(keyword) ||
          (row.notes ?? '').toLowerCase().includes(keyword) ||
          storeName.includes(keyword)
        )
      })
    : records

  const summary: TableOrderSummary = {
    count: filtered.length,
    pendingCount: 0,
    activeCount: 0,
    completedCount: 0,
    totalAmount: 0,
  }

  for (const row of filtered) {
    summary.totalAmount += Number(row.total_amount ?? 0)
    if (row.status === 'pending') summary.pendingCount += 1
    else if (row.status === 'accepted') summary.activeCount += 1
    else if (row.status === 'completed') summary.completedCount += 1
  }

  const paged = paginate(filtered, page, pageSize)
  const rows = paged.rows.map((record) =>
    mapTableOrder(record, storeNameById.get(record.store_id) ?? '—'),
  )

  return {
    data: { rows, total: paged.total, page: paged.page, pageSize: paged.pageSize },
    summary,
  }
}

export async function listStoreTableOrders(
  storeId: string,
  storeName: string,
  limit = 100,
): Promise<TableOrderDto[]> {
  const { data, error } = await supabaseAdmin
    .from('table_orders')
    .select(
      'id, store_id, table_number, customer_name, customer_phone, total_amount, payment_method, payment_proof_url, status, items, notes, created_at',
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new HttpError(502, `Gagal membaca pesanan meja toko: ${error.message}`)
  }

  return ((data ?? []) as TableOrderRecord[]).map((record) => mapTableOrder(record, storeName))
}

export async function getGlobalPendingTableOrdersCount(): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('table_orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  if (error) {
    if (isMissingTableError(error)) return 0
    return 0
  }
  return count ?? 0
}
