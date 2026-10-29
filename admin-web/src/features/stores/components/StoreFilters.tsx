import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { StoreStatus } from '@/types/domain'

interface StoreFiltersProps {
  search: string
  status: StoreStatus | 'all'
  onSearchChange: (value: string) => void
  onStatusChange: (status: StoreStatus | 'all') => void
  onReset: () => void
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Semua status' },
  { value: 'active', label: 'Aktif' },
  { value: 'trial', label: 'Trial' },
  { value: 'inactive', label: 'Nonaktif' },
]

export function StoreFilters({
  search,
  status,
  onSearchChange,
  onStatusChange,
  onReset,
}: StoreFiltersProps) {
  const hasFilter = search.trim() !== '' || status !== 'all'

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 sm:flex-row sm:items-center">
      <Input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Cari nama toko atau username…"
        icon={<Search className="size-4" />}
        containerClassName="w-full sm:max-w-xs"
        aria-label="Cari toko"
      />

      <Select
        value={status}
        onChange={(event) => onStatusChange(event.target.value as StoreStatus | 'all')}
        options={STATUS_OPTIONS}
        containerClassName="w-full sm:w-44"
        aria-label="Filter status toko"
      />

      {hasFilter ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          icon={<X className="size-3.5" />}
          className="sm:ml-auto"
        >
          Reset filter
        </Button>
      ) : null}
    </div>
  )
}
