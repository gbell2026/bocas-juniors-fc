'use client'
import { useEffect, useState } from 'react'
import { getFixtureCalendar } from '@/app/actions/league'
import { useLocale } from '@/lib/i18n/locale-context'
import type { Locale } from '@/lib/i18n/locale'

type CalendarDay = Awaited<ReturnType<typeof getFixtureCalendar>>[number]

function shortDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  }).format(new Date(iso))
}

function longDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso))
}

// Default to the nearest playing/rest day today-or-later; once the season
// has fully passed, fall back to the last day rather than showing nothing.
function defaultSelectedIndex(days: CalendarDay[]): number {
  const today = new Date().toISOString().slice(0, 10)
  const idx = days.findIndex(d => d.date >= today)
  return idx === -1 ? days.length - 1 : idx
}

function divisionPillClass(division: string) {
  return division === 'U10' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'
}

export function FixtureCalendar() {
  const { locale, t } = useLocale()
  const [days, setDays] = useState<CalendarDay[] | null>(null)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    getFixtureCalendar()
      .then(data => { setDays(data); setSelected(defaultSelectedIndex(data)) })
      .catch(() => setDays([]))
  }, [])

  if (days === null) return <p className="text-brand-muted py-8 text-center">{t.league.calendar.loading}</p>
  if (days.length === 0) return <p className="text-brand-muted py-8 text-center">{t.league.calendar.empty}</p>

  const day = days[selected]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setSelected(i)}
            className={`min-w-[66px] flex-1 border rounded p-2 text-center text-xs transition ${
              i === selected ? 'border-brand-primary bg-brand-tint' : 'border-brand-line'
            }`}
          >
            <div className="font-bold text-brand-ink">{shortDate(d.date, locale)}</div>
            <div className="text-brand-muted">{d.rest ? t.league.calendar.restWeek : d.matches.length}</div>
          </button>
        ))}
      </div>

      <p className="text-brand-mutedWarm text-xs mb-4">{t.league.calendar.toucansLegend}</p>

      {day.rest ? (
        <div className="text-center py-12">
          <p className="font-bold text-brand-ink mb-1">{t.league.calendar.restWeek}</p>
          <p className="text-brand-muted text-sm">{longDate(day.date, locale)}</p>
          <p className="text-brand-muted text-sm mt-2">{t.league.calendar.restWeekNote}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">{longDate(day.date, locale)}</p>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              {t.league.calendar.firstDivision(day.firstDivision)}
            </span>
          </div>
          <div className="space-y-2">
            {day.matches.map(m => (
              <div
                key={m.id}
                className={`bg-brand-tint border border-brand-line rounded p-3 flex items-center gap-3 text-sm ${m.cancelled ? 'opacity-60' : ''}`}
              >
                <span className="font-mono tabular-nums text-xs text-brand-muted min-w-[44px]">{m.kickoff ?? '—'}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${divisionPillClass(m.division)}`}>
                  {m.division}
                </span>
                <span className="flex-1">
                  {m.homeTeam} <span className="text-brand-muted">v</span> {m.awayTeam}
                  {m.isHomeClubMatch && <span className="ml-1">★</span>}
                </span>
                {m.cancelled ? (
                  <span className="text-red-600 text-xs font-bold uppercase tracking-wider flex-shrink-0">{t.league.calendar.cancelled}</span>
                ) : m.homeScore !== null && m.awayScore !== null ? (
                  <span className="font-bold text-brand-ink flex-shrink-0">{m.homeScore}–{m.awayScore}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
