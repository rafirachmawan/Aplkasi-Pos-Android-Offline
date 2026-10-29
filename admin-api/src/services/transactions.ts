import { HttpError } from '../lib/errors'
import { fetchAll } from '../lib/fetchAll'
import { buildStoreNameMap, mapTransaction } from '../lib/mapping'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import { parseJakartaDateKey } from '../lib/dates'
import type {
  Paginated,
  TransactionDetailRecord,
  TransactionDto,
  TransactionRecord,
  TransactionSummary,
} from '../types'
import { loadDataset } from './dataset'

export interface TransactionFilters {
  search: string
  storeId?: string
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
  fromIso?: string
  toIso?: string
}

function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[,()%]/g, ' ').trim()
}

function buildTransactionsQuery(select: string, filters: NormalizedFilters) {
  let query = supabaseAdmin.from('transactions').select(select)

  if (filters.fromIso) query = query.gte('created_at', filters.fromIso)
  if (filters.toIso) query = query.lt('created_at', filters.toIso)
  if (filters.storeId) query = query.eq('store_id', filters.storeId)
  if (filters.orExpression) query = query.or(filters.orExpression)

  return query
}

export async function fetchTransactionItems(
  transactionIds: string[],
): Promise<Map<string, TransactionDetailRecord[]>> {
  const byTransaction = new Map<string, TransactionDetailRecord[]>()
  if (transactionIds.length === 0) return byTransaction

  const rows = await fetchAll<TransactionDetailRecord>('detail transaksi', (from, to) =>
    supabaseAdmin
      .from('transaction_details')
      .select('transaction_id, product_name, quantity, price_at_sale')
      .in('transaction_id', transactionIds)
      .order('id', { ascending: true })
      .range(from, to),
  )

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
  from,
  to,
  page,
  pageSize,
}: TransactionListQuery): Promise<{ data: Paginated<TransactionDto>; summary: TransactionSummary }> {
  const dataset = await loadDataset()
  const keyword = sanitizeKeyword(search.toLowerCase())

  const matchingStoreIds = keyword
    ? dataset.stores
        .filter((store) => store.store_name.toLowerCase().includes(keyword))
        .map((store) => store.id)
    : []

  const orParts: string[] = []
  if (keyword) orParts.push(`invoice_number.ilike.%${keyword}%`)
  if (matchingStoreIds.length > 0) orParts.push(`store_id.in.(${matchingStoreIds.join(',')})`)

  let fromIso: string | undefined
  let toIso: string | undefined

  if (from) {
    const start = parseJakartaDateKey(from)
    if (!start) throw new HttpError(400, 'Parameter from harus berformat YYYY-MM-DD.')
    fromIso = start.toISOString()
  }

  if (to) {
    const start = parseJakartaDateKey(to)
    if (!start) throw new HttpError(400, 'Parameter to harus berformat YYYY-MM-DD.')
    start.setUTCDate(start.getUTCDate() + 1)
    toIso = start.toISOString()
  }

  const filters: NormalizedFilters = {
    orExpression: orParts.length > 0 ? orParts.join(',') : null,
    storeId,
    fromIso,
    toIso,
  }

  const summaryRows = await fetchAll<{ grand_total: number }>('transaksi (ringkasan)', (pageFrom, pageTo) =>
    buildTransactionsQuery('grand_total', filters)
      .order('created_at', { ascending: false })
      .range(pageFrom, pageTo),
  )

  const total = summaryRows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const offset = (currentPage - 1) * pageSize

  const { data, error } = await buildTransactionsQuery(
    'id, store_id, invoice_number, grand_total, payment_method, order_type, created_at',
    filters,
  )
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (error) throw new HttpError(502, `Gagal membaca transaksi: ${error.message}`)

  const records = (data ?? []) as unknown as TransactionRecord[]
  const [itemsByTransaction, storeNameById] = await Promise.all([
    fetchTransactionItems(records.map((record) => record.id)),
    Promise.resolve(buildStoreNameMap(dataset.stores)),
  ])

  const rows = records.map((record) =>
    mapTransaction(record, storeNameById.get(record.store_id) ?? '—', itemsByTransaction.get(record.id) ?? []),
  )

  return {
    data: { rows, total, page: currentPage, pageSize },
    summary: {
      count: total,
      revenue: summaryRows.reduce((sum, row) => sum + row.grand_total, 0),
    },
  }
}

export async function listRecentStoreTransactions(
  storeId: string,
  storeName: string,
  limit = 12,
): Promise<TransactionDto[]> {
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, store_id, invoice_number, grand_total, payment_method, order_type, created_at')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new HttpError(502, `Gagal membaca transaksi toko: ${error.message}`)

  const records = (data ?? []) as TransactionRecord[]
  const itemsByTransaction = await fetchTransactionItems(records.map((record) => record.id))

  return records.map((record) =>
    mapTransaction(record, storeName, itemsByTransaction.get(record.id) ?? []),
  )
}
