import type {
  LicenseDto,
  LicenseRecord,
  LicenseStatus,
  LicenseType,
  StoreStatus,
  StoreSummary,
  TransactionDetailRecord,
  TransactionDto,
  TransactionRecord,
  Transaction30dRow,
} from '../types'

const LICENSE_TYPES = new Set<LicenseType>(['lifetime', 'trial', 'subscription'])
const LICENSE_STATUSES = new Set<LicenseStatus>(['active', 'expired', 'revoked'])

function toLicenseType(value: string): LicenseType {
  return LICENSE_TYPES.has(value as LicenseType) ? (value as LicenseType) : 'lifetime'
}

function toLicenseStatus(value: string): LicenseStatus {
  return LICENSE_STATUSES.has(value as LicenseStatus) ? (value as LicenseStatus) : 'expired'
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
  return {
    id: record.id,
    invoiceNumber: record.invoice_number,
    storeId: record.store_id,
    storeName,
    grandTotal: record.grand_total,
    paymentMethod: record.payment_method || 'cash',
    orderType: record.order_type || 'retail',
    createdAt: record.created_at,
    items: items.map((item) => ({
      productName: item.product_name,
      quantity: item.quantity,
      priceAtSale: item.price_at_sale,
    })),
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
