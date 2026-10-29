import { useQuery } from '@tanstack/react-query'
import { fetchKpi } from '../api'

export function useKpi() {
  return useQuery({
    queryKey: ['dashboard', 'kpi'],
    queryFn: fetchKpi,
  })
}
