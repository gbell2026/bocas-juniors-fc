import type { getUpcomingSchedule } from '@/app/actions/schedule'
import Link from 'next/link'

type Schedule = Awaited<ReturnType<typeof getUpcomingSchedule>>

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(iso))
}

function formatTime(time: string) {
  const [h, m] = time.split(':')
  return new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, Number(h), Number(m)))
}

export function UpcomingSchedule({ schedule }: { schedule: Schedule }) {
  if (schedule.length === 0) return null

  return (
    <section className="py-14 px-4 bg-brand-cream border-t border-brand-line">
      <h2 className="font-heading text-brand-ink text-4xl uppercase tracking-wider text-center mb-8">Upcoming Schedule</h2>
      <div className="max-w-2xl mx-auto space-y-3">
        {schedule.map(entry => (
          <div
            key={`${entry.type}-${entry.id}`}
            className={`flex items-center justify-between gap-4 border border-brand-line rounded-lg p-4 bg-brand-tint ${entry.cancelled ? 'opacity-60' : ''}`}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${entry.type === 'practice' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'}`}>
                  {entry.type === 'practice' ? 'Practice' : 'Match'}
                </span>
                {entry.cancelled && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600">Cancelled</span>
                )}
              </div>
              <p className="font-bold text-brand-ink">{formatDate(entry.date)}</p>
              {entry.type === 'practice' ? (
                <p className="text-sm text-brand-muted">
                  {formatTime(entry.time)}{entry.location && ` · ${entry.location}`}
                </p>
              ) : (
                <p className="text-sm text-brand-muted">
                  {entry.isHome ? 'vs' : '@'} {entry.opponent}
                  {!entry.cancelled && entry.homeScore !== null && entry.awayScore !== null && ` — ${entry.homeScore}-${entry.awayScore}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="text-center mt-6">
        <Link href="/league" className="text-brand-primaryDeep text-sm font-bold uppercase tracking-wider underline">
          View Full League Schedule →
        </Link>
      </div>
    </section>
  )
}
