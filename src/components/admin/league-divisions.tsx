'use client'
import { useState } from 'react'
import { createDivision, updateDivision, generateSchedule, generateAlignedSchedule } from '@/app/actions/league-admin'

type Division = { id: string; name: string; season_start_date: string; season_end_date: string }

export function LeagueDivisions({ divisions: initial }: { divisions: Division[] }) {
  const [divisions, setDivisions] = useState(initial)
  const [name, setName] = useState('')
  const [seasonStartDate, setSeasonStartDate] = useState('')
  const [seasonEndDate, setSeasonEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [generatingAligned, setGeneratingAligned] = useState(false)
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
    try {
      const result = await createDivision({ name, seasonStartDate, seasonEndDate })
      if (result.error) { setErrorMessage(result.error); return }
      setName(''); setSeasonStartDate(''); setSeasonEndDate('')
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
    if (!edit.name || !edit.seasonStartDate || !edit.seasonEndDate) {
      setErrorMessage('Name, start date, and end date are all required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateDivision(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setDivisions(prev => prev.map(d => d.id === id
        ? { ...d, name: edit.name, season_start_date: edit.seasonStartDate, season_end_date: edit.seasonEndDate }
        : d
      ))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleGenerateSchedule(divisionId: string) {
    setErrorMessage(null)
    setGenerating(divisionId)
    try {
      const result = await generateSchedule(divisionId)
      if (result.error) { setErrorMessage(result.error); return }
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setGenerating(null)
    }
  }

  async function handleGenerateAligned() {
    setErrorMessage(null)
    setGeneratingAligned(true)
    try {
      const result = await generateAlignedSchedule(divisions.map(d => d.id))
      if (result.error) { setErrorMessage(result.error); return }
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setGeneratingAligned(false)
    }
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

      {divisions.length >= 2 && (
        <div className="mb-4">
          <button
            onClick={handleGenerateAligned}
            disabled={generatingAligned}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            {generatingAligned ? 'Generating…' : 'Generate Aligned Schedule (All Divisions)'}
          </button>
          <p className="text-brand-muted text-[10px] mt-1">
            Requires every division to have the same season dates and no existing fixtures. Any club fielding a team in more than one division always plays on the same date across age groups, and Tangerine Toucans plays every round including round 1.
          </p>
        </div>
      )}

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
