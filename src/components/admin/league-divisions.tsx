'use client'
import { useState } from 'react'
import { createDivision, updateDivision, generateSchedule } from '@/app/actions/league-admin'

type Division = { id: string; name: string; season_start_date: string; season_end_date: string }

export function LeagueDivisions({ divisions: initial }: { divisions: Division[] }) {
  const [divisions, setDivisions] = useState(initial)
  const [name, setName] = useState('')
  const [seasonStartDate, setSeasonStartDate] = useState('')
  const [seasonEndDate, setSeasonEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { name: string; seasonStartDate: string; seasonEndDate: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(d: Division) {
    setEditingId(d.id)
    setEdits(prev => ({ ...prev, [d.id]: { name: d.name, seasonStartDate: d.season_start_date, seasonEndDate: d.season_end_date } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    const result = await createDivision({ name, seasonStartDate, seasonEndDate })
    setCreating(false)
    if (result.error) { setErrorMessage(result.error); return }
    setName(''); setSeasonStartDate(''); setSeasonEndDate('')
    window.location.reload()
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit) return
    setErrorMessage(null)
    setSaving(id)
    const result = await updateDivision(id, edit)
    setSaving(null)
    if (result.error) { setErrorMessage(result.error); return }
    setDivisions(prev => prev.map(d => d.id === id
      ? { ...d, name: edit.name, season_start_date: edit.seasonStartDate, season_end_date: edit.seasonEndDate }
      : d
    ))
    setEditingId(null)
  }

  async function handleGenerateSchedule(divisionId: string) {
    setErrorMessage(null)
    setGenerating(divisionId)
    const result = await generateSchedule(divisionId)
    setGenerating(null)
    if (result.error) { setErrorMessage(result.error); return }
    window.location.reload()
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">League Divisions</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="space-y-2 mb-4">
        {divisions.map(d => (
          <div key={d.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === d.id ? (
              <div className="space-y-2">
                <input
                  className="input w-full"
                  value={edits[d.id]?.name ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [d.id]: { ...prev[d.id], name: e.target.value } }))}
                />
                <div className="flex gap-2">
                  <input
                    type="date" className="input flex-1"
                    value={edits[d.id]?.seasonStartDate ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [d.id]: { ...prev[d.id], seasonStartDate: e.target.value } }))}
                  />
                  <input
                    type="date" className="input flex-1"
                    value={edits[d.id]?.seasonEndDate ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [d.id]: { ...prev[d.id], seasonEndDate: e.target.value } }))}
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(d.id)} disabled={saving === d.id} className="btn-primary text-xs px-3 py-1.5">
                    {saving === d.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">{d.name}</p>
                  <p className="text-brand-muted text-xs">{d.season_start_date} – {d.season_end_date}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(d)} className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                  <button
                    onClick={() => handleGenerateSchedule(d.id)}
                    disabled={generating === d.id}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    {generating === d.id ? 'Generating…' : 'Generate Schedule'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Division</p>
        <input
          placeholder="Division name (e.g. U12)" required className="input w-full"
          value={name} onChange={e => setName(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            type="date" required className="input flex-1"
            value={seasonStartDate} onChange={e => setSeasonStartDate(e.target.value)}
          />
          <input
            type="date" required className="input flex-1"
            value={seasonEndDate} onChange={e => setSeasonEndDate(e.target.value)}
          />
        </div>
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Creating…' : 'Create Division'}
        </button>
      </form>
    </section>
  )
}
