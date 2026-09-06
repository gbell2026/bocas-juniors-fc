'use client'
import { useEffect, useState } from 'react'
import { getLeagueBanner, setLeagueBanner } from '@/app/actions/league-banner'
import { LeaguePostponedBanner } from '@/components/league-postponed-banner'

export function LeagueBannerAdmin() {
  const [message, setMessage] = useState('')
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getLeagueBanner()
      .then(b => { setMessage(b.message); setActive(b.active) })
      .catch(() => setError('Failed to load the banner.'))
      .finally(() => setLoading(false))
  }, [])

  async function save(nextActive: boolean) {
    setSaving(true)
    setError(null)
    try {
      const result = await setLeagueBanner({ active: nextActive, message })
      if (result.error) { setError(result.error); return }
      setActive(nextActive)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-brand-muted text-sm">Loading…</p>

  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-heading text-brand-ink uppercase tracking-wide">Homepage Postponement Banner</h3>
        <p className="text-brand-muted text-xs">
          Shows a red alert at the top of the homepage — e.g. when a matchday is rained off.
        </p>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <textarea
        className="input w-full"
        rows={2}
        placeholder="Today's league fixtures are postponed due to bad weather."
        value={message}
        onChange={e => setMessage(e.target.value)}
        disabled={saving}
      />

      <div>
        <p className="text-brand-muted text-[10px] uppercase tracking-widest mb-1">Preview</p>
        <LeaguePostponedBanner banner={{ active: true, message: message || '…' }} />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {active ? (
          <>
            <span className="text-red-600 text-xs font-bold uppercase tracking-wider">● Live on homepage</span>
            <button
              onClick={() => save(true)}
              disabled={saving}
              className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Update text'}
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving}
              className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
            >
              Hide banner
            </button>
          </>
        ) : (
          <button
            onClick={() => save(true)}
            disabled={saving}
            className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Show banner'}
          </button>
        )}
      </div>
    </section>
  )
}
