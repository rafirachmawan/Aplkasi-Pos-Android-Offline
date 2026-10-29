import { CalendarPlus, KeyRound, ShieldX } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable, type DataTableColumn } from '@/components/ui/Table'
import { formatDate, formatRelative } from '@/lib/format'
import {
  DEVICE_STATUS_LABEL,
  DEVICE_STATUS_TONE,
  LICENSE_STATUS_LABEL,
  LICENSE_STATUS_TONE,
  LICENSE_TYPE_LABEL,
} from '@/lib/labels'
import type { LicenseAction } from '../api'
import type { DeviceRow, LicenseRow } from '@/types/domain'

interface LicenseTableProps {
  rows: LicenseRow[]
  devices: DeviceRow[]
  loading: boolean
  readOnly?: boolean
  onAction: (license: LicenseRow, action: LicenseAction) => void
}

export function LicenseTable({ rows, devices, loading, readOnly = false, onAction }: LicenseTableProps) {
  const deviceMap = new Map(devices.map((device) => [device.deviceId, device]))

  const columns: DataTableColumn<LicenseRow>[] = [
    {
      key: 'device',
      header: 'Perangkat',
      render: (row) => (
        <div className="min-w-40">
          <p className="font-mono text-[11px] font-medium text-ink">{row.deviceId}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{row.storeName}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Tipe',
      render: (row) => <span className="text-slate-700">{LICENSE_TYPE_LABEL[row.licenseType]}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge tone={LICENSE_STATUS_TONE[row.status]}>{LICENSE_STATUS_LABEL[row.status]}</Badge>
      ),
    },
    {
      key: 'activated',
      header: 'Aktivasi',
      render: (row) => <span className="whitespace-nowrap text-slate-600">{formatDate(row.activatedAt)}</span>,
    },
    {
      key: 'expires',
      header: 'Kedaluwarsa',
      render: (row) => (
        <span className="whitespace-nowrap text-slate-600">
          {row.expiresAt ? formatDate(row.expiresAt) : 'Permanen'}
        </span>
      ),
    },
    {
      key: 'lastSeen',
      header: 'Terakhir aktif',
      render: (row) => {
        const device = deviceMap.get(row.deviceId)
        if (!device) return <span className="text-slate-400">—</span>

        return (
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Badge tone={DEVICE_STATUS_TONE[device.status]}>
              {DEVICE_STATUS_LABEL[device.status]}
            </Badge>
            <span className="text-[11px] text-slate-500">{formatRelative(device.lastSeenAt)}</span>
          </div>
        )
      },
    },
    {
      key: 'action',
      header: 'Aksi',
      align: 'right',
      render: (row) => (
        <div className="flex justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            icon={<CalendarPlus className="size-3.5" />}
            onClick={() => onAction(row, 'extend')}
            disabled={readOnly}
            title={readOnly ? 'Mode baca (Opsi B)' : undefined}
          >
            {row.status === 'revoked' ? 'Aktifkan' : 'Perpanjang'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700"
            icon={<ShieldX className="size-3.5" />}
            onClick={() => onAction(row, 'revoke')}
            disabled={readOnly || row.status === 'revoked'}
            title={readOnly ? 'Mode baca (Opsi B)' : undefined}
          >
            Cabut
          </Button>
        </div>
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
      empty={
        <EmptyState
          icon={<KeyRound className="size-5" />}
          title="Perangkat tidak ditemukan"
          description="Coba ubah kata kunci atau filter status lisensi."
        />
      }
    />
  )
}
