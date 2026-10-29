import { ReceiptText, Search, Wallet, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { Select } from '@/components/ui/Select'
import { TransactionDetailModal } from '@/features/transactions/components/TransactionDetailModal'
import { TransactionTable } from '@/features/transactions/components/TransactionTable'
import { useTransactions } from '@/features/transactions/hooks/useTransactions'
import { useStores } from '@/features/stores/hooks/useStores'
import { useDebounce } from '@/hooks/useDebounce'
import { daysAgoDateInput, formatNumber, rupiah, toDateInputValue } from '@/lib/format'
import type { TransactionRow } from '@/types/domain'

const PAGE_SIZE = 10

export function TransactionListPage() {
  const [search, setSearch] = useState('')
  const [storeId, setStoreId] = useState('all')
  const [from, setFrom] = useState(() => daysAgoDateInput(30))
  const [to, setTo] = useState(() => toDateInputValue(new Date()))
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<TransactionRow | null>(null)

  const debouncedSearch = useDebounce(search)
  const { data: storeOptions } = useStores({ page: 1, pageSize: 100 })

  const query = useMemo(
    () => ({ search: debouncedSearch, storeId, from, to, page, pageSize: PAGE_SIZE }),
    [debouncedSearch, storeId, from, to, page],
  )

  const { data, isLoading, isError, refetch } = useTransactions(query)
  const defaultFrom = daysAgoDateInput(30)
  const defaultTo = toDateInputValue(new Date())
  const hasFilter =
    search.trim() !== '' || storeId !== 'all' || from !== defaultFrom || to !== defaultTo

  const resetFilters = () => {
    setSearch('')
    setStoreId('all')
    setFrom(defaultFrom)
    setTo(defaultTo)
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Telusuri nota lintas toko untuk periode tertentu."
        actions={
          data ? (
            <span className="text-xs text-slate-500">
              {formatNumber(data.summary.count)} nota pada periode ini
            </span>
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ReceiptText className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Jumlah transaksi
            </p>
            <p className="text-lg font-bold text-ink">
              {data ? formatNumber(data.summary.count) : '—'}
            </p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <Wallet className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Total omzet
            </p>
            <p className="text-lg font-bold text-ink">{data ? rupiah(data.summary.revenue) : '—'}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="grid gap-2 border-b border-line px-4 py-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_9.5rem_9.5rem_auto]">
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Cari nomor nota atau toko…"
            icon={<Search className="size-4" />}
            aria-label="Cari transaksi"
          />

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

          <Input
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value)
              setPage(1)
            }}
            aria-label="Tanggal mulai"
          />

          <Input
            type="date"
            value={to}
            onChange={(event) => {
              setTo(event.target.value)
              setPage(1)
            }}
            aria-label="Tanggal akhir"
          />

          {hasFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              icon={<X className="size-3.5" />}
              className="justify-start lg:justify-center"
            >
              Reset
            </Button>
          ) : null}
        </div>

        {isError ? (
          <ErrorState message="Gagal memuat transaksi." onRetry={() => void refetch()} />
        ) : (
          <>
            <TransactionTable
              rows={data?.data.rows ?? []}
              loading={isLoading}
              onRowClick={setSelected}
            />

            {data ? (
              <Pagination
                page={data.data.page}
                pageSize={data.data.pageSize}
                total={data.data.total}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </Card>

      <TransactionDetailModal transaction={selected} onClose={() => setSelected(null)} />
    </>
  )
}
