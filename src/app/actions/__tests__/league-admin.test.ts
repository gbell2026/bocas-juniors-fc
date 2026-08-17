jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import {
  generateSchedule, generateAlignedSchedule, approveLeaguePlayer, createDivision, updateDivision,
  approveLeagueClub, rejectLeagueClub, approveLeagueTeam, rejectLeagueTeam, rejectLeaguePlayer,
  updateFixture, addFixture, recordFixtureScore, setFixtureCancelled,
  updateLeagueClub, updateLeagueTeam,
} from '../league-admin'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('generateSchedule', () => {
  it('refuses to generate a schedule if the division already has fixtures', async () => {
    // .from('league_fixtures').select('id').eq(...).limit(1) resolves with an existing row
    ;(mockSupabase.limit as jest.Mock).mockResolvedValueOnce({ data: [{ id: 'fx-1' }], error: null })

    const result = await generateSchedule('div-1')
    expect(result.error).toBe('This division already has a schedule. Add or edit fixtures manually instead.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('refuses to generate a schedule with fewer than 2 approved teams', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no existing fixtures
    mockSupabase.single.mockResolvedValueOnce({ data: { season_start_date: '2026-08-01', season_end_date: '2026-11-01' }, error: null })
    // Four sequential .eq() calls happen in generateSchedule, in this order:
    //   1. fixtures .eq('division_id', ...) -> chained to .limit(1)
    //   2. division .eq('id', ...)           -> chained to .single()
    //   3. teams    .eq('division_id', ...)  -> chainable
    //   4. teams    .eq('status', 'approved') -> IS the awaited value (no .single()/.limit() on this one)
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // fixtures .eq('division_id', ...)
      .mockImplementationOnce(() => mockSupabase) // division .eq('id', ...)
      .mockImplementationOnce(() => mockSupabase) // teams .eq('division_id', ...)
      .mockImplementationOnce(() => Promise.resolve({ data: [{ id: 'team-1' }], error: null })) // teams .eq('status', 'approved')

    const result = await generateSchedule('div-1')
    expect(result.error).toBe('Need at least 2 approved teams to generate a schedule')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('generates and saves a full schedule for 2+ approved teams', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.single.mockResolvedValueOnce({ data: { season_start_date: '2026-08-01', season_end_date: '2026-11-01' }, error: null })
    // Same four-call .eq() sequence as above — see that test's comment for the full breakdown.
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // fixtures .eq('division_id', ...)
      .mockImplementationOnce(() => mockSupabase) // division .eq('id', ...)
      .mockImplementationOnce(() => mockSupabase) // teams .eq('division_id', ...)
      .mockImplementationOnce(() => Promise.resolve({ data: [{ id: 'team-1' }, { id: 'team-2' }], error: null })) // teams .eq('status', 'approved')
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    const result = await generateSchedule('div-1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith([
      expect.objectContaining({ division_id: 'div-1', home_team_id: 'team-1', away_team_id: 'team-2' }),
      expect.objectContaining({ division_id: 'div-1', home_team_id: 'team-2', away_team_id: 'team-1' }),
    ])
  })
})

describe('generateAlignedSchedule', () => {
  it('rejects fewer than 2 divisions without touching the database', async () => {
    const result = await generateAlignedSchedule(['div-1'])
    expect(result.error).toBe('Aligned generation needs at least 2 divisions.')
    expect(mockSupabase.from).not.toHaveBeenCalled()
  })

  it('rejects when one of the divisions already has fixtures', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'fx-1' }], error: null })
    const result = await generateAlignedSchedule(['div-u10', 'div-u14'])
    expect(result.error).toBe('One or more of these divisions already has a schedule. Delete existing fixtures first.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when divisions have different season dates', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.in.mockReturnValueOnce(mockSupabase).mockResolvedValueOnce({
      data: [
        { id: 'div-u10', season_start_date: '2026-09-06', season_end_date: '2026-12-01' },
        { id: 'div-u14', season_start_date: '2026-09-13', season_end_date: '2026-12-01' },
      ],
      error: null,
    })
    const result = await generateAlignedSchedule(['div-u10', 'div-u14'])
    expect(result.error).toBe('All divisions must share the same season start and end date to generate an aligned schedule.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rejects when no Tangerine Toucans team exists in the given divisions', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.in
      .mockReturnValueOnce(mockSupabase)
      .mockResolvedValueOnce({
        data: [
          { id: 'div-u10', season_start_date: '2026-09-06', season_end_date: '2026-12-01' },
          { id: 'div-u14', season_start_date: '2026-09-06', season_end_date: '2026-12-01' },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 't1', division_id: 'div-u10', club_id: 'c1', league_clubs: { name: 'Caranero FC' } },
          { id: 't2', division_id: 'div-u14', club_id: 'c1', league_clubs: { name: 'Caranero FC' } },
        ],
        error: null,
      })
    const result = await generateAlignedSchedule(['div-u10', 'div-u14'])
    expect(result.error).toBe('Could not find a "Tangerine Toucans" team in these divisions to anchor the schedule.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('generates and saves aligned fixtures across all given divisions, with the shared club on the same date in each', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null })
    mockSupabase.in
      .mockReturnValueOnce(mockSupabase)
      .mockResolvedValueOnce({
        data: [
          { id: 'div-u10', season_start_date: '2026-09-06', season_end_date: '2026-12-01' },
          { id: 'div-u14', season_start_date: '2026-09-06', season_end_date: '2026-12-01' },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'u10-toucans', division_id: 'div-u10', club_id: 'toucans', league_clubs: { name: 'Tangerine Toucans' } },
          { id: 'u10-caranero', division_id: 'div-u10', club_id: 'caranero', league_clubs: { name: 'Caranero FC' } },
          { id: 'u14-toucans', division_id: 'div-u14', club_id: 'toucans', league_clubs: { name: 'Tangerine Toucans' } },
          { id: 'u14-caranero', division_id: 'div-u14', club_id: 'caranero', league_clubs: { name: 'Caranero FC' } },
        ],
        error: null,
      })
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    const result = await generateAlignedSchedule(['div-u10', 'div-u14'])
    expect(result.error).toBeUndefined()

    const insertedRows = (mockSupabase.insert as jest.Mock).mock.calls[0][0] as { division_id: string; home_team_id: string; away_team_id: string; match_date: string }[]
    expect(insertedRows).toHaveLength(4) // 2 rounds x 2 divisions

    const u10Dates = insertedRows.filter(r => r.division_id === 'div-u10').map(r => r.match_date).sort()
    const u14Dates = insertedRows.filter(r => r.division_id === 'div-u14').map(r => r.match_date).sort()
    expect(u10Dates).toEqual(u14Dates)
  })
})

