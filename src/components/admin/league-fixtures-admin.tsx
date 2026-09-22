'use client'
import { useEffect, useState } from 'react'
import { getFixturesForAdmin, bulkUpdateFixtures, addFixture, setFixtureCancelled } from '@/app/actions/league-admin'
import type { UpdateFixtureInput } from '@/app/actions/league-admin'

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
  const [saving, setSaving] = useState<string | null>(null) // Cancel/Un-cancel per-row busy state
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkErrors, setBulkErrors] = useState<Record<string, string>>({})
  const [newFixture, setNewFixture] = useState({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '', location: '' })

  // Refetches the whole division's fixtures — called only on mount and on
  // division switch, never as a side effect of saving (that used to wipe
  // every row's in-progress draft, not just the one just saved).
  async function refresh() {
    if (!divisionId) return
    setLoading(true)
    const data = await getFixturesForAdmin(divisionId)
    setFixtures(data)
    setDrafts({})
    setBulkErrors({})
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '', location: '' })
  }, [divisionId])

  // Warn before leaving the page (navigation or tab close) while any row has
  // an unsaved edit.
  useEffect(() => {
    const hasUnsaved = Object.keys(drafts).length > 0
    if (!hasUnsaved) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [drafts])

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
    setBulkErrors(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  async function handleSaveAll() {
    setErrorMessage(null)
    const dirtyEntries = fixtures
      .map(f => ({ f, draft: draftFor(f) }))
      .filter(({ f, draft }) => !draftsEqual(draft, draftFromFixture(f)))
    if (dirtyEntries.length === 0) return

    // Client-side validation — a bad row doesn't block the other dirty rows
    // from saving, it's just excluded from this round trip.
    const nextBulkErrors: Record<string, string> = {}
    const toSend: { id: string; patch: UpdateFixtureInput }[] = []
    for (const { f, draft } of dirtyEntries) {
      if (!draft.matchDate) { nextBulkErrors[f.id] = 'A match needs a date.'; continue }
      if (draft.homeTeamId === draft.awayTeamId) { nextBulkErrors[f.id] = 'Home and away team must be different.'; continue }
      if ((draft.homeScore === '') !== (draft.awayScore === '')) { nextBulkErrors[f.id] = 'Enter both scores or neither.'; continue }
      toSend.push({
        id: f.id,
        patch: {
          matchDate: draft.matchDate,
          homeTeamId: draft.homeTeamId,
          awayTeamId: draft.awayTeamId,
          kickoff: draft.kickoff || null,
          location: draft.location || null,
          homeScore: draft.homeScore === '' ? null : Number(draft.homeScore),
          awayScore: draft.awayScore === '' ? null : Number(draft.awayScore),
        },
      })
    }

    if (toSend.length === 0) { setBulkErrors(prev => ({ ...prev, ...nextBulkErrors })); return }

    setBulkSaving(true)
    try {
      const result = await bulkUpdateFixtures(toSend)
      const failed = result.errors

      setFixtures(prev => prev.map(f => {
        const sent = toSend.find(s => s.id === f.id)
        if (!sent || failed[f.id]) return f
        const draft = drafts[f.id] ?? draftFromFixture(f)
        return {
          ...f,
          matchDate: sent.patch.matchDate!,
          homeTeamId: sent.patch.homeTeamId!,
          awayTeamId: sent.patch.awayTeamId!,
          homeTeamName: teams.find(t => t.id === sent.patch.homeTeamId)?.name ?? f.homeTeamName,
          awayTeamName: teams.find(t => t.id === sent.patch.awayTeamId)?.name ?? f.awayTeamName,
          kickoff: sent.patch.kickoff ?? null,
          location: draft.location.trim() || null, // mirror the server's location.trim() || null
          homeScore: sent.patch.homeScore ?? null,
          awayScore: sent.patch.awayScore ?? null,
        }
      }))

      setDrafts(prev => {
        const next = { ...prev }
        for (const s of toSend) if (!failed[s.id]) delete next[s.id]
        return next
      })
      setBulkErrors({ ...nextBulkErrors, ...failed })
    } catch {
      setErrorMessage('Something went wrong saving your changes. Please try again.')
    } finally {
      setBulkSaving(false)
    }
  }

  async function handleToggleCancelled(fixtureId: string, cancelled: boolean) {
    setErrorMessage(null)
    setSaving(fixtureId)
    try {
      const result = await setFixtureCancelled(fixtureId, cancelled)
      if (result.error) { setErrorMessage(result.error); return }
      setFixtures(prev => prev.map(f => f.id === fixtureId ? { ...f, cancelled } : f))
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
      if (result.error || !result.fixture) { setErrorMessage(result.error ?? 'Failed to add fixture'); return }
      const f = result.fixture
      const homeTeamName = teams.find(t => t.id === f.homeTeamId)?.name ?? 'Unknown'
      const awayTeamName = teams.find(t => t.id === f.awayTeamId)?.name ?? 'Unknown'
      setFixtures(prev => [...prev, { ...f, homeTeamName, awayTeamName }].sort((a, b) => a.matchDate.localeCompare(b.matchDate)))
      setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '', location: '' })
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    }
  }

  const dirtyCount = fixtures.filter(f => !draftsEqual(draftFor(f), draftFromFixture(f))).length

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
          disabled={bulkSaving}
          onChange={e => setDivisionId(e.target.value)}
        >
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>

      {dirtyCount > 0 && (
        <div className="bg-brand-tint border border-brand-primary rounded p-3 mb-3 flex items-center gap-3">
          <button
            onClick={handleSaveAll}
            disabled={bulkSaving}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {bulkSaving ? 'Saving all changes…' : `Save All Changes (${dirtyCount})`}
          </button>
          <span className="text-brand-muted text-xs">{dirtyCount} unsaved {dirtyCount === 1 ? 'fixture' : 'fixtures'}</span>
        </div>
      )}

      {loading ? (
        <p className="text-brand-muted text-sm">Loading…</p>
      ) : (
        <div className="space-y-2 mb-4">
          {fixtures.map(f => {
            const draft = draftFor(f)
            const dirty = !draftsEqual(draft, draftFromFixture(f))
            const rowBusy = bulkSaving || saving === f.id
            return (
              <div key={f.id} className={`bg-brand-tint border border-brand-line rounded p-3 ${f.cancelled ? 'opacity-60' : ''}`}>
                {f.cancelled && (
                  <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Cancelled</span>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date" className="input text-xs" disabled={rowBusy}
                    value={draft.matchDate}
                    onChange={e => setField(f, 'matchDate', e.target.value)}
                  />
                  <input
                    type="time" className="input text-xs" disabled={rowBusy}
                    value={draft.kickoff}
                    onChange={e => setField(f, 'kickoff', e.target.value)}
                  />
                  <select
                    className="input text-xs flex-1 min-w-[8rem]" disabled={rowBusy}
                    value={draft.homeTeamId}
                    onChange={e => setField(f, 'homeTeamId', e.target.value)}
                  >
                    {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <span className="text-brand-muted text-xs">vs</span>
                  <select
                    className="input text-xs flex-1 min-w-[8rem]" disabled={rowBusy}
                    value={draft.awayTeamId}
                    onChange={e => setField(f, 'awayTeamId', e.target.value)}
                  >
                    {divisionTeams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <input
                    type="number" min={0} placeholder="H" className="input w-14 text-xs" disabled={rowBusy}
                    value={draft.homeScore}
                    onChange={e => setField(f, 'homeScore', e.target.value)}
                  />
                  <input
                    type="number" min={0} placeholder="A" className="input w-14 text-xs" disabled={rowBusy}
                    value={draft.awayScore}
                    onChange={e => setField(f, 'awayScore', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <input
                    type="text" className="input text-xs flex-1 min-w-[10rem]" disabled={rowBusy}
                    placeholder="Location (leave blank for the usual ground)"
                    value={draft.location}
                    onChange={e => setField(f, 'location', e.target.value)}
                  />
                  {dirty && (
                    <button
                      onClick={() => resetDraft(f.id)}
                      disabled={rowBusy}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleCancelled(f.id, !f.cancelled)}
                    disabled={rowBusy}
                    className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50"
                  >
                    {f.cancelled ? 'Un-cancel' : 'Cancel'}
                  </button>
                </div>
                {bulkErrors[f.id] && <p className="text-brand-primary text-xs mt-1">{bulkErrors[f.id]}</p>}
              </div>
            )
          })}
          {fixtures.length === 0 && <p className="text-brand-muted text-sm">No fixtures yet for this division.</p>}
        </div>
      )}

      <form onSubmit={handleAddFixture} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Fixture Manually</p>
        <fieldset disabled={bulkSaving} className="space-y-3">
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
        </fieldset>
      </form>
    </section>
  )
}
