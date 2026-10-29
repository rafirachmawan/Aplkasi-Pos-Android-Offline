import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

interface KpiCardProps {
  label: string
  value: string
  icon: ReactNode
  hint?: string
  delta?: number
  loading?: boolean
}

export function KpiCard({ label, value, icon, hint, delta, loading }: KpiCardProps) {
  const hasDelta = typeof delta === 'number' && delta !== 0
  const positive = (delta ?? 0) >= 0

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12px] font-medium text-slate-500">{label}</p>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        {loading ? (
          <div className="h-8 w-28 animate-pulse rounded-md bg-slate-200" />
        ) : (
          <p className="text-2xl font-bold tracking-tight text-ink">{value}</p>
        )}

        {hasDelta && !loading ? (
          <span
            className={cn(
              'mb-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
              positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700',
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {formatNumber(Math.abs(delta ?? 0))}%
          </span>
        ) : null}
      </div>

      {hint ? <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">{hint}</p> : null}
    </Card>
  )
}
