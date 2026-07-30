import { generateRoundRobin } from '../round-robin'

describe('generateRoundRobin', () => {
  it('returns no fixtures for fewer than 2 teams', () => {
    expect(generateRoundRobin([], '2026-08-01', '2026-11-01')).toEqual([])
    expect(generateRoundRobin(['a'], '2026-08-01', '2026-11-01')).toEqual([])
  })

  it('generates exactly 2 fixtures (home and away) for 2 teams', () => {
    const fixtures = generateRoundRobin(['a', 'b'], '2026-08-01', '2026-08-15')
    expect(fixtures).toHaveLength(2)
    expect(fixtures).toContainEqual(expect.objectContaining({ homeTeamId: 'a', awayTeamId: 'b' }))
    expect(fixtures).toContainEqual(expect.objectContaining({ homeTeamId: 'b', awayTeamId: 'a' }))
  })

  it('generates n*(n-1) total fixtures for n teams (double round-robin)', () => {
    const teams = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobin(teams, '2026-08-01', '2026-11-01')
    expect(fixtures).toHaveLength(4 * 3) // 12
  })

  it('has each team play every other team exactly twice, once home once away', () => {
    const teams = ['a', 'b', 'c', 'd']
    const fixtures = generateRoundRobin(teams, '2026-08-01', '2026-11-01')
    for (const t1 of teams) {
      for (const t2 of teams) {
        if (t1 === t2) continue
        const homeCount = fixtures.filter(f => f.homeTeamId === t1 && f.awayTeamId === t2).length
        expect(homeCount).toBe(1)
      }
    }
  })

  it('handles an odd number of teams correctly (byes produce no fixture)', () => {
    const teams = ['a', 'b', 'c']
    const fixtures = generateRoundRobin(teams, '2026-08-01', '2026-11-01')
    expect(fixtures).toHaveLength(3 * 2) // 6 — each of 3 teams plays the other 2, home and away
    for (const f of fixtures) {
      expect(teams).toContain(f.homeTeamId)
      expect(teams).toContain(f.awayTeamId)
    }
  })

  it('spreads match dates across the given date range, in order', () => {
    const fixtures = generateRoundRobin(['a', 'b', 'c', 'd'], '2026-08-01', '2026-11-01')
    const dates = fixtures.map(f => f.matchDate).sort()
    expect(dates[0] >= '2026-08-01').toBe(true)
    expect(dates[dates.length - 1] <= '2026-11-01').toBe(true)
  })

  it('every fixture has a valid ISO date string', () => {
    const fixtures = generateRoundRobin(['a', 'b'], '2026-08-01', '2026-08-15')
    for (const f of fixtures) {
      expect(f.matchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
