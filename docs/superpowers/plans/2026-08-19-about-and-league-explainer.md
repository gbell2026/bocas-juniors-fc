# About Section & League Explainer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a homepage "About Tangerine Toucans FC" section and a `/league` "How the League Works" explainer, both fully translated, orienting first-time visitors to what the site is for and how the league works.

**Architecture:** Both sections are static content blocks added inline to their existing page files (matching how the homepage's existing Get Involved section is already inline, not extracted to its own component). The league explainer's one dynamic element — the season date range — is computed client-side from `divisions` data `/league` already fetches, with no new server action.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS. No new tests (neither page has existing test coverage; this is static content plus one small date-formatting computation, consistent with this codebase's established precedent).

**Spec:** `docs/superpowers/specs/2026-08-19-about-and-league-explainer.md`

---

## Chunk 1: i18n content, homepage section, league explainer

### Task 1: i18n — `home.about` and `league.about` keys

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/es.ts`

- [ ] **Step 1: Add `home.about` to `en.ts`**

Find the end of the `home.schedule` block (it closes right before `home`'s own closing brace):
```ts
    schedule: {
      title: 'Upcoming Schedule',
      fullSchedule: 'Full Schedule',
      practiceScheduleTitle: 'Practice Schedule',
      leagueScheduleTitle: 'League Schedule',
      location: 'Airport Field',
      noPractices: 'No practices in the next two weeks.',
      noMatches: 'No matches in the next week.',
      cancelled: 'Cancelled',
    },
  },
```
Replace with (adding `about` as a new sibling of `schedule`, still inside `home`):
```ts
    schedule: {
      title: 'Upcoming Schedule',
      fullSchedule: 'Full Schedule',
      practiceScheduleTitle: 'Practice Schedule',
      leagueScheduleTitle: 'League Schedule',
      location: 'Airport Field',
      noPractices: 'No practices in the next two weeks.',
      noMatches: 'No matches in the next week.',
      cancelled: 'Cancelled',
    },
    about: {
      title: 'About Tangerine Toucans FC',
      body1: "Tangerine Toucans FC is a youth football club based in Bocas del Toro, Panama, built around one idea: every kid deserves a team. We coach U10 and U14 players, compete in the local youth league, and give this community a place to play, travel, and grow together on and off the pitch.",
      body2: 'This site is where it all comes together. Register your child for the season, check the practice and match schedule, follow league standings, and see the moments from game day in the gallery.',
    },
  },
