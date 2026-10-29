import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ALL_NAV_ITEMS } from '@/config/nav'
import { env } from '@/lib/env'

interface TopbarProps {
  onMenuClick: () => void
}

function currentLabel(pathname: string): string {
  const match = ALL_NAV_ITEMS.find((item) =>
    item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
  return match?.label ?? 'Halaman'
}

const MODE_BADGE = env.isApi
  ? {
      label: 'API lokal',
      className: 'border-sky-200 bg-sky-50 text-sky-700',
      dot: 'bg-sky-500',
    }
  : env.isMock
    ? {
        label: 'Mock',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
      }
    : {
        label: 'Supabase',
        className: 'border-amber-200 bg-amber-50 text-amber-700',
        dot: 'bg-amber-500',
      }

export function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()

  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-white/85 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="focus-ring -ml-1 rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
        aria-label="Buka menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden text-slate-400 sm:inline">Admin</span>
        <span className="hidden text-slate-300 sm:inline">/</span>
        <span className="truncate font-medium text-ink">{currentLabel(pathname)}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 md:inline">{today}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${MODE_BADGE.className}`}
        >
          <span className={`size-1.5 rounded-full ${MODE_BADGE.dot}`} />
          {MODE_BADGE.label}
        </span>
      </div>
    </header>
  )
}
