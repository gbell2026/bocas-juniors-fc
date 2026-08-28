'use client'
import { useState } from 'react'
import { setPracticeBanner, type PracticeBanner } from '@/app/actions/practice-banner'
import { PracticeBannerView } from '@/components/practice-banner-view'

type Status = 'idle' | 'saving' | 'saved' | 'error'

export function PracticeBannerControl({ initial }: { initial: PracticeBanner }) {
  const [active, setActive] = useState(initial.active)
  const [date, setDate] = useState(initial.date)
  const [reason, setReason] = useState(initial.reason)
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function save(next: PracticeBanner) {
    setStatus('saving')
    setErrorMessage(null)
    try {
      const { error } = await setPracticeBanner(next)
      if (error) {
        setStatus('error')
        setErrorMessage(error)
        return
      }
      setActive(next.active)
      setStatus('saved')
    } catch {
      setStatus('error')
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Practice Cancellation Banner</h2>
      <div className="bg-brand-surface border border-brand-border rounded p-4 space-y-4">
        {active ? (
          <p className="text-brand-primary text-sm font-bold uppercase tracking-wider">
            ● Live on the homepage
          </p>
        ) : (
          <p className="text-white/40 text-sm uppercase tracking-wider">Not shown</p>
        )}

        <div>
          <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
            Date
          </label>
          <input
            className="input w-full"
            placeholder="e.g. Saturday 30 August"
            value={date}
            onChange={e => setDate(e.target.value)}
            disabled={status === 'saving'}
          />
        </div>

        <div>
          <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
            Reason
          </label>
          <input
            className="input w-full"
            placeholder="e.g. heavy rain and a waterlogged pitch"
            value={reason}
            onChange={e => setReason(e.target.value)}
            disabled={status === 'saving'}
          />
        </div>

        <div>
          <p className="text-white/30 text-xs uppercase tracking-widest mb-2">Preview</p>
          <PracticeBannerView date={date.trim()} reason={reason.trim()} />
        </div>

        {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}
        {status === 'saved' && <p className="text-green-500 text-sm">Saved.</p>}

        <div className="flex flex-wrap gap-3">
          {active ? (
            <>
              <button
                onClick={() => save({ active: true, date, reason })}
                disabled={status === 'saving'}
                className="btn-primary disabled:opacity-50"
              >
                {status === 'saving' ? 'Saving…' : 'Update banner'}
              </button>
              <button
                onClick={() => save({ active: false, date, reason })}
                disabled={status === 'saving'}
                className="btn-secondary disabled:opacity-50"
              >
                Remove banner
              </button>
            </>
          ) : (
            <button
              onClick={() => save({ active: true, date, reason })}
              disabled={status === 'saving'}
              className="btn-primary disabled:opacity-50"
            >
              {status === 'saving' ? 'Saving…' : "Cancel today's practice"}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
