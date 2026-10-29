import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { env } from '@/lib/env'
import { queryClient } from '@/lib/queryClient'
import * as authApi from './api'
import type { AdminSession, SignInInput } from './api'
import { AuthContext, type AuthContextValue } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(() => authApi.readSession())
  const [ready, setReady] = useState(() => !env.isApi)

  useEffect(() => {
    if (!env.isApi) return

    let active = true

    void authApi.validateSession().then((validated) => {
      if (!active) return
      setSession(validated)
      setReady(true)
    })

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (input: SignInInput) => {
    const next = await authApi.signIn(input)
    setSession(next)
  }, [])

  const signOut = useCallback(() => {
    void authApi.signOut()
    queryClient.clear()
    setSession(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ session, ready, signIn, signOut }),
    [session, ready, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
