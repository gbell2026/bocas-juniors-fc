import { computeStandings } from '../standings'

describe('computeStandings', () => {
  it('returns a zeroed row for every team when no fixtures have been played', () => {
    const rows = computeStandings(['a', 'b'], [])
    expect(rows).toHaveLength(2)
    expect(rows.every(r => r.played === 0 && r.points === 0)).toBe(true)
  })

  it('ignores fixtures with a null score (not yet played)', () => {
    const rows = computeStandings(['a', 'b'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: null, awayScore: null },
    ])
    expect(rows.every(r => r.played === 0)).toBe(true)
  })

  it('awards 3 points for a win and 0 for a loss', () => {
    const rows = computeStandings(['a', 'b'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 2, awayScore: 0 },
    ])
    const a = rows.find(r => r.teamId === 'a')!
    const b = rows.find(r => r.teamId === 'b')!
    expect(a).toMatchObject({ played: 1, won: 1, drawn: 0, lost: 0, points: 3, goalsFor: 2, goalsAgainst: 0, goalDifference: 2 })
    expect(b).toMatchObject({ played: 1, won: 0, drawn: 0, lost: 1, points: 0, goalsFor: 0, goalsAgainst: 2, goalDifference: -2 })
  })

  it('awards 1 point each for a draw', () => {
    const rows = computeStandings(['a', 'b'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 1 },
    ])
    expect(rows.every(r => r.points === 1 && r.drawn === 1)).toBe(true)
  })

  it('breaks a points tie using goal difference', () => {
    const rows = computeStandings(['a', 'b', 'c', 'd'], [
      // a: win 3-0 -> 3pts, GD +3
      { homeTeamId: 'a', awayTeamId: 'c', homeScore: 3, awayScore: 0 },
      // b: win 1-0 -> 3pts, GD +1 -- same points as a, worse GD
      { homeTeamId: 'b', awayTeamId: 'd', homeScore: 1, awayScore: 0 },
    ])
    const sortedIds = rows.filter(r => r.teamId === 'a' || r.teamId === 'b').map(r => r.teamId)
    expect(sortedIds).toEqual(['a', 'b'])
  })

  it('breaks a points-and-goal-difference tie using goals scored', () => {
    const rows = computeStandings(['a', 'b', 'c', 'd'], [
      // a: win 3-1 -> 3pts, GD +2, GF 3
      { homeTeamId: 'a', awayTeamId: 'c', homeScore: 3, awayScore: 1 },
      // b: win 2-0 -> 3pts, GD +2, GF 2 -- same points and GD as a, fewer goals scored
      { homeTeamId: 'b', awayTeamId: 'd', homeScore: 2, awayScore: 0 },
    ])
    const sortedIds = rows.filter(r => r.teamId === 'a' || r.teamId === 'b').map(r => r.teamId)
    expect(sortedIds).toEqual(['a', 'b'])
  })

  it('accumulates stats correctly across multiple fixtures for the same team', () => {
    const rows = computeStandings(['a', 'b', 'c'], [
      { homeTeamId: 'a', awayTeamId: 'b', homeScore: 1, awayScore: 1 },
      { homeTeamId: 'a', awayTeamId: 'c', homeScore: 2, awayScore: 0 },
    ])
    const a = rows.find(r => r.teamId === 'a')!
    expect(a).toMatchObject({ played: 2, won: 1, drawn: 1, lost: 0, points: 4, goalsFor: 3, goalsAgainst: 1, goalDifference: 2 })
  })
})
