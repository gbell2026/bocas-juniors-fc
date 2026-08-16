'use client'
import { useState } from 'react'
import { addChildToParent } from '@/app/actions/register'
import type { PaymentPlan } from '@/lib/supabase/types'
import { useLocale } from '@/lib/i18n/locale-context'
import { translateError } from '@/lib/i18n/error-messages'
import { getSchedule, JOIN_MONTHS, type JoinMonth } from '@/lib/payment-schedule'

type Props = { onSuccess: (playerId: string) => void; onCancel: () => void }

export function AddChildForm({ onSuccess, onCancel }: Props) {
  const { locale, t } = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [joinMonth, setJoinMonth] = useState<JoinMonth>('august')

  const seasonFeeCents = getSchedule('full', true, joinMonth)
    .filter(i => i.label !== 'registration')
    .reduce((sum, i) => sum + i.amountCents, 0)
  const monthlyBreakdown = getSchedule('monthly', true, joinMonth)
    .filter((i): i is { label: 'august' | 'september' | 'october' | 'november'; amountCents: number } => i.label !== 'registration')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await addChildToParent({
      playerName: fd.get('playerName') as string,
      dateOfBirth: fd.get('dateOfBirth') as string,
      position: fd.get('position') as string,
      paymentPlan: fd.get('paymentPlan') as PaymentPlan,
      joinMonth,
    })
    setLoading(false)
    if (result.error) { setError(translateError(locale, result.error)); return }
    onSuccess(result.playerId!)
  }

  const labelClass = 'block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-brand-tint border border-brand-line rounded-lg p-4">
      <p className="text-sm text-brand-muted">
        {t.profile.addChild.discountNotice} <span className="font-bold">{t.profile.addChild.discountNoticeBold}</span> {t.profile.addChild.discountNoticeSuffix}
      </p>
      <div>
        <label htmlFor="addChildPlayerName" className={labelClass}>{t.profile.addChild.playerNameLabel}</label>
        <input id="addChildPlayerName" name="playerName" required className="input w-full" />
      </div>
      <div>
        <label htmlFor="addChildDateOfBirth" className={labelClass}>{t.profile.addChild.dobLabel}</label>
        <input id="addChildDateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
      </div>
      <div>
        <label htmlFor="addChildPosition" className={labelClass}>{t.profile.addChild.positionLabel}</label>
        <select id="addChildPosition" name="position" required className="input w-full">
          <option value="">{t.register.select}</option>
          {(['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const).map(p => (
            <option key={p} value={p}>{t.register.positions[p.toLowerCase() as 'goalkeeper' | 'defender' | 'midfielder' | 'forward']}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="addChildJoinMonth" className={labelClass}>{t.profile.addChild.joinMonthLabel}</label>
        <select
          id="addChildJoinMonth"
          name="joinMonth"
          required
          className="input w-full"
          value={joinMonth}
          onChange={(e) => setJoinMonth(e.target.value as JoinMonth)}
        >
          {JOIN_MONTHS.map((m) => (
            <option key={m} value={m}>{t.payment.labels[m]}</option>
          ))}
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>{t.profile.addChild.paymentPlanLegend}</legend>
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input type="radio" name="paymentPlan" value="full" required className="mt-1" />
          <span>
            <span className="block font-bold">{t.profile.addChild.planFullTitle(`$${seasonFeeCents / 100}`)}</span>
            <span className="block text-brand-muted">{t.profile.addChild.planFullBody}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer text-sm">
          <input type="radio" name="paymentPlan" value="monthly" required className="mt-1" />
          <span>
            <span className="block font-bold">{t.profile.addChild.planMonthlyTitle(`$${seasonFeeCents / 100}`)}</span>
            <span className="block text-brand-muted">
              {t.profile.addChild.planMonthlyBody}{' '}
              {monthlyBreakdown.map((i) => `${t.payment.labels[i.label]} $${i.amountCents / 100}`).join(' · ')}
            </span>
          </span>
        </label>
      </fieldset>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm flex-1 disabled:opacity-50">
          {loading ? t.profile.addChild.adding : t.profile.addChild.addButton}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm px-4">
          {t.profile.addChild.cancel}
        </button>
      </div>
    </form>
  )
}
