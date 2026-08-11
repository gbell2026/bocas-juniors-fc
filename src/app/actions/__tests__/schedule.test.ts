jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { getUpcomingSchedule } from '../schedule'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  in: jest.fn(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

/**
 * getUpcomingSchedule's calls, in exact order, per mock function (each
 * mock function has its own independent FIFO queue):
 *
 *   gte():   [chainable: practices]      [chainable: fixtures]        -- both always chainable (default), no queueing needed
 *   order(): [chainable: practices #1]   [TERMINAL: practices #2]     [TERMINAL: fixtures]
 *   eq():    [chainable: league_clubs.name -> .single()]  [TERMINAL: league_teams.club_id -> homeTeams]
 *   single(): [TERMINAL: league_clubs lookup]
 *   in():    [TERMINAL: opponent team names]  -- only called if there are relevant fixtures
 */
function queuePractices(rows: any[]) {
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // practices .order('practice_date', ...)
    .mockResolvedValueOnce({ data: rows, error: null }) // practices .order('practice_time', ...) TERMINAL
}

function queueNoHomeClub() {
  mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }) // league_clubs lookup -> not found
}

function queueHomeClubWithNoTeams(clubId = 'club-1') {
  mockSupabase.single.mockResolvedValueOnce({ data: { id: clubId }, error: null })
  ;(mockSupabase.eq as jest.Mock)
    .mockImplementationOnce(() => mockSupabase) // league_clubs .eq('name', ...) -> chainable to .single()
    .mockImplementationOnce(() => Promise.resolve({ data: [], error: null })) // league_teams .eq('club_id', ...) TERMINAL, no teams
}

function queueHomeClubWithFixtures(homeTeamIds: string[], fixtureRows: any[], opponentTeams: { id: string; name: string }[]) {
  mockSupabase.single.mockResolvedValueOnce({ data: { id: 'club-1' }, error: null })
  ;(mockSupabase.eq as jest.Mock)
    .mockImplementationOnce(() => mockSupabase) // league_clubs .eq('name', ...) -> chainable
    .mockImplementationOnce(() => Promise.resolve({ data: homeTeamIds.map(id => ({ id })), error: null })) // league_teams .eq('club_id', ...) TERMINAL
  mockSupabase.order.mockResolvedValueOnce({ data: fixtureRows, error: null }) // league_fixtures .order(...) TERMINAL
  if (opponentTeams.length > 0) {
    mockSupabase.in.mockResolvedValueOnce({ data: opponentTeams, error: null })
  }
}

it('returns an empty list when there are no practices and no home club found', async () => {
  queuePractices([])
  queueNoHomeClub()

  const result = await getUpcomingSchedule()
  expect(result).toEqual([])
})

it('returns practices when the home club has no registered teams', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
    location: 'Field A', notes: null, cancelled: false,
  }])
  queueHomeClubWithNoTeams()

  const result = await getUpcomingSchedule()
  expect(result).toEqual([
    { type: 'practice', id: 'p1', date: '2026-08-18', time: '17:00:00', location: 'Field A', notes: null, cancelled: false },
  ])
})

it('combines practices and matches, sorted together by date', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-20', practice_time: '17:00:00',
    location: 'Field A', notes: null, cancelled: false,
  }])
  // team-home is our team; the fixture is on an earlier date than the practice
  queueHomeClubWithFixtures(
    ['team-home'],
    [{ id: 'fx1', match_date: '2026-08-15', home_team_id: 'team-home', away_team_id: 'team-away', home_score: null, away_score: null, cancelled: false }],
    [{ id: 'team-away', name: 'Rival FC' }]
  )

  const result = await getUpcomingSchedule()
  expect(result).toEqual([
    { type: 'match', id: 'fx1', date: '2026-08-15', opponent: 'Rival FC', isHome: true, cancelled: false, homeScore: null, awayScore: null },
    { type: 'practice', id: 'p1', date: '2026-08-20', time: '17:00:00', location: 'Field A', notes: null, cancelled: false },
  ])
})

it('resolves the opponent correctly when our team is the away side', async () => {
  queuePractices([])
  queueHomeClubWithFixtures(
    ['team-home'],
    [{ id: 'fx1', match_date: '2026-08-15', home_team_id: 'team-away', away_team_id: 'team-home', home_score: 2, away_score: 1, cancelled: false }],
    [{ id: 'team-away', name: 'Rival FC' }]
  )

  const result = await getUpcomingSchedule()
  expect(result).toEqual([
    { type: 'match', id: 'fx1', date: '2026-08-15', opponent: 'Rival FC', isHome: false, cancelled: false, homeScore: 2, awayScore: 1 },
  ])
})

it('includes cancelled practices and matches rather than filtering them out', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
    location: null, notes: 'Rained out', cancelled: true,
  }])
  queueHomeClubWithFixtures(
    ['team-home'],
    [{ id: 'fx1', match_date: '2026-08-20', home_team_id: 'team-home', away_team_id: 'team-away', home_score: null, away_score: null, cancelled: true }],
    [{ id: 'team-away', name: 'Rival FC' }]
  )

  const result = await getUpcomingSchedule()
  expect(result.every(r => r.cancelled)).toBe(true)
})

it('respects the limit after combining and sorting', async () => {
  queuePractices([
    { id: 'p1', practice_date: '2026-08-16', practice_time: '17:00:00', location: null, notes: null, cancelled: false },
    { id: 'p2', practice_date: '2026-08-18', practice_time: '17:00:00', location: null, notes: null, cancelled: false },
  ])
  queueHomeClubWithFixtures(
    ['team-home'],
    [{ id: 'fx1', match_date: '2026-08-17', home_team_id: 'team-home', away_team_id: 'team-away', home_score: null, away_score: null, cancelled: false }],
    [{ id: 'team-away', name: 'Rival FC' }]
  )

  const result = await getUpcomingSchedule(2)
  expect(result).toHaveLength(2)
  expect(result.map(r => r.id)).toEqual(['p1', 'fx1'])
})
