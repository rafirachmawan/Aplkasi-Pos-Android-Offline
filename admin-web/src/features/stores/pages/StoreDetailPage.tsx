import {
  ArrowUpRight,
  BookOpen,
  Clock,
  KeyRound,
  Package,
  ReceiptText,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { DebtDetailModal } from '@/features/transactions/components/DebtDetailModal'
import { DebtTable } from '@/features/transactions/components/DebtTable'
import { ShiftDetailModal } from '@/features/transactions/components/ShiftDetailModal'
import { ShiftTable } from '@/features/transactions/components/ShiftTable'
import { TableOrderDetailModal } from '@/features/transactions/components/TableOrderDetailModal'
import { TableOrderTable } from '@/features/transactions/components/TableOrderTable'
import { TransactionDetailModal } from '@/features/transactions/components/TransactionDetailModal'
import { TransactionTable } from '@/features/transactions/components/TransactionTable'
import { useStoreDetail } from '@/features/stores/hooks/useStoreDetail'
import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatNumber, formatRelative, rupiah } from '@/lib/format'
import {
  LICENSE_STATUS_LABEL,
  LICENSE_STATUS_TONE,
  LICENSE_TYPE_LABEL,
  STORE_STATUS_LABEL,
  STORE_STATUS_TONE,
} from '@/lib/labels'
import type { DebtRow, ProductRow, ShiftRow, TableOrderRow, TransactionRow } from '@/types/domain'

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
      <div className="flex items-center gap-2 text-slate-600">
        <span className="flex size-7 items-center justify-center rounded-md border border-brand-border/60 bg-brand-soft text-brand-dark">
          {icon}
        </span>
        <p className="text-xs font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-2 truncate text-lg font-bold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
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
        <p className="mt-0.5 text-xs capitalize text-slate-500">
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
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium">Menipis</span>
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

type StoreTab = 'transactions' | 'debts' | 'tableOrders' | 'shifts' | 'products'
const DETAIL_PAGE_SIZE = 10

