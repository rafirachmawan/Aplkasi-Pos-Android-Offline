import { Modal } from '@/components/ui/Modal'
import { formatDateTime, rupiah } from '@/lib/format'
import { orderTypeLabel, paymentLabel } from '@/lib/labels'
import type { TransactionRow } from '@/types/domain'

interface TransactionDetailModalProps {
  transaction: TransactionRow | null
  onClose: () => void
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
  return (
    <Modal
      open={Boolean(transaction)}
      onClose={onClose}
      title="Detail transaksi"
      description={transaction?.invoiceNumber}
    >
      {transaction ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Toko</p>
              <p className="mt-0.5 font-medium text-ink">{transaction.storeName}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Waktu</p>
              <p className="mt-0.5 font-medium text-ink">{formatDateTime(transaction.createdAt)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Pembayaran</p>
              <p className="mt-0.5 font-medium text-ink">{paymentLabel(transaction.paymentMethod)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-500">Tipe pesanan</p>
              <p className="mt-0.5 font-medium text-ink">{orderTypeLabel(transaction.orderType)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-2 text-left font-semibold">
                    Produk
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
                {transaction.items.map((item, index) => (
                  <tr key={`${item.productName}-${index}`} className="border-b border-line/70 last:border-b-0">
                    <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {rupiah(item.priceAtSale * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-[12px] font-medium text-slate-600">Total</p>
            <p className="text-sm font-bold text-ink">{rupiah(transaction.grandTotal)}</p>
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
