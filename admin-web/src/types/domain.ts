export type StoreStatus = 'active' | 'trial' | 'inactive'

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
  revenueSeries: RevenuePoint[]
  topStores: StoreSummary[]
}

export type LicenseType = 'lifetime' | 'trial' | 'subscription'
export type LicenseStatus = 'active' | 'expired' | 'revoked'

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
}

export interface TransactionRow {
  id: string
  invoiceNumber: string
  storeId: string
  storeName: string
  grandTotal: number
  paymentMethod: string
  orderType: string
  createdAt: string
  items: TransactionItem[]
}

export interface TransactionSummary {
  count: number
  revenue: number
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
  licenses: LicenseRow[]
}
