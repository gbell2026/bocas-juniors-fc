'use client'
import { useState } from 'react'
import { registerParentAndPlayer } from '@/app/actions/register'
import type { PaymentPlan } from '@/lib/supabase/types'
import { useLocale } from '@/lib/i18n/locale-context'
import { translateError } from '@/lib/i18n/error-messages'

type Props = { onSuccess: (playerId: string, parentId: string, parentName: string, playerName: string) => void }

export function RegistrationForm({ onSuccess }: Props) {
  const { locale, t } = useLocale()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await registerParentAndPlayer({
      parentName: fd.get('parentName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      password: fd.get('password') as string,
      playerName: fd.get('playerName') as string,
      dateOfBirth: fd.get('dateOfBirth') as string,
      position: fd.get('position') as string,
      paymentPlan: fd.get('paymentPlan') as PaymentPlan,
      agreedToTerms: fd.get('agreedToTerms') === 'on',
    })
    setLoading(false)
    if (result.error) { setError(translateError(locale, result.error)); return }
    onSuccess(result.playerId!, result.parentId!, fd.get('parentName') as string, fd.get('playerName') as string)
  }

  const labelClass = 'block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <fieldset className="space-y-4">
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">{t.register.playerDetailsLegend}</legend>
        <div>
          <label htmlFor="playerName" className={labelClass}>{t.register.playerNameLabel}</label>
          <input id="playerName" name="playerName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="dateOfBirth" className={labelClass}>{t.register.dobLabel}</label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="position" className={labelClass}>{t.register.positionLabel}</label>
          <select id="position" name="position" required className="input w-full">
            <option value="">{t.register.select}</option>
            {(['Goalkeeper', 'Defender', 'Midfielder', 'Forward'] as const).map(p => (
              <option key={p} value={p}>{t.register.positions[p.toLowerCase() as 'goalkeeper' | 'defender' | 'midfielder' | 'forward']}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">{t.register.parentDetailsLegend}</legend>
        <div>
          <label htmlFor="parentName" className={labelClass}>{t.register.parentNameLabel}</label>
          <input id="parentName" name="parentName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>{t.register.emailLabel}</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>{t.register.phoneLabel}</label>
          <input id="phone" name="phone" type="tel" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>{t.register.passwordLabel}</label>
          <input id="password" name="password" type="password" minLength={8} required className="input w-full" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">{t.register.paymentPlanLegend}</legend>
        <p className="text-sm text-brand-muted">
          {t.register.regFeeNotice} <span className="font-bold">{t.register.regFeeNoticeBold}</span> {t.register.regFeeNoticeSuffix}
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="radio" name="paymentPlan" value="full" required className="mt-1" />
          <span>
            <span className="block font-bold">{t.register.planFullTitle}</span>
            <span className="block text-sm text-brand-muted">{t.register.planFullBody}</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="radio" name="paymentPlan" value="monthly" required className="mt-1" />
          <span>
            <span className="block font-bold">{t.register.planMonthlyTitle}</span>
            <span className="block text-sm text-brand-muted">{t.register.planMonthlyBody}</span>
          </span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" name="agreedToTerms" required className="mt-1" />
        <span>
          {t.register.termsText}
        </span>
      </label>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? t.register.registering : t.register.submitButton}
      </button>
    </form>
  )
}
