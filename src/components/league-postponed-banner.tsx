import type { LeagueBanner } from '@/app/actions/league-banner'

/**
 * Loud, full-width alert at the very top of the homepage for a league-wide
 * announcement — typically "today's fixtures are postponed". Admin-authored
 * free text, toggled from the admin dashboard. Same visual treatment as
 * <PracticeCancelledBanner>.
 */
export function LeaguePostponedBanner({ banner }: { banner: LeagueBanner }) {
  const message = banner.message.trim()
  if (!banner.active || !message) return null

  return (
    <div role="alert" className="bg-red-600 text-white px-4 py-4">
      <p className="max-w-3xl mx-auto text-center font-heading uppercase tracking-wide text-lg sm:text-xl leading-tight">
        ⚠️ {message}
      </p>
    </div>
  )
}
