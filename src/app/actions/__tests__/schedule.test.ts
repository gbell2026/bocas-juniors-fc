jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { getHomeSchedule } from '../schedule'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  in: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

/**
 * getHomeSchedule's calls, in exact order, per mock function (each mock
 * function has its own independent FIFO queue — see the "mock queue
 * ordering" note below for why every call must be explicitly queued):
 *
 *   select(): [1: practices, chainable->gte]  [2: fixtures, chainable->gte]
 *             [3: divisions, TERMINAL]        [4: teams, chainable->in]
 *   gte():    always chainable (practices, fixtures) — default mockReturnThis covers both, no queueing needed
 *   lt():     always chainable (practices, fixtures) — default mockReturnThis covers both, no queueing needed
 *   order():  [1: practices practice_date, chainable] [2: practices practice_time, TERMINAL]
 *             [3: fixtures match_date, chainable]     [4: fixtures kickoff, TERMINAL]
 *   in():     [1: teams, TERMINAL] — only called if there's at least one fixture in the window
 *
 * If there are zero fixtures in the window, getUpcomingLeagueMatches returns
 * early right after fixtures' order() call — select() calls 3/4 and in()
 * never happen, so tests for that case must NOT queue values for them (an
 * unconsumed queued value is harmless, but queuing too FEW for a call that
 * DOES happen is the actual bug to avoid — see queueMatches below).
 */

function queuePractices(rows: any[]) {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 1: practices select('*') -> chainable
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // 1: practices order('practice_date') -> chainable
    .mockResolvedValueOnce({ data: rows, error: null }) // 2: practices order('practice_time') -> TERMINAL
}

function queueNoMatches() {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 2: fixtures select('*') -> chainable
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // 3: fixtures order('match_date') -> chainable
    .mockResolvedValueOnce({ data: [], error: null }) // 4: fixtures order('kickoff') -> TERMINAL, empty -> early return
}

function queueMatches(fixtureRows: any[], divisions: { id: string; name: string }[], teams: { id: string; name: string }[]) {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 2: fixtures select('*') -> chainable
  mockSupabase.order
    .mockReturnValueOnce(mockSupabase) // 3: fixtures order('match_date') -> chainable
    .mockResolvedValueOnce({ data: fixtureRows, error: null }) // 4: fixtures order('kickoff') -> TERMINAL
  mockSupabase.select.mockResolvedValueOnce({ data: divisions, error: null }) // 3: divisions select('id, name') -> TERMINAL
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 4: teams select('id, name') -> chainable, then .in()
  mockSupabase.in.mockResolvedValueOnce({ data: teams, error: null }) // teams .in() -> TERMINAL
}

it('returns empty practices and matches when nothing is scheduled', async () => {
  queuePractices([])
  queueNoMatches()

  const result = await getHomeSchedule()
  expect(result).toEqual({ practices: [], matches: [] })
})

it('maps practices within the window', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
    location: 'Field A', notes: null, cancelled: false,
  }])
  queueNoMatches()

  const result = await getHomeSchedule()
  expect(result.practices).toEqual([
    { id: 'p1', date: '2026-08-18', time: '17:00:00', location: 'Field A', notes: null, cancelled: false },
  ])
})

it('includes matches from clubs other than the home club, unlike the old home-club-only feed', async () => {
  queuePractices([])
  queueMatches(
    [{
      id: 'fx1', match_date: '2026-08-20', kickoff: '10:00:00',
      division_id: 'div-u10', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, cancelled: false,
    }],
    [{ id: 'div-u10', name: 'U10 (as of Jan 2027)' }],
    [{ id: 'team-a', name: 'Caranero FC' }, { id: 'team-b', name: 'Real Barriada' }]
  )

  const result = await getHomeSchedule()
  expect(result.matches).toEqual([{
    id: 'fx1', date: '2026-08-20', kickoff: '10:00', division: 'U10',
    homeTeam: 'Caranero FC', awayTeam: 'Real Barriada',
    cancelled: false, homeScore: null, awayScore: null,
  }])
})

it('returns a null kickoff when the fixture has none set', async () => {
  queuePractices([])
  queueMatches(
    [{
      id: 'fx1', match_date: '2026-08-20', kickoff: null,
      division_id: 'div-u10', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, cancelled: false,
    }],
    [{ id: 'div-u10', name: 'U10' }],
    [{ id: 'team-a', name: 'Caranero FC' }, { id: 'team-b', name: 'Real Barriada' }]
  )

  const result = await getHomeSchedule()
  expect(result.matches[0]).toMatchObject({ kickoff: null })
})

it('includes cancelled practices and matches rather than filtering them out', async () => {
  queuePractices([{
    id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
    location: null, notes: 'Rained out', cancelled: true,
  }])
  queueMatches(
    [{
      id: 'fx1', match_date: '2026-08-20', kickoff: '10:00:00',
      division_id: 'div-u10', home_team_id: 'team-a', away_team_id: 'team-b',
      home_score: null, away_score: null, cancelled: true,
    }],
    [{ id: 'div-u10', name: 'U10' }],
    [{ id: 'team-a', name: 'Caranero FC' }, { id: 'team-b', name: 'Real Barriada' }]
  )

  const result = await getHomeSchedule()
  expect(result.practices[0].cancelled).toBe(true)
  expect(result.matches[0].cancelled).toBe(true)
})

it('queries practices with a 14-day window and fixtures with a 7-day window', async () => {
  queuePractices([])
  queueNoMatches()

  await getHomeSchedule()

  const today = new Date().toISOString().slice(0, 10)
  const in14 = new Date(); in14.setUTCDate(in14.getUTCDate() + 14)
  const in7 = new Date(); in7.setUTCDate(in7.getUTCDate() + 7)

  expect(mockSupabase.gte).toHaveBeenNthCalledWith(1, 'practice_date', today)
  expect(mockSupabase.lt).toHaveBeenNthCalledWith(1, 'practice_date', in14.toISOString().slice(0, 10))
  expect(mockSupabase.gte).toHaveBeenNthCalledWith(2, 'match_date', today)
  expect(mockSupabase.lt).toHaveBeenNthCalledWith(2, 'match_date', in7.toISOString().slice(0, 10))
})
