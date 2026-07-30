export type RoundRobinFixture = { homeTeamId: string; awayTeamId: string; matchDate: string }

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
  const seats: Seat[] = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE]
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

export function generateRoundRobin(
  teamIds: string[],
  startDate: string,
  endDate: string
): RoundRobinFixture[] {
  if (teamIds.length < 2) return []

  const leg1Rounds = circleMethodSingleLeg(teamIds)
  // Leg 2 is leg 1 with home/away reversed — guarantees every pairing
  // occurs exactly twice, once at each venue.
  const leg2Rounds = leg1Rounds.map(round => round.map(p => ({ home: p.away, away: p.home })))
  const allRounds = [...leg1Rounds, ...leg2Rounds]

  const start = new Date(startDate)
  const end = new Date(endDate)
  const totalMs = end.getTime() - start.getTime()
  const stepMs = allRounds.length > 1 ? totalMs / (allRounds.length - 1) : 0

  const fixtures: RoundRobinFixture[] = []
  allRounds.forEach((round, roundIndex) => {
    const roundDate = new Date(start.getTime() + stepMs * roundIndex)
    const matchDate = roundDate.toISOString().slice(0, 10)
    round.forEach(pairing => {
      fixtures.push({ homeTeamId: pairing.home, awayTeamId: pairing.away, matchDate })
    })
  })

  return fixtures
}
