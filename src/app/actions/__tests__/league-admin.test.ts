jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { generateSchedule, approveLeaguePlayer, createDivision, updateDivision } from '../league-admin'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
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
