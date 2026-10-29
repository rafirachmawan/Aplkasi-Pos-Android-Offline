import type {
  DeviceRow,
  LicenseRow,
  LicenseStatus,
  LicenseType,
  ProductRow,
  StoreStatus,
  StoreSummary,
  TransactionItem,
  TransactionRow,
} from '@/types/domain'
import { createRandom, pick, randomInt } from './seed'

const DAY = 86_400_000
const NOW = Date.now()

interface StoreSeed {
  name: string
  username: string
  status: StoreStatus
  daysOld: number
}

const STORE_SEEDS: StoreSeed[] = [
  { name: 'Toko Berkah Jaya', username: 'berkahjaya', status: 'active', daysOld: 214 },
  { name: 'Warung Bu Siti', username: 'busiti', status: 'active', daysOld: 168 },
  { name: 'Kelontong Makmur', username: 'makmur', status: 'active', daysOld: 96 },
  { name: 'Sembako Pak Andi', username: 'pakandi', status: 'active', daysOld: 74 },
  { name: 'Toko Sejahtera', username: 'sejahtera', status: 'trial', daysOld: 9 },
  { name: 'Warung Kopi Senja', username: 'kopisenja', status: 'trial', daysOld: 3 },
  { name: 'Toko Sinar Jaya', username: 'sinarjaya', status: 'inactive', daysOld: 132 },
  { name: 'Kelontong Ibu Ratna', username: 'iburratna', status: 'inactive', daysOld: 121 },
  { name: 'Mini Market Anugerah', username: 'anugerah', status: 'active', daysOld: 61 },
]

interface CatalogItem {
  name: string
  category: string
  unit: string
  price: number
}

const CATALOG: CatalogItem[] = [
  { name: 'Beras Premium 5kg', category: 'sembako', unit: 'karung', price: 72_000 },
  { name: 'Minyak Goreng 1L', category: 'sembako', unit: 'botol', price: 18_000 },
  { name: 'Gula Pasir 1kg', category: 'sembako', unit: 'pack', price: 13_500 },
  { name: 'Telur Ayam 1kg', category: 'sembako', unit: 'kg', price: 28_000 },
  { name: 'Mi Instan Goreng', category: 'makanan', unit: 'pcs', price: 3_500 },
  { name: 'Teh Celup 25', category: 'minuman', unit: 'box', price: 8_500 },
  { name: 'Kopi Sachet', category: 'minuman', unit: 'pcs', price: 2_000 },
  { name: 'Susu UHT 1L', category: 'minuman', unit: 'kotak', price: 19_000 },
  { name: 'Air Mineral 600ml', category: 'minuman', unit: 'botol', price: 4_000 },
  { name: 'Sabun Mandi', category: 'kebersihan', unit: 'pcs', price: 4_500 },
  { name: 'Sampo Sachet', category: 'kebersihan', unit: 'pcs', price: 1_500 },
  { name: 'Pasta Gigi', category: 'kebersihan', unit: 'pcs', price: 12_000 },
  { name: 'Detergen 800g', category: 'kebersihan', unit: 'pack', price: 21_000 },
  { name: 'Roti Manis', category: 'makanan', unit: 'pcs', price: 5_000 },
  { name: 'Keripik Singkong', category: 'makanan', unit: 'pack', price: 8_000 },
  { name: 'Es Krim Cup', category: 'makanan', unit: 'cup', price: 6_000 },
  { name: 'Baterai AA', category: 'lainnya', unit: 'pack', price: 7_000 },
  { name: 'Gas LPG 3kg', category: 'sembako', unit: 'tabung', price: 22_000 },
]

const PAYMENT_METHODS = ['cash', 'cash', 'cash', 'qris', 'qris', 'transfer'] as const
const ORDER_TYPES = ['retail', 'retail', 'retail', 'retail', 'dine_in', 'take_away'] as const

const random = createRandom(20261029)

