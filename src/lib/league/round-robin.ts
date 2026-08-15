export type RoundRobinFixture = { homeTeamId: string; awayTeamId: string; matchDate: string }

export type RoundRobinResult =
  | { ok: true; fixtures: RoundRobinFixture[] }
  | { ok: false; error: string }

const BYE = Symbol('bye')
type Seat = string | typeof BYE

/**
 * Standard "circle method" for a single round-robin: one team is held fixed,
 * the rest rotate around it once per round. Produces n-1 rounds for n teams.
 * If n is odd, a BYE seat is added (making the count even) — any pairing
 * involving BYE is simply dropped, which is exactly what a "bye round" means
 * for the team paired against it.
 */
function circleMethodSingleLeg(teamIds: string[]): { home: string; away: string }[][] {
  // For an odd count, the bye seat goes right after the first team, not at
  // the end. arr[0] never rotates (see below) and is always paired against
  // arr[n-1] — appending BYE at the end would put it there in round 0,
  // meaning the very first team in the input sits out the opening round. It
  // still gets exactly one bye somewhere in the cycle (required for
  // fairness), just not round 0.
  const seats: Seat[] = teamIds.length % 2 === 0 ? [...teamIds] : [teamIds[0], BYE, ...teamIds.slice(1)]
  const n = seats.length
  const rounds: { home: string; away: string }[][] = []
  const arr = [...seats]

  for (let round = 0; round < n - 1; round++) {
    const pairings: { home: string; away: string }[] = []
    for (let i = 0; i < n / 2; i++) {
      const t1 = arr[i]
      const t2 = arr[n - 1 - i]
      if (t1 !== BYE && t2 !== BYE) {
        // Alternate which side is "home" by round parity so a fixed team
        // (arr[0]) doesn't end up home every single round.
        pairings.push(round % 2 === 0 ? { home: t1, away: t2 } : { home: t2, away: t1 })
      }
    }
    rounds.push(pairings)

    // Rotate: keep arr[0] fixed, cycle everyone else by one seat.
    const fixed = arr[0]
    const rest = arr.slice(1)
    rest.unshift(rest.pop()!)
    arr.splice(0, arr.length, fixed, ...rest)
  }
  return rounds
}

// Every match is played on a Sunday, one round per week, with Saturday kept
// free as a fallback day for weather-postponed rearrangements rather than
// being used for originally-scheduled fixtures. Dates are computed in UTC
// (matching how match_date is displayed elsewhere) to avoid an off-by-one
// day shift depending on the server's local timezone.
function firstSundayOnOrAfter(date: Date): Date {
  const sunday = new Date(date)
  const daysUntilSunday = (7 - sunday.getUTCDay()) % 7
  sunday.setUTCDate(sunday.getUTCDate() + daysUntilSunday)
  return sunday
}

export function generateRoundRobin(
  teamIds: string[],
  startDate: string,
  endDate: string
): RoundRobinResult {
  if (teamIds.length < 2) return { ok: true, fixtures: [] }

  const leg1Rounds = circleMethodSingleLeg(teamIds)
  // Leg 2 is leg 1 with home/away reversed — guarantees every pairing
  // occurs exactly twice, once at each venue.
  const leg2Rounds = leg1Rounds.map(round => round.map(p => ({ home: p.away, away: p.home })))
  const allRounds = [...leg1Rounds, ...leg2Rounds]

  const firstSunday = firstSundayOnOrAfter(new Date(startDate))
  const end = new Date(endDate)

  const lastRoundDate = new Date(firstSunday)
  lastRoundDate.setUTCDate(lastRoundDate.getUTCDate() + 7 * (allRounds.length - 1))

  if (lastRoundDate > end) {
    return {
      ok: false,
      error: `Not enough Sundays between the start and end date to fit ${allRounds.length} rounds (one per week) — extend the season end date or reduce the number of teams.`,
    }
  }

  const fixtures: RoundRobinFixture[] = []
  allRounds.forEach((round, roundIndex) => {
    const roundDate = new Date(firstSunday)
    roundDate.setUTCDate(roundDate.getUTCDate() + 7 * roundIndex)
    const matchDate = roundDate.toISOString().slice(0, 10)
    round.forEach(pairing => {
      fixtures.push({ homeTeamId: pairing.home, awayTeamId: pairing.away, matchDate })
    })
  })

  return { ok: true, fixtures }
}
