/**
 * Tipe domain ini harus tetap sinkron dengan
 * admin-web/src/types/domain.ts karena respons API dikonsumsi langsung
 * oleh halaman-halaman console.
 */

export type StoreStatus = 'active' | 'trial' | 'inactive'
export type LicenseType = 'lifetime' | 'trial' | 'subscription'
export type LicenseStatus = 'active' | 'expired' | 'revoked'
export type DebtStatus = 'unpaid' | 'partially_paid' | 'paid'
export type TableOrderStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'
export type ShiftStatus = 'open' | 'closed'

/** Tier langganan toko (SaaS manual). Sumber kebenaran: `store_subscriptions`. */
export type Plan = 'free' | 'pro'

export interface AdminSessionDto {
  name: string
  username: string
  role: 'super_admin'
  loggedInAt: string
}

export interface StoreSummary {
  id: string
  storeName: string
  username: string
  status: StoreStatus
  createdAt: string
  productCount: number
  revenue30d: number
  lastTransactionAt: string | null
}

export interface RevenuePoint {
  date: string
  revenue: number
  transactions: number
}

export interface KpiSummary {
  totalStores: number
  activeStores: number
  transactionsToday: number
  revenueToday: number
  revenueTodayDelta: number
  unpaidDebtCount: number
  unpaidDebtAmount: number
  kasbonTxCount30d: number
  pendingTableOrdersCount: number
  revenueSeries: RevenuePoint[]
  topStores: StoreSummary[]
}

export interface LicenseDto {
  id: string
  deviceId: string
  storeId: string
  storeName: string
  licenseType: LicenseType
  status: LicenseStatus
  activatedAt: string
  expiresAt: string | null
  notes: string
}

export interface SubscriptionDto {
  storeId: string
  storeName: string
  username: string
  plan: Plan
  planStartedAt: string | null
  planExpiresAt: string | null
  updatedAt: string
  updatedBy: string
  /** Sisa hari sampai berakhir; null untuk plan 'free' atau tanpa tanggal. */
  daysRemaining: number | null
}

export interface ProductDto {
  id: string
  storeId: string
  productName: string
  category: string
  unit: string
  stockQuantity: number
  minStockThreshold: number
  sellingPrice: number
}

export interface TransactionItemDto {
  productName: string
  quantity: number
  priceAtSale: number
  capitalAtSale: number
}

export interface TransactionDto {
  id: string
  invoiceNumber: string
  storeId: string
  storeName: string
  totalPrice: number
  discountAmount: number
  grandTotal: number
  cashReceived: number
  cashReturn: number
  paymentMethod: string
  paymentNotes: string
  orderType: string
  tableNumber: string
  isOfflineSync: boolean
  createdAt: string
  items: TransactionItemDto[]
}

export interface TransactionSummary {
  count: number
  revenue: number
  kasbonCount: number
  kasbonRevenue: number
}

export interface DebtPaymentDto {
  id: string
  debtId: string
  paymentAmount: number
  paymentMethod: string
  notes: string
  createdAt: string
}

export interface DebtDto {
  id: string
  storeId: string
  storeName: string
  customerName: string
  customerPhone: string
  transactionId: string | null
  invoiceNumber: string
  totalDebt: number
  remainingDebt: number
  paidAmount: number
  dueDate: string | null
  notes: string
  status: DebtStatus
  createdAt: string
  updatedAt: string
  payments: DebtPaymentDto[]
}

export interface DebtSummary {
  count: number
  unpaidCount: number
  partiallyPaidCount: number
  paidCount: number
  totalDebt: number
  totalRemaining: number
  totalPaid: number
}

export interface TableOrderItemDto {
  productName: string
  quantity: number
  price: number
  notes: string
}

export interface TableOrderDto {
  id: string
  storeId: string
  storeName: string
  tableNumber: string
  customerName: string
  customerPhone: string
  totalAmount: number
  paymentMethod: string
  paymentProofUrl: string
  status: TableOrderStatus
  items: TableOrderItemDto[]
  notes: string
  createdAt: string
}

