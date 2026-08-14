'use client'
import { useState } from 'react'
import Link from 'next/link'
import { submitGetInvolved } from '@/app/actions/get-involved'
import { useLocale } from '@/lib/i18n/locale-context'
import { translateError } from '@/lib/i18n/error-messages'
import { en } from '@/lib/i18n/en'

type Status = 'idle' | 'submitting' | 'success' | 'error'

// Stored/submitted values are always the English label, regardless of UI
// language — the admin panel (English-only, out of scope for translation)
// displays `interests` verbatim, so the stored value must stay
// locale-independent even though the checkbox label shown to the user
// is translated.
const INTEREST_KEYS = Object.keys(en.getInvolved.interestOptions) as (keyof typeof en.getInvolved.interestOptions)[]

export function GetInvolvedForm() {
  const { locale, t } = useLocale()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function toggleInterest(englishLabel: string) {
    setInterests(prev =>
      prev.includes(englishLabel) ? prev.filter(i => i !== englishLabel) : [...prev, englishLabel]
    )
  }

  const canSubmit = name.trim() !== '' && email.trim() !== '' && interests.length > 0 && status !== 'submitting'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    try {
      const { error } = await submitGetInvolved({
        name: name.trim(),
        email: email.trim(),
        organisation: organisation.trim() || undefined,
        interests,
        message: message.trim() || undefined,
      })

      if (error) {
        setStatus('error')
        setErrorMessage(translateError(locale, error))
      } else {
        setStatus('success')
      }
    } catch {
      setStatus('error')
      setErrorMessage(translateError(locale, 'submission_failed'))
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <p className="text-brand-ink font-bold text-lg mb-2">{t.getInvolved.thanksTitle}</p>
        <p className="text-brand-muted text-sm mb-6">{t.getInvolved.thanksBody}</p>
        <Link href="/" className="btn-secondary">{t.getInvolved.backToHome}</Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}

      <div>
        <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1 block">
          {t.getInvolved.nameLabel}
        </label>
        <input
          className="input w-full"
          placeholder={t.getInvolved.namePlaceholder}
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1 block">
          {t.getInvolved.emailLabel}
        </label>
        <input
          className="input w-full"
          type="email"
          placeholder={t.getInvolved.emailPlaceholder}
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1 block">
          {t.getInvolved.orgLabel}
        </label>
        <input
          className="input w-full"
          placeholder={t.getInvolved.orgPlaceholder}
          value={organisation}
          onChange={e => setOrganisation(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1 block">
          {t.getInvolved.interestsLabel}
        </label>
        <div className="space-y-2 mt-2">
          {INTEREST_KEYS.map(key => {
            const englishLabel = en.getInvolved.interestOptions[key]
            return (
              <label key={key} className="flex items-center gap-2 text-brand-ink/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={interests.includes(englishLabel)}
                  onChange={() => toggleInterest(englishLabel)}
                  className="accent-[#F26522]"
                  disabled={status === 'submitting'}
                />
                {t.getInvolved.interestOptions[key]}
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1 block">
          {t.getInvolved.messageLabel}
        </label>
        <textarea
          className="input w-full"
          rows={4}
          placeholder={t.getInvolved.messagePlaceholder}
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? t.getInvolved.sending : t.getInvolved.send}
      </button>
    </form>
  )
}
