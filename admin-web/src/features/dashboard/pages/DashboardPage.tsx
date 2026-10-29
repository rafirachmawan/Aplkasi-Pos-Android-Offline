import { Activity, KeyRound, ReceiptText, RefreshCw, Store, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { KpiCard } from '@/features/dashboard/components/KpiCard'
import { RevenueChart } from '@/features/dashboard/components/RevenueChart'
import { TopStores } from '@/features/dashboard/components/TopStores'
import { useKpi } from '@/features/dashboard/hooks/useKpi'
import { formatNumber, rupiah } from '@/lib/format'

const QUICK_LINKS = [
  {
    to: '/toko',
    icon: Store,
    title: 'Kelola toko',
    description: 'Lihat profil, produk, dan aktivitas setiap toko.',
  },
  {
    to: '/lisensi',
    icon: KeyRound,
    title: 'Lisensi perangkat',
    description: 'Pantau masa trial dan perpanjang lisensi.',
  },
  {
    to: '/transaksi',
    icon: ReceiptText,
    title: 'Telusuri transaksi',
    description: 'Filter nota lintas toko berdasarkan tanggal.',
  },
] as const

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useKpi()

  const today = new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan jaringan toko · ${today}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw className="size-4" />}
            onClick={() => void refetch()}
            disabled={isLoading}
          >
            Muat ulang
          </Button>
        }
      />

      {isError ? (
        <Card>
          <ErrorState message="Gagal memuat ringkasan dashboard." onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Total toko"
              value={data ? formatNumber(data.totalStores) : '—'}
              icon={<Store className="size-4" />}
              hint="Toko terdaftar di jaringan"
              loading={isLoading}
            />
            <KpiCard
              label="Toko aktif 30 hari"
              value={data ? `${formatNumber(data.activeStores)} / ${formatNumber(data.totalStores)}` : '—'}
              icon={<Activity className="size-4" />}
              hint="Memiliki transaksi dalam 30 hari"
              loading={isLoading}
            />
            <KpiCard
              label="Transaksi hari ini"
              value={data ? formatNumber(data.transactionsToday) : '—'}
              icon={<ReceiptText className="size-4" />}
              hint="Nota tercatat sejak 00.00"
              loading={isLoading}
            />
            <KpiCard
              label="Omzet hari ini"
              value={data ? rupiah(data.revenueToday) : '—'}
              icon={<Wallet className="size-4" />}
              hint="Dibanding hari sebelumnya"
              delta={data?.revenueTodayDelta}
              loading={isLoading}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <RevenueChart series={data?.revenueSeries ?? []} loading={isLoading} />
            </div>
            <TopStores stores={data?.topStores ?? []} loading={isLoading} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="focus-ring group flex items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
                  <link.icon className="size-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink">{link.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
