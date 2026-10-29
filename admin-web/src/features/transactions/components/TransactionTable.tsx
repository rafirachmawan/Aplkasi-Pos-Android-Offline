import { ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDateTime, rupiah } from '@/lib/format'
import { orderTypeLabel, paymentLabel } from '@/lib/labels'
import type { TransactionRow } from '@/types/domain'

interface TransactionTableProps {
  rows: TransactionRow[]
  loading: boolean
  onRowClick: (row: TransactionRow) => void
}

export function TransactionTable({ rows, loading, onRowClick }: TransactionTableProps) {
  const columns: DataTableColumn<TransactionRow>[] = [
    {
      key: 'invoice',
      header: 'Nota',
      render: (row) => (
        <div className="min-w-36">
          <p className="font-mono text-[11px] font-medium text-ink">{row.invoiceNumber}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{row.storeName}</p>
        </div>
      ),
    },
    {
      key: 'payment',
      header: 'Pembayaran',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="info">{paymentLabel(row.paymentMethod)}</Badge>
          <span className="text-[11px] text-slate-500">{orderTypeLabel(row.orderType)}</span>
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
        <span className="font-semibold tabular-nums text-ink">{rupiah(row.grandTotal)}</span>
      ),
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
          icon={<ReceiptText className="size-5" />}
          title="Transaksi tidak ditemukan"
          description="Ubah rentang tanggal, toko, atau kata kunci pencarian."
        />
      }
    />
  )
}
