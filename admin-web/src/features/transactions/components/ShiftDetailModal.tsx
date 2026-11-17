import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatDateTime, rupiah } from '@/lib/format'
import { expenseCategoryLabel, SHIFT_STATUS_LABEL, SHIFT_STATUS_TONE } from '@/lib/labels'
import type { ShiftRow } from '@/types/domain'

interface ShiftDetailModalProps {
  shift: ShiftRow | null
  onClose: () => void
}

export function ShiftDetailModal({ shift, onClose }: ShiftDetailModalProps) {
  return (
    <Modal
      open={Boolean(shift)}
      onClose={onClose}
      title="Detail shift kasir"
      description={shift ? `${shift.cashierName} · ${shift.storeName}` : undefined}
      size="lg"
    >
      {shift ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-medium text-slate-500">Nama kasir</p>
              <p className="mt-0.5 font-semibold text-ink">{shift.cashierName}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Status</p>
              <div className="mt-0.5">
                <Badge tone={SHIFT_STATUS_TONE[shift.status]}>
                  {SHIFT_STATUS_LABEL[shift.status]}
                </Badge>
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-500">Mulai shift</p>
              <p className="mt-0.5 font-semibold text-ink">{formatDateTime(shift.startTime)}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Selesai shift</p>
              <p className="mt-0.5 font-semibold text-ink">
                {shift.endTime ? formatDateTime(shift.endTime) : 'Masih berlangsung'}
              </p>
            </div>
            {shift.notes ? (
              <div className="col-span-2">
                <p className="font-medium text-slate-500">Catatan</p>
                <p className="mt-0.5 font-semibold text-ink">{shift.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-3.5 text-xs sm:grid-cols-3">
            <div>
              <p className="text-slate-500">Modal awal laci</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink">
                {rupiah(shift.startingCash)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Penjualan tunai</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink">
                {rupiah(shift.totalCashSales)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Penjualan non-tunai</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink">
                {rupiah(shift.totalNonCashSales)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Kas diharapkan</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink">
                {rupiah(shift.expectedCash)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Kas fisik aktual</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink">
                {shift.actualCash !== null ? rupiah(shift.actualCash) : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Selisih kas</p>
              <p className="mt-0.5 font-semibold tabular-nums text-ink">
                {shift.actualCash !== null ? rupiah(shift.difference) : '—'}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-ink">
              Pengeluaran kas kecil ({shift.expenses.length})
            </p>
            {shift.expenses.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-xs text-slate-500">
                Tidak ada catatan pengeluaran kas kecil pada shift ini.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-slate-50 text-xs text-slate-600">
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Kategori
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Keterangan
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Nominal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shift.expenses.map((expense) => (
                      <tr key={expense.id} className="border-b border-line/70 last:border-b-0">
                        <td className="px-3 py-2 text-slate-600">
                          {expenseCategoryLabel(expense.category)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{expense.description}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-red-700">
                          {rupiah(expense.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
