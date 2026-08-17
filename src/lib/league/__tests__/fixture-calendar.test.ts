import { buildFixtureCalendar, shortDivisionLabel, type CalendarMatch } from '../fixture-calendar'

function match(overrides: Partial<CalendarMatch> = {}): CalendarMatch {
  return {
    id: 'fx-1',
    matchDate: '2026-09-06',
    division: 'U10',
    kickoff: '09:00',
    homeTeam: 'Team A',
    awayTeam: 'Team B',
    homeScore: null,
    awayScore: null,
    cancelled: false,
    isHomeClubMatch: false,
    ...overrides,
  }
}

describe('buildFixtureCalendar', () => {
  it('marks a Sunday with no fixtures as a rest day', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-20', [
      match({ id: 'fx-1', matchDate: '2026-09-06' }),
      match({ id: 'fx-2', matchDate: '2026-09-20' }),
    ])
    expect(days.map(d => d.date)).toEqual(['2026-09-06', '2026-09-13', '2026-09-20'])
    expect(days[1]).toEqual({ date: '2026-09-13', rest: true })
  })

  it('derives firstDivision from the earliest-kickoff match that day', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-06', [
      match({ id: 'fx-1', division: 'U10', kickoff: '11:00' }),
      match({ id: 'fx-2', division: 'U14', kickoff: '09:00' }),
    ])
    expect(days[0]).toMatchObject({ rest: false, firstDivision: 'U14' })
  })

  it('sorts matches by kickoff, with a null kickoff last', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-06', [
      match({ id: 'fx-1', kickoff: '11:00' }),
      match({ id: 'fx-2', kickoff: null }),
      match({ id: 'fx-3', kickoff: '09:00' }),
    ])
    expect(days[0].rest).toBe(false)
    if (!days[0].rest) {
      expect(days[0].matches.map(m => m.id)).toEqual(['fx-3', 'fx-1', 'fx-2'])
    }
  })

  it('preserves isHomeClubMatch through to the output without recomputing it', () => {
    const days = buildFixtureCalendar('2026-09-06', '2026-09-06', [
      match({ id: 'fx-1', isHomeClubMatch: true }),
      match({ id: 'fx-2', isHomeClubMatch: false }),
    ])
    expect(days[0].rest).toBe(false)
    if (!days[0].rest) {
      expect(days[0].matches.find(m => m.id === 'fx-1')?.isHomeClubMatch).toBe(true)
      expect(days[0].matches.find(m => m.id === 'fx-2')?.isHomeClubMatch).toBe(false)
    }
  })
})

describe('shortDivisionLabel', () => {
  it('takes the leading token of the division name', () => {
    expect(shortDivisionLabel('U10 (as of Jan 2027)')).toBe('U10')
    expect(shortDivisionLabel('U14')).toBe('U14')
  })
})
