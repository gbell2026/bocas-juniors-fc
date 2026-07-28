'use client'
import { useState } from 'react'
import type { GetInvolvedSubmission } from '@/lib/supabase/types'
import { markSubmissionHandled } from '@/app/actions/admin'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function GetInvolvedSubmissions({ submissions: initial }: { submissions: GetInvolvedSubmission[] }) {
  const [items, setItems] = useState(initial)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (items.length === 0) return null

  const unhandledCount = items.filter(s => !s.handled).length

  async function handleMarkHandled(id: string) {
    setErrorMessage(null)
    setProcessing(prev => new Set(prev).add(id))
    try {
      await markSubmissionHandled(id)
      setItems(prev => prev.map(s => s.id === id ? { ...s, handled: true } : s))
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Get Involved Submissions ({unhandledCount} unhandled)</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className={`bg-brand-tint border border-brand-line rounded p-4 ${item.handled ? 'opacity-40' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-brand-ink font-bold text-sm">{item.name}</p>
                <a href={`mailto:${item.email}`} className="text-brand-primaryDeep text-xs">{item.email}</a>
                {item.organisation && (
                  <p className="text-brand-muted text-xs mt-0.5">
                    <span className="text-brand-mutedWarm">Org:</span> {item.organisation}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.interests.map(interest => (
                    <span key={interest} className="bg-brand-creamAlt text-brand-muted rounded px-2 py-0.5 text-xs">
                      {interest}
                    </span>
                  ))}
                </div>
                {item.message && <p className="text-brand-muted text-xs mt-2">{item.message}</p>}
                <p className="text-brand-mutedWarm text-xs mt-1">{formatDate(item.submitted_at)}</p>
              </div>
              <div className="flex-shrink-0">
                {item.handled ? (
                  <span className="text-brand-mutedWarm text-xs font-bold uppercase">Handled</span>
                ) : (
                  <button
                    onClick={() => handleMarkHandled(item.id)}
                    disabled={processing.has(item.id)}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Mark as Handled
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
