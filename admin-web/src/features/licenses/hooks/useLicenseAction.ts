import { useMutation, useQueryClient } from '@tanstack/react-query'
import { applyLicenseAction, type LicenseActionInput } from '../api'

export function useLicenseAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: LicenseActionInput) => applyLicenseAction(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['licenses'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      void queryClient.invalidateQueries({ queryKey: ['stores'] })
    },
  })
}
