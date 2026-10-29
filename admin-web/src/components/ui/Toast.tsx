import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'

interface ToastItem {
  id: string
  message: string
  tone: ToastTone
}

interface ToastContextValue {
  push: (message: string, tone?: ToastTone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLES: Record<ToastTone, { wrapper: string; icon: ReactNode }> = {
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: <CheckCircle2 className="size-4 text-emerald-600" />,
  },
  error: {
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    icon: <AlertTriangle className="size-4 text-red-600" />,
  },
  info: {
    wrapper: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: <Info className="size-4 text-sky-600" />,
  },
}

let toastSequence = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: ToastTone = 'success') => {
      toastSequence += 1
      const id = `toast-${toastSequence}`
      setItems((current) => [...current, { id, message, tone }])
      window.setTimeout(() => remove(id), 4000)
    },
    [remove],
  )

  const value = useMemo<ToastContextValue>(() => ({ push }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className={cn(
              'pointer-events-auto flex animate-slide-up items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm shadow-lg',
              TONE_STYLES[item.tone].wrapper,
            )}
          >
            <span className="mt-0.5 shrink-0">{TONE_STYLES[item.tone].icon}</span>
            <p className="flex-1 leading-snug">{item.message}</p>
            <button
              type="button"
              onClick={() => remove(item.id)}
              className="focus-ring rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
              aria-label="Tutup notifikasi"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast harus dipakai di dalam ToastProvider')

  return useMemo(
    () => ({
      success: (message: string) => context.push(message, 'success'),
      error: (message: string) => context.push(message, 'error'),
      info: (message: string) => context.push(message, 'info'),
    }),
    [context],
  )
}
