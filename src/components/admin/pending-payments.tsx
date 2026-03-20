'use client'
import { confirmPayment, denyPayment } from '@/app/actions/payment'

type PendingPayment = {
  id: string; amount: number; payment_method: string; notes: string | null
  players: { name: string } | null
  parents: { name: string } | null
}

const methodLabel: Record<string, string> = {
  paypal: 'PayPal/Card',
  monzo: 'Monzo',
  revolut: 'Revolut',
  cash: 'Cash',
}

export function PendingPayments({ payments }: { payments: PendingPayment[] }) {
  if (payments.length === 0) return null

  async function handleConfirm(id: string) {
    await confirmPayment(id)
    window.location.reload()
  }

  async function handleDeny(id: string) {
    await denyPayment(id)
    window.location.reload()
  }

  return (
    <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h2 className="font-bold text-yellow-800 mb-3">
        ⚠️ Pending Payments ({payments.length})
      </h2>
      <div className="space-y-2">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded p-3 border">
            <div>
              <span className="font-medium">{p.players?.name}</span>
              <span className="text-gray-500 mx-2">—</span>
              <span>Parent: {p.parents?.name}</span>
              <span className="text-gray-500 mx-2">·</span>
              <span className="text-sm font-medium">{methodLabel[p.payment_method] ?? p.payment_method}</span>
              <span className="text-gray-500 ml-2">${(p.amount / 100).toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleConfirm(p.id)} className="btn-success text-sm">Confirm</button>
              <button onClick={() => handleDeny(p.id)} className="btn-danger text-sm">Deny</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