export const stores: StoreSummary[] = []
export const products: ProductRow[] = []
export const transactions: TransactionRow[] = []
export const licenses: LicenseRow[] = []
export const devices: DeviceRow[] = []

const productsByStore = new Map<string, ProductRow[]>()
const invoiceCounters = new Map<string, number>()

function dateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function buildProducts(storeId: string): ProductRow[] {
  const picked = new Set<number>()
  const target = randomInt(6, 9, random)

  while (picked.size < target) {
    picked.add(randomInt(0, CATALOG.length - 1, random))
  }

  return [...picked].map((catalogIndex, index) => {
    const item = CATALOG[catalogIndex]
    const priceJitter = 1 + (randomInt(-6, 8, random) / 100)

    return {
      id: `prd-${storeId}-${index + 1}`,
      storeId,
      productName: item.name,
      category: item.category,
      unit: item.unit,
      stockQuantity: randomInt(3, 84, random),
      minStockThreshold: 5,
      sellingPrice: Math.round((item.price * priceJitter) / 500) * 500,
    }
  })
}

function buildTransactions(storeId: string, storeName: string, seed: StoreSeed): TransactionRow[] {
  const storeProducts = productsByStore.get(storeId) ?? []
  const isInactive = seed.status === 'inactive'
  const count = isInactive ? randomInt(3, 5, random) : randomInt(9, 22, random)
  const rows: TransactionRow[] = []

  for (let index = 0; index < count; index += 1) {
    const dayOffset = isInactive
      ? randomInt(34, 52, random)
      : Math.floor(Math.pow(random(), 1.6) * 30)

    const created = new Date(NOW - dayOffset * DAY)
    created.setHours(randomInt(7, 20, random), randomInt(0, 59, random), 0, 0)

    const key = `${storeId}-${dateKey(created)}`
    const sequence = (invoiceCounters.get(key) ?? 0) + 1
    invoiceCounters.set(key, sequence)

    const itemCount = randomInt(1, 4, random)
    const chosen = new Set<number>()
    while (chosen.size < Math.min(itemCount, storeProducts.length)) {
      chosen.add(randomInt(0, storeProducts.length - 1, random))
    }

    const items: TransactionItem[] = [...chosen].map((productIndex) => {
      const product = storeProducts[productIndex]
      return {
        productName: product.productName,
        quantity: randomInt(1, 3, random),
        priceAtSale: product.sellingPrice,
      }
    })

    rows.push({
      id: `trx-${storeId}-${index + 1}`,
      invoiceNumber: `INV/${dateKey(created)}/${String(sequence).padStart(4, '0')}`,
      storeId,
      storeName,
      grandTotal: items.reduce((sum, item) => sum + item.priceAtSale * item.quantity, 0),
      paymentMethod: pick(PAYMENT_METHODS, random),
      orderType: pick(ORDER_TYPES, random),
      createdAt: created.toISOString(),
      items,
    })
  }

  return rows
}

const THIRTY_DAYS_AGO = NOW - 30 * DAY

STORE_SEEDS.forEach((seed, index) => {
  const storeId = `store-${index + 1}`
  const storeProducts = buildProducts(storeId)
  productsByStore.set(storeId, storeProducts)
  products.push(...storeProducts)

  const storeTransactions = buildTransactions(storeId, seed.name, seed)
  transactions.push(...storeTransactions)

  const recent = storeTransactions.filter((row) => new Date(row.createdAt).getTime() >= THIRTY_DAYS_AGO)
  const lastTransaction = storeTransactions.reduce<string | null>((latest, row) => {
    if (!latest) return row.createdAt
    return new Date(row.createdAt) > new Date(latest) ? row.createdAt : latest
  }, null)

  stores.push({
    id: storeId,
    storeName: seed.name,
    username: seed.username,
    status: seed.status,
    createdAt: new Date(NOW - seed.daysOld * DAY).toISOString(),
    productCount: storeProducts.length,
    revenue30d: recent.reduce((sum, row) => sum + row.grandTotal, 0),
    lastTransactionAt: lastTransaction,
  })
})

transactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

interface LicensePlan {
  storeIndex: number
  type: LicenseType
  status: LicenseStatus
  activatedDaysAgo: number
  expiresInDays: number | null
  notes: string
  lastSeenHoursAgo: number
  appVersion: string
}

const LICENSE_PLANS: LicensePlan[] = [
  { storeIndex: 0, type: 'lifetime', status: 'active', activatedDaysAgo: 180, expiresInDays: null, notes: 'Aktivasi manual dari perangkat', lastSeenHoursAgo: 0.2, appVersion: '1.0.0' },
  { storeIndex: 1, type: 'lifetime', status: 'active', activatedDaysAgo: 150, expiresInDays: null, notes: 'Aktivasi manual dari perangkat', lastSeenHoursAgo: 1.5, appVersion: '1.0.0' },
  { storeIndex: 2, type: 'subscription', status: 'active', activatedDaysAgo: 10, expiresInDays: 20, notes: 'Langganan tahunan', lastSeenHoursAgo: 3, appVersion: '1.0.0' },
  { storeIndex: 3, type: 'lifetime', status: 'active', activatedDaysAgo: 90, expiresInDays: null, notes: '', lastSeenHoursAgo: 26, appVersion: '1.0.0' },
  { storeIndex: 4, type: 'trial', status: 'active', activatedDaysAgo: 9, expiresInDays: 5, notes: 'Masa uji coba', lastSeenHoursAgo: 6, appVersion: '1.0.0' },
  { storeIndex: 5, type: 'trial', status: 'active', activatedDaysAgo: 3, expiresInDays: 11, notes: 'Masa uji coba', lastSeenHoursAgo: 0.5, appVersion: '0.9.4' },
  { storeIndex: 6, type: 'trial', status: 'expired', activatedDaysAgo: 20, expiresInDays: -6, notes: 'Trial berakhir', lastSeenHoursAgo: 24 * 20, appVersion: '0.9.4' },
  { storeIndex: 7, type: 'lifetime', status: 'revoked', activatedDaysAgo: 120, expiresInDays: null, notes: 'Dicabut karena penyalahgunaan', lastSeenHoursAgo: 24 * 35, appVersion: '1.0.0' },
  { storeIndex: 8, type: 'lifetime', status: 'active', activatedDaysAgo: 60, expiresInDays: null, notes: '', lastSeenHoursAgo: 12, appVersion: '1.0.0' },
  { storeIndex: 8, type: 'trial', status: 'active', activatedDaysAgo: 2, expiresInDays: 12, notes: 'Perangkat kasir kedua', lastSeenHoursAgo: 2, appVersion: '1.0.0' },
]

LICENSE_PLANS.forEach((plan, index) => {
  const store = stores[plan.storeIndex]
  const hex = (0x8a3f + index * 977).toString(16).toUpperCase().padStart(4, '0').slice(-4)
  const hex2 = (0xc1d2 + index * 613).toString(16).toUpperCase().padStart(4, '0').slice(-4)
  const deviceId = `MPOS-${hex}-${hex2}`

  licenses.push({
    id: `lic-${index + 1}`,
    deviceId,
    storeId: store.id,
    storeName: store.storeName,
    licenseType: plan.type,
    status: plan.status,
    activatedAt: new Date(NOW - plan.activatedDaysAgo * DAY).toISOString(),
    expiresAt: plan.expiresInDays === null ? null : new Date(NOW + plan.expiresInDays * DAY).toISOString(),
    notes: plan.notes,
  })

  devices.push({
    deviceId,
    storeName: store.storeName,
    appVersion: plan.appVersion,
    lastSeenAt: new Date(NOW - plan.lastSeenHoursAgo * 3_600_000).toISOString(),
    status:
      plan.lastSeenHoursAgo <= 1 ? 'online' : plan.lastSeenHoursAgo <= 24 ? 'idle' : 'offline',
  })
})

export const mockNow = NOW
