/**
 * Tipe domain ini harus tetap sinkron dengan
 * admin-web/src/types/domain.ts karena respons API dikonsumsi langsung
 * oleh halaman-halaman console.
 */

export type StoreStatus = 'active' | 'trial' | 'inactive'
export type LicenseType = 'lifetime' | 'trial' | 'subscription'
export type LicenseStatus = 'active' | 'expired' | 'revoked'

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
}

export interface TransactionDto {
  id: string
  invoiceNumber: string
  storeId: string
  storeName: string
  grandTotal: number
  paymentMethod: string
  orderType: string
  createdAt: string
  items: TransactionItemDto[]
}

export interface TransactionSummary {
  count: number
  revenue: number
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
  licenses: LicenseDto[]
}

// ---------------------------------------------------------------------------
// Baris database (hanya kolom yang dibaca console)
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

export interface TransactionRecord {
  id: string
  store_id: string
  invoice_number: string
  grand_total: number
  payment_method: string
  order_type: string
  created_at: string
}

export interface TransactionDetailRecord {
  transaction_id: string
  product_name: string
  quantity: number
  price_at_sale: number
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
  created_at: string
}
