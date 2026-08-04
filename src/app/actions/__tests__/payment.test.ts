jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

// Mock Resend so the admin-notification email never makes a real network call in tests
const mockSend = jest.fn().mockResolvedValue({ error: null })
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}))

import { requestPayment, confirmPayment, denyPayment, adminMarkCashPaid, getAmountDue, getRegFeeAlertForUser } from '../payment'
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
  // Note: jest.clearAllMocks() resets call history but not persistent implementations
  // like the .mockReturnThis() set above at declaration time — no need to re-apply those here.
})

/**
 * getAmountDue makes exactly 3 sequential `.eq()` calls per invocation:
 *   1. players  .eq('id', playerId)          -> chainable, resolved via .single()
 *   2. payments .eq('player_id', playerId)    -> chainable
 *   3. payments .eq('status', 'succeeded')    -> IS the awaited value (no .single() on this query)
 * Queue exactly 3 mockImplementationOnce calls, in that order, for every test
 * that (directly or indirectly, e.g. via requestPayment/adminMarkCashPaid) calls
 * getAmountDue once. A test calling it twice needs 6 queued, in two groups of 3.
 */
function mockGetAmountDueOnce(plan: string, succeededLabels: (string | null)[]) {
  mockSupabase.single.mockResolvedValueOnce({ data: { payment_plan: plan }, error: null })
  ;(mockSupabase.eq as jest.Mock)
    .mockImplementationOnce(() => mockSupabase) // players .eq('id', ...)
    .mockImplementationOnce(() => mockSupabase) // payments .eq('player_id', ...)
    .mockImplementationOnce(() => Promise.resolve({ // payments .eq('status', 'succeeded')
      data: succeededLabels.map(installment_label => ({ installment_label })), error: null,
    }))
}

describe('getAmountDue', () => {
  it('returns the full-plan amount for a full-plan player with no succeeded payments', async () => {
    mockGetAmountDueOnce('full', [])
    const result = await getAmountDue('player-1')
    expect(result).toEqual({ label: 'full', amountCents: 21000, isFirstInstallment: true })
  })
})

describe('requestPayment', () => {
  it('inserts a pending payment tagged with the currently-due installment', async () => {
    mockGetAmountDueOnce('full', [])
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior',
    })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 21000, installment_label: 'full' })
    )
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['g.bell2010@googlemail.com'],
      subject: expect.stringContaining('Junior'),
    }))
  })

  it('returns an error and does not insert when nothing is currently due', async () => {
    mockGetAmountDueOnce('full', ['full']) // fully paid — nothing due

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior',
    })
    expect(result.error).toBe('No payment is currently due for this player')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })
})

describe('adminMarkCashPaid', () => {
  it('inserts a succeeded cash payment tagged with the currently-due installment', async () => {
    mockGetAmountDueOnce('monthly', ['august']) // August already paid -> September ($60) is due
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await adminMarkCashPaid({ playerId: 'p1', parentId: 'pa1' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6000, installment_label: 'september', status: 'succeeded' })
    )
  })

  it('returns an error and does not insert when nothing is currently due', async () => {
    mockGetAmountDueOnce('monthly', ['august', 'september', 'october', 'november']) // fully paid

    const result = await adminMarkCashPaid({ playerId: 'p1', parentId: 'pa1' })
    expect(result.error).toBe('No payment is currently due for this player')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

it('confirmPayment sets status to succeeded and activates player', async () => {
  mockSupabase.single.mockResolvedValue({ data: { player_id: 'player-1' }, error: null })
  await confirmPayment('pay-1')
  expect(mockSupabase.from).toHaveBeenCalledWith('players')
})

it('denyPayment sets status to failed on the correct payment row', async () => {
  await denyPayment('pay-1')
  expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'failed' })
  expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'pay-1')
})

describe('getRegFeeAlertForUser', () => {
  it('returns null when the user has no parent record', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }) // parent lookup
    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toBeNull()
  })

  it('returns null when the parent has no players', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null }) // parent lookup
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // players lookup
    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toBeNull()
  })

  it('reports regFeePaid: false when the registration fee is outstanding', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null }) // parent lookup
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'player-1' }], error: null }) // players lookup
    // This function's own 2 .eq() calls (parent's user_id, players' parent_id) must be
    // explicitly queued as chainable before mockGetAmountDueOnce's 3 .eq() values, since
    // the mock's once-queue is consumed strictly in call order, not by which helper queued it.
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // parents .eq('user_id', ...)
      .mockImplementationOnce(() => mockSupabase) // players .eq('parent_id', ...)
    mockGetAmountDueOnce('full', []) // nothing paid yet

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: false })
  })

  it('reports regFeePaid: true when the registration fee installment has been paid', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'player-1' }], error: null })
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // parents .eq('user_id', ...)
      .mockImplementationOnce(() => mockSupabase) // players .eq('parent_id', ...)
    mockGetAmountDueOnce('monthly', ['august']) // reg fee (august) already paid, September now due

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: true })
  })

  it('reports regFeePaid: true when the whole plan is fully paid up', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'player-1' }], error: null })
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // parents .eq('user_id', ...)
      .mockImplementationOnce(() => mockSupabase) // players .eq('parent_id', ...)
    mockGetAmountDueOnce('full', ['full']) // getAmountDue resolves null (nothing left to pay)

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: true })
  })
})
