import { UtensilsCrossed } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDateTime, rupiah } from '@/lib/format'
import {
  paymentLabel,
  paymentTone,
  TABLE_ORDER_STATUS_LABEL,
  TABLE_ORDER_STATUS_TONE,
} from '@/lib/labels'
import type { TableOrderRow } from '@/types/domain'

interface TableOrderTableProps {
  rows: TableOrderRow[]
  loading: boolean
  onRowClick: (row: TableOrderRow) => void
  hideStore?: boolean
}

export function TableOrderTable({
  rows,
  loading,
  onRowClick,
  hideStore = false,
}: TableOrderTableProps) {
  const columns: DataTableColumn<TableOrderRow>[] = [
    {
      key: 'tableCustomer',
      header: 'Meja & Pemesan',
      render: (row) => (
        <div className="min-w-40">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">
              Meja {row.tableNumber || '—'}
            </span>
            <p className="font-medium text-ink">{row.customerName}</p>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {!hideStore ? `${row.storeName}` : ''}
            {row.customerPhone ? `${!hideStore ? ' · ' : ''}${row.customerPhone}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={TABLE_ORDER_STATUS_TONE[row.status]}>
            {TABLE_ORDER_STATUS_LABEL[row.status]}
          </Badge>
          <Badge tone={paymentTone(row.paymentMethod)}>{paymentLabel(row.paymentMethod)}</Badge>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Item',
      align: 'center',
      render: (row) => (
        <span className="tabular-nums text-slate-600">
          {row.items.reduce((sum, item) => sum + item.quantity, 0)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-ink">{rupiah(row.totalAmount)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Waktu',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-slate-600">{formatDateTime(row.createdAt)}</span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading}
      skeletonRows={6}
      onRowClick={onRowClick}
      empty={
        <EmptyState
          icon={<UtensilsCrossed className="size-5" />}
          title="Belum ada pesanan meja F&B"
          description="Pesanan QR self-order dari meja pelanggan F&B akan muncul di sini."
        />
      }
    />
  )
}
