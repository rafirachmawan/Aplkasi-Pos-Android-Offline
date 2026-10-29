import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info' | 'accent'

const TONES: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-red-50 text-red-700 ring-red-600/15',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/15',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  accent: 'bg-ink text-white ring-ink/10',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
