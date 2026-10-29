import type { Paginated } from '../types'

export const DEFAULT_PAGE_SIZE = 8
export const MAX_PAGE_SIZE = 200

export function normalizePagination(
  page: number,
  pageSize: number,
): { page: number; pageSize: number } {
  return {
    page: Math.max(1, Math.trunc(page) || 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize) || DEFAULT_PAGE_SIZE)),
  }
}

export function paginate<T>(rows: T[], page: number, pageSize: number): Paginated<T> {
  const safe = normalizePagination(page, pageSize)
  const totalPages = Math.max(1, Math.ceil(rows.length / safe.pageSize))
  const currentPage = Math.min(safe.page, totalPages)
  const start = (currentPage - 1) * safe.pageSize

  return {
    rows: rows.slice(start, start + safe.pageSize),
    total: rows.length,
    page: currentPage,
    pageSize: safe.pageSize,
  }
}