```

- [ ] **Step 2: Add `league.about` to `en.ts`**

The `league` block's `topScorerComingSoon` is followed by an existing `standings: { ... }` block (not directly by `calendar: {`) — find:
```ts
    topScorerComingSoon: 'Top Scorer leaderboard is coming soon!',
    standings: {
      loading: 'Loading table…',
      empty: 'No teams registered in this division yet.',
      team: 'Team',
      played: 'P',
      won: 'W',
      drawn: 'D',
      lost: 'L',
      goalDifference: 'GD',
      points: 'Pts',
    },
    calendar: {
```
Replace with (inserting `about` as a new sibling, after `standings` and before `calendar`):
```ts
    topScorerComingSoon: 'Top Scorer leaderboard is coming soon!',
    standings: {
      loading: 'Loading table…',
      empty: 'No teams registered in this division yet.',
      team: 'Team',
      played: 'P',
      won: 'W',
      drawn: 'D',
      lost: 'L',
      goalDifference: 'GD',
      points: 'Pts',
    },
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
    calendar: {
```

- [ ] **Step 3: Add the matching Spanish blocks to `es.ts`**

Find the end of `home.schedule` in `es.ts`:
```ts
    schedule: {
      title: 'Próximo Calendario',
      fullSchedule: 'Calendario Completo',
      practiceScheduleTitle: 'Entrenamientos',
      leagueScheduleTitle: 'Calendario de Liga',
      location: 'Campo del Aeropuerto',
      noPractices: 'No hay entrenamientos en las próximas dos semanas.',
      noMatches: 'No hay partidos en la próxima semana.',
      cancelled: 'Cancelado',
    },
  },
```
Replace with:
```ts
    schedule: {
      title: 'Próximo Calendario',
      fullSchedule: 'Calendario Completo',
      practiceScheduleTitle: 'Entrenamientos',
      leagueScheduleTitle: 'Calendario de Liga',
      location: 'Campo del Aeropuerto',
      noPractices: 'No hay entrenamientos en las próximas dos semanas.',
      noMatches: 'No hay partidos en la próxima semana.',
      cancelled: 'Cancelado',
    },
    about: {
      title: 'Sobre Tangerine Toucans FC',
      body1: 'Tangerine Toucans FC es un club de fútbol juvenil con base en Bocas del Toro, Panamá, construido sobre una idea: todo niño merece un equipo. Entrenamos a jugadores de las categorías U10 y U14, competimos en la liga juvenil local, y le damos a esta comunidad un lugar para jugar, viajar y crecer juntos, dentro y fuera de la cancha.',
      body2: 'En este sitio es donde todo se junta. Inscribe a tu hijo/a para la temporada, consulta el calendario de entrenamientos y partidos, sigue la tabla de posiciones de la liga, y mira los momentos del día de partido en la galería.',
    },
  },
```

Find the equivalent block in `es.ts` (same structure as `en.ts` — `topScorerComingSoon` followed by a `standings: { ... }` block, then `calendar:`):
```ts
    topScorerComingSoon: '¡La tabla de goleadores llegará pronto!',
    standings: {
      loading: 'Cargando tabla…',
      empty: 'Aún no hay equipos inscritos en esta división.',
      team: 'Equipo',
      played: 'PJ',
      won: 'G',
      drawn: 'E',
      lost: 'P',
      goalDifference: 'DG',
      points: 'Pts',
    },
    calendar: {
```
Replace with (inserting `about` after `standings`, before `calendar`, matching the `en.ts` insertion point exactly):
```ts
    topScorerComingSoon: '¡La tabla de goleadores llegará pronto!',
    standings: {
      loading: 'Cargando tabla…',
      empty: 'Aún no hay equipos inscritos en esta división.',
      team: 'Equipo',
      played: 'PJ',
      won: 'G',
      drawn: 'E',
      lost: 'P',
      goalDifference: 'DG',
      points: 'Pts',
    },
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
    calendar: {
```

- [ ] **Step 4: Typecheck (verifies `es` still satisfies `typeof en`)**

Run: `npx tsc --noEmit`
Expected: no new errors (same 3 pre-existing unrelated gallery test errors as every other task this session)

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: all existing suites still pass (i18n additions are purely additive, no existing key removed or renamed)

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/es.ts
git commit -m "feat: add i18n content for the homepage about section and league explainer"
```

---

### Task 2: Homepage About section

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add the new section**

Find:
```tsx
      <UpcomingSchedule schedule={schedule} locale={locale} />

      {/* Get Involved CTA */}
```
Replace with:
```tsx
      <UpcomingSchedule schedule={schedule} locale={locale} />

      {/* About */}
      <section className="py-14 px-4 bg-brand-creamAlt border-t border-brand-line">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="font-heading text-brand-ink text-3xl uppercase tracking-wider mb-5">{t.home.about.title}</h2>
          <p className="text-brand-muted mb-4">{t.home.about.body1}</p>
          <p className="text-brand-muted">{t.home.about.body2}</p>
        </div>
      </section>

      {/* Get Involved CTA */}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Manual/build check**

Run: `npx next build` — confirm no errors. If a real browser isn't available in this environment, that's the fallback verification (consistent with earlier plans this session).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add an About section to the homepage"
```

---

### Task 3: `/league` "How the League Works" explainer

**Files:**
- Modify: `src/app/league/page.tsx`

- [ ] **Step 1: Add the date-range computation**

Find:
```tsx
export default function LeaguePage() {
  const { t } = useLocale()
  const [tab, setTab] = useState<Tab>('fixtures')
  const [divisions, setDivisions] = useState<Division[]>([])
  const [divisionId, setDivisionId] = useState('')

  useEffect(() => {
    getDivisions()
      .then(list => {
        setDivisions(list)
        if (list.length > 0) setDivisionId(list[0].id)
      })
      .catch(err => console.error('Failed to load League divisions:', err))
  }, [])
```
Replace with (adding `locale` — needed for date formatting — and a `seasonDateRange` computation):
```tsx
export default function LeaguePage() {
  const { t, locale } = useLocale()
  const [tab, setTab] = useState<Tab>('fixtures')
  const [divisions, setDivisions] = useState<Division[]>([])
  const [divisionId, setDivisionId] = useState('')

  useEffect(() => {
    getDivisions()
      .then(list => {
        setDivisions(list)
        if (list.length > 0) setDivisionId(list[0].id)
      })
      .catch(err => console.error('Failed to load League divisions:', err))
  }, [])

  // divisions[0] is safe to treat as earliest because getDivisions() orders
  // by season_start_date server-side; season_end_date has no such guarantee,
  // so it's computed with an explicit reduce instead of trusting array order.
  const seasonDateRange = divisions.length > 0
    ? {
        start: formatSeasonDate(divisions[0].season_start_date, locale),
        end: formatSeasonDate(
          divisions.reduce((latest, d) => (d.season_end_date > latest ? d.season_end_date : latest), divisions[0].season_end_date),
          locale
        ),
      }
    : null
```

Add an import for the `Locale` type (this file doesn't have it yet):
```tsx
import type { Locale } from '@/lib/i18n/locale'
```

Add this helper function above `LeaguePage` (after the `type Division = ...` line, before `export default function LeaguePage`) — typed `locale: Locale`, matching the same helper pattern already used in `src/components/league/fixture-calendar.tsx`'s `longDate`:
```tsx
function formatSeasonDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso))
}
```

- [ ] **Step 2: Add the explainer block**

Find:
```tsx
  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.league.title} subtitle={t.league.subtitle} />
      <div className="flex border-b border-brand-line overflow-x-auto">
```
Replace with:
```tsx
  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title={t.league.title} subtitle={t.league.subtitle} />

      <div className="max-w-3xl mx-auto px-4 py-6 text-sm text-brand-muted space-y-3">
        <h2 className="font-heading text-brand-ink text-lg uppercase tracking-wider">{t.league.about.title}</h2>
        <p>{t.league.about.intro}</p>
        {seasonDateRange && <p>{t.league.about.format(seasonDateRange.start, seasonDateRange.end)}</p>}
        <p>{t.league.about.matchDay}</p>
        <p>{t.league.about.standings}</p>
        <p>{t.league.about.bracketPhase}</p>
        <p>
          {t.league.about.registerPrefix} <span className="font-bold text-brand-ink">{t.league.about.registerBold}</span> {t.league.about.registerSuffix}
        </p>
      </div>

      <div className="flex border-b border-brand-line overflow-x-auto">
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (`useLocale()` — `src/lib/i18n/locale-context.tsx:31-35` — returns `{ locale: Locale; t: typeof en; setLocale }`, confirmed during spec/plan review, so destructuring `const { t, locale } = useLocale()` is valid.)

- [ ] **Step 4: Manual/build check**

Run: `npx next build` — confirm no errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/league/page.tsx
git commit -m "feat: add a How the League Works explainer to the league page"
```

---

### Task 4: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated gallery test errors

- [ ] **Step 2: Lint the changed files**

Run: `npx eslint src/lib/i18n/en.ts src/lib/i18n/es.ts src/app/page.tsx src/app/league/page.tsx`
Expected: no output (clean)

- [ ] **Step 3: Full test suite**

Run: `npx jest`
Expected: all suites pass

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Manual check**

Visit `/` and `/league` (or run `npm run dev` + curl fallback if no browser is available). Confirm: the homepage shows the About section between the schedule and Get Involved; `/league` shows the explainer above the tabs with a real, correctly-formatted season date range (not "Invalid Date" or a raw ISO string); switching the site's language toggle changes both sections' text.

- [ ] **Step 6: Confirm before pushing**

Per this session's established pattern, do not push to `origin/main` without explicit user confirmation, even though all local commits are already made per-task above. No production database changes in this plan — pure code/content, nothing to migrate.
