import { Boxes, LogOut, X } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { NAV_GROUPS } from '@/config/nav'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'

interface SidebarProps {
  open: boolean
  onClose: () => void
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
      hint: 'Read-only · service_role hanya di server',
      dot: 'bg-sky-400',
    }
  : env.isMock
    ? {
        label: 'Mode data: Mock',
        hint: 'Localhost · tidak terhubung ke database produksi',
        dot: 'bg-emerald-400',
      }
    : {
        label: 'Mode data: Supabase',
        hint: 'Integrasi Opsi C belum diaktifkan',
        dot: 'bg-amber-400',
      }

export function Sidebar({ open, onClose }: SidebarProps) {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = () => {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink transition-transform duration-200 lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Navigasi utama"
      >
        <div className="flex items-center justify-between px-5 pb-5 pt-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500 text-white shadow-sm">
              <Boxes className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-white">MarketPos</p>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                Admin Console
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'focus-ring group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-white/10 text-white'
                            : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              'size-4 shrink-0',
                              isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300',
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
          <div className="mb-3 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className={cn('size-1.5 rounded-full', MODE_INFO.dot)} />
              <p className="text-[11px] font-semibold text-slate-200">{MODE_INFO.label}</p>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{MODE_INFO.hint}</p>
          </div>

          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[11px] font-semibold text-white">
              {initials(session?.name ?? 'Admin')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-white">{session?.name ?? 'Admin'}</p>
              <p className="truncate text-[10px] text-slate-500">super_admin</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="focus-ring rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-red-300"
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
