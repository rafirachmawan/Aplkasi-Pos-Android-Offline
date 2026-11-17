import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatDate, formatDateTime, rupiah } from '@/lib/format'
import { DEBT_STATUS_LABEL, DEBT_STATUS_TONE, paymentLabel } from '@/lib/labels'
import type { DebtRow } from '@/types/domain'

interface DebtDetailModalProps {
  debt: DebtRow | null
  onClose: () => void
}

export function DebtDetailModal({ debt, onClose }: DebtDetailModalProps) {
  return (
    <Modal
      open={Boolean(debt)}
      onClose={onClose}
      title="Detail kasbon pelanggan"
      description={debt ? `${debt.customerName} · ${debt.storeName}` : undefined}
      size="lg"
    >
      {debt ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-medium text-slate-500">Pelanggan</p>
              <p className="mt-0.5 font-semibold text-ink">{debt.customerName}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">No. HP / WhatsApp</p>
              <p className="mt-0.5 font-semibold text-ink">{debt.customerPhone || '—'}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Status</p>
              <div className="mt-0.5">
                <Badge tone={DEBT_STATUS_TONE[debt.status]}>{DEBT_STATUS_LABEL[debt.status]}</Badge>
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-500">Sumber Nota</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-ink">
                {debt.invoiceNumber || 'Catat manual'}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Jatuh Tempo</p>
              <p className="mt-0.5 font-semibold text-ink">
                {debt.dueDate ? formatDate(debt.dueDate) : 'Tidak ditentukan'}
              </p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Dicatat pada</p>
              <p className="mt-0.5 font-semibold text-ink">{formatDateTime(debt.createdAt)}</p>
            </div>
            {debt.notes ? (
              <div className="col-span-2 sm:col-span-3">
                <p className="font-medium text-slate-500">Catatan</p>
                <p className="mt-0.5 font-semibold text-ink">{debt.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-3.5 text-xs sm:grid-cols-3">
            <div>
              <p className="text-slate-500">Total kasbon</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-ink">
                {rupiah(debt.totalDebt)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Sudah dibayar</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700">
                {rupiah(debt.paidAmount)}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Sisa hutang</p>
              <p
                className={
                  debt.remainingDebt > 0
                    ? 'mt-0.5 text-sm font-bold tabular-nums text-red-700'
                    : 'mt-0.5 text-sm font-bold tabular-nums text-emerald-700'
                }
              >
                {rupiah(debt.remainingDebt)}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-ink">
              Riwayat cicilan & pelunasan ({debt.payments.length})
            </p>
            {debt.payments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line px-4 py-5 text-center text-xs text-slate-500">
                Belum ada riwayat cicilan yang tercatat untuk kasbon ini.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line bg-slate-50 text-xs text-slate-600">
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Waktu
                      </th>
                      <th scope="col" className="px-3 py-2 text-left font-semibold">
                        Metode & Catatan
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Nominal
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {debt.payments.map((pay) => (
                      <tr key={pay.id} className="border-b border-line/70 last:border-b-0">
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                          {formatDateTime(pay.createdAt)}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <span className="font-medium">{paymentLabel(pay.paymentMethod)}</span>
                          {pay.notes ? (
                            <span className="text-slate-500"> · {pay.notes}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                          {rupiah(pay.paymentAmount)}
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
