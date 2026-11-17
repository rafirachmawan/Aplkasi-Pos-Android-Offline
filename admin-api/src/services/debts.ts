import { HttpError } from '../lib/errors'
import { fetchAll } from '../lib/fetchAll'
import { buildStoreNameMap, mapDebt } from '../lib/mapping'
import { paginate } from '../lib/pagination'
import {
  buildJakartaDateRange,
  isMissingTableError,
  sanitizeSearchKeyword,
} from '../lib/supabaseFallback'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import type {
  DebtDto,
  DebtPaymentRecord,
  DebtRecord,
  DebtStatus,
  DebtSummary,
  Paginated,
} from '../types'
import { loadDataset } from './dataset'

export interface DebtListQuery {
  search: string
  storeId?: string
  status?: DebtStatus | 'all'
  from?: string
  to?: string
  page: number
  pageSize: number
}

const EMPTY_SUMMARY: DebtSummary = {
  count: 0,
  unpaidCount: 0,
  partiallyPaidCount: 0,
  paidCount: 0,
  totalDebt: 0,
  totalRemaining: 0,
  totalPaid: 0,
}

async function fetchPaymentsForDebts(debtIds: string[]): Promise<Map<string, DebtPaymentRecord[]>> {
  const byDebt = new Map<string, DebtPaymentRecord[]>()
  if (debtIds.length === 0) return byDebt

  const { data, error } = await supabaseAdmin
    .from('debt_payments')
    .select('id, store_id, debt_id, payment_amount, payment_method, notes, created_at')
    .in('debt_id', debtIds)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return byDebt
    throw new HttpError(502, `Gagal membaca riwayat cicilan kasbon: ${error.message}`)
  }

  for (const row of (data ?? []) as DebtPaymentRecord[]) {
    const list = byDebt.get(row.debt_id)
    if (list) list.push(row)
    else byDebt.set(row.debt_id, [row])
  }

  return byDebt
}

async function fetchInvoiceMap(transactionIds: string[]): Promise<Map<string, string>> {
  const invoiceByTx = new Map<string, string>()
  if (transactionIds.length === 0) return invoiceByTx

  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select('id, invoice_number')
    .in('id', transactionIds)

  if (error) return invoiceByTx

  for (const row of (data ?? []) as Array<{ id: string; invoice_number: string }>) {
    invoiceByTx.set(row.id, row.invoice_number)
  }

  return invoiceByTx
}

async function enrichDebts(
  records: DebtRecord[],
  storeNameById: Map<string, string>,
): Promise<DebtDto[]> {
  if (records.length === 0) return []

  const debtIds = records.map((row) => row.id)
  const missingInvoiceTxIds = Array.from(
    new Set(
      records
        .filter((row) => !row.invoice_number && row.transaction_id)
        .map((row) => row.transaction_id as string),
    ),
  )

  const [paymentsByDebt, invoiceByTx] = await Promise.all([
    fetchPaymentsForDebts(debtIds),
    fetchInvoiceMap(missingInvoiceTxIds),
  ])

  return records.map((record) =>
    mapDebt(
      record,
      storeNameById.get(record.store_id) ?? '—',
      paymentsByDebt.get(record.id) ?? [],
      record.transaction_id ? invoiceByTx.get(record.transaction_id) : undefined,
    ),
  )
}

export async function listDebts({
  search,
  storeId,
  status = 'all',
  from,
  to,
  page,
  pageSize,
}: DebtListQuery): Promise<{ data: Paginated<DebtDto>; summary: DebtSummary }> {
  const dataset = await loadDataset()
  const storeNameById = buildStoreNameMap(dataset.stores)
  const { fromIso, toIso } = buildJakartaDateRange(from, to)

  let records: DebtRecord[]
  try {
    records = await fetchAll<DebtRecord>('kasbon pelanggan', (rangeFrom, rangeTo) => {
      let query = supabaseAdmin
        .from('customer_debts')
        .select(
          'id, store_id, customer_name, customer_phone, transaction_id, invoice_number, total_debt, remaining_debt, due_date, notes, status, created_at, updated_at',
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
          (row.customer_phone ?? '').toLowerCase().includes(keyword) ||
          (row.invoice_number ?? '').toLowerCase().includes(keyword) ||
          (row.notes ?? '').toLowerCase().includes(keyword) ||
          storeName.includes(keyword)
        )
      })
    : records

  const summary: DebtSummary = {
    count: filtered.length,
    unpaidCount: 0,
    partiallyPaidCount: 0,
    paidCount: 0,
    totalDebt: 0,
    totalRemaining: 0,
    totalPaid: 0,
  }

  for (const row of filtered) {
    const total = Number(row.total_debt ?? 0)
    const remaining = Number(row.remaining_debt ?? 0)
    summary.totalDebt += total
    summary.totalRemaining += remaining
    summary.totalPaid += Math.max(0, total - remaining)
    if (row.status === 'paid') summary.paidCount += 1
    else if (row.status === 'partially_paid') summary.partiallyPaidCount += 1
    else summary.unpaidCount += 1
  }

  const paged = paginate(filtered, page, pageSize)
  const enrichedRows = await enrichDebts(paged.rows, storeNameById)

  return {
    data: {
      rows: enrichedRows,
      total: paged.total,
      page: paged.page,
      pageSize: paged.pageSize,
    },
    summary,
  }
}

export async function listStoreDebts(storeId: string, storeName: string, limit = 100): Promise<DebtDto[]> {
  const { data, error } = await supabaseAdmin
    .from('customer_debts')
    .select(
      'id, store_id, customer_name, customer_phone, transaction_id, invoice_number, total_debt, remaining_debt, due_date, notes, status, created_at, updated_at',
    )
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new HttpError(502, `Gagal membaca kasbon toko: ${error.message}`)
  }

  const storeMap = new Map([[storeId, storeName]])
  return enrichDebts((data ?? []) as DebtRecord[], storeMap)
}

export async function getGlobalUnpaidDebtStats(): Promise<{ count: number; remaining: number }> {
  const { data, error } = await supabaseAdmin
    .from('customer_debts')
    .select('remaining_debt')
    .neq('status', 'paid')

  if (error) {
    if (isMissingTableError(error)) return { count: 0, remaining: 0 }
    return { count: 0, remaining: 0 }
  }

  const rows = (data ?? []) as Array<{ remaining_debt: number }>
  return {
    count: rows.length,
    remaining: rows.reduce((sum, row) => sum + Number(row.remaining_debt ?? 0), 0),
  }
}
