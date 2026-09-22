'use client'
import { useEffect, useState } from 'react'
import { FixtureCalendar } from '@/components/league/fixture-calendar'
import { StandingsTable } from '@/components/league/standings-table'
import { RegisterTeamForm } from '@/components/league/register-team-form'
import { getDivisions } from '@/app/actions/league'
import { useLocale } from '@/lib/i18n/locale-context'
import type { Locale } from '@/lib/i18n/locale'

type Tab = 'fixtures' | 'table' | 'topscorer' | 'register'
type Division = Awaited<ReturnType<typeof getDivisions>>[number]

function formatSeasonDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso))
}

export default function LeaguePage() {
  const { t, locale } = useLocale()
  const [tab, setTab] = useState<Tab>('fixtures')
  const [divisions, setDivisions] = useState<Division[]>([])
  const [divisionId, setDivisionId] = useState('')

  useEffect(() => {
    getDivisions()
      .then(list => {
        setDivisions(list)
        if (list.length > 0) setDivisionId(list[0].id)
      })
      .catch(err => console.error('Failed to load League divisions:', err))
  }, [])

  // divisions[0] is safe to treat as earliest because getDivisions() orders
  // by season_start_date server-side; season_end_date has no such guarantee,
  // so it's computed with an explicit reduce instead of trusting array order.
  const seasonDateRange = divisions.length > 0
    ? {
        start: formatSeasonDate(divisions[0].season_start_date, locale),
        end: formatSeasonDate(
          divisions.reduce((latest, d) => (d.season_end_date > latest ? d.season_end_date : latest), divisions[0].season_end_date),
          locale
        ),
      }
    : null

  const TABS: { key: Tab; label: string }[] = [
    { key: 'fixtures', label: t.league.tabFixtures },
    { key: 'table', label: t.league.tabTable },
    { key: 'topscorer', label: t.league.tabTopScorer },
    { key: 'register', label: t.league.tabRegister },
  ]

  return (
    <main className="bg-league-navy min-h-screen">
      <div className="bg-league-panel border-l-4 border-league-gold px-6 py-5 flex items-center gap-4">
        <img src="/Liga_Islenitos_Circular_Logo.png" alt="" className="w-14 h-14 object-contain flex-shrink-0" />
        <div>
          <h1 className="font-heading text-white uppercase tracking-wider text-3xl">{t.league.title}</h1>
          <p className="text-league-gold font-bold uppercase tracking-[0.25em] text-xs mt-1">{t.league.subtitle}</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 text-sm text-league-muted space-y-3">
        <h2 className="font-heading text-white text-lg uppercase tracking-wider">{t.league.about.title}</h2>
        <p>{t.league.about.intro}</p>
        {seasonDateRange && <p>{t.league.about.format(seasonDateRange.start, seasonDateRange.end)}</p>}
        <p>{t.league.about.matchDay}</p>
        <p>{t.league.about.standings}</p>
        <p>{t.league.about.bracketPhase}</p>
        <p>
          {t.league.about.registerPrefix} <span className="font-bold text-white">{t.league.about.registerBold}</span> {t.league.about.registerSuffix}
        </p>
      </div>

      <div className="flex border-b border-league-turquoise/20 overflow-x-auto">
        {TABS.map(tabDef => (
          <button
            key={tabDef.key}
            onClick={() => setTab(tabDef.key)}
            className={`flex-1 py-3 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap px-4 ${
              tab === tabDef.key ? 'bg-league-gold text-league-navy' : 'bg-league-panel text-league-muted'
            }`}
          >
            {tabDef.label}
          </button>
        ))}
      </div>

      <div className="py-8 px-4 max-w-3xl mx-auto">
        {tab === 'table' && divisions.length > 0 && (
          <div className="mb-6">
            <label htmlFor="divisionSelect" className="block text-league-gold font-bold uppercase tracking-wider text-xs mb-1">
              {t.league.divisionLabel}
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

        {tab === 'fixtures' && <FixtureCalendar />}
        {tab === 'table' && (
          divisionId ? <StandingsTable divisionId={divisionId} /> : <p className="text-league-muted py-8 text-center">{t.league.noDivisions}</p>
        )}
        {tab === 'topscorer' && (
          <p className="text-league-muted py-8 text-center">{t.league.topScorerComingSoon}</p>
        )}
        {tab === 'register' && <RegisterTeamForm />}
      </div>
    </main>
  )
}
