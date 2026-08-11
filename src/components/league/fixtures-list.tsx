'use client'
import { useEffect, useState } from 'react'
import { getFixtures } from '@/app/actions/league'

type Fixture = Awaited<ReturnType<typeof getFixtures>>[number]

function formatMatchDate(iso: string) {
  // match_date is a bare calendar date (no time component) — format it in
  // UTC so it doesn't shift a day depending on the viewer's timezone.
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso))
}

export function FixturesList({ divisionId }: { divisionId: string }) {
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null)

  useEffect(() => {
    let cancelled = false
    setFixtures(null)
    getFixtures(divisionId)
      .then(data => { if (!cancelled) setFixtures(data) })
      .catch(() => { if (!cancelled) setFixtures([]) })
    return () => { cancelled = true }
  }, [divisionId])

  if (fixtures === null) return <p className="text-brand-muted py-8 text-center">Loading fixtures…</p>
  if (fixtures.length === 0) return <p className="text-brand-muted py-8 text-center">No fixtures scheduled yet.</p>

  const grouped = new Map<string, Fixture[]>()
  for (const f of fixtures) {
    grouped.set(f.matchDate, [...(grouped.get(f.matchDate) ?? []), f])
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([date, dayFixtures]) => (
        <div key={date}>
          <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">{formatMatchDate(date)}</p>
          <div className="space-y-2">
            {dayFixtures.map(f => (
              <div
                key={f.id}
                className={`bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between text-sm ${f.cancelled ? 'opacity-60' : ''}`}
              >
                <span className="flex-1">{f.homeTeamName}</span>
                {f.cancelled ? (
                  <span className="text-red-600 text-xs font-bold uppercase tracking-wider px-3">Cancelled</span>
                ) : (
                  <span className="font-bold text-brand-ink px-3">
                    {f.homeScore !== null && f.awayScore !== null ? `${f.homeScore} – ${f.awayScore}` : 'vs'}
                  </span>
                )}
                <span className="flex-1 text-right">{f.awayTeamName}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
