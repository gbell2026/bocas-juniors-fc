import Link from 'next/link'
import type { KickoffFlyer as KickoffFlyerData } from '@/app/actions/flyer'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'
import { cloudinaryUrl } from '@/lib/cloudinary-url'
import { FlyerExportToolbar } from '@/components/flyer/flyer-export-toolbar'

const FLYER_CARD_ID = 'flyer-card'

const LEAGUE_NAME = 'Liga Isleñitos de Bocas'

// Add public/liga-islenitos-logo.png (the league crest, transparent background).
const LEAGUE_LOGO = '/liga-islenitos-logo.png'

// Flyer palette is pulled from the league crest — deep navy #0C2A3D, turquoise
// #22AEC4, gold #F4B32C — and inlined as Tailwind arbitrary values below so the
// JIT picks them up. The rest of the site stays on the Tangerine Toucans brand.

// No sponsor data model yet — the club's homepage sponsors plus the league's
// own. `href: null` renders the logo without a link.
const SPONSORS: { name: string; logo: string; href: string | null }[] = [
  { name: 'Tangerine International', logo: '/tangerine-international-logo.png', href: 'https://tangerine.international' },
  { name: 'Tesoro Escondido', logo: '/tesoro-escondido-logo.jpg', href: 'https://www.tesoro-escondido.com/' },
  { name: 'Bocas Dance Collective', logo: '/bocas-dance-logo.png', href: null },
]

function flyerPillClass(shortLabel: string): string {
  return shortLabel === 'U10'
    ? 'bg-[#22AEC4] text-[#0C2A3D]'
    : 'bg-[#F4B32C] text-[#0C2A3D]'
}

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
  if (!publicId) return <span aria-hidden className="inline-block w-6 h-6 rounded-full bg-white/15 flex-shrink-0" />
  return <img src={cloudinaryUrl(publicId, 48)} alt={alt} className="w-6 h-6 object-contain flex-shrink-0" />
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
        className="max-w-xl mx-auto bg-[#0C2A3D] text-white border-4 border-[#22AEC4] rounded-xl overflow-hidden"
      >
        {/* Header */}
        <header className="text-center px-6 py-7">
          <Link href="/league" className="inline-block">
            <img src={LEAGUE_LOGO} alt={LEAGUE_NAME} width={112} height={112} className="mx-auto mb-3 w-28 h-28 object-contain" />
          </Link>
          <p className="font-heading uppercase tracking-[0.2em] text-white text-lg sm:text-xl leading-tight">
            {LEAGUE_NAME}
          </p>
          <p className="font-heading uppercase tracking-[0.25em] text-[#F4B32C] text-xs mt-4">{t.matchdayHeading}</p>
          <h1 className="font-heading uppercase tracking-widest text-3xl sm:text-4xl leading-none mt-1">
            {t.kickoffTitle}
          </h1>
          <p className="font-heading uppercase tracking-wider text-[#F4B32C] text-lg sm:text-xl mt-2">
            {formatDate(flyer.sundayIso, locale)}
          </p>
        </header>

        {/* Location */}
        <div className="border-y border-[#22AEC4]/30 bg-[#123A54] px-6 py-4 text-center">
          <p className="text-[#22AEC4] uppercase tracking-widest text-[10px] font-bold">{t.locationLabel}</p>
          <p className="font-heading uppercase tracking-wide text-white text-lg">{t.venue}</p>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#F4B32C] text-xs font-bold uppercase tracking-wider underline"
          >
            {t.directions} →
          </a>
        </div>

        {/* Fixtures */}
        <div className="px-6 py-6 space-y-7">
          {flyer.divisions.length === 0 && (
            <p className="text-white/70 text-center text-sm py-4">{t.noFixtures}</p>
          )}

          {flyer.divisions.map(division => (
            <section key={division.id}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${flyerPillClass(division.shortLabel)}`}>
                  {division.name}
                </span>
                <span className="h-px flex-1 bg-[#22AEC4]/30" />
              </div>

              {/* Teams */}
              <p className="text-[#22AEC4] uppercase tracking-widest text-[10px] font-bold mb-1.5">{t.teamsLabel}</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {division.teams.map(team => (
                  <span
                    key={team.name}
                    className="inline-flex items-center gap-1.5 bg-[#123A54] border border-[#22AEC4]/40 rounded-full pl-1 pr-2.5 py-1 text-xs text-white"
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
                    className="flex items-center gap-2 border border-[#22AEC4]/30 bg-[#123A54] rounded px-3 py-2 text-sm"
                  >
                    <span className="font-mono tabular-nums text-xs font-bold text-[#F4B32C] whitespace-nowrap w-16 flex-shrink-0">
                      {fx.kickoff ? formatTime(fx.kickoff, locale) : t.timeTbc}
                    </span>
                    <span className="flex items-center gap-1.5 justify-end flex-1 min-w-0 text-right">
                      <span className="truncate font-medium text-white">{fx.homeTeam}</span>
                      <Badge publicId={fx.homeBadge} alt={fx.homeTeam} />
                    </span>
                    <span className="text-[#22AEC4] text-xs font-bold uppercase flex-shrink-0">{t.vs}</span>
                    <span className="flex items-center gap-1.5 flex-1 min-w-0">
                      <Badge publicId={fx.awayBadge} alt={fx.awayTeam} />
                      <span className="truncate font-medium text-white">{fx.awayTeam}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Sponsors */}
        <footer className="border-t border-[#22AEC4]/30 bg-[#123A54] px-6 py-6 text-center">
          <p className="text-white/50 uppercase tracking-widest text-[10px] font-bold mb-4">{t.sponsorsHeading}</p>
          <div className="flex items-center justify-center gap-5 flex-wrap">
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
            className="inline-block mt-5 text-[#F4B32C] text-xs font-bold uppercase tracking-wider underline"
          >
            {t.backToLeague} →
          </Link>
        </footer>
      </article>
    </main>
  )
}
