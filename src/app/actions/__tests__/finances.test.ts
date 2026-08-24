jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { getFinanceSeasons, createFinanceSeason, updateFinanceSeason } from '../finances'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('getFinanceSeasons', () => {
  it('returns seasons ordered newest first', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 's1', label: '2026 Season', start_date: '2026-08-01', end_date: '2026-12-31', created_at: '2026-01-01' }],
      error: null,
    })
    const result = await getFinanceSeasons()
    expect(result).toEqual([{ id: 's1', label: '2026 Season', startDate: '2026-08-01', endDate: '2026-12-31' }])
    expect(mockSupabase.order).toHaveBeenCalledWith('start_date', { ascending: false })
  })
})

describe('createFinanceSeason', () => {
  it('creates a season', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceSeason({ label: '2026 Season', startDate: '2026-08-01', endDate: '2026-12-31' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ label: '2026 Season', start_date: '2026-08-01', end_date: '2026-12-31' })
  })

  it('rejects an end date on or before the start date', async () => {
    const result = await createFinanceSeason({ label: '2026 Season', startDate: '2026-12-31', endDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

describe('updateFinanceSeason', () => {
  it('updates a season', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateFinanceSeason('s1', { label: 'Renamed', startDate: '2026-08-01', endDate: '2026-12-31' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ label: 'Renamed', start_date: '2026-08-01', end_date: '2026-12-31' })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 's1')
  })

  it('rejects an end date on or before the start date', async () => {
    const result = await updateFinanceSeason('s1', { label: 'Renamed', startDate: '2026-12-31', endDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})
