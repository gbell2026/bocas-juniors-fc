# Fixtures Calendar & Kickoff Times — Design Spec

**Date:** 2026-08-16
**Status:** Approved

## Background

The League's Fixtures tab (`FixturesList`) currently shows a flat, per-division list of matches grouped by date, with no kickoff time (the schema only stores a date). The 2026 autumn season's fixtures were generated externally (per the handoff spec from an earlier session) as a CSV/JSON, along with a design for an interactive calendar UI — a date-strip of Sundays plus a day panel showing that day's matches across both divisions together, since most clubs field a team in both age groups and travel once per weekend. This spec covers importing that season's fixtures and replacing the Fixtures tab with the calendar.

## Scope

**This build:**
- Add a `kickoff` time column to `league_fixtures`
- Add the new U14 team "Loma Espina" (and its club) ahead of import
- One-off import of the 50-fixture 2026 season (20 U10, 30 U14) from the provided CSV
- New pure `fixture-calendar` lib function + action wrapper, replacing per-division `getFixtures` for the Fixtures tab
- New `FixtureCalendar` component (date-strip + day-panel) replacing `FixturesList` on the Fixtures tab
- Kickoff time input added to the admin fixture editor, for parity with the existing date editor

**Explicitly out of scope:**
- Homepage "Upcoming Schedule" widget — does not gain kickoff time display in this pass
- A general-purpose CSV import feature — the import is a one-off script, not a UI
- Colour/dark-mode theming beyond what the site already has (the site has no dark mode; confirmed by reading `tailwind.config.ts`, superseding a stale memory that claimed otherwise)

## Data model changes

```sql
alter table league_fixtures add column kickoff time;
```

Nullable — existing fixtures (and any future fixture added without a specified time, e.g. via the admin "Add Fixture Manually" form if left blank) remain valid. All 50 imported fixtures will have a kickoff set.

New team: club **"Loma Espina"** (status `approved`) with a single U14 team of the same name — same one-club-one-team modeling already used for "Atletico Bastimentos FC".

## Import

A temporary script (same throwaway pattern used for prior schedule generation this session — run once via `ts-node` against the service-role client, then deleted, never committed) that:
1. Reads the provided CSV
2. Substitutes "Loma Espina" for every occurrence of "Pino Espina"
3. Resolves `(division, team name)` to `team_id` via a lookup against `league_teams`
4. Inserts all 50 rows into `league_fixtures` with `division_id`, `home_team_id`, `away_team_id`, `match_date`, `kickoff`

Runs only after the current (empty) `league_fixtures` table is confirmed empty, and after the kickoff column migration and the Loma Espina team both exist.

## `fixture-calendar` — pure function

New file `src/lib/league/fixture-calendar.ts`, unit-tested in isolation (mirrors how `computeStandings` is a pure function wrapped by a thin action):

```ts
type CalendarMatch = {
  id: string
  division: string       // division name, e.g. "U10"
  kickoff: string | null // "HH:MM" or null if unset
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  cancelled: boolean
  isHomeClubMatch: boolean // either side is "Tangerine Toucans" — drives the star marker
}

type CalendarDay =
  | { date: string; rest: true }
  | { date: string; rest: false; firstDivision: string; matches: CalendarMatch[] }

function buildFixtureCalendar(
  seasonStart: string,
  seasonEnd: string,
  fixtures: CalendarMatch[] & { date: string }[] // fixtures tagged with their match_date
): CalendarDay[]
```

Behaviour:
- Enumerates every Sunday from `seasonStart` to `seasonEnd` inclusive, in order.
- A Sunday with no fixtures is a rest day (`rest: true`).
- A playing Sunday's `matches` are sorted by `kickoff` (nulls last).
- `firstDivision` is the division of the earliest-kickoff match that day (derived, not stored — matches the "recompute rather than trust" note from the handoff doc).
- `seasonStart`/`seasonEnd` come from the union of both divisions' `league_divisions` date range (currently identical for U10 and U14, but the function takes explicit bounds rather than assuming that).

Test cases: rest-week detection between playing Sundays, `firstDivision` derivation when divisions alternate, kickoff sort order including a null-kickoff fixture, and the Tangerine Toucans star flag on both a home and an away match.

## Action wrapper

New `getFixtureCalendar()` in `src/app/actions/league.ts`: loads both divisions' date ranges, loads all fixtures across both divisions joined to team names, tags each with `isHomeClubMatch` (same `'Tangerine Toucans'` name-match already used as `HOME_CLUB_NAME` in `schedule.ts`), and calls `buildFixtureCalendar`.

## `FixtureCalendar` component

Replaces `<FixturesList divisionId={divisionId} />` on the Fixtures tab. Since it spans both divisions, the Fixtures tab no longer uses the page's division selector (that selector still applies to the Table tab).

- **Date strip**: horizontal wrapping grid of Sunday tiles (min-width ~66px), each showing short date + match count or "rest". Click to select; selected tile gets an accent border/tint. Default selection: the nearest upcoming Sunday (today or later); once the season has ended, falls back to the last Sunday.
- **Day panel — playing day**: long-form date header + a small "U10 first" / "U14 first" tag; one row per match with kickoff time (tabular-nums, fixed min-width), a division pill, `Home v Away`, and a star after the fixture text for any match involving Tangerine Toucans.
- **Day panel — rest day**: centered empty state — icon, "Rest week" (translated), the long date, and a note that Saturday stays free for weather rearrangements.
- **Colours**: division pills reuse the site's existing pill convention (`bg-brand-primary` / `bg-brand-ink`, white text) already used for practice/match pills in `UpcomingSchedule` — no new brand colours introduced.
- All new UI copy (tag labels, rest-week text, legend) added to both `en.ts` and `es.ts` under `t.league.calendar.*`.

## Admin fixture editor

`league-fixtures-admin.tsx` gains a `kickoff` time input next to the existing `matchDate` date input, wired through `updateFixture`/`addFixture` (both actions gain an optional `kickoff` field).

## Testing

- TDD for `fixture-calendar.ts` (pure function, see cases above)
- `getFixtureCalendar` covered at the action level the same way `getFixtures`/`getStandings` already are
- i18n: new `t.league.calendar.*` keys added to both `en.ts` and `es.ts` in the same commit, keeping `satisfies typeof en` sync intact
- Existing `FixturesList`/its test are deleted along with the component, since nothing else references it
