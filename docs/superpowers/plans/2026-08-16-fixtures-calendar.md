# Fixtures Calendar & Kickoff Times Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the League page's flat per-division Fixtures list with a two-division-combined interactive calendar, add kickoff times throughout (schema, admin editor, homepage widget), and import the real 2026 season fixture data.

**Architecture:** A pure, unit-tested `buildFixtureCalendar` function (mirroring the existing `computeStandings` pattern) turns a flat fixture list into a per-Sunday structure (playing day vs. rest day); a thin server action fetches and tags the data; a new client component renders it as a date-strip + day-panel. Kickoff time is a new nullable `time` column threaded through the admin editor and the homepage "Upcoming Schedule" widget. A one-off script (not committed) creates the new "Loma Espina" team and imports the real season's 50 fixtures.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role client), Jest + Testing Library, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-16-fixtures-calendar.md`

---

## Chunk 1: Data model, pure calendar logic, and server actions

### Task 1: Migration — add `kickoff` column

**Files:**
- Create: `supabase/migrations/017_league_fixture_kickoff.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Nullable: existing fixtures (and any future fixture added without a
-- specified time, e.g. via the admin "Add Fixture Manually" form left
-- blank) remain valid. All fixtures in the real 2026 season import have
-- a kickoff set.
alter table league_fixtures add column kickoff time;
```

- [ ] **Step 2: Apply to production**

**STOP — confirm with the user before running this.** This changes the live database schema.

Run: `supabase db push`
Expected: prompts to confirm pushing `017_league_fixture_kickoff.sql`, then "Finished supabase db push."

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/017_league_fixture_kickoff.sql
git commit -m "feat: add kickoff time column to league_fixtures"
```

---

### Task 2: Update Supabase types for `kickoff`

**Files:**
- Modify: `src/lib/supabase/types.ts` (the `league_fixtures` block, ~line 194)

- [ ] **Step 1: Add `kickoff` to `Row`, `Insert`, and `Update`**

In the `league_fixtures` table's `Row` type, add (alphabetically, after `id`):
```ts
          id: string
          kickoff: string | null
          match_date: string
```

In `Insert`, add (optional, alphabetically after `id`):
```ts
          id?: string
          kickoff?: string | null
          match_date: string
```

In `Update`, add the same optional field in the equivalent position.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (the two pre-existing unrelated `gallery-client`/`masonry-grid` test errors are known and out of scope — see spec review history from the join-month feature earlier this session).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add kickoff field to league_fixtures types"
```

---

### Task 3: `fixture-calendar.ts` — pure function (TDD)

**Files:**
- Create: `src/lib/league/fixture-calendar.ts`
- Test: `src/lib/league/__tests__/fixture-calendar.test.ts`

This mirrors how `src/lib/league/standings.ts` (`computeStandings`) is a pure, DB-free function unit-tested in isolation, then wrapped by a thin action.

- [ ] **Step 1: Write the failing tests**

```ts
import { buildFixtureCalendar, shortDivisionLabel, type CalendarMatch } from '../fixture-calendar'

function match(overrides: Partial<CalendarMatch> = {}): CalendarMatch {
  return {
    id: 'fx-1',
    matchDate: '2026-09-06',
    division: 'U10',
    kickoff: '09:00',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    homeScore: null,
    awayScore: null,
    cancelled: false,
    isHomeClubMatch: false,
    ...overrides,
  }
}

describe('buildFixtureCalendar', () => {
  it('marks a Sunday with no fixtures as a rest day', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-20', [
      match({ id: 'fx-1', matchDate: '2026-09-06' }),
      match({ id: 'fx-2', matchDate: '2026-09-20' }),
    ])
    expect(days.map(d => d.date)).toEqual(['2026-09-06', '2026-09-13', '2026-09-20'])
    expect(days[1]).toEqual({ date: '2026-09-13', rest: true })
  })

  it('derives firstDivision from the earliest-kickoff match that day', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-06', [
      match({ id: 'fx-1', division: 'U10', kickoff: '11:00' }),
      match({ id: 'fx-2', division: 'U14', kickoff: '09:00' }),
    ])
    expect(days[0]).toMatchObject({ rest: false, firstDivision: 'U14' })
  })

  it('sorts matches by kickoff, with a null kickoff last', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-06', [
      match({ id: 'fx-1', kickoff: '11:00' }),
      match({ id: 'fx-2', kickoff: null }),
      match({ id: 'fx-3', kickoff: '09:00' }),
    ])
    expect(days[0].rest).toBe(false)
    if (!days[0].rest) {
      expect(days[0].matches.map(m => m.id)).toEqual(['fx-3', 'fx-1', 'fx-2'])
    }
  })

  it('preserves isHomeClubMatch through to the output without recomputing it', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-06', [
      match({ id: 'fx-1', isHomeClubMatch: true }),
      match({ id: 'fx-2', isHomeClubMatch: false }),
    ])
    expect(days[0].rest).toBe(false)
    if (!days[0].rest) {
      expect(days[0].matches.find(m => m.id === 'fx-1')?.isHomeClubMatch).toBe(true)
      expect(days[0].matches.find(m => m.id === 'fx-2')?.isHomeClubMatch).toBe(false)
    }
  })
})

describe('shortDivisionLabel', () => {
  it('takes the leading token of the division name', () => {
    expect(shortDivisionLabel('U10 (as of Jan 2027)')).toBe('U10')
    expect(shortDivisionLabel('U14')).toBe('U14')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/league/__tests__/fixture-calendar.test.ts`
