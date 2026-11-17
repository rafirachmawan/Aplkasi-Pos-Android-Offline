import { jakartaDateKey, startOfJakartaDay } from '../lib/dates'
import type { KpiSummary, RevenuePoint } from '../types'
import { buildSummaries, loadDataset } from './dataset'
import { getGlobalUnpaidDebtStats } from './debts'
import { getGlobalPendingTableOrdersCount } from './tableOrders'

const SERIES_DAYS = 30

export async function getKpi(): Promise<KpiSummary> {
  const [dataset, debtStats, pendingTableOrdersCount] = await Promise.all([
    loadDataset(),
    getGlobalUnpaidDebtStats(),
    getGlobalPendingTableOrdersCount(),
  ])
  const summaries = buildSummaries(dataset)

  const series: RevenuePoint[] = Array.from({ length: SERIES_DAYS }, (_, index) => {
    const date = startOfJakartaDay(new Date(), index - (SERIES_DAYS - 1))
    return { date: date.toISOString(), revenue: 0, transactions: 0 }
  })

  const pointByDate = new Map(series.map((point) => [jakartaDateKey(point.date), point]))

  let kasbonTxCount30d = 0
  for (const transaction of dataset.transactions30d) {
    if (transaction.payment_method === 'kasbon') {
      kasbonTxCount30d += 1
    }
    const point = pointByDate.get(jakartaDateKey(transaction.created_at))
    if (!point) continue
    point.revenue += transaction.grand_total
    point.transactions += 1
  }

  const todayKey = jakartaDateKey(new Date())
  const yesterdayKey = jakartaDateKey(startOfJakartaDay(new Date(), -1))

  const todayPoint = pointByDate.get(todayKey)
  const yesterdayPoint = pointByDate.get(yesterdayKey)

  const revenueToday = todayPoint?.revenue ?? 0
  const revenueYesterday = yesterdayPoint?.revenue ?? 0
  const revenueTodayDelta =
    revenueYesterday === 0
      ? 0
      : Math.round(((revenueToday - revenueYesterday) / revenueYesterday) * 100)

  const activeStores = summaries.filter((store) => store.lastTransactionAt !== null).length

  const topStores = [...summaries]
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, 5)

  return {
    totalStores: summaries.length,
    activeStores,
    transactionsToday: todayPoint?.transactions ?? 0,
    revenueToday,
    revenueTodayDelta,
    unpaidDebtCount: debtStats.count,
    unpaidDebtAmount: debtStats.remaining,
    kasbonTxCount30d,
    pendingTableOrdersCount,
    revenueSeries: series,
    topStores,
  }
}
