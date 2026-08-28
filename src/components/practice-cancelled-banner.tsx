import type { HomeSchedule } from '@/app/actions/schedule'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

/**
 * Loud, full-width alert shown at the very top of the homepage when a practice
 * scheduled for today has been cancelled. Deliberately separate from the subtle
 * "Cancelled" tag in <UpcomingSchedule> — this one is meant to be impossible to
 * miss. `todayIso` is passed in (YYYY-MM-DD, UTC) so it matches the date basis
 * used by getHomeSchedule.
 */
export function PracticeCancelledBanner({
  schedule,
  locale,
  todayIso,
}: {
  schedule: HomeSchedule
  locale: Locale
  todayIso: string
}) {
  const cancelledToday = schedule.practices.filter(p => p.cancelled && p.date === todayIso)
  if (cancelledToday.length === 0) return null

  const t = (locale === 'es' ? es : en).home.schedule

  return (
    <div role="alert" className="bg-red-600 text-white px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-3 text-center">
        {cancelledToday.map(p => (
          <div key={p.id}>
            <p className="font-heading uppercase tracking-widest text-xl sm:text-2xl leading-tight">
              ⚠️ {t.cancelledBanner.replace('{date}', formatDate(p.date, locale))}
            </p>
            {p.cancellationReason && (
              <p className="text-white/90 text-sm sm:text-base mt-1">
                {t.cancelledBannerReason.replace('{reason}', p.cancellationReason)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
