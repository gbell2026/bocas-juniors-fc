jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { getKickoffFlyer } from '../flyer'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

/**
 * getKickoffFlyer's queries, in order:
 *   1. league_fixtures  select('*').eq().eq().order('kickoff')  -> order TERMINAL
 *   2. league_divisions select('id, name')                      -> select TERMINAL
 *   3. league_teams     select().in('id')                       -> in TERMINAL
 *   4. league_teams     select().in('division_id').eq().order() -> order TERMINAL
 * If query 1 returns no rows the function returns early — queue nothing else.
 */
function queueEmpty() {
  mockSupabase.select.mockReturnValueOnce(mockSupabase) // 1: fixtures select('*') -> chain
  mockSupabase.order.mockResolvedValueOnce({ data: [], error: null }) // 1: order -> TERMINAL, empty
}

function queue(opts: {
  fixtures: any[]
  divisions: { id: string; name: string }[]
  fixtureTeams: { id: string; name: string }[]
  rosterTeams: { name: string; division_id: string }[]
}) {
  mockSupabase.select
    .mockReturnValueOnce(mockSupabase) // 1: fixtures select('*') -> chain
    .mockResolvedValueOnce({ data: opts.divisions, error: null }) // 2: divisions -> TERMINAL
    .mockReturnValueOnce(mockSupabase) // 3: fixtureTeams select -> chain
    .mockReturnValueOnce(mockSupabase) // 4: rosterTeams select -> chain
  mockSupabase.order
    .mockResolvedValueOnce({ data: opts.fixtures, error: null }) // 1: fixtures order -> TERMINAL
    .mockResolvedValueOnce({ data: opts.rosterTeams, error: null }) // 4: rosterTeams order -> TERMINAL
  mockSupabase.in
    .mockResolvedValueOnce({ data: opts.fixtureTeams, error: null }) // 3: .in('id') -> TERMINAL
    .mockReturnValueOnce(mockSupabase) // 4: .in('division_id') -> chain
}

it('returns no divisions when nothing is scheduled for the coming Sunday', async () => {
  queueEmpty()
  const result = await getKickoffFlyer()
  expect(result.divisions).toEqual([])
  expect(result.sundayIso).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

it('lists every approved team in the division, not just the ones playing', async () => {
  queue({
    fixtures: [{
      id: 'fx1', match_date: '2026-09-06', kickoff: '09:30:00', cancelled: false,
      division_id: 'd1', home_team_id: 't1', away_team_id: 't2',
    }],
    divisions: [{ id: 'd1', name: 'U10 (as of Jan 2027)' }],
    fixtureTeams: [{ id: 't1', name: 'Caranero FC' }, { id: 't2', name: 'Real Barriada' }],
    rosterTeams: [
      { name: 'Caranero FC', division_id: 'd1' },
      { name: 'Isla Verde', division_id: 'd1' }, // not playing this Sunday
      { name: 'Real Barriada', division_id: 'd1' },
    ],
  })

  const result = await getKickoffFlyer()
  expect(result.divisions).toHaveLength(1)
  expect(result.divisions[0].teams.map(t => t.name)).toEqual([
    'Caranero FC', 'Isla Verde', 'Real Barriada',
  ])
  expect(result.divisions[0].fixtures).toEqual([
    { id: 'fx1', kickoff: '09:30', homeTeam: 'Caranero FC', homeBadge: null, awayTeam: 'Real Barriada', awayBadge: null },
  ])
  expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'approved')
})

it('carries a null kickoff through', async () => {
  queue({
    fixtures: [{
      id: 'fx1', match_date: '2026-09-06', kickoff: null, cancelled: false,
      division_id: 'd1', home_team_id: 't1', away_team_id: 't2',
    }],
    divisions: [{ id: 'd1', name: 'U14' }],
    fixtureTeams: [{ id: 't1', name: 'A' }, { id: 't2', name: 'B' }],
    rosterTeams: [{ name: 'A', division_id: 'd1' }, { name: 'B', division_id: 'd1' }],
  })

  const result = await getKickoffFlyer()
  expect(result.divisions[0].fixtures[0].kickoff).toBeNull()
})
