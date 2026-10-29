import { CheckCircle2, Clock, Info, Search, ShieldX, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { LicenseActionModal } from '@/features/licenses/components/LicenseActionModal'
import { LicenseTable } from '@/features/licenses/components/LicenseTable'
import { useLicenseAction } from '@/features/licenses/hooks/useLicenseAction'
import { useLicenses } from '@/features/licenses/hooks/useLicenses'
import { useDevices } from '@/features/devices/hooks/useDevices'
import type { LicenseAction } from '@/features/licenses/api'
import { useDebounce } from '@/hooks/useDebounce'
import { env } from '@/lib/env'
import { formatNumber } from '@/lib/format'
import type { LicenseRow, LicenseStatus } from '@/types/domain'

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'revoked', label: 'Dicabut' },
]

interface Target {
  license: LicenseRow
  action: LicenseAction
}

export function LicenseListPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<LicenseStatus | 'all'>('all')
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, refetch } = useLicenses({ search: debouncedSearch })
  const { data: devices } = useDevices()
  const mutation = useLicenseAction()
  const [target, setTarget] = useState<Target | null>(null)

  const allRows = useMemo(() => data ?? [], [data])
  const rows = useMemo(
    () => (status === 'all' ? allRows : allRows.filter((row) => row.status === status)),
    [allRows, status],
  )

  const counts = useMemo(
    () => ({
      total: allRows.length,
      active: allRows.filter((row) => row.status === 'active').length,
      expired: allRows.filter((row) => row.status === 'expired').length,
      revoked: allRows.filter((row) => row.status === 'revoked').length,
    }),
    [allRows],
  )

  const hasFilter = search.trim() !== '' || status !== 'all'

  const handleConfirm = (days: number) => {
    if (!target) return

    mutation.mutate(
      { deviceId: target.license.deviceId, action: target.action, days },
      {
        onSuccess: (updated) => {
          toast.success(
            target.action === 'extend'
              ? `Lisensi ${updated.deviceId} diperpanjang ${days} hari.`
              : `Lisensi ${updated.deviceId} dicabut.`,
          )
          setTarget(null)
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : 'Gagal memproses lisensi.')
        },
      },
    )
  }

  return (
    <>
      <PageHeader
        title="Lisensi & Perangkat"
        description="Pantau status lisensi perangkat yang terhubung ke jaringan toko."
        actions={
          <span className="text-xs text-slate-500">{formatNumber(counts.total)} perangkat terdaftar</span>
        }
      />

      {!env.canManageLicenses ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-[12px] leading-relaxed text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
          <p>
            Mode baca (Opsi B): data lisensi ditampilkan apa adanya dari database. Perpanjang dan
            cabut lisensi dinonaktifkan sampai migrasi Opsi C dijalankan.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Aktif</p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.active)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <Clock className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Kedaluwarsa
            </p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.expired)}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ShieldX className="size-4" />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Dicabut</p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.revoked)}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari device ID atau nama toko…"
            icon={<Search className="size-4" />}
            containerClassName="w-full sm:max-w-xs"
            aria-label="Cari lisensi"
          />

          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as LicenseStatus | 'all')}
            options={STATUS_OPTIONS}
            containerClassName="w-full sm:w-44"
            aria-label="Filter status lisensi"
          />

          {hasFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setStatus('all')
              }}
              icon={<X className="size-3.5" />}
              className="sm:ml-auto"
            >
              Reset filter
            </Button>
          ) : null}
        </div>

        {isError ? (
          <ErrorState message="Gagal memuat data lisensi." onRetry={() => void refetch()} />
        ) : (
          <LicenseTable
            rows={rows}
            devices={devices ?? []}
            loading={isLoading}
            readOnly={!env.canManageLicenses}
            onAction={(license, action) => setTarget({ license, action })}
          />
        )}
      </Card>

      <LicenseActionModal
        open={Boolean(target)}
        license={target?.license ?? null}
        action={target?.action ?? null}
        pending={mutation.isPending}
        onClose={() => setTarget(null)}
        onConfirm={handleConfirm}
      />
    </>
  )
}
