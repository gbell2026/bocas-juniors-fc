# Homepage Schedule Split Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the homepage's single combined "Upcoming Schedule" feed into two independent, side-by-side columns — Practice Schedule (14-day window) and League Schedule (7-day window, every club's matches, with age group and a fixed location).

**Architecture:** Replace `getUpcomingSchedule()`/`ScheduleEntry` in `src/app/actions/schedule.ts` with a new `getHomeSchedule()` returning `{ practices, matches }` as two independently-shaped, independently-windowed arrays — practices unchanged in spirit (just re-windowed), matches now spanning every club/division instead of just the home club. `upcoming-schedule.tsx` renders both as a responsive two-column grid. A small shared helper (`divisionPillClass`) moves from the League page's calendar component into the shared lib so both consumers use one implementation.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role client), Jest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-17-homepage-schedule-split.md`

---

## Chunk 1: Shared helper, data layer, i18n, component, wiring

### Task 1: Export `divisionPillClass` from the shared lib

**Files:**
- Modify: `src/lib/league/fixture-calendar.ts`
- Modify: `src/components/league/fixture-calendar.tsx`
- Test: `src/lib/league/__tests__/fixture-calendar.test.ts`

Currently `divisionPillClass` is a private, unexported function inside `src/components/league/fixture-calendar.tsx:29-31`:
```tsx
function divisionPillClass(division: string) {
  return division === 'U10' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'
}
```
The new homepage component needs the identical mapping. Move it next to `shortDivisionLabel` in the lib file (which already exports that function), and have the component import it instead of defining it locally.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/league/__tests__/fixture-calendar.test.ts`, in the existing `describe('shortDivisionLabel', ...)` area — add a new sibling `describe` block (don't nest it inside `shortDivisionLabel`'s):

```ts
describe('divisionPillClass', () => {
  it('gives U10 the primary color and every other division the ink color', () => {
    expect(divisionPillClass('U10')).toBe('bg-brand-primary text-white')
    expect(divisionPillClass('U14')).toBe('bg-brand-ink text-white')
    expect(divisionPillClass('U12')).toBe('bg-brand-ink text-white')
  })
})
```

Add `divisionPillClass` to the existing `import { buildFixtureCalendar, shortDivisionLabel, type CalendarMatch } from '../fixture-calendar'` line at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/league/__tests__/fixture-calendar.test.ts`
Expected: FAIL — `divisionPillClass` is not exported from `../fixture-calendar` (undefined is not a function, or similar)

- [ ] **Step 3: Add the export to the lib file**

In `src/lib/league/fixture-calendar.ts`, add near `shortDivisionLabel` (e.g. directly after it):
```ts
// Same U10/everything-else split used for the calendar's division pills and
// the homepage's League Schedule column — one shared mapping so both stay
// visually consistent.
export function divisionPillClass(division: string): string {
  return division === 'U10' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'
}
```

- [ ] **Step 4: Remove the local copy and import the shared one**

In `src/components/league/fixture-calendar.tsx`:
- Delete the local `function divisionPillClass(division: string) { ... }` (lines 29-31).
- Add `divisionPillClass` to the existing `import { getFixtureCalendar } from '@/app/actions/league'` — no wait, that's the wrong module. Add a new import line: `import { divisionPillClass } from '@/lib/league/fixture-calendar'`.
- Nothing else in this file changes — it already calls `divisionPillClass(m.division)` exactly as before, just now imported instead of locally defined.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/lib/league/__tests__/fixture-calendar.test.ts`
Expected: PASS, 7 tests (6 existing + 1 new)

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (same pre-existing 3 gallery test errors as always)

- [ ] **Step 7: Commit**

```bash
git add src/lib/league/fixture-calendar.ts src/lib/league/__tests__/fixture-calendar.test.ts src/components/league/fixture-calendar.tsx
git commit -m "refactor: export divisionPillClass for reuse on the homepage"
```

---

### Task 2: `getHomeSchedule()` — replaces `getUpcomingSchedule()` (TDD)

**Files:**
- Modify: `src/app/actions/schedule.ts` (full rewrite of its exported surface)
- Modify: `src/app/actions/__tests__/schedule.test.ts` (full rewrite)

This task deletes `getUpcomingSchedule`, `ScheduleEntry`, and `getUpcomingHomeClubMatches` entirely and replaces them with `getHomeSchedule()` returning two independently-windowed, independently-shaped feeds. `HOME_CLUB_NAME` (from `@/lib/league/home-club`) is no longer needed by this file — the new matches feed spans every club, not just the home one.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `src/app/actions/__tests__/schedule.test.ts` with:

```ts
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { getHomeSchedule } from '../schedule'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  in: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

