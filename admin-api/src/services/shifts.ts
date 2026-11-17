import { HttpError } from '../lib/errors'
import { fetchAll } from '../lib/fetchAll'
import { buildStoreNameMap, mapShift } from '../lib/mapping'
import { paginate } from '../lib/pagination'
import {
  buildJakartaDateRange,
  isMissingTableError,
  sanitizeSearchKeyword,
} from '../lib/supabaseFallback'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import type {
  CashierShiftRecord,
  Paginated,
  ShiftDto,
  ShiftExpenseRecord,
  ShiftStatus,
  ShiftSummary,
} from '../types'
import { loadDataset } from './dataset'

export interface ShiftListQuery {
  search: string
  storeId?: string
  status?: ShiftStatus | 'all'
  from?: string
  to?: string
  page: number
  pageSize: number
}

const EMPTY_SUMMARY: ShiftSummary = {
  count: 0,
  openCount: 0,
  closedCount: 0,
  totalSales: 0,
  totalExpenses: 0,
}

async function fetchExpensesForShifts(
  shiftIds: string[],
): Promise<Map<string, ShiftExpenseRecord[]>> {
  const byShift = new Map<string, ShiftExpenseRecord[]>()
  if (shiftIds.length === 0) return byShift

  const { data, error } = await supabaseAdmin
    .from('shift_expenses')
    .select('id, store_id, shift_id, amount, category, description, created_at')
    .in('shift_id', shiftIds)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTableError(error)) return byShift
    throw new HttpError(502, `Gagal membaca pengeluaran shift: ${error.message}`)
  }

  for (const row of (data ?? []) as ShiftExpenseRecord[]) {
    const list = byShift.get(row.shift_id)
    if (list) list.push(row)
    else byShift.set(row.shift_id, [row])
  }

  return byShift
}

export async function listShifts({
  search,
  storeId,
  status = 'all',
  from,
  to,
  page,
  pageSize,
}: ShiftListQuery): Promise<{ data: Paginated<ShiftDto>; summary: ShiftSummary }> {
  const dataset = await loadDataset()
  const storeNameById = buildStoreNameMap(dataset.stores)
  const { fromIso, toIso } = buildJakartaDateRange(from, to)

  let records: CashierShiftRecord[]
  try {
    records = await fetchAll<CashierShiftRecord>('shift kasir', (rangeFrom, rangeTo) => {
      let query = supabaseAdmin
        .from('cashier_shifts')
        .select(
          'id, store_id, cashier_name, start_time, end_time, starting_cash, expected_cash, actual_cash, difference, total_cash_sales, total_non_cash_sales, total_expenses, status, notes, created_at',
        )
        .order('start_time', { ascending: false })
        .range(rangeFrom, rangeTo)

      if (storeId) query = query.eq('store_id', storeId)
      if (status && status !== 'all') query = query.eq('status', status)
      if (fromIso) query = query.gte('start_time', fromIso)
      if (toIso) query = query.lt('start_time', toIso)
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
          row.cashier_name.toLowerCase().includes(keyword) ||
          (row.notes ?? '').toLowerCase().includes(keyword) ||
          storeName.includes(keyword)
        )
      })
    : records

  const summary: ShiftSummary = {
    count: filtered.length,
    openCount: 0,
    closedCount: 0,
    totalSales: 0,
    totalExpenses: 0,
  }

  for (const row of filtered) {
    summary.totalSales +=
      Number(row.total_cash_sales ?? 0) + Number(row.total_non_cash_sales ?? 0)
    summary.totalExpenses += Number(row.total_expenses ?? 0)
    if (row.status === 'open') summary.openCount += 1
    else summary.closedCount += 1
  }

  const paged = paginate(filtered, page, pageSize)
  const expensesByShift = await fetchExpensesForShifts(paged.rows.map((r) => r.id))
  const rows = paged.rows.map((record) =>
    mapShift(record, storeNameById.get(record.store_id) ?? '—', expensesByShift.get(record.id) ?? []),
  )

  return {
    data: { rows, total: paged.total, page: paged.page, pageSize: paged.pageSize },
    summary,
  }
}

export async function listStoreShifts(
  storeId: string,
  storeName: string,
  limit = 50,
): Promise<ShiftDto[]> {
  const { data, error } = await supabaseAdmin
    .from('cashier_shifts')
    .select(
      'id, store_id, cashier_name, start_time, end_time, starting_cash, expected_cash, actual_cash, difference, total_cash_sales, total_non_cash_sales, total_expenses, status, notes, created_at',
    )
    .eq('store_id', storeId)
    .order('start_time', { ascending: false })
    .limit(limit)

  if (error) {
    if (isMissingTableError(error)) return []
    throw new HttpError(502, `Gagal membaca shift kasir toko: ${error.message}`)
  }

  const records = (data ?? []) as CashierShiftRecord[]
  const expensesByShift = await fetchExpensesForShifts(records.map((r) => r.id))

  return records.map((record) =>
    mapShift(record, storeName, expensesByShift.get(record.id) ?? []),
  )
}
