export type StandingsRow = {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  // Sum of any administrative points adjustments (e.g. a disciplinary
  // deduction) already folded into `points` above — kept separate too so
  // callers can show "18 (-4)" rather than just the opaque total.
  adjustmentPoints: number
}

export type FixtureResult = {
  homeTeamId: string
  awayTeamId: string
  homeScore: number | null
  awayScore: number | null
}

export type PointsAdjustment = {
  teamId: string
  points: number
}

function emptyRow(teamId: string): StandingsRow {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, adjustmentPoints: 0 }
}

export function computeStandings(
  teamIds: string[],
  fixtures: FixtureResult[],
  adjustments: PointsAdjustment[] = []
): StandingsRow[] {
  const rows = new Map(teamIds.map(id => [id, emptyRow(id)]))

  for (const fx of fixtures) {
    if (fx.homeScore === null || fx.awayScore === null) continue
    const home = rows.get(fx.homeTeamId)
    const away = rows.get(fx.awayTeamId)
    if (!home || !away) continue

    home.played++
    away.played++
    home.goalsFor += fx.homeScore
    home.goalsAgainst += fx.awayScore
    away.goalsFor += fx.awayScore
    away.goalsAgainst += fx.homeScore

    if (fx.homeScore > fx.awayScore) {
      home.won++
      home.points += 3
      away.lost++
    } else if (fx.homeScore < fx.awayScore) {
      away.won++
      away.points += 3
      home.lost++
    } else {
      home.drawn++
      away.drawn++
      home.points += 1
      away.points += 1
    }
  }

  for (const adj of adjustments) {
    const row = rows.get(adj.teamId)
    if (!row) continue
    row.adjustmentPoints += adj.points
    row.points += adj.points
  }

  const result = Array.from(rows.values()).map(r => ({ ...r, goalDifference: r.goalsFor - r.goalsAgainst }))
  result.sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor)
  return result
}
