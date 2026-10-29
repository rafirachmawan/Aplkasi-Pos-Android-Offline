import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { totalPages } from '@/lib/pagination'
import { Button } from './Button'

interface PaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const pages = totalPages(total, pageSize)
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
      <p className="text-xs text-slate-500">
        Menampilkan <span className="font-medium text-ink">{formatNumber(start)}</span>–
        <span className="font-medium text-ink">{formatNumber(end)}</span> dari{' '}
        <span className="font-medium text-ink">{formatNumber(total)}</span> data
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          icon={<ChevronLeft className="size-4" />}
        >
          Sebelumnya
        </Button>
        <span className="min-w-16 text-center text-xs text-slate-500">
          {page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
        >
          Berikutnya
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