describe('createDivision', () => {
  it('rejects a season end date on or before the start date, without touching the database', async () => {
    const result = await createDivision({ name: 'U12', seasonStartDate: '2026-11-01', seasonEndDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('creates the division when the date range is valid', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createDivision({ name: 'U12', seasonStartDate: '2026-08-01', seasonEndDate: '2026-11-01' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      season_start_date: '2026-08-01', season_end_date: '2026-11-01',
    }))
  })
})

describe('updateDivision', () => {
  it('rejects a season end date on or before the start date, without touching the database', async () => {
    const result = await updateDivision('div-1', { seasonStartDate: '2026-11-01', seasonEndDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })

  it('updates the division when only one date field is provided (no comparison possible)', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateDivision('div-1', { seasonStartDate: '2026-08-01' })
    expect(result.error).toBeUndefined()
  })
})

describe('approveLeaguePlayer', () => {
  it('approves a player when there is no conflict', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await approveLeaguePlayer('player-1')
    expect(result.error).toBeUndefined()
  })

  it('returns a friendly error when the squad number is already taken', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } })

    const result = await approveLeaguePlayer('player-1')
    expect(result.error).toBe('That squad number is already taken on this team — ask the club for a different number.')
  })
})

describe('club/team/player approve-reject error surfacing', () => {
  const cases: [string, () => Promise<{ error?: string }>, string][] = [
    ['approveLeagueClub', () => approveLeagueClub('id-1'), 'Failed to approve club'],
    ['rejectLeagueClub', () => rejectLeagueClub('id-1'), 'Failed to reject club'],
    ['approveLeagueTeam', () => approveLeagueTeam('id-1'), 'Failed to approve team'],
    ['rejectLeagueTeam', () => rejectLeagueTeam('id-1'), 'Failed to reject team'],
    ['rejectLeaguePlayer', () => rejectLeaguePlayer('id-1'), 'Failed to reject player'],
  ]

  it.each(cases)('%s surfaces a friendly error instead of silently succeeding on a DB failure', async (_name, fn, expectedError) => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await fn()
    expect(result.error).toBe(expectedError)
  })

  it.each(cases)('%s returns no error on success', async (_name, fn) => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await fn()
    expect(result.error).toBeUndefined()
  })
})

