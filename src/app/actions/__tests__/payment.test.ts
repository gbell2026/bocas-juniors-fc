jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

// Mock Resend so the admin-notification email never makes a real network call in tests
const mockSend = jest.fn().mockResolvedValue({ error: null })
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}))

import { requestPayment, confirmPayment, denyPayment, adminMarkCashPaid, getAmountDue, getRegFeeAlertForUser, getPaymentSchedule } from '../payment'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  in: jest.fn(),
  order: jest.fn(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
  // Note: jest.clearAllMocks() resets call history but not persistent implementations
  // like the .mockReturnThis() set above at declaration time — no need to re-apply those here.
})

/**
 * Queues the full mock sequence for ONE getAmountDue(playerId) call — it now
 * also calls isDiscountedSibling(playerId) internally, adding a second
 * `.single()`, two more chainable `.eq()` calls, and one `.order()` call.
 * Must be invoked once per getAmountDue call made during a test, in the
 * exact order those calls happen (each mock function — eq/single/order —
 * has its own independent FIFO queue, so this only needs to get each
 * function's own call order right, not interleave across functions).
 *
 * `siblingIds` is the list of player ids under the same parent, in
 * registration order — pass a list where the target player is NOT at
 * index 0 to simulate the discount applying. Defaults to a solo child
 * (never discounted).
 */
function queueGetAmountDue(plan: string, succeededLabels: (string | null)[], siblingIds: string[] = ['player-1']) {
  mockSupabase.single
    .mockResolvedValueOnce({ data: { payment_plan: plan }, error: null }) // players.eq('id',...).single() -> plan
    .mockResolvedValueOnce({ data: { parent_id: 'parent-1' }, error: null }) // isDiscountedSibling: players.eq('id',...).single() -> parent_id
  ;(mockSupabase.eq as jest.Mock)
    .mockImplementationOnce(() => mockSupabase) // players .eq('id', ...) [plan lookup]
    .mockImplementationOnce(() => mockSupabase) // payments .eq('player_id', ...)
    .mockImplementationOnce(() => Promise.resolve({ // payments .eq('status', 'succeeded') -- TERMINAL
      data: succeededLabels.map(installment_label => ({ installment_label })), error: null,
    }))
    .mockImplementationOnce(() => mockSupabase) // isDiscountedSibling: players .eq('id', ...)
    .mockImplementationOnce(() => mockSupabase) // isDiscountedSibling: players .eq('parent_id', ...)
  mockSupabase.order.mockResolvedValueOnce({ data: siblingIds.map(id => ({ id })), error: null }) // isDiscountedSibling: siblings list
}

/**
 * Same idea as queueGetAmountDue, for ONE getPaymentSchedule(playerId) call.
 * The payments query terminates via `.in()` rather than a chainable `.eq()`,
 * so no explicit `.eq()` overrides are needed for it (both `.eq()` calls
 * involved — players.id and the isDiscountedSibling ones — stay on the
 * default chainable mock).
 */
function queueGetPaymentSchedule(plan: string, payments: { installment_label: string; status: string }[], siblingIds: string[] = ['player-1']) {
  mockSupabase.single
    .mockResolvedValueOnce({ data: { payment_plan: plan }, error: null }) // plan lookup
    .mockResolvedValueOnce({ data: { parent_id: 'parent-1' }, error: null }) // isDiscountedSibling: parent_id
  mockSupabase.in.mockResolvedValueOnce({ data: payments, error: null }) // payments list
  mockSupabase.order.mockResolvedValueOnce({ data: siblingIds.map(id => ({ id })), error: null }) // siblings list
}

describe('getPaymentSchedule', () => {
  it('marks every installment outstanding when nothing has been paid or requested', async () => {
    queueGetPaymentSchedule('full', [])
    const result = await getPaymentSchedule('player-1')
    expect(result).toEqual([
      { label: 'registration', amountCents: 3000, status: 'outstanding', discounted: false },
      { label: 'full', amountCents: 21000, status: 'outstanding', discounted: false },
    ])
  })

  it('marks a succeeded installment as paid and a pending one as pending', async () => {
    queueGetPaymentSchedule('monthly', [
      { installment_label: 'registration', status: 'succeeded' },
      { installment_label: 'august', status: 'pending' },
    ])
    const result = await getPaymentSchedule('player-1')
    expect(result).toEqual([
      { label: 'registration', amountCents: 3000, status: 'paid', discounted: false },
      { label: 'august', amountCents: 3000, status: 'pending', discounted: false },
      { label: 'september', amountCents: 6000, status: 'outstanding', discounted: false },
      { label: 'october', amountCents: 6000, status: 'outstanding', discounted: false },
      { label: 'november', amountCents: 6000, status: 'outstanding', discounted: false },
    ])
  })

  it('halves season-fee amounts and flags them discounted for a second child', async () => {
    // player-2 is at index 1 (not 0) among the siblings -> qualifies for the discount
    queueGetPaymentSchedule('full', [], ['player-1', 'player-2'])
    const result = await getPaymentSchedule('player-2')
    expect(result).toEqual([
      { label: 'registration', amountCents: 3000, status: 'outstanding', discounted: false },
      { label: 'full', amountCents: 10500, status: 'outstanding', discounted: true },
    ])
  })
})

