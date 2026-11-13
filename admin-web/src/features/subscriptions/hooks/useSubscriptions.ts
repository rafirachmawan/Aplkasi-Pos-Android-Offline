import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchSubscriptions, type SubscriptionQuery } from '../api'

export function useSubscriptions(query: SubscriptionQuery = {}) {
  return useQuery({
    queryKey: ['subscriptions', query],
    queryFn: () => fetchSubscriptions(query),
    placeholderData: keepPreviousData,
  })
}
