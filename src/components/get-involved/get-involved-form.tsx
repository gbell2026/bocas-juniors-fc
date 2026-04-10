'use client'
import { useState } from 'react'
import { submitGetInvolved } from '@/app/actions/get-involved'

const INTEREST_OPTIONS = [
  'Sponsoring the website',
  'Sponsoring the kit',
  'Helping on game days',
  'Donating equipment',
  'Becoming a volunteer',
  'Other',
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function GetInvolvedForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function toggleInterest(option: string) {
    setInterests(prev =>
      prev.includes(option) ? prev.filter(i => i !== option) : [...prev, option]
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
        setErrorMessage(error)
      } else {
        setStatus('success')
      }
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <p className="text-white font-bold text-lg mb-2">Thanks for getting in touch!</p>
        <p className="text-white/50 text-sm">We&apos;ll be in contact soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Name *
        </label>
        <input
          className="input w-full"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Email *
        </label>
        <input
          className="input w-full"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Business / Organisation
        </label>
        <input
          className="input w-full"
          placeholder="Business or organisation name (optional)"
          value={organisation}
          onChange={e => setOrganisation(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          I&apos;m interested in... *
        </label>
        <div className="space-y-2 mt-2">
          {INTEREST_OPTIONS.map(option => (
            <label key={option} className="flex items-center gap-2 text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={interests.includes(option)}
                onChange={() => toggleInterest(option)}
                className="accent-[#FF0055]"
                disabled={status === 'submitting'}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Message
        </label>
        <textarea
          className="input w-full"
          rows={4}
          placeholder="Anything else you'd like us to know? (optional)"
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
        {status === 'submitting' ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
