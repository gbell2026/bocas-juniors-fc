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
    <section className="py-8 px-4 bg-brand-cream border-t border-brand-line">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wider">Upcoming Schedule</h2>
          <Link href="/league" className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider underline">
            Full Schedule →
          </Link>
        </div>
        <div className="space-y-1.5">
          {schedule.map(entry => (
            <div
              key={`${entry.type}-${entry.id}`}
              className={`flex items-center gap-3 border border-brand-line rounded p-2.5 bg-brand-tint text-sm ${entry.cancelled ? 'opacity-60' : ''}`}
            >
              <span className="font-bold text-brand-ink whitespace-nowrap flex-shrink-0">{formatDate(entry.date)}</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${entry.type === 'practice' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'}`}>
                {entry.type === 'practice' ? 'Practice' : 'Match'}
              </span>
              <span className="text-brand-muted flex-1 min-w-0 truncate">
                {entry.type === 'practice'
                  ? `${formatTime(entry.time)}${entry.location ? ` · ${entry.location}` : ''}`
                  : `${entry.isHome ? 'vs' : '@'} ${entry.opponent}${!entry.cancelled && entry.homeScore !== null && entry.awayScore !== null ? ` — ${entry.homeScore}-${entry.awayScore}` : ''}`}
              </span>
              {entry.cancelled && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex-shrink-0">Cancelled</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
