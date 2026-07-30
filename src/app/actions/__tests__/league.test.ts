jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { registerLeagueTeam, addLeaguePlayer } from '../league'
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
    players: [{ name: 'Player One', dateOfBirth: '2014-01-01', squadNumber: 7 }],
  }

  it('rejects a submission with no players before touching the database', async () => {
    const result = await registerLeagueTeam({ ...validInput, players: [] })
    expect(result.error).toBe('At least one player is required')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects a submission with an invalid squad number before touching the database', async () => {
    const result = await registerLeagueTeam({
      ...validInput,
      players: [{ name: 'Player One', dateOfBirth: '2014-01-01', squadNumber: 0 }],
    })
    expect(result.error).toBe('Squad numbers must be whole numbers greater than 0.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects a submission targeting a division whose schedule has already been generated', async () => {
    // .from('league_fixtures').select('id').eq('division_id', ...).limit(1) finds an existing fixture
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'fx-1' }], error: null })

    const result = await registerLeagueTeam(validInput)
    expect(result.error).toBe('This division is no longer open for new team registrations.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('creates a club, team, and players on success', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // division has no existing fixtures -> open
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'club-1' }, error: null }) // club insert
      .mockResolvedValueOnce({ data: { id: 'team-1' }, error: null }) // team insert
    mockSupabase.insert
      .mockReturnValueOnce(mockSupabase) // club .insert().select().single()
      .mockReturnValueOnce(mockSupabase) // team .insert().select().single()
      .mockResolvedValueOnce({ error: null }) // players .insert() awaited directly

    const result = await registerLeagueTeam(validInput)
    expect(result).toEqual({ clubId: 'club-1', teamId: 'team-1' })
    expect(mockSupabase.delete).not.toHaveBeenCalled()
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
    expect(result.error).toBe('Failed to create team record')
    expect(mockSupabase.from).toHaveBeenCalledWith('league_clubs')
    expect(mockSupabase.delete).toHaveBeenCalledTimes(1)
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'club-1')
  })

  it('rolls back both the team and the club if the players insert fails', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // division is open
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'club-1' }, error: null })
      .mockResolvedValueOnce({ data: { id: 'team-1' }, error: null })
    mockSupabase.insert
      .mockReturnValueOnce(mockSupabase) // club .insert().select().single()
      .mockReturnValueOnce(mockSupabase) // team .insert().select().single()
      .mockResolvedValueOnce({ error: { message: 'db error' } }) // players insert fails
    mockSupabase.delete.mockReturnValue(mockSupabase)

    const result = await registerLeagueTeam(validInput)
    expect(result.error).toBe('Failed to register players')
    expect(mockSupabase.delete).toHaveBeenCalledTimes(2)
  })
})

describe('addLeaguePlayer', () => {
  const validInput = { teamId: 'team-1', name: 'New Player', dateOfBirth: '2014-05-05', squadNumber: 9 }

  it('rejects an invalid squad number before touching the database', async () => {
    const result = await addLeaguePlayer({ ...validInput, squadNumber: -1 })
    expect(result.error).toBe('Squad number must be a whole number greater than 0.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when the team does not exist', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null })
    const result = await addLeaguePlayer(validInput)
    expect(result.error).toBe('Team not found')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when the team is not yet approved', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'team-1', status: 'pending' }, error: null })
    const result = await addLeaguePlayer(validInput)
    expect(result.error).toBe('Team not found')
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
