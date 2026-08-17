jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { registerLeagueTeam, addLeaguePlayer, getApprovedClubs, addLeagueTeam, getFixtureCalendar } from '../league'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('registerLeagueTeam', () => {
  const validInput = {
    clubName: 'Isla FC', contactName: 'Jane', contactEmail: 'jane@islafc.com', contactPhone: '555-1111',
    teamName: 'Isla FC U12', divisionId: 'div-1',
  }

  it('rejects a submission targeting a division whose schedule has already been generated', async () => {
    // .from('league_fixtures').select('id').eq('division_id', ...).limit(1) finds an existing fixture
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'fx-1' }], error: null })

    const result = await registerLeagueTeam(validInput)
    expect(result.error).toBe('division_closed')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('creates a club and team on success, with no roster', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // division has no existing fixtures -> open
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'club-1' }, error: null }) // club insert
      .mockResolvedValueOnce({ data: { id: 'team-1' }, error: null }) // team insert
    mockSupabase.insert
      .mockReturnValueOnce(mockSupabase) // club .insert().select().single()
      .mockReturnValueOnce(mockSupabase) // team .insert().select().single()

    const result = await registerLeagueTeam(validInput)
    expect(result).toEqual({ clubId: 'club-1', teamId: 'team-1' })
    expect(mockSupabase.delete).not.toHaveBeenCalled()
    expect(mockSupabase.insert).toHaveBeenCalledTimes(2) // club, team — no players insert
  })

  it('creates a club with null contact details when none are provided', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'club-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'team-1' }, error: null })
    mockSupabase.insert
      .mockReturnValueOnce(mockSupabase)
      .mockReturnValueOnce(mockSupabase)

    await registerLeagueTeam({ clubName: 'Isla FC', teamName: 'Isla FC U12', divisionId: 'div-1' })
    expect(mockSupabase.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      contact_name: null, contact_email: null, contact_phone: null,
    }))
  })

  it('rolls back the club if the team insert fails', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // division is open
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'club-1' }, error: null }) // club insert succeeds
      .mockResolvedValueOnce({ data: null, error: { message: 'db error' } }) // team insert fails
    mockSupabase.insert
      .mockReturnValueOnce(mockSupabase) // club .insert().select().single()
      .mockReturnValueOnce(mockSupabase) // team .insert().select().single()
    mockSupabase.delete.mockReturnValue(mockSupabase)

    const result = await registerLeagueTeam(validInput)
    expect(result.error).toBe('submission_failed')
    expect(mockSupabase.from).toHaveBeenCalledWith('league_clubs')
    expect(mockSupabase.delete).toHaveBeenCalledTimes(1)
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'club-1')
  })
})

describe('getApprovedClubs', () => {
  it('returns only approved clubs, ordered by name', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [{ id: 'club-1', name: 'Isla FC' }], error: null })
    const result = await getApprovedClubs()
    expect(result).toEqual([{ id: 'club-1', name: 'Isla FC' }])
    expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'approved')
  })
})

describe('addLeagueTeam', () => {
  const validInput = { clubId: 'club-1', teamName: 'Isla FC U10', divisionId: 'div-2' }

  it('rejects a submission targeting a division whose schedule has already been generated', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'fx-1' }], error: null })
    const result = await addLeagueTeam(validInput)
    expect(result.error).toBe('division_closed')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when the club does not exist or is not approved', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
    const result = await addLeagueTeam(validInput)
    expect(result.error).toBe('club_not_found')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('adds the team under the existing club on success', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'club-1' }, error: null }) // club lookup
      .mockResolvedValueOnce({ data: { id: 'team-2' }, error: null }) // team insert
    mockSupabase.insert.mockReturnValueOnce(mockSupabase)

    const result = await addLeagueTeam(validInput)
    expect(result).toEqual({ teamId: 'team-2' })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      club_id: 'club-1', division_id: 'div-2', name: 'Isla FC U10',
    }))
  })
})

describe('addLeaguePlayer', () => {
  const validInput = { teamId: 'team-1', name: 'New Player', dateOfBirth: '2014-05-05', squadNumber: 9 }

  it('rejects an invalid squad number before touching the database', async () => {
    const result = await addLeaguePlayer({ ...validInput, squadNumber: -1 })
    expect(result.error).toBe('invalid_squad_number')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when the team does not exist', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
    const result = await addLeaguePlayer(validInput)
    expect(result.error).toBe('team_not_found')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when the team is not yet approved', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'team-1', status: 'pending' }, error: null })
    const result = await addLeaguePlayer(validInput)
    expect(result.error).toBe('team_not_found')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('inserts the player when the team is approved', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'team-1', status: 'approved' }, error: null })
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    const result = await addLeaguePlayer(validInput)
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      team_id: 'team-1', name: 'New Player', squad_number: 9,
    }))
  })
})

describe('getFixtureCalendar', () => {
  it('returns an empty array when there are no divisions yet', async () => {
    mockSupabase.select.mockResolvedValueOnce({ data: [], error: null }) // league_divisions
    const result = await getFixtureCalendar()
    expect(result).toEqual([])
  })

  it('tags a fixture as isHomeClubMatch when Tangerine Toucans play, and shortens the division label', async () => {
    // getFixtureCalendar calls .select() three times, in this order:
    //   1. league_divisions .select('*')                -- TERMINAL (awaited directly)
    //   2. league_fixtures  .select('*').order(...)      -- select() is chainable here, order() is TERMINAL
    //   3. league_teams     .select('id, name')           -- TERMINAL
    // mockResolvedValueOnce queues are consumed strictly by call order, not by
    // which logical branch they belong to — the fixtures call's select() MUST
    // get an explicit mockReturnValueOnce(mockSupabase) spacer, or its slot
    // gets consumed by the teams call's queued value and .order() throws
    // "is not a function" on whatever select() actually returned.
    mockSupabase.select
      .mockResolvedValueOnce({ // 1. league_divisions -- TERMINAL
        data: [{ id: 'div-1', name: 'U10 (as of Jan 2027)', season_start_date: '2026-09-06', season_end_date: '2026-09-06' }],
        error: null,
      })
      .mockReturnValueOnce(mockSupabase) // 2. league_fixtures .select() -> chained to .order()
      .mockResolvedValueOnce({ // 3. league_teams -- TERMINAL
        data: [{ id: 'team-1', name: 'Tangerine Toucans' }, { id: 'team-2', name: 'Rival FC' }],
        error: null,
      })
    mockSupabase.order.mockResolvedValueOnce({ // league_fixtures .order('match_date') -- TERMINAL
      data: [{
        id: 'fx-1', division_id: 'div-1', match_date: '2026-09-06', kickoff: '09:00:00',
        home_team_id: 'team-1', away_team_id: 'team-2', home_score: null, away_score: null, cancelled: false,
      }],
      error: null,
    })

    const result = await getFixtureCalendar()
    expect(result).toEqual([{
      date: '2026-09-06',
      rest: false,
      firstDivision: 'U10',
      matches: [expect.objectContaining({
        division: 'U10', kickoff: '09:00', homeTeam: 'Tangerine Toucans', awayTeam: 'Rival FC', isHomeClubMatch: true,
      })],
    }])
  })
})
