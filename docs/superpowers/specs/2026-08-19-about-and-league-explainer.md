# About Section & League Explainer — Design Spec

**Date:** 2026-08-19
**Status:** Approved

## Background

The homepage has no section explaining what the club/site is for — a first-time visitor sees the hero, the schedule, and a Get Involved CTA, with no orientation in between. Separately, `/league` has Fixtures/Table/Top Scorer/Register tabs but nothing explaining the league's format, season, or (soon) its second-half bracket phase.

## Scope

**This build:**
- A homepage "About Tangerine Toucans FC" section, between the schedule and the Get Involved CTA
- A `/league` "How the League Works" explainer, shown once above the tab strip (not per-tab)
- Both fully translated (English/Spanish), matching every other page on the site

**Explicitly out of scope:**
- Any actual bracket-phase UI/tab (a prior session dropped this — the seed-progression math for an odd/even team count was never resolved). This build only *describes* the bracket phase in prose; it builds nothing interactive for it.
- A dedicated `/about` page — this is a homepage section, not a new route
- Making the league explainer collapsible/dismissible — it's a small, always-visible block

## Content

### Homepage About section

```
About Tangerine Toucans FC

Tangerine Toucans FC is a youth football club based in Bocas del Toro,
Panama, built around one idea: every kid deserves a team. We coach U10
and U14 players, compete in the local youth league, and give this
community a place to play, travel, and grow together on and off the
pitch.

This site is where it all comes together. Register your child for the
season, check the practice and match schedule, follow league standings,
and see the moments from game day in the gallery.
```

### `/league` "How the League Works"

```
How the League Works

Tangerine Toucans' U10 and U14 teams compete in a Bocas del Toro youth
football league alongside other local clubs. The regular season is a
double round-robin, with every team facing every other team twice, home
and away, running [live season start] through [live season end].
Matches are played on Sundays at Airport Field, with Saturdays kept free
for weather rearrangements. Standings are decided by points: 3 for a
win, 1 for a draw, 0 for a loss.

After a break, the top teams return in January 2027 for a seeded
bracket phase, with each matchup played home and away and the winner
decided on aggregate score across both legs.

Clubs interested in fielding a team can register via the Register Team
tab.
```

`[live season start]`/`[live season end]` are computed from real data, not hardcoded — see "Data" below. Deliberately vague on club count (per earlier discussion) so the copy doesn't go stale as the league roster changes. The January 2027 bracket date and the "seeded, two-leg, aggregate score" format were both confirmed directly by the user in this conversation.

## Data

`/league` already fetches `getDivisions()` client-side (`src/app/league/page.tsx`), which returns full `league_divisions` rows including `season_start_date`/`season_end_date`. No new server action needed — the explainer computes its date range from the same `divisions` state already in that component:

- **Start**: `divisions[0].season_start_date`. Safe to trust as the earliest because `getDivisions()`'s query is `.select('*').order('season_start_date')` (`src/app/actions/league.ts:144-148`) — Supabase applies that ordering server-side before returning rows, so the first element is guaranteed earliest. (Note: `getFixtureCalendar`, a different action in the same file, computes its own start/end via explicit `.sort()` calls over an *unordered* query instead of relying on `.order()` — that's a different, equally-valid approach for a case with no existing order-by, not a precedent this code needs to copy. Don't fetch a second, redundant reference to divisions to mimic it.)
- **End**: the latest `season_end_date` across all divisions (a simple reduce/max, since `order('season_start_date')` doesn't guarantee end-date order)

Both are formatted for display via `Intl.DateTimeFormat` with `{ day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }`, in the current locale (`es-ES` or `en-GB`). The `timeZone: 'UTC'` is required, not optional: `season_start_date`/`season_end_date` are Postgres `date` columns (`supabase/migrations/006_league.sql:19-20`), so `new Date('2026-09-06')` parses as UTC midnight — formatting without pinning UTC can print the wrong calendar day in a timezone behind UTC (e.g. Panama, UTC-5). Every other ISO-date formatter in this codebase already pins `timeZone: 'UTC'` for exactly this reason (`longDate` in `src/components/league/fixture-calendar.tsx`, `formatDate` in `src/components/upcoming-schedule.tsx`) — this one must match.

If `divisions` hasn't loaded yet (brief loading window before the `useEffect` resolves), the explainer's date-range sentence is simply omitted from render until `divisions.length > 0`, rather than showing a placeholder or blank string.

## Component structure

Both sections are added as inline JSX directly in their existing page files, matching how the homepage's existing "Get Involved" section is already inline in `src/app/page.tsx` rather than extracted to its own component — this codebase doesn't extract single-use static content blocks into separate files.

**Homepage** (`src/app/page.tsx`): new `<section>` between the `<UpcomingSchedule ... />` call and the `{/* Get Involved CTA */}` section, styled consistently with the site's alternating-section convention (bordered, centered, max-width container — matching `UpcomingSchedule`'s own wrapper shape).

