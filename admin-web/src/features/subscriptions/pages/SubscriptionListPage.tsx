import { Crown, Info, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { PlanActionModal, type PlanAction } from '@/features/subscriptions/components/PlanActionModal'
import { SubscriptionTable } from '@/features/subscriptions/components/SubscriptionTable'
import { useActivatePlan, useResetPlan } from '@/features/subscriptions/hooks/usePlanAction'
import { useSubscriptions } from '@/features/subscriptions/hooks/useSubscriptions'
import { useDebounce } from '@/hooks/useDebounce'
import { env } from '@/lib/env'
import { formatNumber } from '@/lib/format'
import type { Plan, SubscriptionRow } from '@/types/domain'

const PLAN_OPTIONS = [
  { value: 'all', label: 'Semua paket' },
  { value: 'free', label: 'Gratis' },
  { value: 'pro', label: 'Pro' },
]

interface Target {
  row: SubscriptionRow
  action: PlanAction
}

export function SubscriptionListPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [plan, setPlan] = useState<Plan | 'all'>('all')
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, refetch } = useSubscriptions({
    search: debouncedSearch,
    plan,
  })
  const activate = useActivatePlan()
  const reset = useResetPlan()
  const [target, setTarget] = useState<Target | null>(null)

  const rows = useMemo(() => data ?? [], [data])

  const counts = useMemo(
    () => ({
      total: rows.length,
      pro: rows.filter((row) => row.plan === 'pro').length,
      free: rows.filter((row) => row.plan === 'free').length,
      expiringSoon: rows.filter(
        (row) => row.plan === 'pro' && row.daysRemaining !== null && row.daysRemaining <= 7,
      ).length,
    }),
    [rows],
  )

  const hasFilter = search.trim() !== '' || plan !== 'all'
  const pending = activate.isPending || reset.isPending

  const handleConfirm = (days: number) => {
    if (!target) return

    const onSuccess = (updated: SubscriptionRow, message: string) => {
      toast.success(message)
      setTarget(null)
      void updated
    }

    const onError = (error: Error) => {
      toast.error(error.message || 'Gagal mengubah paket langganan.')
    }

    if (target.action === 'activate') {
      activate.mutate(
        { storeId: target.row.storeId, days },
        {
          onSuccess: (updated) =>
            onSuccess(updated, `Paket Pro ${target.row.storeName} aktif ${days} hari.`),
          onError,
        },
      )
      return
    }

    reset.mutate(
      { storeId: target.row.storeId },
      {
        onSuccess: (updated) => onSuccess(updated, `${target.row.storeName} kembali ke Gratis.`),
        onError,
      },
    )
  }

  return (
    <>
      <PageHeader
        title="Langganan"
        description="Atur paket Gratis dan Pro untuk setiap toko. Pembayaran dilakukan manual via WhatsApp."
        actions={<span className="text-xs text-slate-500">{formatNumber(counts.total)} toko</span>}
      />

      {!env.isApi ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-3 text-[12px] leading-relaxed text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
          <p>
            Mode {env.isMock ? 'mock' : 'Supabase'}: perubahan paket belum tersimpan ke database.
            Jalankan admin-api dengan <code>VITE_DATA_MODE=api</code> untuk menyimpan perubahan.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Search className="size-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Total toko</p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.total)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-brand-border bg-brand-soft text-brand-dark">
            <Crown className="size-4" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Paket Pro</p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.pro)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <span className="text-sm font-bold">G</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Gratis</p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.free)}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3 p-4">
          <div className="flex size-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
            <span className="text-sm font-bold">!</span>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Berakhir ≤ 7 hari</p>
            <p className="text-lg font-bold text-ink">{formatNumber(counts.expiringSoon)}</p>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama toko atau username…"
            icon={<Search className="size-4" />}
            containerClassName="w-full sm:max-w-xs"
            aria-label="Cari toko"
          />

          <Select
            value={plan}
            onChange={(event) => setPlan(event.target.value as Plan | 'all')}
            options={PLAN_OPTIONS}
            containerClassName="w-full sm:w-44"
            aria-label="Filter paket"
          />

          {hasFilter ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setPlan('all')
              }}
              icon={<X className="size-3.5" />}
              className="sm:ml-auto"
            >
              Reset filter
            </Button>
          ) : null}
        </div>

        {isError ? (
          <ErrorState
            message="Gagal memuat data langganan. Pastikan migrasi v9 sudah dijalankan."
            onRetry={() => void refetch()}
          />
        ) : (
          <SubscriptionTable
            rows={rows}
            loading={isLoading}
            onActivate={(row) => setTarget({ row, action: 'activate' })}
            onReset={(row) => setTarget({ row, action: 'reset' })}
          />
        )}
      </Card>

      <PlanActionModal
        open={Boolean(target)}
        row={target?.row ?? null}
        action={target?.action ?? null}
        pending={pending}
        onClose={() => setTarget(null)}
        onConfirm={handleConfirm}
      />
    </>
  )
}
