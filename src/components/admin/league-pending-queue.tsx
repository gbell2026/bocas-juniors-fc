'use client'
import { useState } from 'react'
import {
  approveLeagueClub, rejectLeagueClub,
  approveLeagueTeam, rejectLeagueTeam,
  approveLeaguePlayer, rejectLeaguePlayer,
} from '@/app/actions/league-admin'

type PendingClub = { id: string; name: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null }
type PendingTeam = { id: string; name: string; clubName: string; divisionName: string }
type PendingPlayer = { id: string; name: string; squadNumber: number; teamName: string; clubName: string }

type Props = { clubs: PendingClub[]; teams: PendingTeam[]; players: PendingPlayer[] }

export function LeaguePendingQueue({ clubs: initialClubs, teams: initialTeams, players: initialPlayers }: Props) {
  const [clubs, setClubs] = useState(initialClubs)
  const [teams, setTeams] = useState(initialTeams)
  const [players, setPlayers] = useState(initialPlayers)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (clubs.length === 0 && teams.length === 0 && players.length === 0) return null

  async function withProcessing(id: string, fn: () => Promise<void>) {
    setErrorMessage(null)
    setProcessing(prev => new Set(prev).add(id))
    try {
      await fn()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  const handleApproveClub = (id: string) => withProcessing(id, async () => {
    const result = await approveLeagueClub(id)
    if (result.error) { setErrorMessage(result.error); return }
    setClubs(prev => prev.filter(c => c.id !== id))
  })
  const handleRejectClub = (id: string) => withProcessing(id, async () => {
    const result = await rejectLeagueClub(id)
    if (result.error) { setErrorMessage(result.error); return }
    setClubs(prev => prev.filter(c => c.id !== id))
  })
  const handleApproveTeam = (id: string) => withProcessing(id, async () => {
    const result = await approveLeagueTeam(id)
    if (result.error) { setErrorMessage(result.error); return }
    // A newly-approved team needs to show up in LeagueFixturesAdmin's team
    // dropdowns (fed by a separate server-side getApprovedTeams() fetch on
    // this same page) — reload so that data is fresh, matching the pattern
    // LeagueDivisions already uses after create/generate-schedule.
    window.location.reload()
  })
  const handleRejectTeam = (id: string) => withProcessing(id, async () => {
    const result = await rejectLeagueTeam(id)
    if (result.error) { setErrorMessage(result.error); return }
    setTeams(prev => prev.filter(t => t.id !== id))
  })
  const handleApprovePlayer = (id: string) => withProcessing(id, async () => {
    const result = await approveLeaguePlayer(id)
    if (result.error) { setErrorMessage(result.error); return }
    setPlayers(prev => prev.filter(p => p.id !== id))
  })
  const handleRejectPlayer = (id: string) => withProcessing(id, async () => {
    const result = await rejectLeaguePlayer(id)
    if (result.error) { setErrorMessage(result.error); return }
    setPlayers(prev => prev.filter(p => p.id !== id))
  })

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">
        League Pending Approvals ({clubs.length + teams.length + players.length})
      </h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      {clubs.length > 0 && (
        <div className="mb-4">
          <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">New Clubs</p>
          <div className="space-y-2">
            {clubs.map(c => (
              <div key={c.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">{c.name}</p>
                  <p className="text-brand-muted text-xs">
                    {[c.contact_name, c.contact_email, c.contact_phone].filter(Boolean).join(' · ') || 'No contact details provided'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApproveClub(c.id)} disabled={processing.has(c.id)} className="btn-primary text-xs px-3 py-1.5">Approve</button>
                  <button onClick={() => handleRejectClub(c.id)} disabled={processing.has(c.id)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {teams.length > 0 && (
        <div className="mb-4">
          <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">New Teams</p>
          <div className="space-y-2">
            {teams.map(t => (
              <div key={t.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">{t.clubName} — {t.name}</p>
                  <p className="text-brand-muted text-xs">{t.divisionName}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApproveTeam(t.id)} disabled={processing.has(t.id)} className="btn-primary text-xs px-3 py-1.5">Approve</button>
                  <button onClick={() => handleRejectTeam(t.id)} disabled={processing.has(t.id)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {players.length > 0 && (
        <div>
          <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">New Players</p>
          <div className="space-y-2">
            {players.map(p => (
              <div key={p.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-brand-ink font-bold text-sm">{p.name} <span className="text-brand-muted font-normal">#{p.squadNumber}</span></p>
                  <p className="text-brand-muted text-xs">{p.clubName} — {p.teamName}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => handleApprovePlayer(p.id)} disabled={processing.has(p.id)} className="btn-primary text-xs px-3 py-1.5">Approve</button>
                  <button onClick={() => handleRejectPlayer(p.id)} disabled={processing.has(p.id)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