Expected: FAIL — `Cannot find module '../fixture-calendar'`

- [ ] **Step 3: Write the implementation**

```ts
export type CalendarMatch = {
  id: string
  matchDate: string       // "YYYY-MM-DD"
  division: string        // short label, e.g. "U10" — see shortDivisionLabel
  kickoff: string | null  // "HH:MM" or null if unset
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  cancelled: boolean
  isHomeClubMatch: boolean // set by the caller (getFixtureCalendar), not computed here
}

export type CalendarDay =
  | { date: string; rest: true }
  | { date: string; rest: false; firstDivision: string; matches: CalendarMatch[] }

// Division names in the DB carry a trailing qualifier (e.g. "U10 (as of Jan
// 2027)") that's meaningful for admin bookkeeping but too long for a
// calendar pill — every current division name starts with its short form,
// so taking the first whitespace-delimited token is sufficient.
export function shortDivisionLabel(divisionName: string): string {
  return divisionName.split(' ')[0]
}

// Same "walk forward one week at a time in UTC" approach as
// firstSundayOnOrAfter in round-robin.ts, kept local here since this file
// has no dependency on the round-robin generator.
function firstSundayOnOrAfter(date: Date): Date {
  const sunday = new Date(date)
  const daysUntilSunday = (7 - sunday.getUTCDay()) % 7
  sunday.setUTCDate(sunday.getUTCDate() + daysUntilSunday)
  return sunday
}

function sortByKickoff(matches: CalendarMatch[]): CalendarMatch[] {
  return [...matches].sort((a, b) => {
    if (a.kickoff === null && b.kickoff === null) return 0
    if (a.kickoff === null) return 1
    if (b.kickoff === null) return -1
    return a.kickoff.localeCompare(b.kickoff)
  })
}

/**
 * Turns a flat fixture list into every Sunday between seasonStart and
 * seasonEnd (inclusive), marking Sundays with no fixtures as rest days.
 * `isHomeClubMatch` must already be set on each CalendarMatch — this
 * function only sorts and groups, it doesn't know about "our club".
 */
export function buildFixtureCalendar(
  seasonStart: string,
  seasonEnd: string,
  fixtures: CalendarMatch[]
): CalendarDay[] {
  const byDate = new Map<string, CalendarMatch[]>()
  for (const f of fixtures) {
    byDate.set(f.matchDate, [...(byDate.get(f.matchDate) ?? []), f])
  }

  const days: CalendarDay[] = []
  let cursor = firstSundayOnOrAfter(new Date(seasonStart))
  const end = new Date(seasonEnd)

  while (cursor <= end) {
    const dateStr = cursor.toISOString().slice(0, 10)
    const dayMatches = byDate.get(dateStr)

    if (!dayMatches || dayMatches.length === 0) {
      days.push({ date: dateStr, rest: true })
    } else {
      const sorted = sortByKickoff(dayMatches)
      days.push({ date: dateStr, rest: false, firstDivision: sorted[0].division, matches: sorted })
    }

    cursor = new Date(cursor)
    cursor.setUTCDate(cursor.getUTCDate() + 7)
  }

  return days
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/league/__tests__/fixture-calendar.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/league/fixture-calendar.ts src/lib/league/__tests__/fixture-calendar.test.ts
git commit -m "feat: add pure fixture-calendar grouping logic"
```

---

### Task 4: Export `HOME_CLUB_NAME` from `schedule.ts`

**Files:**
- Modify: `src/app/actions/schedule.ts:11`

- [ ] **Step 1: Add `export` to the existing constant**

```ts
export const HOME_CLUB_NAME = 'Tangerine Toucans'
```

