import type { getHomeSchedule } from '@/app/actions/schedule'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'
import { divisionPillClass } from '@/lib/league/fixture-calendar'

type HomeSchedule = Awaited<ReturnType<typeof getHomeSchedule>>

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(iso))
}

function formatTime(time: string, locale: Locale) {
  const [h, m] = time.split(':')
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, Number(h), Number(m)))
}

export function UpcomingSchedule({ schedule, locale }: { schedule: HomeSchedule; locale: Locale }) {
  const { practices, matches } = schedule
  if (practices.length === 0 && matches.length === 0) return null
  const t = locale === 'es' ? es : en

  return (
    <section className="py-8 px-4 bg-brand-cream border-t border-brand-line">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wider">{t.home.schedule.title}</h2>
          <Link href="/league" className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider underline">
            {t.home.schedule.fullSchedule} →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">
              {t.home.schedule.practiceScheduleTitle}
            </h3>
            {practices.length === 0 ? (
              <p className="text-brand-muted text-sm">{t.home.schedule.noPractices}</p>
            ) : (
              <div className="space-y-1.5">
                {practices.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 border border-brand-line rounded p-2.5 bg-brand-tint text-sm ${p.cancelled ? 'opacity-60' : ''}`}
                  >
                    <span className="font-bold text-brand-ink whitespace-nowrap flex-shrink-0">{formatDate(p.date, locale)}</span>
                    <span className="text-brand-muted flex-1 min-w-0 truncate">
                      {formatTime(p.time, locale)}{p.location ? ` · ${p.location}` : ''}
                    </span>
                    {p.cancelled && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex-shrink-0">{t.home.schedule.cancelled}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">
              {t.home.schedule.leagueScheduleTitle}
            </h3>
            <p className="text-brand-mutedWarm text-xs mb-2">{t.home.schedule.location}</p>
            {matches.length === 0 ? (
              <p className="text-brand-muted text-sm">{t.home.schedule.noMatches}</p>
            ) : (
              <div className="space-y-1.5">
                {matches.map(m => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 border border-brand-line rounded p-2.5 bg-brand-tint text-sm ${m.cancelled ? 'opacity-60' : ''}`}
                  >
                    <span className="font-bold text-brand-ink whitespace-nowrap flex-shrink-0">{formatDate(m.date, locale)}</span>
                    <span className="font-mono tabular-nums text-xs text-brand-muted whitespace-nowrap flex-shrink-0">
                      {m.kickoff ? formatTime(m.kickoff, locale) : ''}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${divisionPillClass(m.division)}`}>
                      {m.division}
                    </span>
                    <span className="text-brand-muted flex-1 min-w-0 truncate">
                      {m.homeTeam} <span className="text-brand-mutedWarm">v</span> {m.awayTeam}
                    </span>
                    {m.cancelled ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex-shrink-0">{t.home.schedule.cancelled}</span>
                    ) : m.homeScore !== null && m.awayScore !== null ? (
                      <span className="font-bold text-brand-ink flex-shrink-0">{m.homeScore}-{m.awayScore}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
