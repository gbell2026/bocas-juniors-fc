'use client'
import { useEffect, useState } from 'react'
import { getPaymentSettings, requestPayment, getPaymentSchedule } from '@/app/actions/payment'
import { PaymentActionCell } from './payment-action-cell'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type Schedule = Awaited<ReturnType<typeof getPaymentSchedule>>
type Props = { playerId: string; parentId: string; parentName: string; playerName: string }

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
  const allPaid = schedule.every(item => item.status === 'paid')

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wider">Payment Schedule</h2>
        <p className={`text-sm font-bold ${regFeePaid ? 'text-green-600' : 'text-brand-primary'}`}>
          Registration fee: {regFeePaid ? 'Paid' : 'Outstanding'}
        </p>
      </div>

      {allPaid ? (
        <p className="font-heading text-brand-ink text-xl uppercase tracking-wider text-center py-4">
          You&apos;re all paid up for the season!
        </p>
      ) : (
        <div className="overflow-x-auto border border-brand-line rounded">
          <table className="w-full text-sm">
            <thead className="bg-brand-creamAlt">
              <tr>
                <th className="text-left p-2">Item</th>
                <th className="text-left p-2">Amount</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map(item => (
                <tr key={item.label} className="border-t align-middle">
                  <td className="p-2 whitespace-nowrap">
                    {LABEL_DISPLAY[item.label] ?? item.label}
                    {item.discounted && (
                      <span className="ml-1.5 text-brand-primaryDeep text-[10px] font-bold uppercase tracking-wider align-middle">
                        50% sibling discount
                      </span>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">${(item.amountCents / 100).toFixed(2)}</td>
                  <td className={`p-2 font-medium whitespace-nowrap ${STATUS_DISPLAY[item.status].className}`}>
                    {STATUS_DISPLAY[item.status].text}
                  </td>
                  <td className="p-2">
                    {item.status === 'outstanding' && (
                      <PaymentActionCell
                        item={item}
                        settings={settings}
                        onReport={async method => {
                          const result = await requestPayment({ playerId, parentId, method, parentName, playerName, label: item.label })
                          if (!result.error) refreshSchedule()
                          return result
                        }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
