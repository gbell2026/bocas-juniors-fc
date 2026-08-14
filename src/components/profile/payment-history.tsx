import type { Payment } from '@/lib/supabase/types'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

type PaymentWithPlayer = Payment & { players: { name: string } | null }

export function PaymentHistory({ payments, locale }: { payments: PaymentWithPlayer[]; locale: Locale }) {
  const t = locale === 'es' ? es : en
  if (payments.length === 0) return <p className="text-brand-muted">{t.profile.paymentHistory.empty}</p>
  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">{t.profile.paymentHistory.title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-brand-creamAlt">
              <th className="text-left p-2">{t.profile.paymentHistory.dateHeader}</th>
              <th className="text-left p-2">{t.profile.paymentHistory.playerHeader}</th>
              <th className="text-left p-2">{t.profile.paymentHistory.amountHeader}</th>
              <th className="text-left p-2">{t.profile.paymentHistory.methodHeader}</th>
              <th className="text-left p-2">{t.profile.paymentHistory.statusHeader}</th>
            </tr>
          </thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.paid_at ? new Date(p.paid_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB') : '—'}</td>
                <td className="p-2">{p.players?.name ?? '—'}</td>
                <td className="p-2">${(p.amount / 100).toFixed(2)}</td>
                <td className="p-2">{t.payment.methods[p.payment_method]}</td>
                <td className="p-2">{t.profile.paymentHistory.statuses[p.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
