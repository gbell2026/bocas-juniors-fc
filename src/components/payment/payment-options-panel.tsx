'use client'
import { useEffect, useState } from 'react'
import { getPaymentSettings, requestPayment, getPaymentSchedule } from '@/app/actions/payment'
import type { PaymentMethod } from '@/lib/supabase/types'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type Schedule = Awaited<ReturnType<typeof getPaymentSchedule>>
type Props = { playerId: string; parentId: string; parentName: string; playerName: string }
type MethodState = 'idle' | 'awaiting_confirm' | 'loading' | 'sent' | 'error'

const LABEL_DISPLAY: Record<string, string> = {
  registration: 'Registration Fee',
  full: 'Season Fee (Full)',
  august: 'August',
  september: 'September',
  october: 'October',
  november: 'November',
}

const STATUS_DISPLAY: Record<Schedule[number]['status'], { text: string; className: string }> = {
  paid: { text: 'Paid', className: 'text-green-600' },
  pending: { text: 'Pending Review', className: 'text-yellow-600' },
  outstanding: { text: 'Outstanding', className: 'text-brand-primary' },
}

export function PaymentOptionsPanel({ playerId, parentId, parentName, playerName }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [monzoCopied, setMonzoCopied] = useState(false)
  const [revolutCopied, setRevolutCopied] = useState(false)
  const [methodState, setMethodState] = useState<Record<PaymentMethod, MethodState>>({
    paypal: 'idle', monzo: 'idle', revolut: 'idle', cash: 'idle',
  })

  useEffect(() => {
    getPaymentSettings().then(setSettings)
    refreshSchedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- playerId is stable for this
    // component's lifetime (a fresh instance mounts per profile view); intentionally
    // fetch-on-mount only, matching this file's existing pattern before this change.
  }, [])

  async function refreshSchedule() {
    setSchedule(await getPaymentSchedule(playerId))
  }

  if (!settings || schedule === null) return <p className="text-brand-muted py-8 text-center">Loading payment options…</p>

  const regFeePaid = schedule.find(item => item.label === 'registration')?.status === 'paid'
  const regFeeStatus = (
    <p className={`text-sm font-bold ${regFeePaid ? 'text-green-600' : 'text-brand-primary'}`}>
      Registration fee: {regFeePaid ? 'Paid' : 'Outstanding'}
    </p>
  )

  const scheduleTable = schedule.length > 0 && (
    <div className="border border-brand-line rounded overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-brand-creamAlt">
          <tr>
            <th className="text-left p-2">Item</th>
            <th className="text-left p-2">Amount</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {schedule.map(item => (
            <tr key={item.label} className="border-t">
              <td className="p-2">{LABEL_DISPLAY[item.label] ?? item.label}</td>
              <td className="p-2">${(item.amountCents / 100).toFixed(2)}</td>
              <td className={`p-2 font-medium ${STATUS_DISPLAY[item.status].className}`}>
                {STATUS_DISPLAY[item.status].text}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  // The next payable item — skips anything already paid OR already reported
  // and awaiting admin review, so a parent isn't blocked from reporting a
  // second installment just because the first hasn't been confirmed yet.
  const nextActionable = schedule.find(item => item.status === 'outstanding')

  if (!nextActionable) {
    const allPaid = schedule.every(item => item.status === 'paid')
    return (
      <div className="max-w-lg mx-auto py-8 px-4 space-y-3 text-center">
        {regFeeStatus}
        {scheduleTable}
        <p className="font-heading text-brand-ink text-xl uppercase tracking-wider">
          {allPaid ? "You're all paid up for the season!" : 'All payments reported — awaiting admin confirmation.'}
        </p>
      </div>
    )
  }

  const fee = `$${(nextActionable.amountCents / 100).toFixed(2)}`
  const feeTitle = nextActionable.label === 'registration' ? 'Pay Registration Fee' : 'Pay Membership Fee'
  const nextActionableLabel = nextActionable.label

  async function handleConfirm(method: PaymentMethod) {
    setMethodState(s => ({ ...s, [method]: 'loading' }))
    const result = await requestPayment({ playerId, parentId, method, parentName, playerName, label: nextActionableLabel })
    if (result.error) {
      setMethodState(s => ({ ...s, [method]: 'error' }))
      return
    }
    await refreshSchedule()
    // Reset every method's UI state — the next actionable item (if any) is a
    // different installment, so a stale "sent" message from this one would
    // otherwise wrongly look like it also applies to the new amount due.
    setMethodState({ paypal: 'idle', monzo: 'idle', revolut: 'idle', cash: 'idle' })
  }

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      {regFeeStatus}
      {scheduleTable}
      <h2 className="font-heading text-brand-ink text-2xl uppercase tracking-wider">{feeTitle} — {fee}</h2>
      <p className="text-sm text-brand-muted">Choose a payment method below. Once you&apos;ve paid, click the confirmation button so the admin can verify your payment.</p>

      {/* PayPal / Card */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay via PayPal or Credit/Debit Card</h3>
        <p className="text-sm text-brand-muted">Opens PayPal. You can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments.</p>
        {methodState.paypal === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Payment request sent — admin will confirm shortly.</p>
        ) : methodState.paypal === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <a
              href={settings.paypalMeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
              onClick={() => setMethodState(s => ({ ...s, paypal: 'awaiting_confirm' }))}
            >
              Pay {fee} via PayPal / Card ↗
            </a>
            {methodState.paypal === 'awaiting_confirm' && (
              <button
                onClick={() => handleConfirm('paypal')}
                className="btn-secondary text-sm"
              >
                I&apos;ve paid
              </button>
            )}
          </div>
        )}
      </div>

      {/* Monzo */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay via Monzo bank transfer</h3>
        <div className="bg-brand-creamAlt rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-brand-ink/80">
          <span>{settings.monzoDetails}</span>
          <button
            onClick={() => copyToClipboard(settings.monzoDetails, setMonzoCopied)}
            className="text-brand-primary text-xs shrink-0"
          >
            {monzoCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {methodState.monzo === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Transfer confirmed — admin will verify shortly.</p>
        ) : methodState.monzo === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('monzo')}
            disabled={methodState.monzo === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.monzo === 'loading' ? 'Sending…' : "I've sent the transfer"}
          </button>
        )}
      </div>

      {/* Revolut */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay via Revolut bank transfer</h3>
        <div className="bg-brand-creamAlt rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-brand-ink/80">
          <span>{settings.revolutDetails}</span>
          <button
            onClick={() => copyToClipboard(settings.revolutDetails, setRevolutCopied)}
            className="text-brand-primary text-xs shrink-0"
          >
            {revolutCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {methodState.revolut === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Transfer confirmed — admin will verify shortly.</p>
        ) : methodState.revolut === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('revolut')}
            disabled={methodState.revolut === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.revolut === 'loading' ? 'Sending…' : "I've sent the transfer"}
          </button>
        )}
      </div>

      {/* Cash */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay by Cash</h3>
        <p className="text-sm text-brand-muted">Bring cash to the next training session. Click below to notify the admin.</p>
        {methodState.cash === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Admin notified — bring {fee} cash to training.</p>
        ) : methodState.cash === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('cash')}
            disabled={methodState.cash === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.cash === 'loading' ? 'Sending…' : "I’ll pay cash at training"}
          </button>
        )}
      </div>
    </div>
  )
}
