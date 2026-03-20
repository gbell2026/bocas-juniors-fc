'use client'
import { useEffect, useState } from 'react'
import { getPaymentSettings, requestPayment } from '@/app/actions/payment'
import type { PaymentMethod } from '@/lib/supabase/types'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type Props = { playerId: string; parentId: string; parentName: string; playerName: string }
type MethodState = 'idle' | 'awaiting_confirm' | 'loading' | 'sent' | 'error'

export function PaymentOptionsPanel({ playerId, parentId, parentName, playerName }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [monzoCopied, setMonzoCopied] = useState(false)
  const [revolutCopied, setRevolutCopied] = useState(false)
  const [methodState, setMethodState] = useState<Record<PaymentMethod, MethodState>>({
    paypal: 'idle', monzo: 'idle', revolut: 'idle', cash: 'idle',
  })

  useEffect(() => {
    getPaymentSettings().then(setSettings)
  }, [])

  if (!settings) return <p>Loading payment options…</p>

  const fee = `$${(settings.feeCents / 100).toFixed(2)}`

  async function handleConfirm(method: PaymentMethod) {
    setMethodState(s => ({ ...s, [method]: 'loading' }))
    const result = await requestPayment({ playerId, parentId, method, parentName, playerName })
    setMethodState(s => ({ ...s, [method]: result.error ? 'error' : 'sent' }))
  }

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      <h2 className="text-xl font-bold">Pay Membership Fee — {fee}</h2>
      <p className="text-gray-600 text-sm">Choose a payment method below. Once you&apos;ve paid, click the confirmation button so the admin can verify your payment.</p>

      {/* PayPal / Card */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay via PayPal or Credit/Debit Card</h3>
        <p className="text-sm text-gray-600">Opens PayPal. You can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments.</p>
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
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay via Monzo bank transfer</h3>
        <div className="bg-gray-50 rounded p-3 font-mono text-sm flex items-center justify-between gap-3">
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
            {methodState.monzo === 'loading' ? 'Sending…' : "I&apos;ve sent the transfer"}
          </button>
        )}
      </div>

      {/* Revolut */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay via Revolut bank transfer</h3>
        <div className="bg-gray-50 rounded p-3 font-mono text-sm flex items-center justify-between gap-3">
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
            {methodState.revolut === 'loading' ? 'Sending…' : "I&apos;ve sent the transfer"}
          </button>
        )}
      </div>

      {/* Cash */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay by Cash</h3>
        <p className="text-sm text-gray-600">Bring cash to the next training session. Click below to notify the admin.</p>
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
            {methodState.cash === 'loading' ? 'Sending\u2026' : "I\u2019ll pay cash at training"}
          </button>
        )}
      </div>
    </div>
  )
}
