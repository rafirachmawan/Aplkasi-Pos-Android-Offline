export type StoreStatus = 'active' | 'trial' | 'inactive'
export type DebtStatus = 'unpaid' | 'partially_paid' | 'paid'
export type TableOrderStatus = 'pending' | 'accepted' | 'completed' | 'cancelled'
export type ShiftStatus = 'open' | 'closed'

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

export type LicenseType = 'lifetime' | 'trial' | 'subscription'
export type LicenseStatus = 'active' | 'expired' | 'revoked'

/** Tier langganan toko (SaaS manual). */
export type Plan = 'free' | 'pro'

export interface SubscriptionRow {
  storeId: string
  storeName: string
  username: string
  plan: Plan
  planStartedAt: string | null
  planExpiresAt: string | null
  updatedAt: string
  updatedBy: string
  daysRemaining: number | null
}

export interface LicenseRow {
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

export interface ProductRow {
  id: string
  storeId: string
  productName: string
  category: string
  unit: string
  stockQuantity: number
  minStockThreshold: number
  sellingPrice: number
}

export interface TransactionItem {
  productName: string
  quantity: number
  priceAtSale: number
  capitalAtSale: number
}

export interface TransactionRow {
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
  items: TransactionItem[]
}

export interface TransactionSummary {
  count: number
  revenue: number
  kasbonCount: number
  kasbonRevenue: number
}

export interface DebtPaymentRow {
  id: string
  debtId: string
  paymentAmount: number
  paymentMethod: string
  notes: string
  createdAt: string
}

export interface DebtRow {
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
  payments: DebtPaymentRow[]
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

export interface TableOrderItem {
  productName: string
  quantity: number
  price: number
  notes: string
}

export interface TableOrderRow {
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
  items: TableOrderItem[]
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

export interface ShiftExpenseRow {
  id: string
  shiftId: string
  amount: number
  category: string
  description: string
  createdAt: string
}

export interface ShiftRow {
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
  expenses: ShiftExpenseRow[]
}

export interface ShiftSummary {
  count: number
  openCount: number
  closedCount: number
  totalSales: number
  totalExpenses: number
}

export interface DeviceRow {
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

export interface StoreDetail {
  store: StoreSummary
  products: ProductRow[]
  transactions: TransactionRow[]
  totalTransactionCount: number
  debts: DebtRow[]
  tableOrders: TableOrderRow[]
  shifts: ShiftRow[]
  licenses: LicenseRow[]
}
