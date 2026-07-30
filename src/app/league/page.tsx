'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { FixturesList } from '@/components/league/fixtures-list'
import { StandingsTable } from '@/components/league/standings-table'
import { RegisterTeamForm } from '@/components/league/register-team-form'
import { getDivisions } from '@/app/actions/league'

type Tab = 'fixtures' | 'table' | 'topscorer' | 'register'
type Division = Awaited<ReturnType<typeof getDivisions>>[number]

const TABS: { key: Tab; label: string }[] = [
  { key: 'fixtures', label: 'Fixtures' },
  { key: 'table', label: 'Table' },
  { key: 'topscorer', label: 'Top Scorer' },
  { key: 'register', label: 'Register Team' },
]

export default function LeaguePage() {
  const [tab, setTab] = useState<Tab>('fixtures')
  const [divisions, setDivisions] = useState<Division[]>([])
  const [divisionId, setDivisionId] = useState('')

  useEffect(() => {
    getDivisions().then(list => {
      setDivisions(list)
      if (list.length > 0) setDivisionId(list[0].id)
    })
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="League" subtitle="Fixtures, Table & Team Registration" />
      <div className="flex border-b border-brand-line overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap px-4 ${
              tab === t.key ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="py-8 px-4 max-w-3xl mx-auto">
        {(tab === 'fixtures' || tab === 'table') && divisions.length > 0 && (
          <div className="mb-6">
            <label htmlFor="divisionSelect" className="block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">
              Division
            </label>
            <select
              id="divisionSelect"
              className="input w-full max-w-xs"
              value={divisionId}
              onChange={e => setDivisionId(e.target.value)}
            >
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {tab === 'fixtures' && (
          divisionId ? <FixturesList divisionId={divisionId} /> : <p className="text-brand-muted py-8 text-center">No divisions yet.</p>
        )}
        {tab === 'table' && (
          divisionId ? <StandingsTable divisionId={divisionId} /> : <p className="text-brand-muted py-8 text-center">No divisions yet.</p>
        )}
        {tab === 'topscorer' && (
          <p className="text-brand-muted py-8 text-center">Top Scorer leaderboard is coming soon!</p>
        )}
        {tab === 'register' && <RegisterTeamForm />}
      </div>
    </main>
  )
}
