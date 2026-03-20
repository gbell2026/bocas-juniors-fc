import type { Payment } from '@/lib/supabase/types'

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return <p className="text-gray-500">No payments yet.</p>
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Payment History</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Amount</th>
            <th className="text-left p-2">Method</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
              <td className="p-2">${(p.amount / 100).toFixed(2)}</td>
              <td className="p-2 capitalize">{p.payment_method}</td>
              <td className="p-2 capitalize">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
