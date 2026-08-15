import { generateRoundRobin } from '../round-robin'

describe('generateRoundRobin', () => {
  it('returns no fixtures for fewer than 2 teams', () => {
    expect(generateRoundRobin([], '2026-08-01', '2026-11-01')).toEqual({ ok: true, fixtures: [] })
    expect(generateRoundRobin(['a'], '2026-08-01', '2026-11-01')).toEqual({ ok: true, fixtures: [] })
  })

  it('generates exactly 2 fixtures (home and away) for 2 teams', () => {
    const result = generateRoundRobin(['a', 'b'], '2026-08-01', '2026-08-31')
    if (!result.ok) throw new Error('expected ok result')
    expect(result.fixtures).toHaveLength(2)
    expect(result.fixtures).toContainEqual(expect.objectContaining({ homeTeamId: 'a', awayTeamId: 'b' }))
    expect(result.fixtures).toContainEqual(expect.objectContaining({ homeTeamId: 'b', awayTeamId: 'a' }))
  })

  it('generates n*(n-1) total fixtures for n teams (double round-robin)', () => {
    const teams = ['a', 'b', 'c', 'd']
    const result = generateRoundRobin(teams, '2026-08-01', '2026-12-01')
    if (!result.ok) throw new Error('expected ok result')
    expect(result.fixtures).toHaveLength(4 * 3) // 12
  })

  it('has each team play every other team exactly twice, once home once away', () => {
    const teams = ['a', 'b', 'c', 'd']
    const result = generateRoundRobin(teams, '2026-08-01', '2026-12-01')
    if (!result.ok) throw new Error('expected ok result')
    for (const t1 of teams) {
      for (const t2 of teams) {
        if (t1 === t2) continue
        const homeCount = result.fixtures.filter(f => f.homeTeamId === t1 && f.awayTeamId === t2).length
        expect(homeCount).toBe(1)
      }
    }
  })

  it('handles an odd number of teams correctly (byes produce no fixture)', () => {
    const teams = ['a', 'b', 'c']
    const result = generateRoundRobin(teams, '2026-08-01', '2026-11-01')
    if (!result.ok) throw new Error('expected ok result')
    expect(result.fixtures).toHaveLength(3 * 2) // 6 — each of 3 teams plays the other 2, home and away
    for (const f of result.fixtures) {
      expect(teams).toContain(f.homeTeamId)
      expect(teams).toContain(f.awayTeamId)
    }
  })

  it('schedules every match on a Sunday', () => {
    const result = generateRoundRobin(['a', 'b', 'c', 'd'], '2026-08-01', '2026-12-01')
    if (!result.ok) throw new Error('expected ok result')
    for (const f of result.fixtures) {
      const weekday = new Date(`${f.matchDate}T00:00:00Z`).getUTCDay()
      expect(weekday).toBe(0)
    }
  })

  it('schedules one round per week, starting on the first Sunday on/after the start date', () => {
    // 2026-08-01 is a Saturday; the first available Sunday is 2026-08-02
    const result = generateRoundRobin(['a', 'b'], '2026-08-01', '2026-08-31')
    if (!result.ok) throw new Error('expected ok result')
    expect(result.fixtures.map(f => f.matchDate).sort()).toEqual(['2026-08-02', '2026-08-09'])
  })

  it('starts on the start date itself when it already falls on a Sunday', () => {
    // 2026-08-02 is already a Sunday
    const result = generateRoundRobin(['a', 'b'], '2026-08-02', '2026-08-31')
    if (!result.ok) throw new Error('expected ok result')
    expect(result.fixtures.map(f => f.matchDate).sort()).toEqual(['2026-08-02', '2026-08-09'])
  })

  it('returns an error instead of fixtures when there are not enough Sundays before the end date', () => {
    // 4 teams need 6 rounds (6 Sundays); the window 2026-08-01..2026-08-15 only contains 2
    const result = generateRoundRobin(['a', 'b', 'c', 'd'], '2026-08-01', '2026-08-15')
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected error result')
    expect(result.error).toBeTruthy()
  })

  it('every fixture has a valid ISO date string', () => {
    const result = generateRoundRobin(['a', 'b'], '2026-08-01', '2026-08-15')
    if (!result.ok) throw new Error('expected ok result')
    for (const f of result.fixtures) {
      expect(f.matchDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
