import { HttpError } from '../lib/errors'
import { buildStoreNameMap, mapLicense } from '../lib/mapping'
import { paginate } from '../lib/pagination'
import { supabaseAdmin } from '../lib/supabaseAdmin'
import type {
  Paginated,
  ProductDto,
  ProductRecord,
  StoreDetailDto,
  StoreStatus,
  StoreSummary,
} from '../types'
import { buildSummaries, loadDataset } from './dataset'
import { listRecentStoreTransactions } from './transactions'

export interface StoreListQuery {
  search: string
  status: StoreStatus | 'all'
  page: number
  pageSize: number
}

async function enrichStore(row: StoreSummary): Promise<void> {
  const [countResult, latestResult] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', row.id),
    supabaseAdmin
      .from('transactions')
      .select('created_at')
      .eq('store_id', row.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (countResult.error) {
    throw new HttpError(502, `Gagal menghitung produk toko: ${countResult.error.message}`)
  }
  if (latestResult.error) {
    throw new HttpError(502, `Gagal membaca transaksi terakhir: ${latestResult.error.message}`)
  }

  row.productCount = countResult.count ?? 0
  const latest = latestResult.data as { created_at: string } | null
  row.lastTransactionAt = latest?.created_at ?? row.lastTransactionAt
}

export async function listStores({
  search,
  status,
  page,
  pageSize,
}: StoreListQuery): Promise<Paginated<StoreSummary>> {
  const dataset = await loadDataset()
  const keyword = search.trim().toLowerCase()

  const summaries = buildSummaries(dataset).filter((store) => {
    const matchKeyword =
      !keyword ||
      store.storeName.toLowerCase().includes(keyword) ||
      store.username.toLowerCase().includes(keyword)
    const matchStatus = status === 'all' || store.status === status
    return matchKeyword && matchStatus
  })

  const paged = paginate(summaries, page, pageSize)
  await Promise.all(paged.rows.map((row) => enrichStore(row)))

  return paged
}

function mapProduct(record: ProductRecord): ProductDto {
  return {
    id: record.id,
    storeId: record.store_id,
    productName: record.product_name,
    category: record.category,
    unit: record.unit,
    stockQuantity: record.stock_quantity,
    minStockThreshold: record.min_stock_threshold,
    sellingPrice: record.selling_price,
  }
}

const PRODUCT_LIMIT = 500

export async function getStoreDetail(storeId: string): Promise<StoreDetailDto> {
  const dataset = await loadDataset()
  const store = buildSummaries(dataset).find((row) => row.id === storeId)

  if (!store) throw new HttpError(404, 'Toko tidak ditemukan.')

  const [productsResult] = await Promise.all([
    supabaseAdmin
      .from('products')
      .select(
        'id, store_id, product_name, category, unit, stock_quantity, min_stock_threshold, selling_price',
      )
      .eq('store_id', storeId)
      .order('product_name', { ascending: true })
      .limit(PRODUCT_LIMIT),
    enrichStore(store),
  ])

  if (productsResult.error) {
    throw new HttpError(502, `Gagal membaca produk toko: ${productsResult.error.message}`)
  }

  const storeNameById = buildStoreNameMap(dataset.stores)
  const [products, transactions] = await Promise.all([
    Promise.resolve(((productsResult.data ?? []) as ProductRecord[]).map(mapProduct)),
    listRecentStoreTransactions(storeId, store.storeName),
  ])

  return {
    store,
    products,
    transactions,
    licenses: dataset.licenses
      .filter((license) => license.store_id === storeId)
      .map((license) => mapLicense(license, storeNameById)),
  }
}
