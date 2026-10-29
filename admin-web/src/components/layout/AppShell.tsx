import { Suspense, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Skeleton } from '@/components/ui/Skeleton'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

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

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>

        <footer className="mx-auto w-full max-w-7xl px-4 pb-6 text-[11px] text-slate-400 sm:px-6 lg:px-8">
          MarketPos Admin Console · Data mock untuk pengembangan lokal
        </footer>
      </div>
    </div>
  )
}
