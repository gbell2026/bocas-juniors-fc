'use client'
import { useState } from 'react'
import { updateLeagueTeam } from '@/app/actions/league-admin'
import type { getAllLeagueTeams, getLeagueDivisionsAdmin } from '@/app/actions/league-admin'

type Team = Awaited<ReturnType<typeof getAllLeagueTeams>>[number]
type Division = Awaited<ReturnType<typeof getLeagueDivisionsAdmin>>[number]
type Status = Team['status']

type EditState = { name: string; divisionId: string; status: Status }

type Props = { teams: Team[]; divisions: Division[] }

export function ManageLeagueTeams({ teams: initial, divisions }: Props) {
  const [teams, setTeams] = useState(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(t: Team) {
    setEditingId(t.id)
    setEdits(prev => ({ ...prev, [t.id]: { name: t.name, divisionId: t.divisionId, status: t.status } }))
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.name) {
      setErrorMessage('Team name is required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateLeagueTeam(id, { name: edit.name, divisionId: edit.divisionId, status: edit.status })
      if (result.error) { setErrorMessage(result.error); return }
      const divisionName = divisions.find(d => d.id === edit.divisionId)?.name ?? ''
      setTeams(prev => prev.map(t => t.id === id
        ? { ...t, name: edit.name, divisionId: edit.divisionId, divisionName, status: edit.status }
        : t
      ))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Manage Teams ({teams.length})</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      {teams.length === 0 && <p className="text-brand-muted text-sm">No teams registered yet.</p>}

      <div className="space-y-2">
        {teams.map(t => (
          <div key={t.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === t.id ? (
              <div className="space-y-2">
                <input
                  className="input w-full" placeholder="Team name"
                  value={edits[t.id].name}
                  onChange={e => setEdits(prev => ({ ...prev, [t.id]: { ...prev[t.id], name: e.target.value } }))}
                />
                <select
                  className="input w-full" aria-label="Division"
                  value={edits[t.id].divisionId}
                  onChange={e => setEdits(prev => ({ ...prev, [t.id]: { ...prev[t.id], divisionId: e.target.value } }))}
                >
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <select
                  className="input w-full" aria-label="Status"
                  value={edits[t.id].status}
                  onChange={e => setEdits(prev => ({ ...prev, [t.id]: { ...prev[t.id], status: e.target.value as Status } }))}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(t.id)} disabled={saving === t.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === t.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">{t.clubName} — {t.name}</p>
                  <p className="text-brand-muted text-xs">{t.divisionName} · <span className="uppercase">{t.status}</span></p>
                </div>
                <button onClick={() => startEdit(t)} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">Edit</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
