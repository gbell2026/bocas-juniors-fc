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

// Same U10/everything-else split used for the calendar's division pills and
// the homepage's League Schedule column — one shared mapping so both stay
// visually consistent.
export function divisionPillClass(division: string): string {
  return division === 'U10' ? 'bg-brand-primary text-white' : 'bg-brand-ink text-white'
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
