'use client'
import { useEffect, useState } from 'react'
import { getFixturesForAdmin, updateFixture, addFixture, setFixtureCancelled } from '@/app/actions/league-admin'

type Division = { id: string; name: string }
type Team = { id: string; name: string; divisionId: string }
type Fixture = Awaited<ReturnType<typeof getFixturesForAdmin>>[number]

type Draft = {
  matchDate: string
  kickoff: string
  location: string
  homeTeamId: string
  awayTeamId: string
  homeScore: string
  awayScore: string
}

function draftFromFixture(f: Fixture): Draft {
  return {
    matchDate: f.matchDate,
    kickoff: f.kickoff ?? '',
    location: f.location ?? '',
    homeTeamId: f.homeTeamId,
    awayTeamId: f.awayTeamId,
    homeScore: String(f.homeScore ?? ''),
    awayScore: String(f.awayScore ?? ''),
  }
}

function draftsEqual(a: Draft, b: Draft): boolean {
  return (Object.keys(a) as (keyof Draft)[]).every(k => a[k] === b[k])
}

export function LeagueFixturesAdmin({ divisions, teams }: { divisions: Division[]; teams: Team[] }) {
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? '')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [newFixture, setNewFixture] = useState({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '', location: '' })

  async function refresh() {
    if (!divisionId) return
    setLoading(true)
    const data = await getFixturesForAdmin(divisionId)
    setFixtures(data)
    setDrafts({})
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '', location: '' })
  }, [divisionId])

  const divisionTeams = teams.filter(t => t.divisionId === divisionId)

  function draftFor(f: Fixture): Draft {
    return drafts[f.id] ?? draftFromFixture(f)
  }

  function setField(f: Fixture, field: keyof Draft, value: string) {
    setDrafts(prev => ({ ...prev, [f.id]: { ...draftFor(f), [field]: value } }))
  }

  function resetDraft(id: string) {
    setDrafts(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleSave(f: Fixture) {
    const draft = draftFor(f)
    setErrorMessage(null)

    if (!draft.matchDate) { setErrorMessage('A match needs a date.'); return }
    if (draft.homeTeamId === draft.awayTeamId) { setErrorMessage('Home and away team must be different.'); return }
    if ((draft.homeScore === '') !== (draft.awayScore === '')) {
      setErrorMessage('Enter both scores or neither.')
      return
    }

    setSaving(f.id)
    try {
      const result = await updateFixture(f.id, {
        matchDate: draft.matchDate,
        homeTeamId: draft.homeTeamId,
        awayTeamId: draft.awayTeamId,
        kickoff: draft.kickoff || null,
        location: draft.location || null,
        homeScore: draft.homeScore === '' ? null : Number(draft.homeScore),
        awayScore: draft.awayScore === '' ? null : Number(draft.awayScore),
      })
      if (result.error) { setErrorMessage(result.error); return }
      await refresh()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleToggleCancelled(fixtureId: string, cancelled: boolean) {
    setErrorMessage(null)
    setSaving(fixtureId)
    try {
      const result = await setFixtureCancelled(fixtureId, cancelled)
      if (result.error) { setErrorMessage(result.error); return }
      await refresh()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleAddFixture(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)

    if (newFixture.homeTeamId === newFixture.awayTeamId) {
      setErrorMessage('Home and away team must be different.')
      return
    }

    try {
      const result = await addFixture({
        divisionId,
        ...newFixture,
        kickoff: newFixture.kickoff || undefined,
        location: newFixture.location || undefined,
      })
      if (result.error) { setErrorMessage(result.error); return }
      setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '', location: '' })
      await refresh()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">League Fixtures</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="mb-4">
        <label htmlFor="fixtureDivisionSelect" className="block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">Division</label>
        <select
          id="fixtureDivisionSelect"
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
          {fixtures.map(f => {
            const draft = draftFor(f)
            const dirty = !draftsEqual(draft, draftFromFixture(f))
            const busy = saving === f.id
            return (
              <div key={f.id} className={`bg-brand-tint border border-brand-line rounded p-3 ${f.cancelled ? 'opacity-60' : ''}`}>
                {f.cancelled && (
                  <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Cancelled</span>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date" className="input text-xs" disabled={busy}
                    value={draft.matchDate}
                    onChange={e => setField(f, 'matchDate', e.target.value)}
                  />
                  <input
                    type="time" className="input text-xs" disabled={busy}
                    value={draft.kickoff}
                    onChange={e => setField(f, 'kickoff', e.target.value)}
                  />
                  <select
                    className="input text-xs flex-1 min-w-[8rem]" disabled={busy}
                    value={draft.homeTeamId}
                    onChange={e => setField(f, 'homeTeamId', e.target.value)}
                  >
                    {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="text-brand-muted text-xs">vs</span>
                  <select
                    className="input text-xs flex-1 min-w-[8rem]" disabled={busy}
                    value={draft.awayTeamId}
                    onChange={e => setField(f, 'awayTeamId', e.target.value)}
                  >
                    {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input
                    type="number" min={0} placeholder="H" className="input w-14 text-xs" disabled={busy}
                    value={draft.homeScore}
                    onChange={e => setField(f, 'homeScore', e.target.value)}
                  />
                  <input
                    type="number" min={0} placeholder="A" className="input w-14 text-xs" disabled={busy}
                    value={draft.awayScore}
                    onChange={e => setField(f, 'awayScore', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <input
                    type="text" className="input text-xs flex-1 min-w-[10rem]" disabled={busy}
                    placeholder="Location (leave blank for the usual ground)"
                    value={draft.location}
                    onChange={e => setField(f, 'location', e.target.value)}
                  />
                  <button
                    onClick={() => handleSave(f)}
                    disabled={busy || !dirty}
                    className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save changes'}
                  </button>
                  {dirty && (
                    <button
                      onClick={() => resetDraft(f.id)}
                      disabled={busy}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleCancelled(f.id, !f.cancelled)}
                    disabled={busy}
                    className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50"
                  >
                    {f.cancelled ? 'Un-cancel' : 'Cancel'}
                  </button>
                </div>
              </div>
            )
          })}
          {fixtures.length === 0 && <p className="text-brand-muted text-sm">No fixtures yet for this division.</p>}
        </div>
      )}

      <form onSubmit={handleAddFixture} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Fixture Manually</p>
        <div className="flex gap-2 flex-wrap">
          <select
            required className="input flex-1"
            value={newFixture.homeTeamId}
            onChange={e => setNewFixture(prev => ({ ...prev, homeTeamId: e.target.value }))}
          >
            <option value="">Home team…</option>
            {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select
            required className="input flex-1"
            value={newFixture.awayTeamId}
            onChange={e => setNewFixture(prev => ({ ...prev, awayTeamId: e.target.value }))}
          >
            <option value="">Away team…</option>
            {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <input
            type="date" required className="input flex-1"
            value={newFixture.matchDate}
            onChange={e => setNewFixture(prev => ({ ...prev, matchDate: e.target.value }))}
          />
          <input
            type="time" className="input flex-1"
            value={newFixture.kickoff}
            onChange={e => setNewFixture(prev => ({ ...prev, kickoff: e.target.value }))}
          />
        </div>
        <input
          type="text" className="input w-full"
          placeholder="Location (optional — leave blank for the usual ground)"
          value={newFixture.location}
          onChange={e => setNewFixture(prev => ({ ...prev, location: e.target.value }))}
        />
        <button type="submit" className="btn-primary text-sm w-full">Add Fixture</button>
      </form>
    </section>
  )
}
