import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchTransactions, type TransactionQuery } from '../api'

export function useTransactions(query: TransactionQuery) {
  return useQuery({
    queryKey: ['transactions', query],
    queryFn: () => fetchTransactions(query),
    placeholderData: keepPreviousData,
  })
}
