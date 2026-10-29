import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchLicenses, type LicenseQuery } from '../api'

export function useLicenses(query: LicenseQuery) {
  return useQuery({
    queryKey: ['licenses', query],
    queryFn: () => fetchLicenses(query),
    placeholderData: keepPreviousData,
  })
}