/**
 * getHomeSchedule's calls, in exact order, per mock function (each mock
 * function has its own independent FIFO queue — see the "mock queue
 * ordering" note below for why every call must be explicitly queued):
 *
 *   select(): [1: practices, chainable->gte]  [2: fixtures, chainable->gte]
 *             [3: divisions, TERMINAL]        [4: teams, chainable->in]
 *   gte():    always chainable (practices, fixtures) — default mockReturnThis covers both, no queueing needed
 *   lt():     always chainable (practices, fixtures) — default mockReturnThis covers both, no queueing needed
 *   order():  [1: practices practice_date, chainable] [2: practices practice_time, TERMINAL]
 *             [3: fixtures match_date, chainable]     [4: fixtures kickoff, TERMINAL]
 *   in():     [1: teams, TERMINAL] — only called if there's at least one fixture in the window
 *
 * If there are zero fixtures in the window, getUpcomingLeagueMatches returns
 * early right after fixtures' order() call — select() calls 3/4 and in()
 * never happen, so tests for that case must NOT queue values for them (an
 * unconsumed queued value is harmless, but queuing too FEW for a call that
 * DOES happen is the actual bug to avoid — see queueMatches below).
 */

function queuePractices(rows: any[]) {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 1: practices select('*') -> chainable
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // 1: practices order('practice_date') -> chainable
    .mockResolvedValueOnce({ data: rows, error: null }) // 2: practices order('practice_time') -> TERMINAL
}

function queueNoMatches() {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 2: fixtures select('*') -> chainable
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // 3: fixtures order('match_date') -> chainable
    .mockResolvedValueOnce({ data: [], error: null }) // 4: fixtures order('kickoff') -> TERMINAL, empty -> early return
}

function queueMatches(fixtureRows: any[], divisions: { id: string; name: string }[], teams: { id: string; name: string }[]) {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 2: fixtures select('*') -> chainable
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // 3: fixtures order('match_date') -> chainable
    .mockResolvedValueOnce({ data: fixtureRows, error: null }) // 4: fixtures order('kickoff') -> TERMINAL
  mockSupabase.select.mockResolvedValueOnce({ data: divisions, error: null }) // 3: divisions select('id, name') -> TERMINAL
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 4: teams select('id, name') -> chainable, then .in()
  mockSupabase.in.mockResolvedValueOnce({ data: teams, error: null }) // teams .in() -> TERMINAL
}

it('returns empty practices and matches when nothing is scheduled', async () => {
  queuePractices([])
  queueNoMatches()

  const result = await getHomeSchedule()
  expect(result).toEqual({ practices: [], matches: [] })
})

it('maps practices within the window', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
    location: 'Field A', notes: null, cancelled: false,
  }])
  queueNoMatches()

  const result = await getHomeSchedule()
  expect(result.practices).toEqual([
    { id: 'p1', date: '2026-08-18', time: '17:00:00', location: 'Field A', notes: null, cancelled: false },
  ])
})

it('includes matches from clubs other than the home club, unlike the old home-club-only feed', async () => {
  queuePractices([])
  queueMatches(
    [{
      id: 'fx1', match_date: '2026-08-20', kickoff: '10:00:00',
      division_id: 'div-u10', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, cancelled: false,
    }],
    [{ id: 'div-u10', name: 'U10 (as of Jan 2027)' }],
    [{ id: 'team-a', name: 'Caranero FC' }, { id: 'team-b', name: 'Real Barriada' }]
  )

  const result = await getHomeSchedule()
  expect(result.matches).toEqual([{
    id: 'fx1', date: '2026-08-20', kickoff: '10:00', division: 'U10',
    homeTeam: 'Caranero FC', awayTeam: 'Real Barriada',
    cancelled: false, homeScore: null, awayScore: null,
  }])
})

it('returns a null kickoff when the fixture has none set', async () => {
  queuePractices([])
  queueMatches(
    [{
      id: 'fx1', match_date: '2026-08-20', kickoff: null,
      division_id: 'div-u10', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, cancelled: false,
    }],
    [{ id: 'div-u10', name: 'U10' }],
    [{ id: 'team-a', name: 'Caranero FC' }, { id: 'team-b', name: 'Real Barriada' }]
  )

  const result = await getHomeSchedule()
  expect(result.matches[0]).toMatchObject({ kickoff: null })
})

