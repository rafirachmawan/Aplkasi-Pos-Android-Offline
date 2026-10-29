import { createContext, useContext } from 'react'
import type { AdminSession, SignInInput } from './api'

export interface AuthContextValue {
  session: AdminSession | null
  /** False saat sesi API sedang diverifikasi ke server lokal. */
  ready: boolean
  signIn: (input: SignInInput) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider')
  return context
}
