import { Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDateTime, rupiah } from '@/lib/format'
import { SHIFT_STATUS_LABEL, SHIFT_STATUS_TONE } from '@/lib/labels'
import type { ShiftRow } from '@/types/domain'

interface ShiftTableProps {
  rows: ShiftRow[]
  loading: boolean
  onRowClick: (row: ShiftRow) => void
  hideStore?: boolean
}

export function ShiftTable({ rows, loading, onRowClick, hideStore = false }: ShiftTableProps) {
  const columns: DataTableColumn<ShiftRow>[] = [
    {
      key: 'cashier',
      header: 'Kasir & Shift',
      render: (row) => (
        <div className="min-w-36">
          <p className="font-medium text-ink">{row.cashierName}</p>
          {!hideStore ? <p className="mt-0.5 text-xs text-slate-500">{row.storeName}</p> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={SHIFT_STATUS_TONE[row.status]}>{SHIFT_STATUS_LABEL[row.status]}</Badge>
      ),
    },
    {
      key: 'sales',
      header: 'Penjualan',
      align: 'right',
      render: (row) => (
        <span className="font-semibold tabular-nums text-ink">
          {rupiah(row.totalCashSales + row.totalNonCashSales)}
        </span>
      ),
    },
    {
      key: 'expenses',
      header: 'Kas Keluar',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-slate-700">{rupiah(row.totalExpenses)}</span>
      ),
    },
    {
      key: 'difference',
      header: 'Selisih Laci',
      align: 'right',
      render: (row) => {
        if (row.status === 'open') {
          return <span className="text-xs text-slate-500">Belum tutup</span>
        }
        return (
          <span
            className={
              row.difference === 0
                ? 'font-medium tabular-nums text-emerald-700'
                : 'font-semibold tabular-nums text-amber-700'
            }
          >
            {row.difference >= 0 ? '+' : ''}
            {rupiah(row.difference)}
          </span>
        )
      },
    },
    {
      key: 'startTime',
      header: 'Mulai Shift',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-slate-600">{formatDateTime(row.startTime)}</span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading}
      skeletonRows={5}
      onRowClick={onRowClick}
      empty={
        <EmptyState
          icon={<Clock className="size-5" />}
          title="Belum ada catatan shift kasir"
          description="Rekap buka/tutup shift dan pengeluaran kas kecil akan muncul di sini."
        />
      }
    />
  )
}
