'use client'
import { useEffect, useState } from 'react'
import { getFixturesForAdmin, updateFixture, addFixture, recordFixtureScore } from '@/app/actions/league-admin'

type Division = { id: string; name: string }
type Team = { id: string; name: string; divisionId: string }
type Fixture = Awaited<ReturnType<typeof getFixturesForAdmin>>[number]

export function LeagueFixturesAdmin({ divisions, teams }: { divisions: Division[]; teams: Team[] }) {
  const [divisionId, setDivisionId] = useState(divisions[0]?.id ?? '')
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, { home: string; away: string }>>({})
  const [newFixture, setNewFixture] = useState({ homeTeamId: '', awayTeamId: '', matchDate: '' })

  async function refresh() {
    if (!divisionId) return
    setLoading(true)
    const data = await getFixturesForAdmin(divisionId)
    setFixtures(data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    // Switching divisions invalidates any in-progress "Add Fixture" selections —
    // the previously-picked teams belong to the old division and won't appear
    // as options in the new one, so stale state would otherwise sit there
    // satisfying `required` with a team that isn't actually selectable anymore.
    setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '' })
  }, [divisionId])

  const divisionTeams = teams.filter(t => t.divisionId === divisionId)

  function draftFor(fixtureId: string, fixture: Fixture) {
    return scoreDrafts[fixtureId] ?? { home: String(fixture.homeScore ?? ''), away: String(fixture.awayScore ?? '') }
  }

  async function handleSaveScore(fixtureId: string) {
    const draft = scoreDrafts[fixtureId]
    if (!draft || draft.home === '' || draft.away === '') return
    setErrorMessage(null)
    setSaving(fixtureId)
    try {
      const result = await recordFixtureScore(fixtureId, Number(draft.home), Number(draft.away))
      if (result.error) { setErrorMessage(result.error); return }
      await refresh()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDateChange(fixtureId: string, matchDate: string) {
    setErrorMessage(null)
    setSaving(fixtureId)
    try {
      const result = await updateFixture(fixtureId, { matchDate })
      if (result.error) { setErrorMessage(result.error); return }
      await refresh()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleTeamChange(fixtureId: string, side: 'homeTeamId' | 'awayTeamId', teamId: string) {
    const fixture = fixtures.find(f => f.id === fixtureId)
    const otherTeamId = side === 'homeTeamId' ? fixture?.awayTeamId : fixture?.homeTeamId
    if (teamId === otherTeamId) {
      setErrorMessage('A team cannot play itself — pick two different teams.')
      return
    }

    setErrorMessage(null)
    setSaving(fixtureId)
    try {
      const result = await updateFixture(fixtureId, { [side]: teamId })
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
      const result = await addFixture({ divisionId, ...newFixture })
      if (result.error) { setErrorMessage(result.error); return }
      setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '' })
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
            const draft = draftFor(f.id, f)
            return (
              <div key={f.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center gap-3 flex-wrap">
                <input
                  key={`${f.id}-${f.matchDate}`}
                  type="date"
                  className="input text-xs"
                  defaultValue={f.matchDate}
                  onBlur={e => e.target.value !== f.matchDate && handleDateChange(f.id, e.target.value)}
                />
                <select
                  className="input text-xs flex-1"
                  value={f.homeTeamId}
                  onChange={e => handleTeamChange(f.id, 'homeTeamId', e.target.value)}
                >
                  {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <span className="text-brand-muted text-xs">vs</span>
                <select
                  className="input text-xs flex-1"
                  value={f.awayTeamId}
                  onChange={e => handleTeamChange(f.id, 'awayTeamId', e.target.value)}
                >
                  {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <input
                  type="number" min={0} placeholder="H" className="input w-14 text-xs"
                  value={draft.home}
                  onChange={e => setScoreDrafts(prev => ({ ...prev, [f.id]: { home: e.target.value, away: draft.away } }))}
                />
                <input
                  type="number" min={0} placeholder="A" className="input w-14 text-xs"
                  value={draft.away}
                  onChange={e => setScoreDrafts(prev => ({ ...prev, [f.id]: { home: draft.home, away: e.target.value } }))}
                />
                <button
                  onClick={() => handleSaveScore(f.id)}
                  disabled={saving === f.id}
                  className="btn-secondary text-xs px-3 py-1.5"
                >
                  {saving === f.id ? 'Saving…' : 'Save Score'}
                </button>
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
        </div>
        <button type="submit" className="btn-primary text-sm w-full">Add Fixture</button>
      </form>
    </section>
  )
}
