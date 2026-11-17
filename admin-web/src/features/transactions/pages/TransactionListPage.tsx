import { BookOpen, Clock, ReceiptText, Search, UtensilsCrossed, Wallet, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { DebtDetailModal } from '@/features/transactions/components/DebtDetailModal'
import { DebtTable } from '@/features/transactions/components/DebtTable'
import { ShiftDetailModal } from '@/features/transactions/components/ShiftDetailModal'
import { ShiftTable } from '@/features/transactions/components/ShiftTable'
import { TableOrderDetailModal } from '@/features/transactions/components/TableOrderDetailModal'
import { TableOrderTable } from '@/features/transactions/components/TableOrderTable'
import { TransactionDetailModal } from '@/features/transactions/components/TransactionDetailModal'
import { TransactionTable } from '@/features/transactions/components/TransactionTable'
import {
  useDebts,
  useShifts,
  useTableOrders,
  useTransactions,
} from '@/features/transactions/hooks/useTransactions'
import { useStores } from '@/features/stores/hooks/useStores'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/cn'
import { daysAgoDateInput, formatNumber, rupiah, toDateInputValue } from '@/lib/format'
import type {
  DebtRow,
  DebtStatus,
  ShiftRow,
  ShiftStatus,
  TableOrderRow,
  TableOrderStatus,
  TransactionRow,
} from '@/types/domain'

const PAGE_SIZE = 10

type LedgerTab = 'pos' | 'kasbon' | 'meja' | 'shift'
type DatePreset = 'all' | 'today' | '7d' | '30d' | 'custom'

const VALID_TABS = new Set<LedgerTab>(['pos', 'kasbon', 'meja', 'shift'])

function SummaryTile({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string
  value: string
  hint?: string
  icon: ReactNode
  tone?: 'brand' | 'slate' | 'emerald' | 'amber' | 'sky'
}) {
  const iconToneClass =
    tone === 'brand'
      ? 'border border-brand-border/70 bg-brand-soft text-brand-dark'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-700'
        : tone === 'amber'
          ? 'bg-amber-50 text-amber-700'
          : tone === 'sky'
            ? 'bg-sky-50 text-sky-700'
            : 'bg-slate-100 text-slate-600'

  return (
    <Card className="flex items-center gap-3 p-4">
      <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', iconToneClass)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="truncate text-lg font-bold text-ink">{value}</p>
        {hint ? <p className="truncate text-xs text-slate-500">{hint}</p> : null}
      </div>
    </Card>
  )
}

export function TransactionListPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawTab = searchParams.get('tab') as LedgerTab | null
  const activeTab: LedgerTab = rawTab && VALID_TABS.has(rawTab) ? rawTab : 'pos'

  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState(() => searchParams.get('storeId') || 'all')
  const [paymentMethod, setPaymentMethod] = useState(
    () => searchParams.get('paymentMethod') || 'all',
  )
  const [orderType, setOrderType] = useState('all')
  const [debtStatus, setDebtStatus] = useState<DebtStatus | 'all'>('all')
  const [tableOrderStatus, setTableOrderStatus] = useState<TableOrderStatus | 'all'>('all')
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus | 'all'>('all')

  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const [selectedTx, setSelectedTx] = useState<TransactionRow | null>(null)
  const [selectedDebt, setSelectedDebt] = useState<DebtRow | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<TableOrderRow | null>(null)
  const [selectedShift, setSelectedShift] = useState<ShiftRow | null>(null)

  const debouncedSearch = useDebounce(search)
  const { data: storeOptions } = useStores({ page: 1, pageSize: 100 })

  const baseQuery = useMemo(
    () => ({
      search: debouncedSearch,
      storeId,
      from,
      to,
      page,
      pageSize: PAGE_SIZE,
    }),
    [debouncedSearch, storeId, from, to, page],
  )

  const txQuery = useTransactions({
    ...baseQuery,
    page: activeTab === 'pos' ? page : 1,
    pageSize: activeTab === 'pos' ? PAGE_SIZE : 1,
    paymentMethod,
    orderType,
  })
  const debtQuery = useDebts({
    ...baseQuery,
    page: activeTab === 'kasbon' ? page : 1,
    pageSize: activeTab === 'kasbon' ? PAGE_SIZE : 1,
    status: debtStatus,
  })
  const orderQuery = useTableOrders({
    ...baseQuery,
    page: activeTab === 'meja' ? page : 1,
    pageSize: activeTab === 'meja' ? PAGE_SIZE : 1,
    status: tableOrderStatus,
  })
  const shiftQuery = useShifts({
    ...baseQuery,
    page: activeTab === 'shift' ? page : 1,
    pageSize: activeTab === 'shift' ? PAGE_SIZE : 1,
    status: shiftStatus,
  })

  const switchTab = (nextTab: LedgerTab) => {
    setPage(1)
    const next = new URLSearchParams(searchParams)
    if (nextTab === 'pos') next.delete('tab')
    else next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  const applyPreset = (preset: Exclude<DatePreset, 'custom'>) => {
    setDatePreset(preset)
    setPage(1)
    if (preset === 'all') {
      setFrom('')
      setTo('')
    } else if (preset === 'today') {
      const today = toDateInputValue(new Date())
      setFrom(today)
      setTo(today)
    } else if (preset === '7d') {
      setFrom(daysAgoDateInput(6))
      setTo(toDateInputValue(new Date()))
    } else {
      setFrom(daysAgoDateInput(29))
      setTo(toDateInputValue(new Date()))
    }
  }

  const hasFilter =
    search.trim() !== '' ||
    storeId !== 'all' ||
    from !== '' ||
    to !== '' ||
    (activeTab === 'pos' && (paymentMethod !== 'all' || orderType !== 'all')) ||
    (activeTab === 'kasbon' && debtStatus !== 'all') ||
    (activeTab === 'meja' && tableOrderStatus !== 'all') ||
    (activeTab === 'shift' && shiftStatus !== 'all')

  const resetFilters = () => {
    setSearch('')
    setStoreId('all')
    setPaymentMethod('all')
    setOrderType('all')
    setDebtStatus('all')
    setTableOrderStatus('all')
    setShiftStatus('all')
    applyPreset('all')
  }

  const TABS: Array<{ id: LedgerTab; label: string; count?: number; icon: ReactNode }> = [
    {
      id: 'pos',
      label: 'Penjualan POS',
      count: txQuery.data?.summary.count,
      icon: <ReceiptText className="size-3.5" />,
    },
    {
      id: 'kasbon',
      label: 'Kasbon & Cicilan',
      count: debtQuery.data?.summary.count,
      icon: <BookOpen className="size-3.5" />,
    },
    {
      id: 'meja',
      label: 'Pesanan Meja F&B',
      count: orderQuery.data?.summary.count,
      icon: <UtensilsCrossed className="size-3.5" />,
    },
    {
      id: 'shift',
      label: 'Shift Kasir',
      count: shiftQuery.data?.summary.count,
      icon: <Clock className="size-3.5" />,
    },
  ]

  const searchPlaceholder =
    activeTab === 'pos'
      ? 'Cari nota, toko, meja, atau catatan…'
      : activeTab === 'kasbon'
        ? 'Cari pelanggan, HP, nota, atau toko…'
        : activeTab === 'meja'
          ? 'Cari pemesan, meja, toko, atau catatan…'
          : 'Cari nama kasir, toko, atau catatan…'

  const activeQuery =
    activeTab === 'pos'
      ? txQuery
      : activeTab === 'kasbon'
        ? debtQuery
        : activeTab === 'meja'
          ? orderQuery
          : shiftQuery

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Seluruh transaksi client lintas toko: penjualan POS, buku kasbon & cicilan, pesanan meja F&B, dan shift kasir."
        actions={
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-white p-1">
            {(
              [
                { id: 'all', label: 'Semua waktu' },
                { id: 'today', label: 'Hari ini' },
                { id: '7d', label: '7 hari' },
                { id: '30d', label: '30 hari' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPreset(item.id)}
                className={cn(
                  'focus-ring rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  datePreset === item.id
                    ? 'bg-brand-dark text-white shadow-xs'
                    : 'text-slate-600 hover:bg-brand-soft/60 hover:text-brand-dark',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Tab Navigasi Sumber Transaksi Client */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchTab(tab.id)}
              className={cn(
                'focus-ring inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors',
                isActive
                  ? 'border-brand-dark bg-brand-dark text-white shadow-xs'
                  : 'border-line bg-white text-slate-600 hover:border-brand-border hover:bg-brand-soft/40 hover:text-brand-dark',
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                    isActive ? 'bg-white/20 text-white' : 'bg-brand-soft text-brand-dark',
                  )}
                >
                  {formatNumber(tab.count)}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* Ringkasan KPI Tab Aktif */}
      {activeTab === 'pos' ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Jumlah transaksi"
            value={txQuery.data ? formatNumber(txQuery.data.summary.count) : '—'}
            hint="Seluruh metode pembayaran"
            icon={<ReceiptText className="size-4" />}
          />
          <SummaryTile
            label="Total omzet"
            value={txQuery.data ? rupiah(txQuery.data.summary.revenue) : '—'}
            hint="Sesuai filter aktif"
            icon={<Wallet className="size-4" />}
            tone="emerald"
          />
          <SummaryTile
            label="Nota kasbon"
            value={txQuery.data ? formatNumber(txQuery.data.summary.kasbonCount) : '—'}
            hint={
              txQuery.data ? rupiah(txQuery.data.summary.kasbonRevenue) : undefined
            }
            icon={<BookOpen className="size-4" />}
            tone="amber"
          />
        </div>
      ) : activeTab === 'kasbon' ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Total kasbon tercatat"
            value={debtQuery.data ? formatNumber(debtQuery.data.summary.count) : '—'}
            hint={
              debtQuery.data
                ? `${formatNumber(debtQuery.data.summary.unpaidCount + debtQuery.data.summary.partiallyPaidCount)} aktif · ${formatNumber(debtQuery.data.summary.paidCount)} lunas`
                : undefined
            }
            icon={<BookOpen className="size-4" />}
          />
          <SummaryTile
            label="Sisa piutang belum lunas"
            value={debtQuery.data ? rupiah(debtQuery.data.summary.totalRemaining) : '—'}
            hint={
              debtQuery.data
                ? `Dari total ${rupiah(debtQuery.data.summary.totalDebt)}`
                : undefined
            }
            icon={<Wallet className="size-4" />}
            tone="amber"
          />
          <SummaryTile
            label="Sudah terbayar / dicicil"
            value={debtQuery.data ? rupiah(debtQuery.data.summary.totalPaid) : '—'}
            icon={<Wallet className="size-4" />}
            tone="emerald"
          />
        </div>
      ) : activeTab === 'meja' ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Total pesanan meja"
            value={orderQuery.data ? formatNumber(orderQuery.data.summary.count) : '—'}
            icon={<UtensilsCrossed className="size-4" />}
          />
          <SummaryTile
            label="Menunggu / Diproses"
            value={
              orderQuery.data
                ? formatNumber(
                    orderQuery.data.summary.pendingCount + orderQuery.data.summary.activeCount,
                  )
                : '—'
            }
            hint={
              orderQuery.data
                ? `${formatNumber(orderQuery.data.summary.pendingCount)} menunggu konfirmasi`
                : undefined
            }
            icon={<Clock className="size-4" />}
            tone="amber"
          />
          <SummaryTile
            label="Total nominal pesanan"
            value={orderQuery.data ? rupiah(orderQuery.data.summary.totalAmount) : '—'}
            icon={<Wallet className="size-4" />}
            tone="emerald"
          />
        </div>
      ) : (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <SummaryTile
            label="Total shift tercatat"
            value={shiftQuery.data ? formatNumber(shiftQuery.data.summary.count) : '—'}
            hint={
              shiftQuery.data
                ? `${formatNumber(shiftQuery.data.summary.openCount)} aktif · ${formatNumber(shiftQuery.data.summary.closedCount)} tutup`
                : undefined
            }
            icon={<Clock className="size-4" />}
          />
          <SummaryTile
            label="Penjualan selama shift"
            value={shiftQuery.data ? rupiah(shiftQuery.data.summary.totalSales) : '—'}
            icon={<Wallet className="size-4" />}
            tone="emerald"
          />
          <SummaryTile
            label="Pengeluaran kas kecil"
            value={shiftQuery.data ? rupiah(shiftQuery.data.summary.totalExpenses) : '—'}
            icon={<Wallet className="size-4" />}
            tone="amber"
          />
        </div>
      )}

      {/* Filter & Data Table */}
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="min-w-52 flex-1">
            <Input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder={searchPlaceholder}
              icon={<Search className="size-4" />}
              aria-label="Cari data transaksi"
            />
          </div>

          <div className="w-44">
            <Select
              value={storeId}
              onChange={(event) => {
                setStoreId(event.target.value)
                setPage(1)
              }}
              options={[
                { value: 'all', label: 'Semua toko' },
                ...(storeOptions?.rows ?? []).map((store) => ({
                  value: store.id,
                  label: store.storeName,
                })),
              ]}
              aria-label="Filter toko"
            />
          </div>

          {activeTab === 'pos' ? (
            <>
              <div className="w-40">
                <Select
                  value={paymentMethod}
                  onChange={(event) => {
                    setPaymentMethod(event.target.value)
                    setPage(1)
                  }}
                  options={[
                    { value: 'all', label: 'Semua pembayaran' },
                    { value: 'cash', label: 'Tunai' },
                    { value: 'qris', label: 'QRIS' },
                    { value: 'transfer', label: 'Transfer Bank' },
                    { value: 'debit', label: 'Debit / EDC' },
                    { value: 'kasbon', label: 'Kasbon' },
                  ]}
                  aria-label="Filter metode pembayaran"
                />
              </div>
              <div className="w-36">
                <Select
                  value={orderType}
                  onChange={(event) => {
                    setOrderType(event.target.value)
                    setPage(1)
                  }}
                  options={[
                    { value: 'all', label: 'Semua tipe' },
                    { value: 'retail', label: 'Retail' },
                    { value: 'dine_in', label: 'Dine in' },
                    { value: 'take_away', label: 'Take away' },
                  ]}
                  aria-label="Filter tipe pesanan"
                />
              </div>
            </>
          ) : activeTab === 'kasbon' ? (
            <div className="w-40">
              <Select
                value={debtStatus}
                onChange={(event) => {
                  setDebtStatus(event.target.value as DebtStatus | 'all')
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Semua status' },
                  { value: 'unpaid', label: 'Belum lunas' },
                  { value: 'partially_paid', label: 'Cicilan' },
                  { value: 'paid', label: 'Lunas' },
                ]}
                aria-label="Filter status kasbon"
              />
            </div>
          ) : activeTab === 'meja' ? (
            <div className="w-40">
              <Select
                value={tableOrderStatus}
                onChange={(event) => {
                  setTableOrderStatus(event.target.value as TableOrderStatus | 'all')
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Semua status' },
                  { value: 'pending', label: 'Menunggu' },
                  { value: 'accepted', label: 'Diproses' },
                  { value: 'completed', label: 'Selesai' },
                  { value: 'cancelled', label: 'Dibatalkan' },
                ]}
                aria-label="Filter status pesanan meja"
              />
            </div>
          ) : (
            <div className="w-40">
              <Select
                value={shiftStatus}
                onChange={(event) => {
                  setShiftStatus(event.target.value as ShiftStatus | 'all')
                  setPage(1)
                }}
                options={[
                  { value: 'all', label: 'Semua status' },
                  { value: 'open', label: 'Sedang berjalan' },
                  { value: 'closed', label: 'Ditutup' },
                ]}
                aria-label="Filter status shift"
              />
            </div>
          )}

          <div className="w-36">
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value)
                setDatePreset('custom')
                setPage(1)
              }}
              aria-label="Tanggal mulai"
            />
          </div>

          <div className="w-36">
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value)
                setDatePreset('custom')
                setPage(1)
              }}
              aria-label="Tanggal akhir"
            />
          </div>

          {hasFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              icon={<X className="size-3.5" />}
            >
              Reset
            </Button>
          ) : null}
        </div>

        {activeQuery.isError ? (
          <ErrorState message="Gagal memuat data dari server." onRetry={() => void activeQuery.refetch()} />
        ) : activeTab === 'pos' ? (
          <>
            <TransactionTable
              rows={txQuery.data?.data.rows ?? []}
              loading={txQuery.isLoading}
              onRowClick={setSelectedTx}
            />
            {txQuery.data ? (
              <Pagination
                page={txQuery.data.data.page}
                pageSize={txQuery.data.data.pageSize}
                total={txQuery.data.data.total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : activeTab === 'kasbon' ? (
          <>
            <DebtTable
              rows={debtQuery.data?.data.rows ?? []}
              loading={debtQuery.isLoading}
              onRowClick={setSelectedDebt}
            />
            {debtQuery.data ? (
              <Pagination
                page={debtQuery.data.data.page}
                pageSize={debtQuery.data.data.pageSize}
                total={debtQuery.data.data.total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : activeTab === 'meja' ? (
          <>
            <TableOrderTable
              rows={orderQuery.data?.data.rows ?? []}
              loading={orderQuery.isLoading}
              onRowClick={setSelectedOrder}
            />
            {orderQuery.data ? (
              <Pagination
                page={orderQuery.data.data.page}
                pageSize={orderQuery.data.data.pageSize}
                total={orderQuery.data.data.total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : (
          <>
            <ShiftTable
              rows={shiftQuery.data?.data.rows ?? []}
              loading={shiftQuery.isLoading}
              onRowClick={setSelectedShift}
            />
            {shiftQuery.data ? (
              <Pagination
                page={shiftQuery.data.data.page}
                pageSize={shiftQuery.data.data.pageSize}
                total={shiftQuery.data.data.total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <TransactionDetailModal transaction={selectedTx} onClose={() => setSelectedTx(null)} />
      <DebtDetailModal debt={selectedDebt} onClose={() => setSelectedDebt(null)} />
      <TableOrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      <ShiftDetailModal shift={selectedShift} onClose={() => setSelectedShift(null)} />
    </>
  )
}