describe('getAmountDue', () => {
  it('returns the one-time registration fee first for a full-plan player with no succeeded payments', async () => {
    queueGetAmountDue('full', [])
    const result = await getAmountDue('player-1')
    expect(result).toEqual({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
  })

  it('returns the full-plan season fee once the registration fee is paid', async () => {
    queueGetAmountDue('full', ['registration'])
    const result = await getAmountDue('player-1')
    expect(result).toEqual({ label: 'full', amountCents: 21000, isFirstInstallment: false })
  })

  it('halves the season fee for a second child', async () => {
    queueGetAmountDue('full', ['registration'], ['player-1', 'player-2'])
    const result = await getAmountDue('player-2')
    expect(result).toEqual({ label: 'full', amountCents: 10500, isFirstInstallment: false })
  })

  it('does not discount the registration fee itself for a second child', async () => {
    queueGetAmountDue('full', [], ['player-1', 'player-2'])
    const result = await getAmountDue('player-2')
    expect(result).toEqual({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
  })
})

describe('requestPayment', () => {
  it('inserts a pending payment for the requested installment when it is outstanding', async () => {
    queueGetPaymentSchedule('full', [])
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior', label: 'registration',
    })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000, installment_label: 'registration' })
    )
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['g.bell2010@googlemail.com'],
      subject: expect.stringContaining('Junior'),
    }))
  })

  it('allows reporting the season fee while the registration fee is still pending review', async () => {
    queueGetPaymentSchedule('full', [{ installment_label: 'registration', status: 'pending' }])
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'monzo',
      parentName: 'Jane', playerName: 'Junior', label: 'full',
    })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 21000, installment_label: 'full' })
    )
  })

  it('inserts the discounted amount for a second child', async () => {
    queueGetPaymentSchedule('full', [], ['player-1', 'p2'])
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await requestPayment({
      playerId: 'p2', parentId: 'pa1', method: 'cash',
      parentName: 'Jane', playerName: 'Junior Two', label: 'registration',
    })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000, installment_label: 'registration' })
    )
  })

  it('returns an error and does not insert when the requested installment is already paid', async () => {
    queueGetPaymentSchedule('full', [{ installment_label: 'registration', status: 'succeeded' }])

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior', label: 'registration',
    })
    expect(result.error).toBe('This item is not currently payable')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('returns an error and does not insert when the requested installment is already pending review', async () => {
    queueGetPaymentSchedule('full', [{ installment_label: 'registration', status: 'pending' }])

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior', label: 'registration',
    })
    expect(result.error).toBe('This item is not currently payable')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('returns an error and does not insert for a label not in the player\'s plan', async () => {
    queueGetPaymentSchedule('full', [])

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior', label: 'august',
    })
    expect(result.error).toBe('This item is not currently payable')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

describe('adminMarkCashPaid', () => {
  it('inserts a succeeded cash payment tagged with the currently-due installment', async () => {
    queueGetAmountDue('monthly', ['registration', 'august']) // registration + August already paid -> September ($60) is due
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await adminMarkCashPaid({ playerId: 'p1', parentId: 'pa1' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 6000, installment_label: 'september', status: 'succeeded' })
    )
  })

  it('returns an error and does not insert when nothing is currently due', async () => {
    queueGetAmountDue('monthly', ['registration', 'august', 'september', 'october', 'november']) // fully paid

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
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // parents .eq('user_id', ...)
      .mockImplementationOnce(() => Promise.resolve({ data: [], error: null })) // players .eq('parent_id', ...) TERMINAL
    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toBeNull()
  })

  it('reports regFeePaid: false when the (only) child\'s registration fee is outstanding', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null }) // parent lookup
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // parents .eq('user_id', ...)
      .mockImplementationOnce(() => Promise.resolve({ data: [{ id: 'player-1' }], error: null })) // players .eq('parent_id', ...) TERMINAL
    queueGetAmountDue('full', []) // nothing paid yet

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: false })
  })

  it('reports regFeePaid: true once the registration fee installment is paid', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null })
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase)
      .mockImplementationOnce(() => Promise.resolve({ data: [{ id: 'player-1' }], error: null }))
    queueGetAmountDue('monthly', ['registration']) // registration fee paid, August now due

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: true })
  })

  it('reports regFeePaid: true when the whole plan is fully paid up', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null })
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase)
      .mockImplementationOnce(() => Promise.resolve({ data: [{ id: 'player-1' }], error: null }))
    queueGetAmountDue('full', ['registration', 'full']) // getAmountDue resolves null (nothing left to pay)

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: true })
  })

  it('checks every child and flags the one still owing, when the first child is fully paid', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null }) // parent lookup
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // parents .eq('user_id', ...)
      .mockImplementationOnce(() => Promise.resolve({ // players .eq('parent_id', ...) TERMINAL — two children
        data: [{ id: 'player-1' }, { id: 'player-2' }], error: null,
      }))
    queueGetAmountDue('full', ['registration', 'full'], ['player-1']) // child 1: fully paid
    queueGetAmountDue('full', [], ['player-1', 'player-2']) // child 2: registration fee outstanding

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-2', regFeePaid: false })
  })

  it('reports regFeePaid: true when every child is paid up', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null })
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase)
      .mockImplementationOnce(() => Promise.resolve({
        data: [{ id: 'player-1' }, { id: 'player-2' }], error: null,
      }))
    queueGetAmountDue('full', ['registration', 'full'], ['player-1'])
    queueGetAmountDue('full', ['registration', 'full'], ['player-1', 'player-2'])

    const result = await getRegFeeAlertForUser('user-1')
    expect(result).toEqual({ playerId: 'player-1', regFeePaid: true })
  })
})
