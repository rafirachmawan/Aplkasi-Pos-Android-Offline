import { delay, stores, transactions } from '@/mocks'
import { apiRequest } from '@/lib/adminApi'
import { env } from '@/lib/env'
import { supabaseNotReady } from '@/lib/notReady'
import type { KpiSummary, RevenuePoint } from '@/types/domain'

const DAY = 86_400_000
const SERIES_DAYS = 30

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfToday(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

export async function fetchKpi(): Promise<KpiSummary> {
  if (env.isApi) {
    return apiRequest<KpiSummary>('/api/kpi')
  }

  if (!env.isMock) supabaseNotReady()
  await delay(320)

  const today = startOfToday()
  const series: RevenuePoint[] = Array.from({ length: SERIES_DAYS }, (_, index) => {
    const day = new Date(today.getTime() - (SERIES_DAYS - 1 - index) * DAY)
    return { date: day.toISOString(), revenue: 0, transactions: 0 }
  })

  const byDate = new Map(series.map((point) => [localDateKey(new Date(point.date)), point]))

  for (const transaction of transactions) {
    const point = byDate.get(localDateKey(new Date(transaction.createdAt)))
    if (!point) continue
    point.revenue += transaction.grandTotal
    point.transactions += 1
  }

  const todayKey = localDateKey(today)
  const yesterdayKey = localDateKey(new Date(today.getTime() - DAY))

  const todayPoint = byDate.get(todayKey)
  const yesterdayPoint = byDate.get(yesterdayKey)

  const revenueToday = todayPoint?.revenue ?? 0
  const revenueYesterday = yesterdayPoint?.revenue ?? 0
  const revenueTodayDelta =
    revenueYesterday === 0
      ? 0
      : Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100)

  const thirtyDaysAgo = today.getTime() - SERIES_DAYS * DAY
  const activeStores = stores.filter(
    (store) => store.lastTransactionAt && new Date(store.lastTransactionAt).getTime() >= thirtyDaysAgo,
  ).length

  const topStores = [...stores].sort((a, b) => b.revenue30d - a.revenue30d).slice(0, 5)

  return {
    totalStores: stores.length,
    activeStores,
    transactionsToday: todayPoint?.transactions ?? 0,
    revenueToday,
    revenueTodayDelta,
    revenueSeries: series,
    topStores,
  }
}
