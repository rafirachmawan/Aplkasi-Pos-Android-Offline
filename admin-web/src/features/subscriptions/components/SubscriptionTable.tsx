import { Crown, ArrowDownCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDate } from '@/lib/format'
import { PLAN_LABEL, PLAN_TONE } from '@/lib/labels'
import type { SubscriptionRow } from '@/types/domain'

interface SubscriptionTableProps {
  rows: SubscriptionRow[]
  loading: boolean
  onActivate: (row: SubscriptionRow) => void
  onReset: (row: SubscriptionRow) => void
}

/** Sisa hari ditampilkan sebagai "sisa N hari"; nol tetap ditulis apa adanya. */
function remainingLabel(days: number | null): string {
  if (days === null) return '—'
  if (days <= 0) return 'Hari ini'
  return `sisa ${days} hari`
}

export function SubscriptionTable({
  rows,
  loading,
  onActivate,
  onReset,
}: SubscriptionTableProps) {
  const columns: DataTableColumn<SubscriptionRow>[] = [
    {
      key: 'store',
      header: 'Toko',
      render: (row) => (
        <div className="min-w-44">
          <p className="font-medium text-ink">{row.storeName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.username ? `@${row.username}` : '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Paket',
      render: (row) => <Badge tone={PLAN_TONE[row.plan]}>{PLAN_LABEL[row.plan]}</Badge>,
    },
    {
      key: 'started',
      header: 'Mulai aktif',
      render: (row) => (
        <span className="whitespace-nowrap text-slate-600">
          {row.plan === 'pro' ? formatDate(row.planStartedAt) : '—'}
        </span>
      ),
    },
    {
      key: 'expires',
      header: 'Berakhir',
      render: (row) => (
        <span className="whitespace-nowrap text-slate-600">
          {row.plan === 'pro' ? formatDate(row.planExpiresAt) : '—'}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'Sisa aktif',
      render: (row) =>
        row.plan === 'pro' ? (
          <Badge tone={row.daysRemaining !== null && row.daysRemaining <= 7 ? 'warning' : 'info'}>
            {remainingLabel(row.daysRemaining)}
          </Badge>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          {row.plan === 'pro' ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              icon={<ArrowDownCircle className="size-3.5" />}
              onClick={() => onReset(row)}
            >
              Kembali Gratis
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              icon={<Crown className="size-3.5" />}
              onClick={() => onActivate(row)}
            >
              Aktifkan Pro
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.storeId}
      loading={loading}
      skeletonRows={6}
      empty={
        <EmptyState
          icon={<Crown className="size-5" />}
          title="Toko tidak ditemukan"
          description="Coba ubah kata kunci atau filter paket."
        />
      }
    />
  )
}
