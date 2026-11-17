import { useEffect, useState } from 'react'
import { ArrowDownCircle, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import { formatDate } from '@/lib/format'
import type { SubscriptionRow } from '@/types/domain'

export type PlanAction = 'activate' | 'reset'

interface PlanActionModalProps {
  open: boolean
  row: SubscriptionRow | null
  action: PlanAction | null
  pending: boolean
  onClose: () => void
  onConfirm: (days: number) => void
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 hari (1 bulan)' },
  { value: '90', label: '90 hari (3 bulan)' },
  { value: '180', label: '180 hari (6 bulan)' },
  { value: '365', label: '365 hari (1 tahun)' },
]

/** Tanggal berakhir bila dihitung dari durasi yang dipilih. */
function previewExpiry(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000)
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function PlanActionModal({
  open,
  row,
  action,
  pending,
  onClose,
  onConfirm,
}: PlanActionModalProps) {
  const [days, setDays] = useState('30')

  useEffect(() => {
    if (open) setDays('30')
  }, [open, row?.storeId, action])

  if (!row || !action) return null

  const isActivate = action === 'activate'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={isActivate ? 'Aktifkan paket Pro' : 'Kembalikan ke Gratis'}
      description={
        isActivate
          ? 'Masa aktif Pro dihitung otomatis dan tampil di aplikasi kasir.'
          : 'Fitur Pro terkunci kembali. Data toko tetap utuh.'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button
            variant={isActivate ? 'primary' : 'danger'}
            size="sm"
            loading={pending}
            onClick={() => onConfirm(Number(days))}
            icon={
              isActivate ? <Crown className="size-4" /> : <ArrowDownCircle className="size-4" />
            }
          >
            {isActivate ? `Aktifkan ${days} hari` : 'Kembalikan ke Gratis'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-line bg-slate-50/70 px-3 py-2.5">
          <p className="text-sm font-medium text-ink">{row.storeName}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {row.username ? `@${row.username}` : 'Tanpa username'}
          </p>
        </div>

        {isActivate ? (
          <>
            <Select
              label="Durasi masa aktif"
              value={days}
              onChange={(event) => setDays(event.target.value)}
              options={DURATION_OPTIONS}
            />
            <p className="rounded-lg border border-brand-border bg-brand-soft px-3 py-2 text-xs leading-relaxed text-brand-dark">
              Berlaku mulai hari ini sampai <strong>{previewExpiry(Number(days))}</strong>.
              {row.plan === 'pro' ? ' Perpanjangan dihitung dari tanggal berakhir yang masih berlaku.' : ''}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-slate-600">
              Aksi ini hanya mengubah paket langganan toko. Produk, transaksi, kasbon, dan shift
              yang sudah ada <strong>tidak dihapus</strong>.
            </p>
            {row.planExpiresAt ? (
              <p className="text-xs text-slate-500">
                Masa aktif berakhir {formatDate(row.planExpiresAt)}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  )
}
