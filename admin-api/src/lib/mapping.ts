import type {
  CashierShiftRecord,
  DebtDto,
  DebtPaymentDto,
  DebtPaymentRecord,
  DebtRecord,
  DebtStatus,
  LicenseDto,
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  ShiftDto,
  ShiftExpenseDto,
  ShiftExpenseRecord,
  ShiftStatus,
  StoreStatus,
  StoreSummary,
  TableOrderDto,
  TableOrderItemDto,
  TableOrderRecord,
  TableOrderStatus,
  TransactionDetailRecord,
  TransactionDto,
  TransactionRecord,
  Transaction30dRow,
} from '../types'

const LICENSE_TYPES = new Set<LicenseType>(['lifetime', 'trial', 'subscription'])
const LICENSE_STATUSES = new Set<LicenseStatus>(['active', 'expired', 'revoked'])
const DEBT_STATUSES = new Set<DebtStatus>(['unpaid', 'partially_paid', 'paid'])
const TABLE_ORDER_STATUSES = new Set<TableOrderStatus>(['pending', 'accepted', 'completed', 'cancelled'])
const SHIFT_STATUSES = new Set<ShiftStatus>(['open', 'closed'])

function toLicenseType(value: string): LicenseType {
  return LICENSE_TYPES.has(value as LicenseType) ? (value as LicenseType) : 'lifetime'
}

function toLicenseStatus(value: string): LicenseStatus {
  return LICENSE_STATUSES.has(value as LicenseStatus) ? (value as LicenseStatus) : 'expired'
}

function toDebtStatus(value: string): DebtStatus {
  return DEBT_STATUSES.has(value as DebtStatus) ? (value as DebtStatus) : 'unpaid'
}

function toTableOrderStatus(value: string): TableOrderStatus {
  return TABLE_ORDER_STATUSES.has(value as TableOrderStatus)
    ? (value as TableOrderStatus)
    : 'pending'
}

function toShiftStatus(value: string): ShiftStatus {
  return SHIFT_STATUSES.has(value as ShiftStatus) ? (value as ShiftStatus) : 'closed'
}

export function buildStoreNameMap(stores: Array<{ id: string; store_name: string }>): Map<string, string> {
  return new Map(stores.map((store) => [store.id, store.store_name]))
}

export function mapLicense(record: LicenseRecord, storeNameById: Map<string, string>): LicenseDto {
  const storeName = record.store_id
    ? (storeNameById.get(record.store_id) ?? 'Toko tidak dikenal')
    : 'Tidak terhubung'

  return {
    id: record.id,
    deviceId: record.device_id,
    storeId: record.store_id ?? '',
    storeName,
    licenseType: toLicenseType(record.license_type),
    status: toLicenseStatus(record.status),
    activatedAt: record.activated_at ?? record.created_at,
    expiresAt: record.expires_at,
    notes: record.notes ?? '',
  }
}

export function mapTransaction(
  record: TransactionRecord,
  storeName: string,
  items: TransactionDetailRecord[],
): TransactionDto {
  const grandTotal = Number(record.grand_total ?? 0)
  const discountAmount = Number(record.discount_amount ?? 0)
  const totalPrice =
    record.total_price !== undefined && record.total_price !== null
      ? Number(record.total_price)
      : grandTotal + discountAmount

  return {
    id: record.id,
    invoiceNumber: record.invoice_number,
    storeId: record.store_id,
    storeName,
    totalPrice,
    discountAmount,
    grandTotal,
    cashReceived: Number(record.cash_received ?? 0),
    cashReturn: Number(record.cash_return ?? 0),
    paymentMethod: record.payment_method || 'cash',
    paymentNotes: record.payment_notes ?? '',
    orderType: record.order_type || 'retail',
    tableNumber: record.table_number ?? '',
    isOfflineSync: Boolean(record.is_offline_sync),
    createdAt: record.created_at,
    items: items.map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
      priceAtSale: item.price_at_sale,
      capitalAtSale: Number(item.capital_at_sale ?? 0),
    })),
  }
}

export function mapDebtPayment(record: DebtPaymentRecord): DebtPaymentDto {
  return {
    id: record.id,
    debtId: record.debt_id,
    paymentAmount: Number(record.payment_amount ?? 0),
    paymentMethod: record.payment_method || 'cash',
    notes: record.notes ?? '',
    createdAt: record.created_at,
  }
}

export function mapDebt(
  record: DebtRecord,
  storeName: string,
  payments: DebtPaymentRecord[],
  fallbackInvoiceNumber?: string,
): DebtDto {
  const totalDebt = Number(record.total_debt ?? 0)
  const remainingDebt = Number(record.remaining_debt ?? 0)
  const paidAmount = Math.max(0, totalDebt - remainingDebt)

  return {
    id: record.id,
    storeId: record.store_id,
    storeName,
    customerName: record.customer_name,
    customerPhone: record.customer_phone ?? '',
    transactionId: record.transaction_id ?? null,
    invoiceNumber: record.invoice_number || fallbackInvoiceNumber || '',
    totalDebt,
    remainingDebt,
    paidAmount,
    dueDate: record.due_date ?? null,
    notes: record.notes ?? '',
    status: toDebtStatus(record.status),
    createdAt: record.created_at,
    updatedAt: record.updated_at ?? record.created_at,
    payments: payments.map(mapDebtPayment),
  }
}

