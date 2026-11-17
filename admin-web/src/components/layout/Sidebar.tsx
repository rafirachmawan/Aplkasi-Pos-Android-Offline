import { Boxes, LogOut, PanelLeftClose, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { NAV_GROUPS } from '@/config/nav'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'

interface SidebarProps {
  open: boolean
  desktopOpen: boolean
  onClose: () => void
  onDesktopToggle: () => void
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const MODE_INFO = env.isApi
  ? {
      label: 'Mode data: API lokal',
      hint: 'Read-only · service_role di server',
      dot: 'bg-brand-bright',
    }
  : env.isMock
    ? {
        label: 'Mode data: Mock',
        hint: 'Localhost · data pengembangan lokal',
        dot: 'bg-amber-400',
      }
    : {
        label: 'Mode data: Supabase',
        hint: 'Integrasi Opsi C belum diaktifkan',
        dot: 'bg-sky-400',
      }

export function Sidebar({ open, desktopOpen, onClose, onDesktopToggle }: SidebarProps) {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          tabIndex={-1}
          className="fixed inset-0 z-40 animate-fade-in bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-label="Tutup menu navigasi"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full',
          desktopOpen ? 'lg:translate-x-0' : 'lg:-translate-x-full',
        )}
        aria-label="Navigasi utama"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm shadow-brand/30">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">MarketPos</p>
              <p className="text-xs font-medium tracking-wide text-slate-300">
                Admin Console
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="focus-ring inline-flex size-11 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="size-4" />
          </button>

          <button
            type="button"
            onClick={onDesktopToggle}
            className="focus-ring hidden size-11 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white lg:inline-flex"
            aria-label="Tutup sidebar"
            title="Tutup sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-xs font-semibold tracking-wider text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'focus-ring group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-brand/15 text-white ring-1 ring-inset ring-brand/35'
                            : 'text-slate-300 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              'size-4 shrink-0',
                              isActive
                                ? 'text-brand-bright'
                                : 'text-slate-400 group-hover:text-slate-200',
                            )}
                          />
                          {item.label}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className={cn('size-2 rounded-full', MODE_INFO.dot)} />
              <p className="text-xs font-semibold text-slate-100">{MODE_INFO.label}</p>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{MODE_INFO.hint}</p>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/25 text-xs font-semibold text-orange-200 ring-1 ring-brand/40">
              {initials(session?.name ?? 'Admin')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{session?.name ?? 'Admin'}</p>
              <p className="truncate text-xs text-slate-400">super_admin</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="focus-ring inline-flex size-10 items-center justify-center rounded-md text-slate-300 transition-colors hover:bg-white/10 hover:text-red-300"
              aria-label="Keluar"
              title="Keluar"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
