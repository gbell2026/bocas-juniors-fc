jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))
// Deliberate deviation from this repo's convention of only mocking
// @/lib/supabase/server — driving getAmountDue's real DB-mock chain here
// would be disproportionate to what this test actually verifies (roster
// mapping, not payment-due computation, which has its own tests).
jest.mock('@/app/actions/payment', () => ({ getAmountDue: jest.fn() }))

import { getRosterForCoach } from '../roster'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getAmountDue } from '@/app/actions/payment'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  order: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('getRosterForCoach', () => {
  it('excludes inactive players via the query itself', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [], error: null })
    await getRosterForCoach()
    expect(mockSupabase.neq).toHaveBeenCalledWith('status', 'inactive')
  })

  it('excludes cancelled players via the query itself', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [], error: null })
    await getRosterForCoach()
    expect(mockSupabase.neq).toHaveBeenCalledWith('status', 'cancelled')
  })

  it('maps hasOutstanding from getAmountDue: null means fully paid, non-null means outstanding', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [
        { id: 'p1', parent_id: 'parent-1', name: 'Alice', position: 'Forward', age_groups: ['U10'] },
        { id: 'p2', parent_id: 'parent-2', name: 'Bob', position: 'Defender', age_groups: [] },
      ],
      error: null,
    })
    ;(getAmountDue as jest.Mock)
      .mockResolvedValueOnce(null) // Alice fully paid
      .mockResolvedValueOnce({ label: 'registration', amountCents: 3000, isFirstInstallment: true }) // Bob owes

    const result = await getRosterForCoach()

    expect(result).toEqual([
      { id: 'p1', parentId: 'parent-1', name: 'Alice', position: 'Forward', ageGroups: ['U10'], hasOutstanding: false },
      { id: 'p2', parentId: 'parent-2', name: 'Bob', position: 'Defender', ageGroups: [], hasOutstanding: true },
    ])
  })

  it('returns an empty array when there are no players', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: null, error: null })
    const result = await getRosterForCoach()
    expect(result).toEqual([])
  })
})
