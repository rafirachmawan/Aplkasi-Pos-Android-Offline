import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Crown,
  ReceiptText,
  RefreshCw,
  Store,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react'
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
    description: 'Lihat profil, produk, kasbon, dan seluruh aktivitas toko.',
  },
  {
    to: '/langganan',
    icon: Crown,
    title: 'Langganan toko',
    description: 'Atur paket Gratis dan Pro untuk setiap toko.',
  },
  {
    to: '/transaksi',
    icon: ReceiptText,
    title: 'Telusuri transaksi',
    description: 'Pantau nota POS, kasbon & cicilan, pesanan meja, dan shift.',
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

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              to="/transaksi?tab=kasbon"
              className="focus-ring group flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-brand-border hover:bg-brand-soft/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Piutang kasbon aktif</p>
                  <p className="text-base font-bold text-ink">
                    {data ? rupiah(data.unpaidDebtAmount) : '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {data ? `${formatNumber(data.unpaidDebtCount)} catatan belum lunas` : ''}
                  </p>
                </div>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-dark" />
            </Link>

            <Link
              to="/transaksi?paymentMethod=kasbon"
              className="focus-ring group flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-brand-border hover:bg-brand-soft/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-brand-border bg-brand-soft text-brand-dark">
                  <ReceiptText className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Transaksi kasbon (30 hari)</p>
                  <p className="text-base font-bold text-ink">
                    {data ? `${formatNumber(data.kasbonTxCount30d)} nota` : '—'}
                  </p>
                  <p className="text-xs text-slate-500">Checkout dengan metode kasbon</p>
                </div>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-dark" />
            </Link>

            <Link
              to="/transaksi?tab=meja"
              className="focus-ring group flex items-center justify-between gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-brand-border hover:bg-brand-soft/30"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-700">
                  <UtensilsCrossed className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500">Pesanan meja menunggu</p>
                  <p className="text-base font-bold text-ink">
                    {data ? `${formatNumber(data.pendingTableOrdersCount)} antrean` : '—'}
                  </p>
                  <p className="text-xs text-slate-500">Pesanan mandiri QR meja F&B</p>
                </div>
              </div>
              <ArrowUpRight className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-brand-dark" />
            </Link>
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
                className="focus-ring group flex items-start gap-3 rounded-xl border border-line bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-brand-border hover:bg-brand-soft/30"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors group-hover:bg-brand-soft group-hover:text-brand-dark">
                  <link.icon className="size-4" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-ink group-hover:text-brand-dark">
                    {link.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{link.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
