import { debts, delay, shifts, tableOrders, transactions } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import { DEFAULT_PAGE_SIZE, paginate } from '@/lib/pagination'
import type {
  DebtRow,
  DebtStatus,
  DebtSummary,
  Paginated,
  ShiftRow,
  ShiftStatus,
  ShiftSummary,
  TableOrderRow,
  TableOrderStatus,
  TableOrderSummary,
  TransactionRow,
  TransactionSummary,
} from '@/types/domain'

export interface BaseLedgerQuery {
  search?: string
  storeId?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface TransactionQuery extends BaseLedgerQuery {
  paymentMethod?: string
  orderType?: string
}

export interface DebtQuery extends BaseLedgerQuery {
  status?: DebtStatus | 'all'
}

export interface TableOrderQuery extends BaseLedgerQuery {
  status?: TableOrderStatus | 'all'
}

export interface ShiftQuery extends BaseLedgerQuery {
  status?: ShiftStatus | 'all'
}

export interface TransactionListResult {
  data: Paginated<TransactionRow>
  summary: TransactionSummary
}

export interface DebtListResult {
  data: Paginated<DebtRow>
  summary: DebtSummary
}

export interface TableOrderListResult {
  data: Paginated<TableOrderRow>
  summary: TableOrderSummary
}

export interface ShiftListResult {
  data: Paginated<ShiftRow>
  summary: ShiftSummary
}

function localDateKey(iso: string): string {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildQueryParams(
  query: BaseLedgerQuery,
  extra: Record<string, string | undefined> = {},
): string {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    pageSize: String(query.pageSize ?? DEFAULT_PAGE_SIZE),
  })
  if (query.search?.trim()) params.set('search', query.search.trim())
  if (query.storeId && query.storeId !== 'all') params.set('storeId', query.storeId)
  if (query.from) params.set('from', query.from)
  if (query.to) params.set('to', query.to)

  for (const [key, value] of Object.entries(extra)) {
    if (value && value !== 'all') params.set(key, value)
  }

  return params.toString()
}

function matchesStoreAndDate(
  row: { storeId: string },
  timestamp: string,
  { storeId = 'all', from = '', to = '' }: BaseLedgerQuery,
): boolean {
  const matchStore = storeId === 'all' || row.storeId === storeId
  const dateKey = localDateKey(timestamp)
  const matchFrom = !from || dateKey >= from
  const matchTo = !to || dateKey <= to
  return matchStore && matchFrom && matchTo
}

