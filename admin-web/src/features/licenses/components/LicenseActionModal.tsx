import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Select } from '@/components/ui/Select'
import type { LicenseAction } from '../api'
import type { LicenseRow } from '@/types/domain'

interface LicenseActionModalProps {
  open: boolean
  license: LicenseRow | null
  action: LicenseAction | null
  pending: boolean
  onClose: () => void
  onConfirm: (days: number) => void
}

const DURATION_OPTIONS = [
  { value: '30', label: '30 hari' },
  { value: '90', label: '90 hari' },
  { value: '180', label: '180 hari' },
  { value: '365', label: '1 tahun' },
]

export function LicenseActionModal({
  open,
  license,
  action,
  pending,
  onClose,
  onConfirm,
}: LicenseActionModalProps) {
  const [days, setDays] = useState('30')

  useEffect(() => {
    if (open) setDays('30')
  }, [open, license?.deviceId, action])

  if (!license || !action) return null

  const isExtend = action === 'extend'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={isExtend ? 'Perpanjang lisensi' : 'Cabut lisensi'}
      description={
        isExtend
          ? 'Lisensi akan diaktifkan kembali sesuai durasi yang dipilih.'
          : 'Perangkat akan kehilangan akses sampai lisensi diaktifkan ulang.'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
            Batal
          </Button>
          <Button
            variant={isExtend ? 'primary' : 'danger'}
            size="sm"
            loading={pending}
            onClick={() => onConfirm(Number(days))}
            icon={isExtend ? <CalendarPlus className="size-4" /> : <AlertTriangle className="size-4" />}
          >
            {isExtend ? 'Perpanjang' : 'Ya, cabut lisensi'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-line bg-slate-50/70 px-3 py-2.5">
          <p className="font-mono text-[11px] text-slate-600">{license.deviceId}</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink">{license.storeName}</p>
        </div>

        {isExtend ? (
          <Select
            label="Durasi perpanjangan"
            value={days}
            onChange={(event) => setDays(event.target.value)}
            options={DURATION_OPTIONS}
          />
        ) : (
          <p className="text-xs leading-relaxed text-slate-600">
            Tindakan ini hanya mengubah status lisensi perangkat. Data produk dan transaksi toko
            tidak dihapus.
          </p>
        )}
      </div>
    </Modal>
  )
}
