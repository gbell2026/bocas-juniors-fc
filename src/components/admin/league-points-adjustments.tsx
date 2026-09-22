'use client'
import { useEffect, useState } from 'react'
import { getPointsAdjustments, addPointsAdjustment, deletePointsAdjustment } from '@/app/actions/league-admin'

type Division = { id: string; name: string }
type Team = { id: string; name: string; divisionId: string }
type Adjustment = Awaited<ReturnType<typeof getPointsAdjustments>>[number]

export function LeaguePointsAdjustments({ divisions, teams }: { divisions: Division[]; teams: Team[] }) {
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? '')
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [teamId, setTeamId] = useState('')
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [creating, setCreating] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const divisionTeams = teams.filter(t => t.divisionId === divisionId)

  useEffect(() => {
    if (!divisionId) return
    setLoading(true)
    getPointsAdjustments(divisionId).then(data => { setAdjustments(data); setLoading(false) })
    setTeamId(''); setPoints(''); setReason('')
  }, [divisionId])

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    const pointsNum = Number(points)
    if (!teamId || !reason.trim() || points.trim() === '' || Number.isNaN(pointsNum)) {
      setErrorMessage('Pick a team, a points value, and a reason.')
      return
    }
    setCreating(true)
    try {
      const result = await addPointsAdjustment({ teamId, points: pointsNum, reason: reason.trim() })
      if (result.error || !result.adjustment) { setErrorMessage(result.error ?? 'Something went wrong. Please try again.'); return }
      setAdjustments(prev => [result.adjustment!, ...prev])
      setTeamId(''); setPoints(''); setReason('')
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleRemove(id: string) {
    setErrorMessage(null)
    setRemoving(id)
    try {
      const result = await deletePointsAdjustment(id)
      if (result.error) { setErrorMessage(result.error); return }
      setAdjustments(prev => prev.filter(a => a.id !== id))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setRemoving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Points Adjustments</h2>
      <p className="text-brand-muted text-xs mb-3">
        Standings otherwise come purely from match results — use this for a disciplinary deduction or bonus
        (e.g. an overage player, a late kickoff). Positive or negative points both work; use 0 to add an
        explanatory footnote without changing anyone's points (e.g. when the penalty is already baked into
        a default-win scoreline).
      </p>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="mb-4">
        <label htmlFor="pointsAdjDivisionSelect" className="block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">Division</label>
        <select
          id="pointsAdjDivisionSelect"
          className="input w-full max-w-xs"
          value={divisionId}
          onChange={e => setDivisionId(e.target.value)}
        >
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-brand-muted text-sm">Loading…</p>
      ) : (
        <div className="space-y-2 mb-4">
          {adjustments.map(a => {
            const team = teams.find(t => t.id === a.teamId)
            return (
              <div key={a.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">
                    {team?.name ?? 'Unknown team'}{' '}
                    <span className={a.points < 0 ? 'text-red-600' : a.points > 0 ? 'text-green-600' : 'text-amber-600'}>
                      {a.points > 0 ? `+${a.points}` : a.points} pts
                    </span>
                  </p>
                  <p className="text-brand-muted text-xs">{a.reason}</p>
                </div>
                <button
                  onClick={() => handleRemove(a.id)}
                  disabled={removing === a.id}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  {removing === a.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            )
          })}
          {adjustments.length === 0 && <p className="text-brand-muted text-sm">No points adjustments for this division.</p>}
        </div>
      )}

      <form onSubmit={handleAdd} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Adjustment</p>
        <div className="flex gap-2 flex-wrap">
          <select className="input flex-1" value={teamId} onChange={e => setTeamId(e.target.value)}>
            <option value="">Team…</option>
            {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="number" placeholder="Points (e.g. -3)" className="input w-40"
            value={points} onChange={e => setPoints(e.target.value)}
          />
        </div>
        <input
          type="text" placeholder="Reason (e.g. Fielded an overage player)" className="input w-full"
          value={reason} onChange={e => setReason(e.target.value)}
        />
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Adding…' : 'Add Adjustment'}
        </button>
      </form>
    </section>
  )
}