describe('updateFixture', () => {
  it('returns a friendly error when the two teams would be the same (check constraint violation)', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { code: '23514', message: 'check constraint violation' } })

    const result = await updateFixture('fx-1', { homeTeamId: 'team-1' })
    expect(result.error).toBe('A team cannot play itself — pick two different teams.')
  })

  it('returns no error on success', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await updateFixture('fx-1', { matchDate: '2026-08-15' })
    expect(result.error).toBeUndefined()
  })

  it('includes kickoff in the patch when provided', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    await updateFixture('fx-1', { kickoff: '10:00' })
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({ kickoff: '10:00' }))
  })
})

describe('addFixture', () => {
  it('inserts the provided kickoff, or null when omitted', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    await addFixture({ divisionId: 'div-1', homeTeamId: 'team-1', awayTeamId: 'team-2', matchDate: '2026-09-06', kickoff: '09:00' })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ kickoff: '09:00' }))

    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    await addFixture({ divisionId: 'div-1', homeTeamId: 'team-1', awayTeamId: 'team-2', matchDate: '2026-09-06' })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({ kickoff: null }))
  })
})

describe('recordFixtureScore', () => {
  it('returns a friendly error when a negative score violates the check constraint', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { code: '23514', message: 'check constraint violation' } })

    const result = await recordFixtureScore('fx-1', -1, 2)
    expect(result.error).toBe('Scores cannot be negative.')
  })

  it('returns no error on success', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await recordFixtureScore('fx-1', 2, 1)
    expect(result.error).toBeUndefined()
  })
})

describe('updateLeagueClub', () => {
  it('only patches the fields provided, plus updated_at', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await updateLeagueClub('club-1', { name: 'Riverside FC', status: 'approved' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Riverside FC', status: 'approved', updated_at: expect.any(String),
    }))
    const patch = (mockSupabase.update as jest.Mock).mock.calls[0][0]
    expect(patch).not.toHaveProperty('contact_email')
    expect(patch).not.toHaveProperty('badge_cloudinary_public_id')
  })

  it('explicitly clears the badge when badgeCloudinaryPublicId is null, distinct from omitting it', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    await updateLeagueClub('club-1', { badgeCloudinaryPublicId: null })
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      badge_cloudinary_public_id: null,
    }))
  })

  it('sets a new badge public id when provided', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    await updateLeagueClub('club-1', { badgeCloudinaryPublicId: 'tangerine-toucans/abc123' })
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      badge_cloudinary_public_id: 'tangerine-toucans/abc123',
    }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await updateLeagueClub('club-1', { name: 'Riverside FC' })
    expect(result.error).toBe('Failed to update club')
  })
})

describe('updateLeagueTeam', () => {
  it('patches name, division, and status using snake_case columns', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await updateLeagueTeam('team-1', { name: 'U12 Blue', divisionId: 'div-2', status: 'approved' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'U12 Blue', division_id: 'div-2', status: 'approved', updated_at: expect.any(String),
    }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await updateLeagueTeam('team-1', { name: 'U12 Blue' })
    expect(result.error).toBe('Failed to update team')
  })
})

describe('setFixtureCancelled', () => {
  it('marks a fixture cancelled', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })

    const result = await setFixtureCancelled('fx-1', true)
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ cancelled: true })
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await setFixtureCancelled('fx-1', false)
    expect(result.error).toBe('Failed to update fixture')
  })
})
