import { KeyRound, Package, ReceiptText, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import { useStoreDetail } from '@/features/stores/hooks/useStoreDetail'
import { formatDate, formatDateTime, formatNumber, formatRelative, rupiah } from '@/lib/format'
import {
  LICENSE_STATUS_LABEL,
  LICENSE_STATUS_TONE,
  LICENSE_TYPE_LABEL,
  STORE_STATUS_LABEL,
  STORE_STATUS_TONE,
} from '@/lib/labels'
import type { ProductRow, TransactionRow } from '@/types/domain'
import { useParams } from 'react-router-dom'
import { useState, type ReactNode } from 'react'

function StatTile({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: string
  icon: ReactNode
  hint?: string
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="flex size-7 items-center justify-center rounded-md bg-slate-100">{icon}</span>
        <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-bold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </Card>
  )
}

const PRODUCT_COLUMNS: DataTableColumn<ProductRow>[] = [
  {
    key: 'name',
    header: 'Produk',
    render: (product) => (
      <div>
        <p className="font-medium text-ink">{product.productName}</p>
        <p className="mt-0.5 text-[11px] capitalize text-slate-500">
          {product.category} · per {product.unit}
        </p>
      </div>
    ),
  },
  {
    key: 'stock',
    header: 'Stok',
    align: 'right',
    render: (product) => {
      const low = product.stockQuantity <= product.minStockThreshold
      return (
        <span
          className={
            low
              ? 'inline-flex items-center gap-1.5 font-semibold tabular-nums text-red-600'
              : 'tabular-nums text-slate-700'
          }
        >
          {formatNumber(product.stockQuantity)}
          {low ? (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium">Menipis</span>
          ) : null}
        </span>
      )
    },
  },
  {
    key: 'price',
    header: 'Harga jual',
    align: 'right',
    render: (product) => <span className="tabular-nums text-slate-700">{rupiah(product.sellingPrice)}</span>,
  },
]

const TRANSACTION_COLUMNS: DataTableColumn<TransactionRow>[] = [
  {
    key: 'invoice',
    header: 'Nota',
    render: (row) => <span className="font-mono text-[12px] text-slate-700">{row.invoiceNumber}</span>,
  },
  {
    key: 'total',
    header: 'Total',
    align: 'right',
    render: (row) => <span className="font-semibold tabular-nums text-ink">{rupiah(row.grandTotal)}</span>,
  },
  {
    key: 'time',
    header: 'Waktu',
    align: 'right',
    render: (row) => (
      <span className="whitespace-nowrap text-slate-600">{formatDateTime(row.createdAt)}</span>
    ),
  },
]

export function StoreDetailPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const { data, isLoading, isError, refetch } = useStoreDetail(storeId)
  const [productPage, setProductPage] = useState(1)
  const PRODUCT_PAGE_SIZE = 10

  if (isLoading) {
    return (
      <>
        <PageHeader title="Memuat toko…" backTo="/toko" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-4 h-64" />
      </>
    )
  }

  if (isError || !data) {
    return (
      <>
        <PageHeader title="Detail toko" backTo="/toko" />
        <Card>
          <ErrorState message="Toko tidak ditemukan atau gagal dimuat." onRetry={() => void refetch()} />
        </Card>
      </>
    )
  }

  const { store, products, transactions, licenses } = data

  return (
    <>
      <PageHeader
        title={store.storeName}
        description={`@${store.username} · bergabung ${formatDate(store.createdAt)}`}
        backTo="/toko"
        backLabel="Daftar toko"
        actions={
          <Badge tone={STORE_STATUS_TONE[store.status]}>{STORE_STATUS_LABEL[store.status]}</Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Produk"
          value={formatNumber(store.productCount)}
          icon={<Package className="size-3.5" />}
          hint="SKU aktif di toko"
        />
        <StatTile
          label="Omzet 30 hari"
          value={rupiah(store.revenue30d)}
          icon={<Wallet className="size-3.5" />}
          hint="Total penjualan bersih"
        />
        <StatTile
          label="Transaksi terakhir"
          value={formatRelative(store.lastTransactionAt)}
          icon={<ReceiptText className="size-3.5" />}
          hint={store.lastTransactionAt ? formatDateTime(store.lastTransactionAt) : undefined}
        />
        <StatTile
          label="Perangkat"
          value={`${licenses.length} terdaftar`}
          icon={<KeyRound className="size-3.5" />}
          hint="Lisensi terhubung ke toko ini"
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* Kolom Kiri (2/3): Data Utama (Produk & Transaksi) */}
        <div className="space-y-5 xl:col-span-2">
          {/* Card Produk */}
          <Card className="overflow-hidden border-slate-200/80 shadow-xs">
            <CardHeader
              title="Daftar Produk"
              description={`${formatNumber(products.length)} produk terdaftar`}
            />
            <DataTable
              columns={PRODUCT_COLUMNS}
              rows={products.slice(
                (productPage - 1) * PRODUCT_PAGE_SIZE,
                productPage * PRODUCT_PAGE_SIZE
              )}
              rowKey={(product) => product.id}
              skeletonRows={4}
              empty={
                <EmptyState
                  icon={<Package className="size-5" />}
                  title="Belum ada produk"
                  description="Toko ini belum menambahkan produk."
                />
              }
            />
            {products.length > PRODUCT_PAGE_SIZE && (
              <Pagination
                page={productPage}
                pageSize={PRODUCT_PAGE_SIZE}
                total={products.length}
                onPageChange={setProductPage}
              />
            )}
          </Card>

          {/* Card Transaksi Terakhir */}
          <Card className="overflow-hidden border-slate-200/80 shadow-xs">
            <CardHeader title="Transaksi Terakhir" description="Maksimal 12 nota penjualan terbaru" />
            <DataTable
              columns={TRANSACTION_COLUMNS}
              rows={transactions}
              rowKey={(row) => row.id}
              skeletonRows={4}
              empty={
                <EmptyState
                  icon={<ReceiptText className="size-5" />}
                  title="Belum ada transaksi"
                  description="Belum ada penjualan tercatat untuk toko ini."
                />
              }
            />
          </Card>
        </div>

        {/* Kolom Kanan (1/3): Sidebar Info Profil & Lisensi Perangkat */}
        <div className="space-y-5">
          {/* Card Informasi Toko */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader title="Informasi Toko" description="Profil akun kasir & registrasi" />
            <dl className="divide-y divide-slate-100 px-5 py-2 text-sm">
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Username Toko</dt>
                <dd className="mt-1 font-medium text-slate-800">@{store.username}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Tanggal Terdaftar</dt>
                <dd className="mt-1 font-medium text-slate-700">{formatDateTime(store.createdAt)}</dd>
              </div>
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Transaksi Terakhir
                </dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {store.lastTransactionAt ? formatDateTime(store.lastTransactionAt) : '-'}
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">ID Toko (Database)</dt>
                <dd className="mt-1 break-all font-mono text-[11px] text-slate-500 bg-slate-50 p-2 rounded-md border border-slate-200/60">
                  {store.id}
                </dd>
              </div>
            </dl>
          </Card>

          {/* Card Lisensi Perangkat */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader title="Lisensi Perangkat" description="Status perangkat kasir terhubung" />
            <div className="divide-y divide-line">
              {licenses.length === 0 ? (
                <EmptyState
                  icon={<KeyRound className="size-5" />}
                  title="Belum ada perangkat"
                  description="Lisensi akan muncul setelah perangkat mengaktifkan aplikasi."
                />
              ) : (
                licenses.map((license) => (
                  <div key={license.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-mono text-[11px] font-medium text-slate-700">{license.deviceId}</p>
                      <Badge tone={LICENSE_STATUS_TONE[license.status]}>
                        {LICENSE_STATUS_LABEL[license.status]}
                      </Badge>
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-[11px] text-slate-500">
                      <p>
                        Tipe:{' '}
                        <span className="font-medium text-slate-700">
                          {LICENSE_TYPE_LABEL[license.licenseType]}
                        </span>
                      </p>
                      <p>
                        Kedaluwarsa:{' '}
                        <span className="font-medium text-slate-700">
                          {license.expiresAt ? formatDate(license.expiresAt) : 'Permanen'}
                        </span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
