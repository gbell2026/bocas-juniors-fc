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
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Get Involved Submissions ({unhandledCount} unhandled)</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-creamAlt">
            <tr>
              {['Name', 'Email', 'Organisation', 'Interests', 'Message', 'Date', 'Status/Action'].map(h => (
                <th key={h} className="text-left p-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className={`border-t align-top ${item.handled ? 'opacity-40' : ''}`}>
                <td className="p-3 font-medium">{item.name}</td>
                <td className="p-3">
                  <a href={`mailto:${item.email}`} className="text-brand-primaryDeep">{item.email}</a>
                </td>
                <td className="p-3">{item.organisation || '—'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {item.interests.map(interest => (
                      <span key={interest} className="bg-brand-creamAlt text-brand-muted rounded px-2 py-0.5 text-xs">
                        {interest}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 max-w-xs truncate" title={item.message ?? undefined}>{item.message || '—'}</td>
                <td className="p-3 text-brand-mutedWarm text-xs whitespace-nowrap">{formatDate(item.submitted_at)}</td>
                <td className="p-3">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
