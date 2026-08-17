# Homepage Schedule Split — Design Spec

**Date:** 2026-08-17
**Status:** Approved

## Background

The homepage's "Upcoming Schedule" section currently shows one combined, date-sorted feed of practices and Tangerine Toucans' own league matches (via `getUpcomingSchedule()` / `ScheduleEntry`), capped at 5 items total. This replaces it with two independent, side-by-side columns — Practice Schedule and League Schedule — where League Schedule shows every league match (all clubs, both divisions), not just the home club's, each showing its age group and location.

## Scope

**This build:**
- Split the homepage schedule into two columns: Practice Schedule (practices in the next 14 days) and League Schedule (all league matches, any club, in the next 7 days)
- League Schedule rows show: date, kickoff time, division ("U10"/"U14"), home team, away team, and score/cancelled status if applicable
- League matches all share one fixed location, **"Airport Field"**, shown once as a subtitle under the "League Schedule" heading rather than repeated on every row (every league match happens at the same venue, so per-row repetition would be redundant clutter)
- Replace `getUpcomingSchedule()`/`ScheduleEntry` with a new action returning the two feeds separately
- Remove now-unused i18n keys (`practice`, `match`, `vs`, `at` type/opponent labels), add new ones for the two column headings, empty states, and the location subtitle

**Explicitly out of scope:**
- A dedicated public page for practices (none exists today; "Full Schedule →" continues to link only to `/league`, which has the full match calendar)
- Making the match location a real per-fixture/venue data field — it's a fixed constant for now, matching how the user described it ("league matches are at the airport")
- Any change to `/league`'s own fixture calendar (Fixtures tab) — this is homepage-only

## Data layer

Replace `getUpcomingSchedule()` and `ScheduleEntry` in `src/app/actions/schedule.ts` with:

```ts
export type PracticeScheduleEntry = {
  id: string; date: string; time: string; location: string | null; notes: string | null; cancelled: boolean
}

export type LeagueMatchScheduleEntry = {
  id: string; date: string; kickoff: string | null; division: string
  homeTeam: string; awayTeam: string; cancelled: boolean
  homeScore: number | null; awayScore: number | null
}

export type HomeSchedule = { practices: PracticeScheduleEntry[]; matches: LeagueMatchScheduleEntry[] }

export async function getHomeSchedule(): Promise<HomeSchedule>
```

- **Practices**: same query pattern as today (`practices` table, `gte practice_date today`), narrowed with `lt practice_date (today + 14 days)`, ordered by date then time.
- **Matches**: `league_fixtures` for **every** team (no home-club filtering — `getUpcomingHomeClubMatches`'s club/team lookup goes away entirely for this path), `gte match_date today`, `lt match_date (today + 7 days)`, ordered by date then kickoff. Each row is joined to its two team names and its division's short label via the existing `shortDivisionLabel` helper (`src/lib/league/fixture-calendar.ts`) — reused here rather than reimplemented, same as it already is in `getFixtureCalendar()`.
- `kickoff` is normalized `HH:MM:SS` → `HH:MM` the same way every other consumer of this column already does (`getFixtureCalendar`, `getFixturesForAdmin`, the old `getUpcomingHomeClubMatches`).
- `HOME_CLUB_NAME` (`src/lib/league/home-club.ts`) is no longer used by this file once the home-club filtering is removed — confirm nothing else in `schedule.ts` still needs it before removing the import.

**Small shared refactor:** `divisionPillClass` (U10 → `bg-brand-primary`, else `bg-brand-ink`) currently lives as a private helper inside `src/components/league/fixture-calendar.tsx`. Since the new homepage component needs the identical mapping, export it from `src/lib/league/fixture-calendar.ts` (alongside the already-exported `shortDivisionLabel`) and have both `fixture-calendar.tsx` and the new homepage component import it from there, rather than duplicating the two-line function.

`src/app/page.tsx` updates its call from `getUpcomingSchedule()` to `getHomeSchedule()` and passes the resulting `HomeSchedule` object into `UpcomingSchedule` — its `force-dynamic`/`revalidate = 0` exports need no change, since the reason for them (avoiding a stale cached schedule) applies identically to the new action.

## Component

`src/components/upcoming-schedule.tsx` (`UpcomingSchedule`) changes from a single flat list to a two-column layout:

- Section-level heading/link stays as-is: `t.home.schedule.title` ("Upcoming Schedule") + "Full Schedule →" link to `/league`.
- Below that, a responsive grid: two columns side by side on desktop (`md:grid-cols-2`), stacked on mobile (`grid-cols-1`) — same breakpoint convention already used elsewhere on the site.
- **Practice Schedule column**: heading `t.home.schedule.practiceScheduleTitle`. Each row: date, time, location/notes — same visual shape as today's practice rows, just without the "PRACTICE" type pill (redundant now that the whole column is practices). Empty state: a small muted `t.home.schedule.noPractices` message instead of the row list.
- **League Schedule column**: heading `t.home.schedule.leagueScheduleTitle`, with a muted subtitle line showing `t.home.schedule.location` ("Airport Field"). Each row: date, kickoff time, a division pill (via the newly-exported `divisionPillClass`), then `homeTeam v awayTeam` (plain "v" separator, matching the existing untranslated convention in `fixture-calendar.tsx` — no `vs`/`at` distinction needed anymore since there's no "us" perspective), then a trailing score (if played) or "Cancelled" tag (reusing `t.home.schedule.cancelled`). Empty state: `t.home.schedule.noMatches`.
- The section as a whole no longer returns `null` when everything is empty — it returns `null` only if **both** feeds are empty (mirroring today's overall behavior for the fully-empty case), but renders normally with one column showing its empty-state message if only one feed has items in its window. This matches the approved design: an empty-one/full-other split is now a normal, expected state given the two feeds have independent windows.

## i18n

In both `src/lib/i18n/en.ts` and `es.ts`, under `home.schedule`:

Remove (no longer referenced by anything after this change — confirm via grep before deleting): `practice`, `match`, `vs`, `at`.

Add:
```ts
practiceScheduleTitle: 'Practice Schedule',
leagueScheduleTitle: 'League Schedule',
location: 'Airport Field',
noPractices: 'No practices in the next two weeks.',
noMatches: 'No matches in the next week.',
```
(`title`, `fullSchedule`, `cancelled` are unchanged and stay.)

Spanish equivalents follow the same keys, natural (not literal) translations, consistent with the rest of `es.ts`.

## Testing

- TDD on `getHomeSchedule()` in a rewritten `src/app/actions/__tests__/schedule.test.ts`: 14-day practice window boundary, 7-day match window boundary, matches from clubs other than Tangerine Toucans are included (this is the core behavior change — the old tests only ever asserted home-club fixtures), division label shortening, kickoff normalization.
- `shortDivisionLabel`/`divisionPillClass` already have coverage (or will, for the newly-exported `divisionPillClass`) in `src/lib/league/__tests__/fixture-calendar.test.ts` — add one small test case there for `divisionPillClass` if it doesn't already exist.
- No new component test for `upcoming-schedule.tsx`, consistent with its established no-test precedent (confirmed with the user in an earlier session).
