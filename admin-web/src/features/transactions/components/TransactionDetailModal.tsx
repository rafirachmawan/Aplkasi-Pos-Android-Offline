import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { formatDateTime, rupiah } from '@/lib/format'
import { orderTypeLabel, paymentLabel, paymentTone } from '@/lib/labels'
import type { TransactionRow } from '@/types/domain'

interface TransactionDetailModalProps {
  transaction: TransactionRow | null
  onClose: () => void
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
  const totalCapital = transaction
    ? transaction.items.reduce((sum, item) => sum + item.capitalAtSale * item.quantity, 0)
    : 0
  const hasCapitalData = transaction
    ? transaction.items.some((item) => item.capitalAtSale > 0)
    : false
  const estimatedProfit = transaction ? transaction.grandTotal - totalCapital : 0

  return (
    <Modal
      open={Boolean(transaction)}
      onClose={onClose}
      title="Detail transaksi"
      description={transaction?.invoiceNumber}
      size="lg"
    >
      {transaction ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p className="font-medium text-slate-500">Toko</p>
              <p className="mt-0.5 font-semibold text-ink">{transaction.storeName}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Waktu</p>
              <p className="mt-0.5 font-semibold text-ink">{formatDateTime(transaction.createdAt)}</p>
            </div>
            <div>
              <p className="font-medium text-slate-500">Pembayaran</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge tone={paymentTone(transaction.paymentMethod)}>
                  {paymentLabel(transaction.paymentMethod)}
                </Badge>
                {transaction.isOfflineSync ? <Badge tone="neutral">Sync offline</Badge> : null}
              </div>
            </div>
            <div>
              <p className="font-medium text-slate-500">Tipe pesanan</p>
              <p className="mt-0.5 font-semibold text-ink">
                {orderTypeLabel(transaction.orderType)}
                {transaction.tableNumber ? ` · ${transaction.tableNumber}` : ''}
              </p>
            </div>
            {transaction.paymentNotes ? (
              <div className="col-span-2">
                <p className="font-medium text-slate-500">
                  Catatan pembayaran
                </p>
                <p className="mt-0.5 font-semibold text-ink">{transaction.paymentNotes}</p>
              </div>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-xs text-slate-600">
                  <th scope="col" className="px-3 py-2 text-left font-semibold">
                    Produk
                  </th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Harga satuan
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">
                    Subtotal
                  </th>
                </tr>
              </thead>
              <tbody>
                {transaction.items.map((item, index) => (
                  <tr
                    key={`${item.productName}-${index}`}
                    className="border-b border-line/70 last:border-b-0"
                  >
                    <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                    <td className="px-3 py-2 text-center tabular-nums text-slate-600">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {rupiah(item.priceAtSale)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {rupiah(item.priceAtSale * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-1.5 rounded-lg bg-slate-50 px-3.5 py-3 text-[12px]">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{rupiah(transaction.totalPrice)}</span>
            </div>
            {transaction.discountAmount > 0 ? (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Diskon</span>
                <span className="tabular-nums">-{rupiah(transaction.discountAmount)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-line pt-1.5">
              <span className="font-medium text-ink">Total tagihan</span>
              <span className="text-sm font-bold tabular-nums text-ink">
                {rupiah(transaction.grandTotal)}
              </span>
            </div>
            {transaction.cashReceived > 0 || transaction.cashReturn > 0 ? (
              <div className="flex items-center justify-between text-slate-500">
                <span>
                  {transaction.paymentMethod === 'kasbon' ? 'DP diterima' : 'Dibayar'}
                </span>
                <span className="tabular-nums">
                  {rupiah(transaction.cashReceived)}
                  {transaction.cashReturn > 0
                    ? ` (kembali ${rupiah(transaction.cashReturn)})`
                    : ''}
                </span>
              </div>
            ) : null}
            {hasCapitalData ? (
              <div className="flex items-center justify-between text-slate-600">
                <span>Estimasi laba kotor</span>
                <span className="font-semibold tabular-nums text-emerald-700">
                  {rupiah(estimatedProfit)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Modal>
  )
}
