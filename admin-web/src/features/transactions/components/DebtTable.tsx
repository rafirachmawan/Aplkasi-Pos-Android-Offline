import { BookOpen } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDate, formatDateTime, rupiah } from '@/lib/format'
import { DEBT_STATUS_LABEL, DEBT_STATUS_TONE } from '@/lib/labels'
import type { DebtRow } from '@/types/domain'

interface DebtTableProps {
  rows: DebtRow[]
  loading: boolean
  onRowClick: (row: DebtRow) => void
  hideStore?: boolean
}

export function DebtTable({ rows, loading, onRowClick, hideStore = false }: DebtTableProps) {
  const columns: DataTableColumn<DebtRow>[] = [
    {
      key: 'customer',
      header: 'Pelanggan & Sumber',
      render: (row) => (
        <div className="min-w-40">
          <p className="font-medium text-ink">{row.customerName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {!hideStore ? `${row.storeName} · ` : ''}
            {row.invoiceNumber ? (
              <span className="font-mono">{row.invoiceNumber}</span>
            ) : (
              'Catat manual'
            )}
            {row.customerPhone ? ` · ${row.customerPhone}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={DEBT_STATUS_TONE[row.status]}>{DEBT_STATUS_LABEL[row.status]}</Badge>
          {row.payments.length > 0 ? (
            <span className="text-xs text-slate-500">{row.payments.length}× cicilan</span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'totalDebt',
      header: 'Total Hutang',
      align: 'right',
      render: (row) => (
        <span className="tabular-nums text-slate-700">{rupiah(row.totalDebt)}</span>
      ),
    },
    {
      key: 'remainingDebt',
      header: 'Sisa Hutang',
      align: 'right',
      render: (row) => (
        <span
          className={
            row.remainingDebt > 0
              ? 'font-semibold tabular-nums text-red-700'
              : 'font-semibold tabular-nums text-emerald-700'
          }
        >
          {rupiah(row.remainingDebt)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Jatuh Tempo',
      align: 'right',
      render: (row) => (
        <span className="whitespace-nowrap text-[12px] text-slate-600">
          {row.dueDate ? formatDate(row.dueDate) : '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Dicatat',
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
          icon={<BookOpen className="size-5" />}
          title="Belum ada data kasbon"
          description="Catatan hutang pelanggan dari Kasir maupun Buku Kasbon akan muncul di sini."
        />
      }
    />
  )
}
