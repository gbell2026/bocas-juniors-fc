jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import {
  getFinanceSeasons, createFinanceSeason, updateFinanceSeason,
  getFinanceCategories, createFinanceCategory, renameFinanceCategory, deleteFinanceCategory,
} from '../finances'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn(),
  single: jest.fn(),
  limit: jest.fn(),
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

describe('getFinanceCategories', () => {
  it('returns categories', async () => {
    // getFinanceCategories calls .order('kind').order('name') — two calls in one
    // chain. The first must return mockSupabase (chainable); only the second
    // resolves. Queuing just one mockResolvedValueOnce here would be consumed
    // by the FIRST call instead, breaking the chain — queue both explicitly.
    mockSupabase.order.mockReturnValueOnce(mockSupabase) // .order('kind')
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'c1', name: 'Wages', kind: 'expense', auto_source: null }],
      error: null,
    }) // .order('name')
    const result = await getFinanceCategories()
    expect(result).toEqual([{ id: 'c1', name: 'Wages', kind: 'expense', autoSource: null }])
  })
})

describe('createFinanceCategory', () => {
  it('creates a manual category', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceCategory({ name: 'Referee Fees', kind: 'expense' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ name: 'Referee Fees', kind: 'expense', auto_source: null })
  })
})

describe('renameFinanceCategory', () => {
  it('renames a manual category', async () => {
    // renameFinanceCategory calls .eq('id', id) twice: once (chainable) before
    // the auto_source .single() lookup, then again (terminal) for the update.
    // Queuing only one mockResolvedValueOnce would be consumed by the FIRST
    // (chainable) call, breaking .single() — queue the chainable return first.
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // auto_source check .eq('id', id)
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // update .eq('id', id)
    const result = await renameFinanceCategory('c1', 'New Name')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ name: 'New Name' })
  })

  it('refuses to rename an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'registration' }, error: null })
    const result = await renameFinanceCategory('c1', 'New Name')
    expect(result.error).toBe('This category is computed automatically and can\'t be renamed')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})

describe('deleteFinanceCategory', () => {
  it('refuses to delete an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'subscription' }, error: null })
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category is computed automatically and can\'t be deleted')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a category with logged entries', async () => {
    // The implementation queries entries and budgets unconditionally (not
    // short-circuited) before checking either result, so both .limit(1) calls
    // always happen — queue a value for both, even though only the first
    // (entries) is what this test is actually asserting on.
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'e1' }], error: null }) // entries: has one
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // budgets: none
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category has logged entries or a budget — remove those first')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a category with a budget set', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no entries
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'b1' }], error: null }) // has a budget
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category has logged entries or a budget — remove those first')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('deletes a manual category with no entries or budgets', async () => {
    // .eq() is called 4 times in this path: auto_source check (chainable,
    // before .single()), the entries check (chainable, before .limit()), the
    // budgets check (chainable, before .limit()), and finally the delete
    // itself (terminal). Only the last should resolve — the first three must
    // be queued to return mockSupabase, or the terminal value gets
    // front-consumed by the very first call and breaks .single().
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // auto_source check .eq('id', id)
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // entries check .eq('category_id', id)
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no entries
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // budgets check .eq('category_id', id)
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no budget
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // the delete itself .eq('id', id)
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
  })
})