(No test needed — this is a one-word visibility change to a constant already covered indirectly by `schedule.test.ts`.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/schedule.ts
git commit -m "refactor: export HOME_CLUB_NAME for reuse in the fixture calendar action"
```

---

### Task 5: `getFixtureCalendar()` action + remove `getFixtures()`

**Files:**
- Modify: `src/app/actions/league.ts` (add `getFixtureCalendar`, remove `getFixtures` at ~line 184)

- [ ] **Step 1: Add the import and the new action**

Add to the top imports:
```ts
import { buildFixtureCalendar, shortDivisionLabel } from '@/lib/league/fixture-calendar'
import { HOME_CLUB_NAME } from '@/app/actions/schedule'
```

Replace the entire `getFixtures` function (~line 179-204) with:

```ts
/**
 * Both divisions' fixtures combined into the Fixtures tab's calendar —
 * unlike getStandings/the old getFixtures, this deliberately spans every
 * division at once, since most clubs field a team in both age groups and
 * the calendar co-locates their matchdays.
 */
export async function getFixtureCalendar() {
  const supabase = createSupabaseServiceClient()

  const { data: divisions } = await supabase.from('league_divisions').select('*')
  if (!divisions || divisions.length === 0) return []

  const seasonStart = [...divisions].sort((a, b) => a.season_start_date.localeCompare(b.season_start_date))[0].season_start_date
  const seasonEnd = [...divisions].sort((a, b) => b.season_end_date.localeCompare(a.season_end_date))[0].season_end_date
  const divisionNameById = new Map(divisions.map(d => [d.id, d.name]))

  const { data: fixtures } = await supabase.from('league_fixtures').select('*').order('match_date')
  const { data: teams } = await supabase.from('league_teams').select('id, name')
  const teamById = new Map((teams ?? []).map(t => [t.id, t.name]))

  const calendarMatches = (fixtures ?? []).map(f => {
    const homeTeam = teamById.get(f.home_team_id) ?? 'Unknown'
    const awayTeam = teamById.get(f.away_team_id) ?? 'Unknown'
    return {
      id: f.id,
      matchDate: f.match_date,
      division: shortDivisionLabel(divisionNameById.get(f.division_id) ?? ''),
      kickoff: f.kickoff ? f.kickoff.slice(0, 5) : null,
      homeTeam,
      awayTeam,
      homeScore: f.home_score,
      awayScore: f.away_score,
      cancelled: f.cancelled,
      isHomeClubMatch: homeTeam === HOME_CLUB_NAME || awayTeam === HOME_CLUB_NAME,
    }
  })

  return buildFixtureCalendar(seasonStart, seasonEnd, calendarMatches)
}
```

- [ ] **Step 2: Write a test for the new action**

Add to `src/app/actions/__tests__/league.test.ts` (new `describe` block; the existing `mockSupabase` object at the top of the file already covers `from`/`select`/`order`):

```ts
describe('getFixtureCalendar', () => {
  it('returns an empty array when there are no divisions yet', async () => {
    mockSupabase.select.mockResolvedValueOnce({ data: [], error: null }) // league_divisions
    const result = await getFixtureCalendar()
    expect(result).toEqual([])
  })

  it('tags a fixture as isHomeClubMatch when Tangerine Toucans play, and shortens the division label', async () => {
    // getFixtureCalendar calls .select() three times, in this order:
    //   1. league_divisions .select('*')                -- TERMINAL (awaited directly)
    //   2. league_fixtures  .select('*').order(...)      -- select() is chainable here, order() is TERMINAL
    //   3. league_teams     .select('id, name')           -- TERMINAL
    // mockResolvedValueOnce queues are consumed strictly by call order, not by
    // which logical branch they belong to — the fixtures call's select() MUST
    // get an explicit mockReturnValueOnce(mockSupabase) spacer, or its slot
    // gets consumed by the teams call's queued value and .order() throws
    // "is not a function" on whatever select() actually returned.
    mockSupabase.select
      .mockResolvedValueOnce({ // 1. league_divisions -- TERMINAL
        data: [{ id: 'div-1', name: 'U10 (as of Jan 2027)', season_start_date: '2026-09-06', season_end_date: '2026-09-06' }],
        error: null,
      })
      .mockReturnValueOnce(mockSupabase) // 2. league_fixtures .select() -> chained to .order()
      .mockResolvedValueOnce({ // 3. league_teams -- TERMINAL
        data: [{ id: 'team-1', name: 'Tangerine Toucans' }, { id: 'team-2', name: 'Rival FC' }],
        error: null,
      })
    mockSupabase.order.mockResolvedValueOnce({ // league_fixtures .order('match_date') -- TERMINAL
      data: [{
        id: 'fx-1', division_id: 'div-1', match_date: '2026-09-06', kickoff: '09:00:00',
        home_team_id: 'team-1', away_team_id: 'team-2', home_score: null, away_score: null, cancelled: false,
      }],
      error: null,
    })

    const result = await getFixtureCalendar()
    expect(result).toEqual([{
      date: '2026-09-06',
      rest: false,
      firstDivision: 'U10',
      matches: [expect.objectContaining({
        division: 'U10', kickoff: '09:00', homeTeam: 'Tangerine Toucans', awayTeam: 'Rival FC', isHomeClubMatch: true,
      })],
    }])
  })
})
```

Add `getFixtureCalendar` to the existing import line at the top of the test file.

- [ ] **Step 3: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/league.test.ts`
Expected: PASS (existing tests still pass, 2 new tests pass)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/league.ts src/app/actions/__tests__/league.test.ts
git commit -m "feat: add getFixtureCalendar action, remove unused getFixtures"
```

> **Correction found during execution (code quality review of Task 5):** Task 4's `export const HOME_CLUB_NAME = 'Tangerine Toucans'` in `src/app/actions/schedule.ts` (a `'use server'` file) plus Task 5's `import { HOME_CLUB_NAME } from '@/app/actions/schedule'` together broke `next build` — Next.js's Server Actions compiler only allows async function exports from a `'use server'` file; a plain `const` export is a hard build error that `tsc --noEmit`/`jest` don't catch. Fixed by moving `HOME_CLUB_NAME` to a new plain module `src/lib/league/home-club.ts`, with both `schedule.ts` and `league.ts` importing it from there instead. If re-executing this plan from scratch, define `HOME_CLUB_NAME` in `src/lib/league/home-club.ts` from the start (Task 4) rather than exporting it from `schedule.ts`.

---

## Chunk 2: UI — calendar component, admin editor, homepage widget, i18n

### Task 6: i18n — `t.league.calendar.*`

**Files:**
- Modify: `src/lib/i18n/en.ts` (league block, after `standings`, ~line 138)
- Modify: `src/lib/i18n/es.ts` (matching position, ~line 139)

- [ ] **Step 1: Add the English keys**

In `en.ts`, insert after the `standings: { ... },` block and before `registerForm: {`:

```ts
    calendar: {
      loading: 'Loading fixtures…',
      empty: 'No fixtures scheduled yet.',
      restWeek: 'Rest week',
      restWeekNote: 'No fixtures this weekend — Saturday stays free for weather rearrangements.',
      firstDivision: (division: string) => `${division} first`,
      toucansLegend: '★ marks Tangerine Toucans matches',
      cancelled: 'Cancelled',
    },
```

- [ ] **Step 2: Add the matching Spanish keys**

In `es.ts`, same position:

```ts
    calendar: {
      loading: 'Cargando calendario…',
      empty: 'Aún no hay partidos programados.',
      restWeek: 'Semana de descanso',
      restWeekNote: 'No hay partidos este fin de semana — el sábado queda libre para reprogramar por mal tiempo.',
      firstDivision: (division: string) => `${division} primero`,
      toucansLegend: '★ marca los partidos de Tangerine Toucans',
      cancelled: 'Cancelado',
    },
```

- [ ] **Step 3: Typecheck (verifies `es` still satisfies `typeof en`)**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Run the full test suite**

Run: `npx jest`
Expected: all existing suites still pass (i18n key additions are additive)

- [ ] **Step 5: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/es.ts
git commit -m "feat: add i18n keys for the fixtures calendar"
```

---

### Task 7: `FixtureCalendar` component

**Files:**
- Create: `src/components/league/fixture-calendar.tsx`
- Delete: `src/components/league/fixtures-list.tsx` (has no test file — confirmed, nothing to delete alongside it)

- [ ] **Step 1: Write the component**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getFixtureCalendar } from '@/app/actions/league'
import { useLocale } from '@/lib/i18n/locale-context'
import type { Locale } from '@/lib/i18n/locale'

type CalendarDay = Awaited<ReturnType<typeof getFixtureCalendar>>[number]

function shortDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  }).format(new Date(iso))
}

function longDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(iso))
}

// Default to the nearest playing/rest day today-or-later; once the season
// has fully passed, fall back to the last day rather than showing nothing.
function defaultSelectedIndex(days: CalendarDay[]): number {
  const today = new Date().toISOString().slice(0, 10)
  const idx = days.findIndex(d => d.date >= today)
  return idx === -1 ? days.length - 1 : idx
}

function divisionPillClass(division: string) {
  return division === 'U10' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'
}

export function FixtureCalendar() {
  const { locale, t } = useLocale()
  const [days, setDays] = useState<CalendarDay[] | null>(null)
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    getFixtureCalendar()
      .then(data => { setDays(data); setSelected(defaultSelectedIndex(data)) })
      .catch(() => setDays([]))
  }, [])

  if (days === null) return <p className="text-brand-muted py-8 text-center">{t.league.calendar.loading}</p>
  if (days.length === 0) return <p className="text-brand-muted py-8 text-center">{t.league.calendar.empty}</p>

  const day = days[selected]

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setSelected(i)}
            className={`min-w-[66px] flex-1 border rounded p-2 text-center text-xs transition ${
              i === selected ? 'border-brand-primary bg-brand-tint' : 'border-brand-line'
            }`}
          >
            <div className="font-bold text-brand-ink">{shortDate(d.date, locale)}</div>
            <div className="text-brand-muted">{d.rest ? t.league.calendar.restWeek : d.matches.length}</div>
          </button>
        ))}
      </div>

      <p className="text-brand-mutedWarm text-xs mb-4">{t.league.calendar.toucansLegend}</p>

      {day.rest ? (
        <div className="text-center py-12">
          <p className="font-bold text-brand-ink mb-1">{t.league.calendar.restWeek}</p>
          <p className="text-brand-muted text-sm">{longDate(day.date, locale)}</p>
          <p className="text-brand-muted text-sm mt-2">{t.league.calendar.restWeekNote}</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">{longDate(day.date, locale)}</p>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              {t.league.calendar.firstDivision(day.firstDivision)}
            </span>
          </div>
          <div className="space-y-2">
            {day.matches.map(m => (
              <div
                key={m.id}
                className={`bg-brand-tint border border-brand-line rounded p-3 flex items-center gap-3 text-sm ${m.cancelled ? 'opacity-60' : ''}`}
              >
                <span className="font-mono tabular-nums text-xs text-brand-muted min-w-[44px]">{m.kickoff ?? '—'}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${divisionPillClass(m.division)}`}>
                  {m.division}
                </span>
                <span className="flex-1">
                  {m.homeTeam} <span className="text-brand-muted">v</span> {m.awayTeam}
                  {m.isHomeClubMatch && <span className="ml-1">★</span>}
                </span>
                {m.cancelled ? (
                  <span className="text-red-600 text-xs font-bold uppercase tracking-wider flex-shrink-0">{t.league.calendar.cancelled}</span>
                ) : m.homeScore !== null && m.awayScore !== null ? (
                  <span className="font-bold text-brand-ink flex-shrink-0">{m.homeScore}–{m.awayScore}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete the old component and its now-orphaned i18n keys**

```bash
rm src/components/league/fixtures-list.tsx
```

`FixturesList` was the only consumer of `t.league.fixtures.{loading,empty,cancelled,vs}` in both `src/lib/i18n/en.ts` and `src/lib/i18n/es.ts` — remove that `fixtures: { ... }` block from the `league` namespace in both files now that nothing references it, rather than leaving dead translation keys behind.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `src/app/league/page.tsx` referencing `FixturesList` — expected, fixed in Task 8

- [ ] **Step 4: Commit**

```bash
git add src/components/league/fixture-calendar.tsx
git rm src/components/league/fixtures-list.tsx
git commit -m "feat: add FixtureCalendar component, remove FixturesList"
```

(No dedicated component test — matches the existing precedent of `FixturesList`/`StandingsTable` having no test files; the data-shaping logic they depend on is tested at the pure-function and action level in Tasks 3 and 5.)

---

### Task 8: Wire `FixtureCalendar` into `/league`

**Files:**
- Modify: `src/app/league/page.tsx`

- [ ] **Step 1: Update the import**

Replace:
```ts
import { FixturesList } from '@/components/league/fixtures-list'
```
with:
```ts
import { FixtureCalendar } from '@/components/league/fixture-calendar'
```

- [ ] **Step 2: Scope the division selector to the Table tab only**

Replace:
```tsx
{(tab === 'fixtures' || tab === 'table') && divisions.length > 0 && (
```
with:
```tsx
{tab === 'table' && divisions.length > 0 && (
```

- [ ] **Step 3: Swap the Fixtures tab content**

Replace:
```tsx
{tab === 'fixtures' && (
  divisionId ? <FixturesList divisionId={divisionId} /> : <p className="text-brand-muted py-8 text-center">{t.league.noDivisions}</p>
)}
```
with:
```tsx
{tab === 'fixtures' && <FixtureCalendar />}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Manual check**

Run: `npm run dev`, visit `/league`, click the Fixtures tab. Expected: date strip renders, selecting a tile shows that day's matches or the rest-day empty state, no division dropdown above it. Switch to the Table tab and confirm the division dropdown still appears there.

- [ ] **Step 6: Commit**

```bash
git add src/app/league/page.tsx
git commit -m "feat: replace the Fixtures tab with the fixture calendar"
```

---

### Task 9: Admin fixture editor — kickoff input

**Files:**
- Modify: `src/app/actions/league-admin.ts` (`getFixturesForAdmin`, `UpdateFixtureInput`/`updateFixture`, `addFixture`)
- Modify: `src/app/actions/__tests__/league-admin.test.ts`
- Modify: `src/components/admin/league-fixtures-admin.tsx`

- [ ] **Step 1: Write the failing action tests**

Add to the existing `describe('updateFixture', ...)` block in `league-admin.test.ts`:

```ts
  it('includes kickoff in the patch when provided', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    await updateFixture('fx-1', { kickoff: '10:00' })
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ kickoff: '10:00' }))
  })
```

Add a new `describe` block after it (there's no existing coverage for `addFixture`):

```ts
describe('addFixture', () => {
  it('inserts the provided kickoff, or null when omitted', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    await addFixture({ divisionId: 'div-1', homeTeamId: 'team-1', awayTeamId: 'team-2', matchDate: '2026-09-06', kickoff: '09:00' })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ kickoff: '09:00' }))

    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    await addFixture({ divisionId: 'div-1', homeTeamId: 'team-1', awayTeamId: 'team-2', matchDate: '2026-09-06' })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ kickoff: null }))
  })
})
```

The test file's current import block does **not** include `addFixture` (it imports `updateFixture, recordFixtureScore, setFixtureCancelled` and others from `../league-admin`, but not `addFixture` — it's an existing export that's simply never been tested). Add `addFixture` to that destructured import list, or the new `describe('addFixture', ...)` block will fail with a reference error rather than the intended assertion failure.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/league-admin.test.ts`
Expected: FAIL — `kickoff` not present in the actual `update`/`insert` call

- [ ] **Step 3: Update the actions**

In `src/app/actions/league-admin.ts`, update `getFixturesForAdmin`'s mapped return (~line 341) to include:
```ts
    kickoff: f.kickoff ? f.kickoff.slice(0, 5) : null,
```

Update `UpdateFixtureInput` and `updateFixture`:
```ts
export type UpdateFixtureInput = { matchDate?: string; homeTeamId?: string; awayTeamId?: string; kickoff?: string }

export async function updateFixture(id: string, input: UpdateFixtureInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const patch: Record<string, string> = {}
  if (input.matchDate) patch.match_date = input.matchDate
  if (input.homeTeamId) patch.home_team_id = input.homeTeamId
  if (input.awayTeamId) patch.away_team_id = input.awayTeamId
  if (input.kickoff) patch.kickoff = input.kickoff
  const { error } = await supabase.from('league_fixtures').update(patch).eq('id', id)
  if (error) {
    if (error.code === '23514') return { error: 'A team cannot play itself — pick two different teams.' }
    return { error: 'Failed to update fixture' }
  }
  return {}
}
```

Update `addFixture`:
```ts
export async function addFixture(input: {
  divisionId: string; homeTeamId: string; awayTeamId: string; matchDate: string; kickoff?: string
}): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_fixtures').insert({
    division_id: input.divisionId,
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    match_date: input.matchDate,
    kickoff: input.kickoff ?? null,
  })
  if (error) {
    if (error.code === '23514') return { error: 'A team cannot play itself — pick two different teams.' }
    return { error: 'Failed to add fixture' }
  }
  return {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/league-admin.test.ts`
Expected: PASS

- [ ] **Step 5: Add the kickoff input to the admin UI**

In `src/components/admin/league-fixtures-admin.tsx`:

Add a handler alongside `handleDateChange`:
```ts
  async function handleKickoffChange(fixtureId: string, kickoff: string) {
    setErrorMessage(null)
    setSaving(fixtureId)
    try {
      const result = await updateFixture(fixtureId, { kickoff })
      if (result.error) { setErrorMessage(result.error); return }
      await refresh()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }
```

Add a time input next to the existing date input in the per-fixture row:
```tsx
                <input
                  key={`${f.id}-${f.kickoff}`}
                  type="time"
                  className="input text-xs"
                  defaultValue={f.kickoff ?? ''}
                  onBlur={e => e.target.value !== (f.kickoff ?? '') && handleKickoffChange(f.id, e.target.value)}
                />
```

`newFixture` state is reset to a literal object in **three** places in this file — all three need `kickoff: ''` added, or the third one will fail Step 6's typecheck (TypeScript will flag the object literal as missing the now-required `kickoff` property):

1. The state initializer:
```ts
  const [newFixture, setNewFixture] = useState({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '' })
```
2. The division-switch `useEffect`'s reset (currently `setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '' })`):
```ts
    setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '' })
```
3. `handleAddFixture`'s post-success reset (currently `setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '' })` right after the successful `addFixture` call):
```ts
      setNewFixture({ homeTeamId: '', awayTeamId: '', matchDate: '', kickoff: '' })
```

Add a time input to the "Add Fixture Manually" form, and pass it through in `handleAddFixture`'s call to `addFixture({ divisionId, ...newFixture })` (already spreads `newFixture`, so passing `kickoff: ''` through as `undefined` when empty needs a small guard — send `kickoff: newFixture.kickoff || undefined` explicitly rather than spreading the empty string):
```tsx
          <input
            type="time" className="input flex-1"
            value={newFixture.kickoff}
            onChange={e => setNewFixture(prev => ({ ...prev, kickoff: e.target.value }))}
          />
```
```ts
      const result = await addFixture({ divisionId, ...newFixture, kickoff: newFixture.kickoff || undefined })
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 7: Manual check**

Run: `npm run dev`, visit `/admin`, League → Divisions sub-tab, confirm the kickoff time input appears per fixture row and in "Add Fixture Manually", and that editing it persists after a refresh.

- [ ] **Step 8: Commit**

```bash
git add src/app/actions/league-admin.ts src/app/actions/__tests__/league-admin.test.ts src/components/admin/league-fixtures-admin.tsx
git commit -m "feat: add kickoff time editing to the admin fixture editor"
```

---

### Task 10: Homepage "Upcoming Schedule" widget — kickoff time (TDD)

**Files:**
- Modify: `src/app/actions/schedule.ts` (`ScheduleEntry` match variant, `getUpcomingHomeClubMatches`)
- Modify: `src/app/actions/__tests__/schedule.test.ts`
- Modify: `src/components/upcoming-schedule.tsx`

- [ ] **Step 1: Update the failing tests**

In `schedule.test.ts`, update the fixture-row mocks and expected results to include `kickoff`. Specifically:

In `'combines practices and matches, sorted together by date'`, change the fixture row to add `kickoff: '10:00:00'` and the expected match object to add `kickoff: '10:00'`:
```ts
    [{ id: 'fx1', match_date: '2026-08-15', kickoff: '10:00:00', home_team_id: 'team-home', away_team_id: 'team-away', home_score: null, away_score: null, cancelled: false }],
```
```ts
    { type: 'match', id: 'fx1', date: '2026-08-15', opponent: 'Rival FC', isHome: true, cancelled: false, homeScore: null, awayScore: null, kickoff: '10:00' },
```

In `'resolves the opponent correctly when our team is the away side'`, same treatment — add `kickoff: '15:00:00'` to the row and `kickoff: '15:00'` to the expectation.

In `'includes cancelled practices and matches rather than filtering them out'` and `'respects the limit after combining and sorting'`, add `kickoff: '09:00:00'` to their fixture-row mocks (the assertions in these two don't check the field directly, but the mock should still shape like a real row).

Add one new test:
```ts
it('returns a null kickoff when the fixture has none set', async () => {
  queuePractices([])
  queueHomeClubWithFixtures(
    ['team-home'],
    [{ id: 'fx1', match_date: '2026-08-15', kickoff: null, home_team_id: 'team-home', away_team_id: 'team-away', home_score: null, away_score: null, cancelled: false }],
    [{ id: 'team-away', name: 'Rival FC' }]
  )
  const result = await getUpcomingSchedule()
  expect(result[0]).toMatchObject({ kickoff: null })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/schedule.test.ts`
Expected: FAIL — actual match objects don't have a `kickoff` field yet

- [ ] **Step 3: Update the implementation**

In `src/app/actions/schedule.ts`, update the `ScheduleEntry` match variant:
```ts
  | { type: 'match'; id: string; date: string; kickoff: string | null; opponent: string; isHome: boolean; cancelled: boolean; homeScore: number | null; awayScore: number | null }
```

Update the mapped return in `getUpcomingHomeClubMatches`:
```ts
    return {
      type: 'match' as const,
      id: f.id,
      date: f.match_date,
      kickoff: f.kickoff ? f.kickoff.slice(0, 5) : null,
      opponent: opponentNameById.get(opponentId) ?? 'TBD',
      isHome,
      cancelled: f.cancelled,
      homeScore: f.home_score,
      awayScore: f.away_score,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/schedule.test.ts`
Expected: PASS

- [ ] **Step 5: Display kickoff in the widget**

In `src/components/upcoming-schedule.tsx`, update the match-entry text line:
```tsx
              <span className="text-brand-muted flex-1 min-w-0 truncate">
                {entry.type === 'practice'
                  ? `${formatTime(entry.time, locale)}${entry.location ? ` · ${entry.location}` : ''}`
                  : `${entry.kickoff ? `${formatTime(entry.kickoff, locale)} · ` : ''}${entry.isHome ? t.home.schedule.vs : t.home.schedule.at} ${entry.opponent}${!entry.cancelled && entry.homeScore !== null && entry.awayScore !== null ? ` — ${entry.homeScore}-${entry.awayScore}` : ''}`}
              </span>
```

(`formatTime` already handles a plain `"HH:MM"` string — same normalization already used for practice `time`, no new parsing logic needed.)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 7: Manual check**

Run: `npm run dev`, visit `/`, confirm any upcoming match in "Upcoming Schedule" shows its kickoff time before "vs"/"@", matching the practice row's `time · location` style.

- [ ] **Step 8: Commit**

```bash
git add src/app/actions/schedule.ts src/app/actions/__tests__/schedule.test.ts src/components/upcoming-schedule.tsx
git commit -m "feat: show kickoff time on the homepage upcoming schedule widget"
```

---

### Task 11: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (same 2 pre-existing unrelated gallery test errors as before this feature)

- [ ] **Step 2: Lint the changed files**

Run: `npx eslint src/lib/league/fixture-calendar.ts src/app/actions/league.ts src/app/actions/schedule.ts src/app/actions/league-admin.ts src/components/league/fixture-calendar.tsx src/app/league/page.tsx src/components/admin/league-fixtures-admin.tsx src/components/upcoming-schedule.tsx src/lib/i18n/en.ts src/lib/i18n/es.ts src/lib/supabase/types.ts`
Expected: no output (clean)

- [ ] **Step 3: Full test suite**

Run: `npx jest`
Expected: all suites pass

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: "Compiled successfully"

---

## Chunk 3: Production rollout — new team and season data import

### Task 12: Import the 2026 season fixtures

**STOP — every step in this task touches production data. Confirm with the user before running the script.** This assumes migration 017 (Task 1) is already applied to production.

**Files:**
- Create (temporary, not committed): a `ts-node` script, e.g. `/private/tmp/claude-501/.../scratchpad/import-fixtures.ts` (use this session's scratchpad directory, not the repo)

- [ ] **Step 1: Confirm `league_fixtures` is empty in production**

It was emptied earlier this session (40 rows deleted) and nothing has re-added rows since — confirm with a quick count via the REST API before proceeding, so this doesn't silently duplicate data:
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/league_fixtures?select=id" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
```
Expected: `0`. **If the count is not 0, STOP — do not run the import script.** Surface the discrepancy to the user before doing anything else; importing on top of existing rows would silently duplicate fixtures.

- [ ] **Step 2: Write the import script**

The script must be safe to re-run (idempotent) so a partial failure can simply be retried rather than requiring manual cleanup:

1. Look up the U10 and U14 `league_divisions` rows **by name at runtime** (do not hardcode the UUIDs looked up earlier this session — they're believed current, but a runtime lookup removes the staleness risk entirely and is simpler than hardcode-plus-verify).
2. **Lookup-or-create** the "Loma Espina" club and U14 team: `select` `league_clubs` by `name = 'Loma Espina'` first; only `insert` if not found. Same lookup-or-create for the `league_teams` row (`name = 'Loma Espina'`, `division_id` = the U14 division id from step 1). This makes re-running the script after a partial failure safe — it won't create a duplicate club/team.
3. Read `~/Downloads/league_fixtures_2026.csv`.
4. Substitute every occurrence of `"Pino Espina"` with `"Loma Espina"`.
5. Look up each row's `(division, home_team, away_team)` against `league_teams` (joined by the division id resolved in step 1) to resolve team names to ids. If any row fails to resolve a team name, **throw immediately and abort before inserting anything** — don't insert a fixture with a null/guessed team id.
6. Before inserting, re-check `league_fixtures` count is still 0 (guards against a race, and against accidentally running the script twice in the same session).
7. Insert all 50 rows into `league_fixtures` with `division_id`, `home_team_id`, `away_team_id`, `match_date`, `kickoff` (parsed straight from the CSV's `kickoff` column, e.g. `"09:00"`).

Use the service-role client via `createSupabaseServiceClient()`, same as every other one-off script this session. Log a summary count at the end (e.g. "Inserted 50 fixtures, 20 U10 / 30 U14") to sanity-check against the expected split before moving on.

**If the script fails partway through** (e.g. crashes after inserting some but not all of the 50 fixtures): don't just re-run it blindly. First check what's actually in the DB —
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/league_fixtures?select=id" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))"
```
If it's non-zero and less than 50, delete those partial rows before retrying (same delete-all approach used earlier this session to empty the table), so Step 1's "must be 0" precondition holds on the retry. The Loma Espina club/team lookup-or-create means those don't need cleanup even on a partial failure.

- [ ] **Step 3: Run the script**

**STOP — this step writes to the production database. Confirm with the user before running it.**

Run: `npx ts-node <script path>`
Expected: reports inserting the Loma Espina club/team (or finding them already present, on a retry), then 50 fixtures (20 U10, 30 U14), no errors

- [ ] **Step 4: Verify in production**

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/league_fixtures?select=id,division_id,match_date,kickoff,home_team_id,away_team_id" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -c "
import json, sys
from collections import Counter
rows = json.load(sys.stdin)
print('total', len(rows))
print(Counter(r['division_id'] for r in rows))
print('any missing kickoff:', any(r['kickoff'] is None for r in rows))
print('any missing team id:', any(r['home_team_id'] is None or r['away_team_id'] is None for r in rows))
print('any self-match:', any(r['home_team_id'] == r['away_team_id'] for r in rows))
"
```
Expected: `total 50`, a 20/30 split across the two division ids, `any missing kickoff: False`, `any missing team id: False`, `any self-match: False`

Then spot-check 3-5 specific rows against the source CSV by joining through team names (not just ids), including at least one fixture involving Loma Espina, to catch a swapped home/away pair or a misresolved team that the aggregate counts above wouldn't reveal:
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/league_fixtures?select=match_date,kickoff,home:home_team_id(name),away:away_team_id(name)&limit=5" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" | python3 -m json.tool
```
Compare the printed rows against the corresponding lines in `league_fixtures_2026.csv` by eye (remembering "Pino Espina" in the CSV should now read "Loma Espina").

Finally, confirm the substitution was complete — no fixture should still resolve to a team literally named "Pino Espina":
```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/league_teams?select=id&name=eq.Pino%20Espina" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```
Expected: `[]`

- [ ] **Step 5: Delete the script**

```bash
rm <script path>
```

Nothing to commit for this task — it's a data-only change to production, not a code change.

---

## Final step: hand back to the user

- [ ] **Step 1: Manual check on the live-shaped data**

Run: `npm run dev`, visit `/league` → Fixtures, confirm the real season renders correctly (13 Sundays, 3 rest weeks, U10/U14 co-located where the source data has them on the same date, Tangerine Toucans star showing on their matches, opening Sunday 2026-09-06 selected by default if run before that date or the nearest correct day otherwise).

- [ ] **Step 2: Confirm before pushing**

Per this session's established pattern, do not push to `origin/main` without explicit user confirmation, even though all local commits are already made per-task above.
