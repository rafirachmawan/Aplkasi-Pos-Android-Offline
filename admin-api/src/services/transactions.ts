import { HttpError } from '../lib/errors'
import { fetchAll } from '../lib/fetchAll'
import { buildStoreNameMap, mapTransaction } from '../lib/mapping'
import {
  buildJakartaDateRange,
  isMissingColumnError,
  sanitizeSearchKeyword,
} from '../lib/supabaseFallback'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import type {
  Paginated,
  TransactionDetailRecord,
  TransactionDto,
  TransactionRecord,
  TransactionSummary,
} from '../types'
import { loadDataset } from './dataset'

const RICH_TX_SELECT =
  'id, store_id, invoice_number, total_price, discount_amount, grand_total, cash_received, cash_return, payment_method, payment_notes, order_type, table_number, is_offline_sync, created_at'
const BASE_TX_SELECT =
  'id, store_id, invoice_number, grand_total, payment_method, order_type, created_at'

export interface TransactionFilters {
  search: string
  storeId?: string
  paymentMethod?: string
  orderType?: string
  from?: string
  to?: string
}

export interface TransactionListQuery extends TransactionFilters {
  page: number
  pageSize: number
}

interface NormalizedFilters {
  orExpression: string | null
  storeId?: string
  paymentMethod?: string
  orderType?: string
  fromIso?: string
  toIso?: string
}

function buildTransactionsQuery(select: string, filters: NormalizedFilters, includeRichOr = true) {
  let query = supabaseAdmin.from('transactions').select(select)

  if (filters.fromIso) query = query.gte('created_at', filters.fromIso)
  if (filters.toIso) query = query.lt('created_at', filters.toIso)
  if (filters.storeId) query = query.eq('store_id', filters.storeId)
  if (filters.paymentMethod) query = query.eq('payment_method', filters.paymentMethod)
  if (filters.orderType) query = query.eq('order_type', filters.orderType)
  if (includeRichOr && filters.orExpression) query = query.or(filters.orExpression)

  return query
}

export async function fetchTransactionItems(
  transactionIds: string[],
): Promise<Map<string, TransactionDetailRecord[]>> {
  const byTransaction = new Map<string, TransactionDetailRecord[]>()
  if (transactionIds.length === 0) return byTransaction

  let rows: TransactionDetailRecord[]
  try {
    rows = await fetchAll<TransactionDetailRecord>('detail transaksi', (from, to) =>
      supabaseAdmin
        .from('transaction_details')
        .select('transaction_id, product_name, quantity, price_at_sale, capital_at_sale')
        .in('transaction_id', transactionIds)
        .order('id', { ascending: true })
        .range(from, to),
    )
  } catch (err) {
    if (!isMissingColumnError(err as { message?: string })) throw err
    rows = await fetchAll<TransactionDetailRecord>('detail transaksi', (from, to) =>
      supabaseAdmin
        .from('transaction_details')
        .select('transaction_id, product_name, quantity, price_at_sale')
        .in('transaction_id', transactionIds)
        .order('id', { ascending: true })
        .range(from, to),
    )
  }

  for (const row of rows) {
    const list = byTransaction.get(row.transaction_id)
    if (list) list.push(row)
    else byTransaction.set(row.transaction_id, [row])
  }

  return byTransaction
}

