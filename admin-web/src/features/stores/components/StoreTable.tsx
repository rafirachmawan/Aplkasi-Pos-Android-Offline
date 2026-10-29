import { ChevronRight, Store } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDate, formatNumber, formatRelative, rupiah } from '@/lib/format'
import { STORE_STATUS_LABEL, STORE_STATUS_TONE } from '@/lib/labels'
import type { StoreSummary } from '@/types/domain'

interface StoreTableProps {
  rows: StoreSummary[]
  loading: boolean
  onRowClick: (store: StoreSummary) => void
}

export function StoreTable({ rows, loading, onRowClick }: StoreTableProps) {
  const columns: DataTableColumn<StoreSummary>[] = [
    {
      key: 'store',
      header: 'Toko',
      render: (store) => (
        <div className="min-w-44">
          <p className="font-medium text-ink">{store.storeName}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            @{store.username} · sejak {formatDate(store.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (store) => (
        <Badge tone={STORE_STATUS_TONE[store.status]}>{STORE_STATUS_LABEL[store.status]}</Badge>
      ),
    },
    {
      key: 'products',
      header: 'Produk',
      align: 'right',
      render: (store) => (
        <span className="tabular-nums text-slate-700">{formatNumber(store.productCount)}</span>
      ),
    },
    {
      key: 'revenue',
      header: 'Omzet 30 hari',
      align: 'right',
      render: (store) => (
        <span className="font-semibold tabular-nums text-ink">{rupiah(store.revenue30d)}</span>
      ),
    },
    {
      key: 'lastTransaction',
      header: 'Transaksi terakhir',
      render: (store) => (
        <span className="whitespace-nowrap text-slate-600">{formatRelative(store.lastTransactionAt)}</span>
      ),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: () => <ChevronRight className="ml-auto size-4 text-slate-300" />,
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(store) => store.id}
      loading={loading}
      onRowClick={onRowClick}
      empty={
        <EmptyState
          icon={<Store className="size-5" />}
          title="Toko tidak ditemukan"
          description="Coba ubah kata kunci pencarian atau filter status."
        />
      }
    />
  )
}
