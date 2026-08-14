'use client'
import { useEffect, useState } from 'react'
import { getPaymentSettings, requestPayment, getPaymentSchedule } from '@/app/actions/payment'
import { PaymentActionCell } from './payment-action-cell'
import { useLocale } from '@/lib/i18n/locale-context'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type Schedule = Awaited<ReturnType<typeof getPaymentSchedule>>
type Props = { playerId: string; parentId: string; parentName: string; playerName: string }

export function PaymentOptionsPanel({ playerId, parentId, parentName, playerName }: Props) {
  const { t } = useLocale()
  const LABEL_DISPLAY: Record<string, string> = t.payment.labels
  const STATUS_DISPLAY: Record<Schedule[number]['status'], { text: string; className: string }> = {
    paid: { text: t.payment.paid, className: 'text-green-600' },
    pending: { text: t.payment.pendingReview, className: 'text-yellow-600' },
    outstanding: { text: t.payment.outstanding, className: 'text-brand-primary' },
  }
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

  if (!settings || schedule === null) return <p className="text-brand-muted py-8 text-center">{t.payment.loading}</p>

  const regFeePaid = schedule.find(item => item.label === 'registration')?.status === 'paid'
  const allPaid = schedule.every(item => item.status === 'paid')

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wider">{t.payment.scheduleTitle}</h2>
        <p className={`text-sm font-bold ${regFeePaid ? 'text-green-600' : 'text-brand-primary'}`}>
          {t.payment.regFeeLabel} {regFeePaid ? t.payment.paid : t.payment.outstanding}
        </p>
      </div>

      {allPaid ? (
        <p className="font-heading text-brand-ink text-xl uppercase tracking-wider text-center py-4">
          {t.payment.allPaidUp}
        </p>
      ) : (
        <>
          {/* Mobile: stacked cards — a 4-column table doesn't fit a phone
              screen even with horizontal scroll, and the Action column
              (the actual "Pay" controls) ends up scrolled out of view. */}
          <div className="sm:hidden space-y-3" data-testid="mobile-schedule">
            {schedule.map(item => (
              <div key={item.label} className="border border-brand-line rounded p-3 bg-brand-tint space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-brand-ink">{LABEL_DISPLAY[item.label] ?? item.label}</p>
                    {item.discounted && (
                      <p className="text-brand-primaryDeep text-[10px] font-bold uppercase tracking-wider">{t.payment.siblingDiscount}</p>
                    )}
                  </div>
                  <p className={`text-xs font-medium whitespace-nowrap ${STATUS_DISPLAY[item.status].className}`}>
                    {STATUS_DISPLAY[item.status].text}
                  </p>
                </div>
                <p className="text-lg font-bold text-brand-ink">${(item.amountCents / 100).toFixed(2)}</p>
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
              </div>
            ))}
          </div>

          {/* Desktop/tablet: compact table */}
          <div className="hidden sm:block overflow-x-auto border border-brand-line rounded" data-testid="desktop-schedule">
            <table className="w-full text-sm">
              <thead className="bg-brand-creamAlt">
                <tr>
                  <th className="text-left p-2">{t.payment.itemHeader}</th>
                  <th className="text-left p-2">{t.payment.amountHeader}</th>
                  <th className="text-left p-2">{t.payment.statusHeader}</th>
                  <th className="text-left p-2">{t.payment.actionHeader}</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map(item => (
                  <tr key={item.label} className="border-t align-middle">
                    <td className="p-2 whitespace-nowrap">
                      {LABEL_DISPLAY[item.label] ?? item.label}
                      {item.discounted && (
                        <span className="ml-1.5 text-brand-primaryDeep text-[10px] font-bold uppercase tracking-wider align-middle">
                          {t.payment.siblingDiscount}
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
        </>
      )}
    </div>
  )
}