export async function listTransactions({
  search,
  storeId,
  paymentMethod,
  orderType,
  from,
  to,
  page,
  pageSize,
}: TransactionListQuery): Promise<{ data: Paginated<TransactionDto>; summary: TransactionSummary }> {
  const dataset = await loadDataset()
  const keyword = sanitizeSearchKeyword(search.toLowerCase())

  const matchingStoreIds = keyword
    ? dataset.stores
        .filter((store) => store.store_name.toLowerCase().includes(keyword))
        .map((store) => store.id)
    : []

  const orParts: string[] = []
  const baseOrParts: string[] = []
  if (keyword) {
    orParts.push(`invoice_number.ilike.%${keyword}%`)
    orParts.push(`payment_notes.ilike.%${keyword}%`)
    orParts.push(`table_number.ilike.%${keyword}%`)
    baseOrParts.push(`invoice_number.ilike.%${keyword}%`)
  }
  if (matchingStoreIds.length > 0) {
    const storeIn = `store_id.in.(${matchingStoreIds.join(',')})`
    orParts.push(storeIn)
    baseOrParts.push(storeIn)
  }

  const { fromIso, toIso } = buildJakartaDateRange(from, to)

  const filters: NormalizedFilters = {
    orExpression: orParts.length > 0 ? orParts.join(',') : null,
    storeId,
    paymentMethod,
    orderType,
    fromIso,
    toIso,
  }

  let summaryRows: Array<{ grand_total: number; payment_method?: string | null }>
  try {
    summaryRows = await fetchAll<{ grand_total: number; payment_method?: string | null }>(
      'transaksi (ringkasan)',
      (pageFrom, pageTo) =>
        buildTransactionsQuery('grand_total, payment_method', filters)
          .order('created_at', { ascending: false })
          .range(pageFrom, pageTo),
    )
  } catch (err) {
    if (!isMissingColumnError(err as { message?: string })) throw err
    const fallbackFilters = {
      ...filters,
      orExpression: baseOrParts.length > 0 ? baseOrParts.join(',') : null,
    }
    summaryRows = await fetchAll<{ grand_total: number; payment_method?: string | null }>(
      'transaksi (ringkasan)',
      (pageFrom, pageTo) =>
        buildTransactionsQuery('grand_total, payment_method', fallbackFilters)
          .order('created_at', { ascending: false })
          .range(pageFrom, pageTo),
    )
  }

  const total = summaryRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize

  let pageData: unknown[] | null = null
  let pageError: { code?: string; message: string } | null = null

  {
    const res = await buildTransactionsQuery(RICH_TX_SELECT, filters)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    pageData = res.data as unknown[] | null
    pageError = res.error
  }

  if (pageError && isMissingColumnError(pageError)) {
    const fallbackFilters = {
      ...filters,
      orExpression: baseOrParts.length > 0 ? baseOrParts.join(',') : null,
    }
    const res = await buildTransactionsQuery(BASE_TX_SELECT, fallbackFilters)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    pageData = res.data as unknown[] | null
    pageError = res.error
  }

  if (pageError) {
    throw new HttpError(502, `Gagal membaca transaksi: ${pageError.message}`)
  }

  const records = (pageData ?? []) as TransactionRecord[]
  const [itemsByTransaction, storeNameById] = await Promise.all([
    fetchTransactionItems(records.map((record) => record.id)),
    Promise.resolve(buildStoreNameMap(dataset.stores)),
  ])

  const rows = records.map((record) =>
    mapTransaction(record, storeNameById.get(record.store_id) ?? '—', itemsByTransaction.get(record.id) ?? []),
  )

  let kasbonCount = 0
  let kasbonRevenue = 0
  let totalRevenue = 0
  for (const row of summaryRows) {
    const amount = Number(row.grand_total ?? 0)
    totalRevenue += amount
    if (row.payment_method === 'kasbon') {
      kasbonCount += 1
      kasbonRevenue += amount
    }
  }

  return {
    data: { rows, total, page: currentPage, pageSize },
    summary: {
      count: total,
      revenue: totalRevenue,
      kasbonCount,
      kasbonRevenue,
    },
  }
}

export async function listRecentStoreTransactions(
  storeId: string,
  storeName: string,
  limit = 100,
): Promise<TransactionDto[]> {
  let rows: unknown[] | null = null
  let error: { code?: string; message: string } | null = null

  {
    const res = await supabaseAdmin
      .from('transactions')
      .select(RICH_TX_SELECT)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit)
    rows = res.data as unknown[] | null
    error = res.error
  }

  if (error && isMissingColumnError(error)) {
    const res = await supabaseAdmin
      .from('transactions')
      .select(BASE_TX_SELECT)
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(limit)
    rows = res.data as unknown[] | null
    error = res.error
  }

  if (error) {
    throw new HttpError(502, `Gagal membaca transaksi toko: ${error.message}`)
  }

  const records = (rows ?? []) as TransactionRecord[]
  const itemsByTransaction = await fetchTransactionItems(records.map((record) => record.id))

  return records.map((record) =>
    mapTransaction(record, storeName, itemsByTransaction.get(record.id) ?? []),
  )
}

export async function countStoreTransactions(storeId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('store_id', storeId)

  if (error) {
    throw new HttpError(502, `Gagal menghitung transaksi toko: ${error.message}`)
  }
  return count ?? 0
}