export function StoreDetailPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const { data, isLoading, isError, refetch } = useStoreDetail(storeId)
  const [activeTab, setActiveTab] = useState<StoreTab>('transactions')
  const [txPage, setTxPage] = useState(1)
  const [productPage, setProductPage] = useState(1)

  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null)
  const [selectedDebt, setSelectedDebt] = useState<DebtRow | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<TableOrderRow | null>(null)
  const [selectedShift, setSelectedShift] = useState<ShiftRow | null>(null)

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

  const {
    store,
    products,
    transactions,
    totalTransactionCount,
    debts = [],
    tableOrders = [],
    shifts = [],
    licenses,
  } = data

  const unpaidDebtTotal = debts
    .filter((d) => d.status !== 'paid')
    .reduce((sum, d) => sum + d.remainingDebt, 0)
  const unpaidDebtCount = debts.filter((d) => d.status !== 'paid').length

  const TABS: Array<{ id: StoreTab; label: string; count: number; icon: ReactNode }> = [
    {
      id: 'transactions',
      label: 'Transaksi POS',
      count: totalTransactionCount || transactions.length,
      icon: <ReceiptText className="size-3.5" />,
    },
    {
      id: 'debts',
      label: 'Kasbon',
      count: debts.length,
      icon: <BookOpen className="size-3.5" />,
    },
    {
      id: 'tableOrders',
      label: 'Pesanan Meja',
      count: tableOrders.length,
      icon: <UtensilsCrossed className="size-3.5" />,
    },
    {
      id: 'shifts',
      label: 'Shift Kasir',
      count: shifts.length,
      icon: <Clock className="size-3.5" />,
    },
    {
      id: 'products',
      label: 'Produk & Stok',
      count: products.length,
      icon: <Package className="size-3.5" />,
    },
  ]

  const pagedTransactions = transactions.slice(
    (txPage - 1) * DETAIL_PAGE_SIZE,
    txPage * DETAIL_PAGE_SIZE,
  )

  return (
    <>
      <PageHeader
        title={store.storeName}
        description={`@${store.username} · bergabung ${formatDate(store.createdAt)}`}
        backTo="/toko"
        backLabel="Daftar toko"
        actions={
          <div className="flex items-center gap-2">
            <Link
              to={`/transaksi?storeId=${encodeURIComponent(store.id)}`}
              className="focus-ring inline-flex items-center gap-1 rounded-lg border border-brand-border bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand-dark hover:bg-orange-100"
            >
              Semua transaksi
              <ArrowUpRight className="size-3.5" />
            </Link>
            <Badge tone={STORE_STATUS_TONE[store.status]}>{STORE_STATUS_LABEL[store.status]}</Badge>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total transaksi"
          value={formatNumber(totalTransactionCount || transactions.length)}
          icon={<ReceiptText className="size-3.5" />}
          hint={`Terakhir ${formatRelative(store.lastTransactionAt)}`}
        />
        <StatTile
          label="Omzet 30 hari"
          value={rupiah(store.revenue30d)}
          icon={<Wallet className="size-3.5" />}
          hint="Total penjualan bersih"
        />
        <StatTile
          label="Piutang kasbon"
          value={rupiah(unpaidDebtTotal)}
          icon={<BookOpen className="size-3.5" />}
          hint={`${formatNumber(unpaidDebtCount)} kasbon belum lunas`}
        />
        <StatTile
          label="Produk & Perangkat"
          value={`${formatNumber(store.productCount)} SKU`}
          icon={<Package className="size-3.5" />}
          hint={`${licenses.length} lisensi terhubung`}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        {/* Kolom Kiri (2/3): Data Aktivitas Toko (Transaksi, Kasbon, Pesanan Meja, Shift, Produk) */}
        <div className="space-y-4 xl:col-span-2">
          <div className="flex flex-wrap gap-1.5">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'focus-ring inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors',
                    isActive
                      ? 'border-brand-dark bg-brand-dark text-white shadow-xs'
                      : 'border-line bg-white text-slate-600 hover:border-brand-border hover:bg-brand-soft/40 hover:text-brand-dark',
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                      isActive ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand-dark',
                    )}
                  >
                    {formatNumber(tab.count)}
                  </span>
                </button>
              )
            })}
          </div>

          {activeTab === 'transactions' ? (
            <Card className="overflow-hidden border-slate-200/80 shadow-xs">
              <CardHeader
                title="Riwayat Transaksi POS"
                description={`Menampilkan ${formatNumber(transactions.length)} transaksi terbaru dari total ${formatNumber(totalTransactionCount || transactions.length)} nota`}
                action={
                  <Link
                    to={`/transaksi?storeId=${encodeURIComponent(store.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
                  >
                    Filter lengkap
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                }
              />
              <TransactionTable
                rows={pagedTransactions}
                loading={false}
                onRowClick={setSelectedTx}
                hideStore
              />
              {transactions.length > DETAIL_PAGE_SIZE ? (
                <Pagination
                  page={txPage}
                  pageSize={DETAIL_PAGE_SIZE}
                  total={transactions.length}
                  onPageChange={setTxPage}
                />
              ) : null}
            </Card>
          ) : activeTab === 'debts' ? (
            <Card className="overflow-hidden border-slate-200/80 shadow-xs">
              <CardHeader
                title="Buku Kasbon Pelanggan"
                description={`${formatNumber(debts.length)} catatan kasbon (klik baris untuk melihat riwayat cicilan)`}
                action={
                  <Link
                    to={`/transaksi?tab=kasbon&storeId=${encodeURIComponent(store.id)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline"
                  >
                    Buka di Transaksi
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                }
              />
              <DebtTable
                rows={debts}
                loading={false}
                onRowClick={setSelectedDebt}
                hideStore
              />
            </Card>
          ) : activeTab === 'tableOrders' ? (
            <Card className="overflow-hidden border-slate-200/80 shadow-xs">
              <CardHeader
                title="Pesanan Meja F&B"
                description={`${formatNumber(tableOrders.length)} pesanan QR self-order`}
              />
              <TableOrderTable
                rows={tableOrders}
                loading={false}
                onRowClick={setSelectedOrder}
                hideStore
              />
            </Card>
          ) : activeTab === 'shifts' ? (
            <Card className="overflow-hidden border-slate-200/80 shadow-xs">
              <CardHeader
                title="Shift Kasir"
                description={`${formatNumber(shifts.length)} catatan shift buka/tutup kasir`}
              />
              <ShiftTable
                rows={shifts}
                loading={false}
                onRowClick={setSelectedShift}
                hideStore
              />
            </Card>
          ) : (
            <Card className="overflow-hidden border-slate-200/80 shadow-xs">
              <CardHeader
                title="Daftar Produk"
                description={`${formatNumber(products.length)} produk terdaftar`}
              />
              <DataTable
                columns={PRODUCT_COLUMNS}
                rows={products.slice(
                  (productPage - 1) * DETAIL_PAGE_SIZE,
                  productPage * DETAIL_PAGE_SIZE,
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
              {products.length > DETAIL_PAGE_SIZE ? (
                <Pagination
                  page={productPage}
                  pageSize={DETAIL_PAGE_SIZE}
                  total={products.length}
                  onPageChange={setProductPage}
                />
              ) : null}
            </Card>
          )}
        </div>

        {/* Kolom Kanan (1/3): Sidebar Info Profil & Lisensi Perangkat */}
        <div className="space-y-5">
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader title="Informasi Toko" description="Profil akun kasir & registrasi" />
            <dl className="divide-y divide-slate-100 px-5 py-2 text-sm">
              <div className="py-3">
                <dt className="text-xs font-medium text-slate-500">
                  Username Toko
                </dt>
                <dd className="mt-1 font-medium text-slate-800">@{store.username}</dd>
              </div>
              <div className="py-3">
                <dt className="text-xs font-medium text-slate-500">
                  Tanggal Terdaftar
                </dt>
                <dd className="mt-1 font-medium text-slate-700">{formatDateTime(store.createdAt)}</dd>
              </div>
              <div className="py-3">
                <dt className="text-xs font-medium text-slate-500">
                  Transaksi Terakhir
                </dt>
                <dd className="mt-1 font-medium text-slate-700">
                  {store.lastTransactionAt ? formatDateTime(store.lastTransactionAt) : '-'}
                </dd>
              </div>
              <div className="py-3">
                <dt className="text-xs font-medium text-slate-500">
                  ID Toko (Database)
                </dt>
                <dd className="mt-1 break-all rounded-md border border-slate-200/60 bg-slate-50 p-2 font-mono text-xs text-slate-600">
                  {store.id}
                </dd>
              </div>
            </dl>
          </Card>

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
                      <p className="font-mono text-xs font-medium text-slate-700">
                        {license.deviceId}
                      </p>
                      <Badge tone={LICENSE_STATUS_TONE[license.status]}>
                        {LICENSE_STATUS_LABEL[license.status]}
                      </Badge>
                    </div>
                    <div className="mt-2.5 space-y-1.5 text-xs text-slate-500">
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

      <TransactionDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      <DebtDetailModal debt={selectedDebt} onClose={() => setSelectedDebt(null)} />
      <TableOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <ShiftDetailModal shift={selectedShift} onClose={() => setSelectedShift(null)} />
    </>
  )
}
