'use client'
import { useState } from 'react'
import { createFinanceSeason, updateFinanceSeason } from '@/app/actions/finances'
import type { FinanceSeason, FinanceCategory } from '@/app/actions/finances'

type Props = {
  seasons: FinanceSeason[]
  categories: FinanceCategory[]
}

// Falls back to the season with the latest start date when none contains
// today — `getFinanceSeasons` orders by start_date descending, so
// seasons[0] is that season. Not literally "most recently created" (this
// list doesn't carry a created_at to the client), but the closest available
// proxy and the only ordering already established by Chunk 1.
function defaultSeasonId(seasons: FinanceSeason[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const current = seasons.find(s => s.startDate <= today && today <= s.endDate)
  return current?.id ?? seasons[0]?.id ?? ''
}

export function FinancesAdmin({ seasons: initialSeasons, categories }: Props) {
  const [seasons, setSeasons] = useState(initialSeasons)
  const [seasonId, setSeasonId] = useState(defaultSeasonId(initialSeasons))
  const [managingSeasons, setManagingSeasons] = useState(false)
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { label: string; startDate: string; endDate: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(s: FinanceSeason) {
    setEditingId(s.id)
    setEdits(prev => ({ ...prev, [s.id]: { label: s.label, startDate: s.startDate, endDate: s.endDate } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const result = await createFinanceSeason({ label, startDate, endDate })
      if (result.error) { setErrorMessage(result.error); return }
      setLabel(''); setStartDate(''); setEndDate('')
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit) return
    if (!edit.label || !edit.startDate || !edit.endDate) {
      setErrorMessage('Label, start date, and end date are all required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateFinanceSeason(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setSeasons(prev => prev.map(s => s.id === id ? { ...s, ...edit } : s))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  const selectedSeason = seasons.find(s => s.id === seasonId) ?? null

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink">Finances</h2>
        <button onClick={() => setManagingSeasons(v => !v)} className="btn-secondary text-xs px-3 py-1.5">
          {managingSeasons ? 'Done' : 'Manage Seasons'}
        </button>
      </div>

      {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}

      {seasons.length === 0 ? (
        <p className="text-brand-muted text-sm">Create a season to get started.</p>
      ) : (
        <select
          value={seasonId}
          onChange={e => setSeasonId(e.target.value)}
          className="input"
        >
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.label} ({s.startDate} – {s.endDate})</option>
          ))}
        </select>
      )}

      {managingSeasons && (
        <div className="space-y-2 border border-brand-line rounded p-4">
          {seasons.map(s => (
            <div key={s.id} className="bg-brand-tint border border-brand-line rounded p-3">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <input
                    className="input w-full"
                    value={edits[s.id]?.label ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], label: e.target.value } }))}
                  />
                  <div className="flex gap-2">
                    <input
                      type="date" className="input flex-1"
                      value={edits[s.id]?.startDate ?? ''}
                      onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], startDate: e.target.value } }))}
                    />
                    <input
                      type="date" className="input flex-1"
                      value={edits[s.id]?.endDate ?? ''}
                      onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], endDate: e.target.value } }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(s.id)} disabled={saving === s.id} className="btn-primary text-xs px-3 py-1.5">
                      {saving === s.id ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{s.label}</p>
                    <p className="text-brand-muted text-xs">{s.startDate} – {s.endDate}</p>
                  </div>
                  <button onClick={() => startEdit(s)} className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                </div>
              )}
            </div>
          ))}

          <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
            <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Season</p>
            <input
              placeholder="Season label (e.g. 2026 Season)" required className="input w-full"
              value={label} onChange={e => setLabel(e.target.value)}
            />
            <div className="flex gap-2">
              <input type="date" required className="input flex-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" required className="input flex-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
              {creating ? 'Creating…' : 'Create Season'}
            </button>
          </form>
        </div>
      )}

      {selectedSeason && <p className="text-brand-muted text-sm">Categories loaded: {categories.length}</p>}
    </section>
  )
}
