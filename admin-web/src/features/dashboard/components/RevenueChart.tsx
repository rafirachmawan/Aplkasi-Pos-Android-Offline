import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { formatDate, formatShortDate, rupiah, rupiahCompact } from '@/lib/format'
import type { RevenuePoint } from '@/types/domain'

const RANGES = [7, 14, 30] as const
type Range = (typeof RANGES)[number]

interface RevenueChartProps {
  series: RevenuePoint[]
  loading?: boolean
}

export function RevenueChart({ series, loading }: RevenueChartProps) {
  const [range, setRange] = useState<Range>(14)
  const data = series.slice(-range)
  const total = data.reduce((sum, point) => sum + point.revenue, 0)
  const transactions = data.reduce((sum, point) => sum + point.transactions, 0)

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Omzet harian"
        description="Total penjualan seluruh toko per hari"
        action={
          <div className="flex rounded-lg border border-line bg-slate-50 p-0.5">
            {RANGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={cn(
                  'focus-ring rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  range === option
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-slate-500 hover:text-ink',
                )}
                aria-pressed={range === option}
              >
                {option} hari
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-x-8 gap-y-2 px-5 pt-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Omzet {range} hari
          </p>
          <p className="mt-1 text-xl font-bold tracking-tight text-ink">{rupiah(total)}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Transaksi</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-ink">{transactions}</p>
        </div>
      </div>

      <div className="h-64 w-full px-2 pb-3 pt-4 sm:h-72">
        {loading ? (
          <div className="flex h-full items-end gap-2 px-3 pb-2">
            {Array.from({ length: range }, (_, index) => (
              <Skeleton
                key={index}
                className="flex-1"
                style={{ height: `${30 + ((index * 37) % 60)}%` }}
              />
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatShortDate(String(value))}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                minTickGap={18}
              />
              <YAxis
                tickFormatter={(value) => rupiahCompact(Number(value))}
                tick={{ fontSize: 11, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                width={62}
              />
              <Tooltip
                formatter={(value) => [rupiah(Number(value)), 'Omzet']}
                labelFormatter={(value) => formatDate(String(value))}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  fontSize: 12,
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={2}
                fill="url(#revenueFill)"
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
