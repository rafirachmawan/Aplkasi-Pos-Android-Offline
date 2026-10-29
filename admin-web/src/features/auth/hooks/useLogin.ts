import { useState } from 'react'
import { useAuth } from '../auth-context'
import type { LoginValues } from '../schema'

export function useLogin() {
  const { signIn } = useAuth()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (values: LoginValues): Promise<boolean> => {
    setIsPending(true)
    setError(null)
    try {
      await signIn(values)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk. Coba lagi.')
      return false
    } finally {
      setIsPending(false)
    }
  }

  return { submit, isPending, error }
}
