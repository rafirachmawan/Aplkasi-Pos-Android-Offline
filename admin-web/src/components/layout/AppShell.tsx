import { Suspense, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/cn'
import { env } from '@/lib/env'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

const SIDEBAR_STORAGE_KEY = 'marketpos.admin.sidebarOpen'

function readInitialDesktopSidebar(): boolean {
  try {
    const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY)
    return saved === null ? true : saved === 'true'
  } catch {
    return true
  }
}

function PageFallback() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  )
}

const FOOTER_MODE_TEXT = env.isApi
  ? 'MarketPos Admin Console · Terhubung ke API lokal (read-only)'
  : env.isMock
    ? 'MarketPos Admin Console · Data mock untuk pengembangan lokal'
    : 'MarketPos Admin Console · Mode Supabase'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState<boolean>(readInitialDesktopSidebar)

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(desktopOpen))
    } catch {
      // Abaikan bila localStorage tidak tersedia
    }
  }, [desktopOpen])

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar
        open={mobileOpen}
        desktopOpen={desktopOpen}
        onClose={() => setMobileOpen(false)}
        onDesktopToggle={() => setDesktopOpen((prev) => !prev)}
      />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          desktopOpen ? 'lg:pl-64' : 'lg:pl-0',
        )}
      >
        <Topbar
          mobileOpen={mobileOpen}
          desktopOpen={desktopOpen}
          onMobileToggle={() => setMobileOpen((prev) => !prev)}
          onDesktopToggle={() => setDesktopOpen((prev) => !prev)}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          {FOOTER_MODE_TEXT}
        </footer>
      </div>
    </div>
  )
}
