import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  backTo?: string
  backLabel?: string
}

export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = 'Kembali',
}: PageHeaderProps) {
  return (
    <div className="mb-6">
      {backTo ? (
        <Link
          to={backTo}
          className="focus-ring mb-3 inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-3.5" />
          {backLabel}
        </Link>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
