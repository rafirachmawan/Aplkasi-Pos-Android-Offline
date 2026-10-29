import { useQuery } from '@tanstack/react-query'
import { fetchStoreDetail } from '../api'

export function useStoreDetail(storeId: string | undefined) {
  return useQuery({
    queryKey: ['stores', 'detail', storeId],
    queryFn: () => fetchStoreDetail(storeId as string),
    enabled: Boolean(storeId),
  })
}
