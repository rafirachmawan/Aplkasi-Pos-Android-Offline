import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatDateTime, rupiah } from '@/lib/format'
import {
  paymentLabel,
  paymentTone,
  TABLE_ORDER_STATUS_LABEL,
  TABLE_ORDER_STATUS_TONE,
} from '@/lib/labels'
import type { TableOrderRow } from '@/types/domain'

interface TableOrderDetailModalProps {
  order: TableOrderRow | null
  onClose: () => void
}

export function TableOrderDetailModal({ order, onClose }: TableOrderDetailModalProps) {
  return (
    <Modal
      open={Boolean(order)}
      onClose={onClose}
      title="Detail pesanan meja F&B"
      description={order ? `Meja ${order.tableNumber || '—'} · ${order.storeName}` : undefined}
      size="lg"
    >
      {order ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-medium text-slate-500">Pemesan</p>
              <p className="mt-0.5 font-semibold text-ink">{order.customerName}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">No. HP</p>
              <p className="mt-0.5 font-semibold text-ink">{order.customerPhone || '—'}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Status</p>
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                <Badge tone={TABLE_ORDER_STATUS_TONE[order.status]}>
                  {TABLE_ORDER_STATUS_LABEL[order.status]}
                </Badge>
                <Badge tone={paymentTone(order.paymentMethod)}>
                  {paymentLabel(order.paymentMethod)}
                </Badge>
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-500">Nomor meja</p>
              <p className="mt-0.5 font-semibold text-ink">{order.tableNumber || '—'}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Waktu pesan</p>
              <p className="mt-0.5 font-semibold text-ink">{formatDateTime(order.createdAt)}</p>
            </div>
            {order.notes ? (
              <div className="col-span-2 sm:col-span-3">
                <p className="font-medium text-slate-500">Catatan pesanan</p>
                <p className="mt-0.5 font-semibold text-ink">{order.notes}</p>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-xs text-slate-600">
                  <th scope="col" className="px-3 py-2 text-left font-semibold">
                    Menu
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, idx) => (
                  <tr
                    key={`${item.productName}-${idx}`}
                    className="border-b border-line/70 last:border-b-0"
                  >
                    <td className="px-3 py-2 text-slate-700">
                      <p>{item.productName}</p>
                      {item.notes ? (
                        <p className="text-xs text-slate-500">Catatan: {item.notes}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {rupiah(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {order.paymentProofUrl ? (
            <div className="rounded-lg border border-line bg-slate-50 p-3">
              <p className="mb-2 text-xs font-medium text-slate-500">
                Bukti pembayaran QRIS
              </p>
              <a
                href={order.paymentProofUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-brand-dark underline hover:text-brand"
              >
                Buka foto bukti pembayaran →
              </a>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5">
            <p className="text-[12px] font-medium text-slate-600">Total pesanan</p>
            <p className="text-sm font-bold tabular-nums text-ink">{rupiah(order.totalAmount)}</p>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
