import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Compass className="size-6" />
      </div>
      <p className="mt-4 text-3xl font-bold tracking-tight text-ink">404</p>
      <h1 className="mt-1 text-sm font-semibold text-ink">Halaman tidak ditemukan</h1>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        Alamat yang Anda buka tidak tersedia di console admin.
      </p>
      <Link to="/" className="mt-4">
        <Button variant="outline" size="sm">
          Kembali ke dashboard
        </Button>
      </Link>
    </div>
  )
}