**`/league`** (`src/app/league/page.tsx`): new block between `<PageHeader ... />` and the tab-strip `<div className="flex border-b ...">`, in a `max-w-3xl mx-auto px-4` container matching the tab content area's own width below it.

## i18n

New keys, following the existing prefix/bold/suffix pattern already used elsewhere (e.g. `t.register.regFeeNotice`/`regFeeNoticeBold`/`regFeeNoticeSuffix`) for the one sentence that needs a bolded inline reference to the Register Team tab:

`src/lib/i18n/en.ts`, under `home`:
```ts
about: {
  title: 'About Tangerine Toucans FC',
  body1: "Tangerine Toucans FC is a youth football club based in Bocas del Toro, Panama, built around one idea: every kid deserves a team. We coach U10 and U14 players, compete in the local youth league, and give this community a place to play, travel, and grow together on and off the pitch.",
  body2: 'This site is where it all comes together. Register your child for the season, check the practice and match schedule, follow league standings, and see the moments from game day in the gallery.',
},
```

`src/lib/i18n/en.ts`, under `league`:
```ts
about: {
  title: 'How the League Works',
  intro: "Tangerine Toucans' U10 and U14 teams compete in a Bocas del Toro youth football league alongside other local clubs.",
  format: (start: string, end: string) => `The regular season is a double round-robin, with every team facing every other team twice, home and away, running ${start} through ${end}.`,
  matchDay: 'Matches are played on Sundays at Airport Field, with Saturdays kept free for weather rearrangements.',
  standings: 'Standings are decided by points: 3 for a win, 1 for a draw, 0 for a loss.',
  bracketPhase: 'After a break, the top teams return in January 2027 for a seeded bracket phase, with each matchup played home and away and the winner decided on aggregate score across both legs.',
  registerPrefix: 'Clubs interested in fielding a team can register via the',
  registerBold: 'Register Team',
  registerSuffix: 'tab.',
},
```

`src/lib/i18n/es.ts`, matching structure and position, with natural (not literal) Spanish translations:
```ts
// under home:
about: {
  title: 'Sobre Tangerine Toucans FC',
  body1: 'Tangerine Toucans FC es un club de fútbol juvenil con base en Bocas del Toro, Panamá, construido sobre una idea: todo niño merece un equipo. Entrenamos a jugadores de las categorías U10 y U14, competimos en la liga juvenil local, y le damos a esta comunidad un lugar para jugar, viajar y crecer juntos, dentro y fuera de la cancha.',
  body2: 'En este sitio es donde todo se junta. Inscribe a tu hijo/a para la temporada, consulta el calendario de entrenamientos y partidos, sigue la tabla de posiciones de la liga, y mira los momentos del día de partido en la galería.',
},

// under league:
about: {
  title: 'Cómo Funciona la Liga',
  intro: 'Los equipos U10 y U14 de Tangerine Toucans compiten en una liga de fútbol juvenil de Bocas del Toro junto a otros clubes locales.',
  format: (start: string, end: string) => `La temporada regular es un todos contra todos a doble vuelta, en la que cada equipo se enfrenta a los demás dos veces, de local y visitante, del ${start} al ${end}.`,
  matchDay: 'Los partidos se juegan los domingos en Airport Field, y los sábados quedan libres para reprogramar por mal tiempo.',
  standings: 'La tabla de posiciones se decide por puntos: 3 por victoria, 1 por empate, 0 por derrota.',
  bracketPhase: 'Después de un descanso, los mejores equipos regresan en enero de 2027 para una fase de eliminación por llaves con siembra, donde cada enfrentamiento se juega de local y visitante y el ganador se decide por el marcador global de ambos partidos.',
  registerPrefix: 'Los clubes interesados en inscribir un equipo pueden hacerlo en la pestaña',
  registerBold: 'Inscribir Equipo',
  registerSuffix: '.',
},
```

`registerBold`'s Spanish value (`'Inscribir Equipo'`) matches the existing `t.league.tabRegister` value exactly, for consistency with the tab's own label.

## Testing

No new test files. Neither `src/app/page.tsx` nor `src/app/league/page.tsx` has existing test coverage (confirmed — both are page-level components with no `__tests__` counterpart in this codebase), and this change is static content plus one small date-formatting computation, consistent with the established precedent of not adding component tests for this class of page-level, mostly-static UI.
