import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDebounce } from '@/hooks/useDebounce'
import { StoreFilters } from '@/features/stores/components/StoreFilters'
import { StoreTable } from '@/features/stores/components/StoreTable'
import { useStores } from '@/features/stores/hooks/useStores'
import { formatNumber } from '@/lib/format'
import type { StoreStatus } from '@/types/domain'

const PAGE_SIZE = 8

export function StoreListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StoreStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const debouncedSearch = useDebounce(search)

  const { data, isLoading, isError, refetch } = useStores({
    search: debouncedSearch,
    status,
    page,
    pageSize: PAGE_SIZE,
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleStatus = (value: StoreStatus | 'all') => {
    setStatus(value)
    setPage(1)
  }

  const handleReset = () => {
    setSearch('')
    setStatus('all')
    setPage(1)
  }

  return (
    <>
      <PageHeader
        title="Toko"
        description="Seluruh toko yang terdaftar di jaringan MarketPos."
        actions={
          data ? (
            <span className="text-xs text-slate-500">
              {formatNumber(data.total)} toko ditemukan
            </span>
          ) : null
        }
      />

      <Card>
        <StoreFilters
          search={search}
          status={status}
          onSearchChange={handleSearch}
          onStatusChange={handleStatus}
          onReset={handleReset}
        />

        {isError ? (
          <ErrorState message="Gagal memuat daftar toko." onRetry={() => void refetch()} />
        ) : (
          <>
            <StoreTable
              rows={data?.rows ?? []}
              loading={isLoading}
              onRowClick={(store) => navigate(`/toko/${store.id}`)}
            />

            {data ? (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            ) : (
              <div className="border-t border-line px-4 py-3">
                <Skeleton className="h-4 w-48" />
              </div>
            )}
          </>
        )}
      </Card>
    </>
  )
}