export async function fetchTransactions(
  query: TransactionQuery,
): Promise<TransactionListResult> {
  if (env.isApi) {
    const qs = buildQueryParams(query, {
      paymentMethod: query.paymentMethod,
      orderType: query.orderType,
    })
    return apiRequest<TransactionListResult>(`/api/transactions?${qs}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(260)

  const keyword = (query.search ?? '').trim().toLowerCase()
  const paymentFilter = query.paymentMethod ?? 'all'
  const orderFilter = query.orderType ?? 'all'

  const filtered = transactions.filter((row) => {
    const matchKeyword =
      !keyword ||
      row.invoiceNumber.toLowerCase().includes(keyword) ||
      row.storeName.toLowerCase().includes(keyword) ||
      row.paymentNotes.toLowerCase().includes(keyword) ||
      row.tableNumber.toLowerCase().includes(keyword)
    const matchPayment = paymentFilter === 'all' || row.paymentMethod === paymentFilter
    const matchOrder = orderFilter === 'all' || row.orderType === orderFilter
    return (
      matchKeyword &&
      matchPayment &&
      matchOrder &&
      matchesStoreAndDate(row, row.createdAt, query)
    )
  })

  const kasbonRows = filtered.filter((row) => row.paymentMethod === 'kasbon')
  return {
    data: paginate(filtered, query.page ?? 1, query.pageSize ?? DEFAULT_PAGE_SIZE),
    summary: {
      count: filtered.length,
      revenue: filtered.reduce((sum, row) => sum + row.grandTotal, 0),
      kasbonCount: kasbonRows.length,
      kasbonRevenue: kasbonRows.reduce((sum, row) => sum + row.grandTotal, 0),
    },
  }
}

export async function fetchDebts(query: DebtQuery): Promise<DebtListResult> {
  if (env.isApi) {
    const qs = buildQueryParams(query, { status: query.status })
    return apiRequest<DebtListResult>(`/api/debts?${qs}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(240)

  const keyword = (query.search ?? '').trim().toLowerCase()
  const statusFilter = query.status ?? 'all'

  const filtered = debts.filter((row) => {
    const matchKeyword =
      !keyword ||
      row.customerName.toLowerCase().includes(keyword) ||
      row.customerPhone.toLowerCase().includes(keyword) ||
      row.invoiceNumber.toLowerCase().includes(keyword) ||
      row.notes.toLowerCase().includes(keyword) ||
      row.storeName.toLowerCase().includes(keyword)
    const matchStatus = statusFilter === 'all' || row.status === statusFilter
    return matchKeyword && matchStatus && matchesStoreAndDate(row, row.createdAt, query)
  })

  return {
    data: paginate(filtered, query.page ?? 1, query.pageSize ?? DEFAULT_PAGE_SIZE),
    summary: {
      count: filtered.length,
      unpaidCount: filtered.filter((row) => row.status === 'unpaid').length,
      partiallyPaidCount: filtered.filter((row) => row.status === 'partially_paid').length,
      paidCount: filtered.filter((row) => row.status === 'paid').length,
      totalDebt: filtered.reduce((sum, row) => sum + row.totalDebt, 0),
      totalRemaining: filtered.reduce((sum, row) => sum + row.remainingDebt, 0),
      totalPaid: filtered.reduce((sum, row) => sum + row.paidAmount, 0),
    },
  }
}

export async function fetchTableOrders(query: TableOrderQuery): Promise<TableOrderListResult> {
  if (env.isApi) {
    const qs = buildQueryParams(query, { status: query.status })
    return apiRequest<TableOrderListResult>(`/api/table-orders?${qs}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(240)

  const keyword = (query.search ?? '').trim().toLowerCase()
  const statusFilter = query.status ?? 'all'

  const filtered = tableOrders.filter((row) => {
    const matchKeyword =
      !keyword ||
      row.customerName.toLowerCase().includes(keyword) ||
      row.tableNumber.toLowerCase().includes(keyword) ||
      row.storeName.toLowerCase().includes(keyword) ||
      row.notes.toLowerCase().includes(keyword)
    const matchStatus = statusFilter === 'all' || row.status === statusFilter
    return matchKeyword && matchStatus && matchesStoreAndDate(row, row.createdAt, query)
  })

  return {
    data: paginate(filtered, query.page ?? 1, query.pageSize ?? DEFAULT_PAGE_SIZE),
    summary: {
      count: filtered.length,
      pendingCount: filtered.filter((row) => row.status === 'pending').length,
      activeCount: filtered.filter((row) => row.status === 'accepted').length,
      completedCount: filtered.filter((row) => row.status === 'completed').length,
      totalAmount: filtered.reduce((sum, row) => sum + row.totalAmount, 0),
    },
  }
}

export async function fetchShifts(query: ShiftQuery): Promise<ShiftListResult> {
  if (env.isApi) {
    const qs = buildQueryParams(query, { status: query.status })
    return apiRequest<ShiftListResult>(`/api/shifts?${qs}`)
  }

  if (!env.isMock) supabaseNotReady()
  await delay(240)

  const keyword = (query.search ?? '').trim().toLowerCase()
  const statusFilter = query.status ?? 'all'

  const filtered = shifts.filter((row) => {
    const matchKeyword =
      !keyword ||
      row.cashierName.toLowerCase().includes(keyword) ||
      row.storeName.toLowerCase().includes(keyword) ||
      row.notes.toLowerCase().includes(keyword)
    const matchStatus = statusFilter === 'all' || row.status === statusFilter
    return matchKeyword && matchStatus && matchesStoreAndDate(row, row.startTime, query)
  })

  return {
    data: paginate(filtered, query.page ?? 1, query.pageSize ?? DEFAULT_PAGE_SIZE),
    summary: {
      count: filtered.length,
      openCount: filtered.filter((row) => row.status === 'open').length,
      closedCount: filtered.filter((row) => row.status === 'closed').length,
      totalSales: filtered.reduce(
        (sum, row) => sum + row.totalCashSales + row.totalNonCashSales,
        0,
      ),
      totalExpenses: filtered.reduce((sum, row) => sum + row.totalExpenses, 0),
    },
  }
}
