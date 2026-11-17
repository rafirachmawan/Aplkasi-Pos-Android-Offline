import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  fetchDebts,
  fetchShifts,
  fetchTableOrders,
  fetchTransactions,
  type DebtQuery,
  type ShiftQuery,
  type TableOrderQuery,
  type TransactionQuery,
} from '../api'

export function useTransactions(query: TransactionQuery, enabled = true) {
  return useQuery({
    queryKey: ['transactions', query],
    queryFn: () => fetchTransactions(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useDebts(query: DebtQuery, enabled = true) {
  return useQuery({
    queryKey: ['debts', query],
    queryFn: () => fetchDebts(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useTableOrders(query: TableOrderQuery, enabled = true) {
  return useQuery({
    queryKey: ['table-orders', query],
    queryFn: () => fetchTableOrders(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useShifts(query: ShiftQuery, enabled = true) {
  return useQuery({
    queryKey: ['shifts', query],
    queryFn: () => fetchShifts(query),
    placeholderData: keepPreviousData,
    enabled,
  })
}
