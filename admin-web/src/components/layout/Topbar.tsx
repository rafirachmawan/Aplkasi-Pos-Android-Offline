import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { ALL_NAV_ITEMS } from '@/config/nav'
import { env } from '@/lib/env'

interface TopbarProps {
  mobileOpen: boolean
  desktopOpen: boolean
  onMobileToggle: () => void
  onDesktopToggle: () => void
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
      className: 'border-brand-border bg-brand-soft text-brand-dark',
      dot: 'bg-brand',
    }
  : env.isMock
    ? {
        label: 'Mock',
        className: 'border-amber-200 bg-amber-50 text-amber-800',
        dot: 'bg-amber-500',
      }
    : {
        label: 'Supabase',
        className: 'border-sky-200 bg-sky-50 text-sky-700',
        dot: 'bg-sky-500',
      }

export function Topbar({
  mobileOpen,
  desktopOpen,
  onMobileToggle,
  onDesktopToggle,
}: TopbarProps) {
  const { pathname } = useLocation()

  const today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMobileToggle}
        className="focus-ring -ml-2 inline-flex size-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-brand-soft/60 hover:text-brand-dark lg:hidden"
        aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
        aria-expanded={mobileOpen}
      >
        <Menu className="size-5" />
      </button>

      <button
        type="button"
        onClick={onDesktopToggle}
        className="focus-ring -ml-2 hidden size-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-brand-soft/60 hover:text-brand-dark lg:inline-flex"
        aria-label={desktopOpen ? 'Tutup sidebar' : 'Buka sidebar'}
        aria-expanded={desktopOpen}
        title={desktopOpen ? 'Tutup sidebar' : 'Buka sidebar'}
      >
        {desktopOpen ? (
          <PanelLeftClose className="size-5" />
        ) : (
          <PanelLeftOpen className="size-5" />
        )}
      </button>

      <div className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden text-slate-500 sm:inline">Admin</span>
        <span className="hidden text-slate-300 sm:inline">/</span>
        <span className="truncate font-semibold text-ink">{currentLabel(pathname)}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-xs text-slate-500 md:inline">{today}</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${MODE_BADGE.className}`}
        >
          <span className={`size-1.5 rounded-full ${MODE_BADGE.dot}`} />
          {MODE_BADGE.label}
        </span>
      </div>
    </header>
  )
}
