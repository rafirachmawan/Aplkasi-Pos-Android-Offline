import { useQuery } from '@tanstack/react-query'
import { fetchDevices } from '../api'

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
  })
}
