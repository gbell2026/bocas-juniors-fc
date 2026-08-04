'use client'
import { useState } from 'react'
import type { PaymentMethod } from '@/lib/supabase/types'
import type { getPaymentSettings, getPaymentSchedule } from '@/app/actions/payment'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type ScheduleItem = Awaited<ReturnType<typeof getPaymentSchedule>>[number]
type ReportState = 'idle' | 'awaiting_confirm' | 'loading' | 'sent' | 'error'

const METHOD_LABEL: Record<PaymentMethod, string> = {
  paypal: 'PayPal / Card', monzo: 'Monzo', revolut: 'Revolut', cash: 'Cash',
}

type Props = {
  item: ScheduleItem
  settings: Settings
  onReport: (method: PaymentMethod) => Promise<{ error?: string }>
}

// Compact, single-row payment action for one outstanding schedule item —
// a method dropdown plus whatever that method needs (a pay link, bank
// transfer details to copy, or a plain confirm button), so a page with
// several outstanding items stays a scannable table instead of stacking a
// full card per item per method.
export function PaymentActionCell({ item, settings, onReport }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('paypal')
  const [state, setState] = useState<ReportState>('idle')
  const [copied, setCopied] = useState(false)

  const fee = `$${(item.amountCents / 100).toFixed(2)}`

  async function handleConfirm() {
    setState('loading')
    const result = await onReport(method)
    setState(result.error ? 'error' : 'sent')
  }

  function handleMethodChange(next: PaymentMethod) {
    setMethod(next)
    setState('idle')
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (state === 'sent') return <span className="text-green-600 text-xs font-bold whitespace-nowrap">✓ Reported</span>
  if (state === 'error') return (
    <span className="text-red-600 text-xs">
      Something went wrong.{' '}
      <button onClick={() => setState('idle')} className="underline">Try again</button>
    </span>
  )

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        aria-label={`Payment method for ${item.label}`}
        value={method}
        onChange={e => handleMethodChange(e.target.value as PaymentMethod)}
        className="input text-xs py-1 px-1.5 w-auto"
      >
        {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map(m => (
          <option key={m} value={m}>{METHOD_LABEL[m]}</option>
        ))}
      </select>

      {method === 'paypal' && (
        state === 'awaiting_confirm' ? (
          <button onClick={handleConfirm} className="btn-secondary text-xs px-2 py-1">I&apos;ve paid</button>
        ) : (
          <a
            href={settings.paypalMeUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setState('awaiting_confirm')}
            className="btn-primary text-xs px-2 py-1"
          >
            Pay {fee} ↗
          </a>
        )
      )}

      {(method === 'monzo' || method === 'revolut') && (
        <>
          <button
            onClick={() => copyToClipboard(method === 'monzo' ? settings.monzoDetails : settings.revolutDetails)}
            className="text-brand-primary text-xs underline"
          >
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={state === 'loading'}
            className="btn-secondary text-xs px-2 py-1 disabled:opacity-50"
          >
            {state === 'loading' ? 'Sending…' : "I've sent it"}
          </button>
        </>
      )}

      {method === 'cash' && (
        <button
          onClick={handleConfirm}
          disabled={state === 'loading'}
          className="btn-secondary text-xs px-2 py-1 disabled:opacity-50"
        >
          {state === 'loading' ? 'Sending…' : "I'll pay cash"}
        </button>
      )}
    </div>
  )
}
