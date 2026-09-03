import Link from 'next/link'
import type { KickoffFlyer as KickoffFlyerData } from '@/app/actions/flyer'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'
import { cloudinaryUrl } from '@/lib/cloudinary-url'
import { divisionPillClass } from '@/lib/league/fixture-calendar'
import { FlyerExportToolbar } from '@/components/flyer/flyer-export-toolbar'

const FLYER_CARD_ID = 'flyer-card'

const LEAGUE_NAME = 'Liga Isleñitos de Bocas'

// The league's logo. Point this at the league mark once its file is added to
// public/ (a transparent-background version reads best on the cream card).
const LEAGUE_LOGO = '/logo-white-bg.png'

// No sponsor data model yet — mirror the homepage's hardcoded set. `href: null`
// renders the logo without a link.
const SPONSORS: { name: string; logo: string; href: string | null }[] = [
  { name: 'Tesoro Escondido', logo: '/tesoro-escondido-logo.jpg', href: 'https://www.tesoro-escondido.com/' },
  { name: 'Bocas Dance Collective', logo: '/bocas-dance-logo.png', href: null },
]

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

function formatTime(hhmm: string, locale: Locale) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, h, m))
}

function Badge({ publicId, alt }: { publicId: string | null; alt: string }) {
  if (!publicId) return <span aria-hidden className="inline-block w-6 h-6 rounded-full bg-brand-line flex-shrink-0" />
  return (
    <img
      src={cloudinaryUrl(publicId, 48)}
      alt={alt}
      className="w-6 h-6 object-contain flex-shrink-0"
    />
  )
}

export function KickoffFlyer({ flyer, locale }: { flyer: KickoffFlyerData; locale: Locale }) {
  const t = (locale === 'es' ? es : en).flyer
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.venue + ', Panama')}`

  return (
    <main className="bg-brand-creamAlt min-h-screen py-8 px-4">
      <div className="max-w-xl mx-auto mb-4">
        <FlyerExportToolbar
          targetId={FLYER_CARD_ID}
          sundayIso={flyer.sundayIso}
          labels={{
            downloadPng: t.downloadPng,
            downloadPdf: t.downloadPdf,
            preparing: t.preparing,
            downloadHint: t.downloadHint,
            downloadError: t.downloadError,
          }}
        />
      </div>

      <article
        id={FLYER_CARD_ID}
        className="max-w-xl mx-auto bg-brand-cream border-4 border-brand-ink rounded-xl overflow-hidden"
      >
        {/* Header */}
        <header className="bg-brand-ink text-white text-center px-6 py-7">
          <Link href="/league" className="inline-block">
            <img src={LEAGUE_LOGO} alt={LEAGUE_NAME} width={96} height={96} className="mx-auto mb-3 w-24 h-24 object-contain" />
          </Link>
          <p className="font-heading uppercase tracking-[0.2em] text-white text-lg sm:text-xl leading-tight">
            {LEAGUE_NAME}
          </p>
          <p className="font-heading uppercase tracking-[0.25em] text-brand-accent text-xs mt-3">{t.matchdayHeading}</p>
          <h1 className="font-heading uppercase tracking-widest text-3xl sm:text-4xl leading-none mt-1">
            {t.kickoffTitle}
          </h1>
          <p className="font-heading uppercase tracking-wider text-brand-accent text-lg sm:text-xl mt-2">
            {formatDate(flyer.sundayIso, locale)}
          </p>
        </header>

        {/* Location */}
        <div className="border-b border-brand-line px-6 py-4 text-center">
          <p className="text-brand-mutedWarm uppercase tracking-widest text-[10px] font-bold">{t.locationLabel}</p>
          <p className="font-heading uppercase tracking-wide text-brand-ink text-lg">{t.venue}</p>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider underline"
          >
            {t.directions} →
          </a>
        </div>

        {/* Fixtures */}
        <div className="px-6 py-6 space-y-7">
          {flyer.divisions.length === 0 && (
            <p className="text-brand-muted text-center text-sm py-4">{t.noFixtures}</p>
          )}

          {flyer.divisions.map(division => (
            <section key={division.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${divisionPillClass(division.shortLabel)}`}>
                  {division.name}
                </span>
                <span className="h-px flex-1 bg-brand-line" />
              </div>

              {/* Teams */}
              <p className="text-brand-mutedWarm uppercase tracking-widest text-[10px] font-bold mb-1.5">{t.teamsLabel}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {division.teams.map(team => (
                  <span
                    key={team.name}
                    className="inline-flex items-center gap-1.5 bg-brand-tint border border-brand-line rounded-full pl-1 pr-2.5 py-1 text-xs text-brand-ink"
                  >
                    <Badge publicId={team.badge} alt="" />
                    {team.name}
                  </span>
                ))}
              </div>

              {/* Fixtures */}
              <ul className="space-y-1.5">
                {division.fixtures.map(fx => (
                  <li
                    key={fx.id}
                    className="flex items-center gap-2 border border-brand-line rounded bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-mono tabular-nums text-xs text-brand-mutedWarm whitespace-nowrap w-16 flex-shrink-0">
                      {fx.kickoff ? formatTime(fx.kickoff, locale) : t.timeTbc}
                    </span>
                    <span className="flex items-center gap-1.5 justify-end flex-1 min-w-0 text-right">
                      <span className="truncate font-medium text-brand-ink">{fx.homeTeam}</span>
                      <Badge publicId={fx.homeBadge} alt={fx.homeTeam} />
                    </span>
                    <span className="text-brand-mutedWarm text-xs font-bold uppercase flex-shrink-0">{t.vs}</span>
                    <span className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Badge publicId={fx.awayBadge} alt={fx.awayTeam} />
                      <span className="truncate font-medium text-brand-ink">{fx.awayTeam}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Sponsors */}
        <footer className="bg-brand-ink px-6 py-6 text-center">
          <p className="text-white/40 uppercase tracking-widest text-[10px] font-bold mb-4">{t.sponsorsHeading}</p>
          <div className="flex items-center justify-center gap-6 flex-wrap">
            {SPONSORS.map(sponsor => {
              const img = (
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="h-12 w-auto object-contain bg-white rounded px-2 py-1"
                />
              )
              return sponsor.href ? (
                <a key={sponsor.name} href={sponsor.href} target="_blank" rel="noopener noreferrer" aria-label={sponsor.name}>
                  {img}
                </a>
              ) : (
                <span key={sponsor.name}>{img}</span>
              )
            })}
          </div>
          <Link
            href="/league"
            className="inline-block mt-5 text-brand-accent text-xs font-bold uppercase tracking-wider underline"
          >
            {t.backToLeague} →
          </Link>
        </footer>
      </article>
    </main>
  )
}
