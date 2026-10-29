import type { Paginated } from '@/types/domain'

export const DEFAULT_PAGE_SIZE = 8

export function paginate<T>(rows: T[], page: number, pageSize = DEFAULT_PAGE_SIZE): Paginated<T> {
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(rows.length / safePageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * safePageSize

  return {
    rows: rows.slice(start, start + safePageSize),
    total: rows.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
}
