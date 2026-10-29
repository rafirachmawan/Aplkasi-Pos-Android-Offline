import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchStores, type StoreListQuery } from '../api'

export function useStores(query: StoreListQuery) {
  return useQuery({
    queryKey: ['stores', query],
    queryFn: () => fetchStores(query),
    placeholderData: keepPreviousData,
  })
}