function parseTableOrderItems(raw: unknown): TableOrderItemDto[] {
  if (!Array.isArray(raw)) return []
  return raw.map((entry) => {
    const obj = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
    return {
      productName: String(obj.name ?? obj.product_name ?? obj.productName ?? 'Item'),
      quantity: Number(obj.quantity ?? obj.qty ?? 1) || 1,
      price: Number(obj.price ?? obj.price_at_sale ?? obj.selling_price ?? 0) || 0,
      notes: String(obj.notes ?? ''),
    }
  })
}

export function mapTableOrder(record: TableOrderRecord, storeName: string): TableOrderDto {
  return {
    id: record.id,
    storeId: record.store_id,
    storeName,
    tableNumber: record.table_number ?? '',
    customerName: record.customer_name,
    customerPhone: record.customer_phone ?? '',
    totalAmount: Number(record.total_amount ?? 0),
    paymentMethod: record.payment_method || 'cash_cashier',
    paymentProofUrl: record.payment_proof_url ?? '',
    status: toTableOrderStatus(record.status),
    items: parseTableOrderItems(record.items),
    notes: record.notes ?? '',
    createdAt: record.created_at,
  }
}

export function mapShiftExpense(record: ShiftExpenseRecord): ShiftExpenseDto {
  return {
    id: record.id,
    shiftId: record.shift_id,
    amount: Number(record.amount ?? 0),
    category: record.category || 'operasional',
    description: record.description,
    createdAt: record.created_at,
  }
}

export function mapShift(
  record: CashierShiftRecord,
  storeName: string,
  expenses: ShiftExpenseRecord[],
): ShiftDto {
  return {
    id: record.id,
    storeId: record.store_id,
    storeName,
    cashierName: record.cashier_name,
    startTime: record.start_time,
    endTime: record.end_time ?? null,
    startingCash: Number(record.starting_cash ?? 0),
    expectedCash: Number(record.expected_cash ?? 0),
    actualCash: record.actual_cash !== null && record.actual_cash !== undefined ? Number(record.actual_cash) : null,
    difference: Number(record.difference ?? 0),
    totalCashSales: Number(record.total_cash_sales ?? 0),
    totalNonCashSales: Number(record.total_non_cash_sales ?? 0),
    totalExpenses: Number(record.total_expenses ?? 0),
    status: toShiftStatus(record.status),
    notes: record.notes ?? '',
    createdAt: record.created_at,
    expenses: expenses.map(mapShiftExpense),
  }
}

const DAY_MS = 86_400_000

interface DatasetStoreInput {
  id: string
  store_name: string
  created_at: string
}

interface DatasetProfileInput {
  store_id: string
  username: string
}

interface DatasetLicenseInput {
  store_id: string | null
  license_type: string
  status: string
  expires_at: string | null
}

/**
 * Menghitung ringkasan toko dari dataset yang sudah dimuat. Semua agregasi
 * dilakukan di memori server agar tidak menambah query per baris.
 */
export function summarizeStores(
  stores: DatasetStoreInput[],
  profiles: DatasetProfileInput[],
  licenses: DatasetLicenseInput[],
  transactions: Transaction30dRow[],
): StoreSummary[] {
  const usernameByStore = new Map<string, string>()
  for (const profile of profiles) {
    if (!usernameByStore.has(profile.store_id)) {
      usernameByStore.set(profile.store_id, profile.username)
    }
  }

  const now = Date.now()
  const trialStores = new Set<string>()
  for (const license of licenses) {
    if (!license.store_id) continue
    if (license.status !== 'active' || license.license_type !== 'trial') continue
    if (license.expires_at && new Date(license.expires_at).getTime() <= now) continue
    trialStores.add(license.store_id)
  }

  const revenueByStore = new Map<string, number>()
  const lastTransactionByStore = new Map<string, string>()

  for (const transaction of transactions) {
    revenueByStore.set(
      transaction.store_id,
      (revenueByStore.get(transaction.store_id) ?? 0) + transaction.grand_total,
    )

    const previous = lastTransactionByStore.get(transaction.store_id)
    if (!previous || transaction.created_at > previous) {
      lastTransactionByStore.set(transaction.store_id, transaction.created_at)
    }
  }

  return stores.map((store) => {
    const lastTransactionAt = lastTransactionByStore.get(store.id) ?? null

    let status: StoreStatus = 'inactive'
    if (trialStores.has(store.id)) {
      status = 'trial'
    } else if (lastTransactionAt) {
      status = 'active'
    }

    return {
      id: store.id,
      storeName: store.store_name,
      username: usernameByStore.get(store.id) ?? '—',
      status,
      createdAt: store.created_at,
      productCount: 0,
      revenue30d: revenueByStore.get(store.id) ?? 0,
      lastTransactionAt,
    }
  })
}

export function isWithinDays(iso: string, days: number): boolean {
  const time = new Date(iso).getTime()
  return Number.isFinite(time) && Date.now() - time <= days * DAY_MS
}
