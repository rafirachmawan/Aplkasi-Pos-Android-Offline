import { useMutation, useQueryClient } from '@tanstack/react-query'
import { activatePlan, resetPlan, type ActivatePlanInput, type ResetPlanInput } from '../api'

/**
 * Mengubah tier langganan. Setelah berhasil, cache langganan, daftar toko,
 * dan dashboard di-refresh supaya badge plan langsung sinkron.
 */
export function useActivatePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ActivatePlanInput) => activatePlan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['stores'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useResetPlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: ResetPlanInput) => resetPlan(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      void queryClient.invalidateQueries({ queryKey: ['stores'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
