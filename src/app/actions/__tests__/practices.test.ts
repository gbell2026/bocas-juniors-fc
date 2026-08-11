jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import {
  getUpcomingPractices, getAllPractices, createPractice, updatePractice, setPracticeCancelled, deletePractice,
} from '../practices'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

const row = {
  id: 'p1', practice_date: '2026-08-18', practice_time: '17:00:00',
  location: 'Field A', notes: 'Bring water', cancelled: false, created_at: '2026-08-11T00:00:00Z',
}

describe('getUpcomingPractices', () => {
  it('maps rows to camelCase, ordered by date then time', async () => {
    mockSupabase.order
      .mockReturnValueOnce(mockSupabase) // .order('practice_date', ...) -- chainable
      .mockResolvedValueOnce({ data: [row], error: null }) // .order('practice_time', ...) -- TERMINAL

    const result = await getUpcomingPractices()
    expect(result).toEqual([{
      id: 'p1', practiceDate: '2026-08-18', practiceTime: '17:00:00',
      location: 'Field A', notes: 'Bring water', cancelled: false,
    }])
    expect(mockSupabase.gte).toHaveBeenCalledWith('practice_date', expect.any(String))
  })

  it('includes cancelled practices rather than filtering them out', async () => {
    mockSupabase.order
      .mockReturnValueOnce(mockSupabase)
      .mockResolvedValueOnce({ data: [{ ...row, cancelled: true }], error: null })

    const result = await getUpcomingPractices()
    expect(result[0].cancelled).toBe(true)
  })
})

describe('getAllPractices', () => {
  it('maps rows to camelCase without a date floor', async () => {
    mockSupabase.order
      .mockReturnValueOnce(mockSupabase)
      .mockResolvedValueOnce({ data: [row], error: null })

    const result = await getAllPractices()
    expect(result).toEqual([{
      id: 'p1', practiceDate: '2026-08-18', practiceTime: '17:00:00',
      location: 'Field A', notes: 'Bring water', cancelled: false,
    }])
    expect(mockSupabase.gte).not.toHaveBeenCalled()
  })
})

describe('createPractice', () => {
  it('inserts a new practice on success', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createPractice({ practiceDate: '2026-08-18', practiceTime: '17:00', location: 'Field A' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      practice_date: '2026-08-18', practice_time: '17:00', location: 'Field A', notes: null,
    }))
  })

  it('rejects a missing date or time without inserting', async () => {
    const result = await createPractice({ practiceDate: '', practiceTime: '17:00' })
    expect(result.error).toBe('Date and time are both required.')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await createPractice({ practiceDate: '2026-08-18', practiceTime: '17:00' })
    expect(result.error).toBe('Failed to add practice')
  })
})

describe('updatePractice', () => {
  it('updates an existing practice on success', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updatePractice('p1', { practiceDate: '2026-08-19', practiceTime: '18:00' })
    expect(result.error).toBeUndefined()
  })

  it('rejects a missing date or time without updating', async () => {
    const result = await updatePractice('p1', { practiceDate: '2026-08-19', practiceTime: '' })
    expect(result.error).toBe('Date and time are both required.')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})

describe('setPracticeCancelled', () => {
  it('marks a practice cancelled', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await setPracticeCancelled('p1', true)
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ cancelled: true })
  })
})

describe('deletePractice', () => {
  it('deletes a practice on success', async () => {
    mockSupabase.delete.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await deletePractice('p1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.delete.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deletePractice('p1')
    expect(result.error).toBe('Failed to delete practice')
  })
})