it('includes cancelled practices and matches rather than filtering them out', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
    location: null, notes: 'Rained out', cancelled: true,
  }])
  queueMatches(
    [{
      id: 'fx1', match_date: '2026-08-20', kickoff: '10:00:00',
      division_id: 'div-u10', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, cancelled: true,
    }],
    [{ id: 'div-u10', name: 'U10' }],
    [{ id: 'team-a', name: 'Caranero FC' }, { id: 'team-b', name: 'Real Barriada' }]
  )

  const result = await getHomeSchedule()
  expect(result.practices[0].cancelled).toBe(true)
  expect(result.matches[0].cancelled).toBe(true)
})

it('queries practices with a 14-day window and fixtures with a 7-day window', async () => {
  queuePractices([])
  queueNoMatches()

  await getHomeSchedule()

  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date(); in14.setUTCDate(in14.getUTCDate() + 14)
  const in7 = new Date(); in7.setUTCDate(in7.getUTCDate() + 7)

  expect(mockSupabase.gte).toHaveBeenNthCalledWith(1, 'practice_date', today)
  expect(mockSupabase.lt).toHaveBeenNthCalledWith(1, 'practice_date', in14.toISOString().slice(0, 10))
  expect(mockSupabase.gte).toHaveBeenNthCalledWith(2, 'match_date', today)
  expect(mockSupabase.lt).toHaveBeenNthCalledWith(2, 'match_date', in7.toISOString().slice(0, 10))
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/schedule.test.ts`
Expected: FAIL — `getHomeSchedule` is not exported from `../schedule` (the old `getUpcomingSchedule` is still there, unrelated to what the new tests import)

- [ ] **Step 3: Rewrite `src/app/actions/schedule.ts`**

Replace the entire file contents with:

```ts
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { shortDivisionLabel } from '@/lib/league/fixture-calendar'

export type PracticeScheduleEntry = {
  id: string; date: string; time: string; location: string | null; notes: string | null; cancelled: boolean
}

export type LeagueMatchScheduleEntry = {
  id: string; date: string; kickoff: string | null; division: string
  homeTeam: string; awayTeam: string; cancelled: boolean
  homeScore: number | null; awayScore: number | null
}

export type HomeSchedule = { practices: PracticeScheduleEntry[]; matches: LeagueMatchScheduleEntry[] }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Two independent, differently-windowed feeds for the homepage: practices
 * (next 14 days) and every league match across every club/division (next 7
 * days) — unlike the old getUpcomingSchedule, this deliberately does NOT
 * filter matches down to just this club's own games, since the homepage
 * now shows the full league schedule.
 */
export async function getHomeSchedule(): Promise<HomeSchedule> {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: practiceRows } = await supabase
    .from('practices').select('*')
    .gte('practice_date', today).lt('practice_date', addDays(today, 14))
    .order('practice_date', { ascending: true }).order('practice_time', { ascending: true })

  const practices: PracticeScheduleEntry[] = (practiceRows ?? []).map(p => ({
    id: p.id,
    date: p.practice_date,
    time: p.practice_time,
    location: p.location,
    notes: p.notes,
    cancelled: p.cancelled,
  }))

  const matches = await getUpcomingLeagueMatches(today, addDays(today, 7))

  return { practices, matches }
}

async function getUpcomingLeagueMatches(today: string, until: string): Promise<LeagueMatchScheduleEntry[]> {
  const supabase = createSupabaseServiceClient()

  const { data: fixtureRows } = await supabase
    .from('league_fixtures').select('*')
    .gte('match_date', today).lt('match_date', until)
    .order('match_date', { ascending: true }).order('kickoff', { ascending: true })
  if (!fixtureRows || fixtureRows.length === 0) return []

  const { data: divisions } = await supabase.from('league_divisions').select('id, name')
  const divisionNameById = new Map((divisions ?? []).map(d => [d.id, d.name]))

  const teamIds = Array.from(new Set(fixtureRows.flatMap(f => [f.home_team_id, f.away_team_id])))
  const { data: teams } = await supabase.from('league_teams').select('id, name').in('id', teamIds)
  const teamNameById = new Map((teams ?? []).map(t => [t.id, t.name]))

  return fixtureRows.map(f => ({
    id: f.id,
    date: f.match_date,
    kickoff: f.kickoff ? f.kickoff.slice(0, 5) : null,
    division: shortDivisionLabel(divisionNameById.get(f.division_id) ?? ''),
    homeTeam: teamNameById.get(f.home_team_id) ?? 'Unknown',
    awayTeam: teamNameById.get(f.away_team_id) ?? 'Unknown',
    cancelled: f.cancelled,
    homeScore: f.home_score,
    awayScore: f.away_score,
  }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/schedule.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors in `src/app/page.tsx` and `src/components/upcoming-schedule.tsx` (both still reference the now-deleted `getUpcomingSchedule`/`ScheduleEntry`) — EXPECTED, fixed in Tasks 3-4. Nothing else new.

- [ ] **Step 6: Run `npx next build`**

Expected: fails with module/type errors pointing at `page.tsx`/`upcoming-schedule.tsx` referencing the deleted exports — same expected, deliberately mid-flight state as the typecheck. This plan has one task each to fix both remaining consumers next.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/schedule.ts src/app/actions/__tests__/schedule.test.ts
git commit -m "feat: replace getUpcomingSchedule with getHomeSchedule (practices + all-club matches)"
```

---

### Task 3: i18n — new/removed `t.home.schedule.*` keys

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/es.ts`

- [ ] **Step 1: Update the English block**

In `src/lib/i18n/en.ts`, replace the `home.schedule` block:
```ts
    schedule: {
      title: 'Upcoming Schedule',
      fullSchedule: 'Full Schedule',
      practice: 'Practice',
      match: 'Match',
      vs: 'vs',
      at: '@',
      cancelled: 'Cancelled',
    },
```
with:
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
```
(`practice`, `match`, `vs`, `at` are removed — confirm via `grep -rn "schedule\.practice\b\|schedule\.match\b\|schedule\.vs\b\|schedule\.at\b" src` that nothing references them before deleting; they were only ever used in the `upcoming-schedule.tsx` this plan is about to rewrite.)

- [ ] **Step 2: Update the Spanish block**

In `src/lib/i18n/es.ts`, same position, replace with:
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
```
(keep the existing `title`/`fullSchedule` Spanish text as-is — only the keys listed above change; verify against the current file rather than assuming these two are unchanged)

- [ ] **Step 3: Typecheck (verifies `es` still satisfies `typeof en`)**

Run: `npx tsc --noEmit`
Expected: still shows the two consumer errors from Task 2 Step 5 (page.tsx, upcoming-schedule.tsx) plus the 3 pre-existing gallery errors — nothing about i18n

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/es.ts
git commit -m "feat: update i18n keys for the split homepage schedule"
```

---

### Task 4: Rewrite `upcoming-schedule.tsx` as a two-column layout

**Files:**
- Modify: `src/components/upcoming-schedule.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import type { getHomeSchedule } from '@/app/actions/schedule'
import Link from 'next/link'
import type { Locale } from '@/lib/i18n/locale'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'
import { divisionPillClass } from '@/lib/league/fixture-calendar'

type HomeSchedule = Awaited<ReturnType<typeof getHomeSchedule>>

function formatDate(iso: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(iso))
}

function formatTime(time: string, locale: Locale) {
  const [h, m] = time.split(':')
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(2000, 0, 1, Number(h), Number(m)))
}

export function UpcomingSchedule({ schedule, locale }: { schedule: HomeSchedule; locale: Locale }) {
  const { practices, matches } = schedule
  if (practices.length === 0 && matches.length === 0) return null
  const t = locale === 'es' ? es : en

  return (
    <section className="py-8 px-4 bg-brand-cream border-t border-brand-line">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wider">{t.home.schedule.title}</h2>
          <Link href="/league" className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider underline">
            {t.home.schedule.fullSchedule} →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">
              {t.home.schedule.practiceScheduleTitle}
            </h3>
            {practices.length === 0 ? (
              <p className="text-brand-muted text-sm">{t.home.schedule.noPractices}</p>
            ) : (
              <div className="space-y-1.5">
                {practices.map(p => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-3 border border-brand-line rounded p-2.5 bg-brand-tint text-sm ${p.cancelled ? 'opacity-60' : ''}`}
                  >
                    <span className="font-bold text-brand-ink whitespace-nowrap flex-shrink-0">{formatDate(p.date, locale)}</span>
                    <span className="text-brand-muted flex-1 min-w-0 truncate">
                      {formatTime(p.time, locale)}{p.location ? ` · ${p.location}` : ''}
                    </span>
                    {p.cancelled && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex-shrink-0">{t.home.schedule.cancelled}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">
              {t.home.schedule.leagueScheduleTitle}
            </h3>
            <p className="text-brand-mutedWarm text-xs mb-2">{t.home.schedule.location}</p>
            {matches.length === 0 ? (
              <p className="text-brand-muted text-sm">{t.home.schedule.noMatches}</p>
            ) : (
              <div className="space-y-1.5">
                {matches.map(m => (
                  <div
                    key={m.id}
                    className={`flex items-center gap-2 border border-brand-line rounded p-2.5 bg-brand-tint text-sm ${m.cancelled ? 'opacity-60' : ''}`}
                  >
                    <span className="font-bold text-brand-ink whitespace-nowrap flex-shrink-0">{formatDate(m.date, locale)}</span>
                    <span className="font-mono tabular-nums text-xs text-brand-muted whitespace-nowrap flex-shrink-0">
                      {m.kickoff ? formatTime(m.kickoff, locale) : ''}
                    </span>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0 ${divisionPillClass(m.division)}`}>
                      {m.division}
                    </span>
                    <span className="text-brand-muted flex-1 min-w-0 truncate">
                      {m.homeTeam} <span className="text-brand-mutedWarm">v</span> {m.awayTeam}
                    </span>
                    {m.cancelled ? (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 flex-shrink-0">{t.home.schedule.cancelled}</span>
                    ) : m.homeScore !== null && m.awayScore !== null ? (
                      <span className="font-bold text-brand-ink flex-shrink-0">{m.homeScore}-{m.awayScore}</span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: only `src/app/page.tsx`'s error remains (still calling the deleted `getUpcomingSchedule` — fixed in Task 5), plus the 3 pre-existing gallery errors

- [ ] **Step 3: Commit**

```bash
git add src/components/upcoming-schedule.tsx
git commit -m "feat: render the homepage schedule as two side-by-side columns"
```

(No new component test — matches this component's established no-test precedent, confirmed in an earlier session.)

---

### Task 5: Wire `page.tsx` to `getHomeSchedule()`

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update the import and call**

Replace:
```ts
import { getUpcomingSchedule } from '@/app/actions/schedule'
```
with:
```ts
import { getHomeSchedule } from '@/app/actions/schedule'
```

Replace:
```ts
  const schedule = await getUpcomingSchedule()
```
with:
```ts
  const schedule = await getHomeSchedule()
```

Nothing else in this file changes — `<UpcomingSchedule schedule={schedule} locale={locale} />` already passes the whole object through, and the `export const dynamic = 'force-dynamic'` / `export const revalidate = 0` pair stay exactly as they are (same staleness concern applies identically to the new action).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (only the 3 pre-existing gallery errors)

- [ ] **Step 3: Run `npx next build`**

Expected: `✓ Compiled successfully`, no errors — this plan's chain of deliberately-mid-flight breakage (Task 2 → Task 4) is now fully resolved.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, visit `/`. If a real browser isn't available in this environment, at minimum confirm the page compiles and serves (`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/`, expect `200`) — same fallback used in the fixtures-calendar plan's equivalent steps.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: call getHomeSchedule from the homepage"
```

---

### Task 6: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the same 3 pre-existing, unrelated gallery test errors (`gallery-client.test.tsx` x2, `masonry-grid.test.tsx` x1, `submitter_name`)

- [ ] **Step 2: Lint the changed files**

Run: `npx eslint src/lib/league/fixture-calendar.ts src/lib/league/__tests__/fixture-calendar.test.ts src/components/league/fixture-calendar.tsx src/app/actions/schedule.ts src/app/actions/__tests__/schedule.test.ts src/lib/i18n/en.ts src/lib/i18n/es.ts src/components/upcoming-schedule.tsx src/app/page.tsx`
Expected: no output (clean) — if pre-existing unrelated lint errors show up in any of these files from before this plan started, note them as known/out-of-scope rather than treating them as new failures (cross-check against `git log` for that file, same approach used in the fixtures-calendar plan's Task 11)

- [ ] **Step 3: Full test suite**

Run: `npx jest`
Expected: all suites pass

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: "Compiled successfully"

- [ ] **Step 5: Confirm before pushing**

Per this session's established pattern, do not push to `origin/main` without explicit user confirmation, even though all local commits are already made per-task above. (No production database changes in this plan — pure code/i18n, nothing to migrate or import.)