export interface TableOrderSummary {
  count: number
  pendingCount: number
  activeCount: number
  completedCount: number
  totalAmount: number
}

export interface ShiftExpenseDto {
  id: string
  shiftId: string
  amount: number
  category: string
  description: string
  createdAt: string
}

export interface ShiftDto {
  id: string
  storeId: string
  storeName: string
  cashierName: string
  startTime: string
  endTime: string | null
  startingCash: number
  expectedCash: number
  actualCash: number | null
  difference: number
  totalCashSales: number
  totalNonCashSales: number
  totalExpenses: number
  status: ShiftStatus
  notes: string
  createdAt: string
  expenses: ShiftExpenseDto[]
}

export interface ShiftSummary {
  count: number
  openCount: number
  closedCount: number
  totalSales: number
  totalExpenses: number
}

export interface DeviceDto {
  deviceId: string
  storeName: string
  appVersion: string
  lastSeenAt: string
  status: 'online' | 'idle' | 'offline'
}

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
}

export interface StoreDetailDto {
  store: StoreSummary
  products: ProductDto[]
  transactions: TransactionDto[]
  totalTransactionCount: number
  debts: DebtDto[]
  tableOrders: TableOrderDto[]
  shifts: ShiftDto[]
  licenses: LicenseDto[]
}

// ---------------------------------------------------------------------------
// Baris database (kolom yang dibaca console)
// ---------------------------------------------------------------------------

export interface StoreRow {
  id: string
  store_name: string
  created_at: string
}

export interface ProfileRow {
  store_id: string
  username: string
}

export interface LicenseRecord {
  id: string
  device_id: string
  store_id: string | null
  license_type: string
  status: string
  activated_at: string
  expires_at: string | null
  notes: string | null
  created_at: string
}

/** Baris `public.store_subscriptions` (migrasi v9). */
export interface SubscriptionRecord {
  store_id: string
  plan: string
  plan_started_at: string | null
  plan_expires_at: string | null
  updated_at: string
  updated_by: string
}

export interface TransactionRecord {
  id: string
  store_id: string
  invoice_number: string
  total_price?: number | null
  discount_amount?: number | null
  grand_total: number
  cash_received?: number | null
  cash_return?: number | null
  payment_method?: string | null
  payment_notes?: string | null
  order_type?: string | null
  table_number?: string | null
  is_offline_sync?: boolean | null
  created_at: string
}

export interface TransactionDetailRecord {
  transaction_id: string
  product_name: string
  quantity: number
  price_at_sale: number
  capital_at_sale?: number | null
}

export interface DebtPaymentRecord {
  id: string
  store_id: string
  debt_id: string
  payment_amount: number
  payment_method: string | null
  notes: string | null
  created_at: string
}

export interface DebtRecord {
  id: string
  store_id: string
  customer_name: string
  customer_phone: string | null
  transaction_id: string | null
  invoice_number: string | null
  total_debt: number
  remaining_debt: number
  due_date: string | null
  notes: string | null
  status: string
  created_at: string
  updated_at: string | null
}

export interface TableOrderRecord {
  id: string
  store_id: string
  table_number: string | null
  customer_name: string
  customer_phone: string | null
  total_amount: number
  payment_method: string | null
  payment_proof_url: string | null
  status: string
  items: unknown
  notes: string | null
  created_at: string
}

export interface ShiftExpenseRecord {
  id: string
  store_id: string
  shift_id: string
  amount: number
  category: string | null
  description: string
  created_at: string
}

export interface CashierShiftRecord {
  id: string
  store_id: string
  cashier_name: string
  start_time: string
  end_time: string | null
  starting_cash: number
  expected_cash: number | null
  actual_cash: number | null
  difference: number | null
  total_cash_sales: number | null
  total_non_cash_sales: number | null
  total_expenses: number | null
  status: string
  notes: string | null
  created_at: string
}

export interface ProductRecord {
  id: string
  store_id: string
  product_name: string
  category: string
  unit: string
  stock_quantity: number
  min_stock_threshold: number
  selling_price: number
}

export interface Transaction30dRow {
  store_id: string
  grand_total: number
  payment_method?: string | null
  created_at: string
}
