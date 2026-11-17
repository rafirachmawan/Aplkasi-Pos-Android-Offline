import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { rupiah } from '@/lib/format'
import type { StoreSummary } from '@/types/domain'

interface TopStoresProps {
  stores: StoreSummary[]
  loading?: boolean
}

export function TopStores({ stores, loading }: TopStoresProps) {
  const maxRevenue = Math.max(1, ...stores.map((store) => store.revenue30d))

  return (
    <Card className="flex flex-col">
      <CardHeader title="Toko teratas" description="Berdasarkan omzet 30 hari terakhir" />

      <div className="flex-1 p-3">
        {loading ? (
          <div className="space-y-3 p-2">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        ) : stores.length === 0 ? (
          <EmptyState title="Belum ada data toko" description="Data akan muncul setelah toko bertransaksi." />
        ) : (
          <ul className="space-y-1">
            {stores.map((store, index) => (
              <li key={store.id}>
                <Link
                  to={`/toko/${store.id}`}
                  className="focus-ring group block rounded-lg px-2.5 py-2.5 transition-colors hover:bg-brand-soft/60"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold',
                        index === 0
                          ? 'bg-brand-soft text-brand-dark ring-1 ring-inset ring-brand-border'
                          : 'bg-slate-100 text-slate-600',
                      )}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink group-hover:text-brand-dark">
                        {store.storeName}
                      </p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{
                            width: `${Math.max(4, (store.revenue30d / maxRevenue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
                      {rupiah(store.revenue30d)}
                    </p>
                    <ArrowUpRight className="size-3.5 shrink-0 text-slate-400 transition-colors group-hover:text-brand-dark" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}
