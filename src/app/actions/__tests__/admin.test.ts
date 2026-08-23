jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))
jest.mock('@/app/actions/payment', () => ({ getAmountDue: jest.fn() }))

import { createCoachAccount, getCoachAccounts, deleteCoachAccount, updatePlayerAgeGroups, cancelPlayer, restorePlayer, deletePlayer, getAllPlayers } from '../admin'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getAmountDue } from '@/app/actions/payment'

const mockSupabase = {
  auth: { admin: { createUser: jest.fn(), deleteUser: jest.fn(), getUserById: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  order: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('createCoachAccount', () => {
  const input = { name: 'Josh Miller', email: 'josh@example.com', password: 'pass1234' }

  it('returns an error if auth user creation fails, without touching user_roles', async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Email taken' } })
    const result = await createCoachAccount(input)
    expect(result.error).toBe('Failed to create login')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('rolls back the auth user if the user_roles insert fails', async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await createCoachAccount(input)
    expect(result.error).toBe('Failed to assign coach role')
    expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('creates the auth user and assigns the coach role on success', async () => {
    mockSupabase.auth.admin.createUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    mockSupabase.insert.mockResolvedValueOnce({ error: null })

    const result = await createCoachAccount(input)
    expect(result.error).toBeUndefined()
    expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ user_id: 'user-1', role: 'coach' })
  })
})

describe('getCoachAccounts', () => {
  it('maps each coach user_roles row to its email via getUserById', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ data: [{ user_id: 'user-1' }, { user_id: 'user-2' }], error: null })
    mockSupabase.auth.admin.getUserById
      .mockResolvedValueOnce({ data: { user: { email: 'josh@example.com' } } })
      .mockResolvedValueOnce({ data: { user: { email: 'morgan@example.com' } } })

    const result = await getCoachAccounts()
    expect(result).toEqual([
      { userId: 'user-1', email: 'josh@example.com' },
      { userId: 'user-2', email: 'morgan@example.com' },
    ])
  })

  it('returns an empty array when there are no coach accounts', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ data: [], error: null })
    const result = await getCoachAccounts()
    expect(result).toEqual([])
    expect(mockSupabase.auth.admin.getUserById).not.toHaveBeenCalled()
  })
})

describe('deleteCoachAccount', () => {
  it('removes the coach role and deletes the auth user', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteCoachAccount('user-1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
    expect(mockSupabase.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('surfaces a friendly error if removing the role fails, without deleting the auth user', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteCoachAccount('user-1')
    expect(result.error).toBe('Failed to remove coach role')
    expect(mockSupabase.auth.admin.deleteUser).not.toHaveBeenCalled()
  })
})

describe('updatePlayerAgeGroups', () => {
  it('updates the player with the given age groups', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await updatePlayerAgeGroups('player-1', ['U10', 'U14'])
    expect(mockSupabase.update).toHaveBeenCalledWith({ age_groups: ['U10', 'U14'] })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'player-1')
  })
})

describe('cancelPlayer', () => {
  it('sets status to cancelled and clears return_date', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await cancelPlayer('player-1')
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'cancelled', return_date: null })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'player-1')
  })
})

describe('restorePlayer', () => {
  it('sets status back to active', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await restorePlayer('player-1')
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'active' })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'player-1')
  })
})

describe('getAllPlayers', () => {
  it('sets hasPayments true when the player has any payment row, regardless of status', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{
        id: 'player-1', name: 'Alice', payment_plan: 'full', age_groups: ['U10'],
        payments: [{ paid_at: null, status: 'pending', installment_label: 'registration' }],
      }],
      error: null,
    })
    const result = await getAllPlayers()
    expect(result[0].hasPayments).toBe(true)
  })

  it('sets hasPayments false when the player has no payment rows', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'player-2', name: 'Bob', payment_plan: 'full', age_groups: [], payments: [] }],
      error: null,
    })
    const result = await getAllPlayers()
    expect(result[0].hasPayments).toBe(false)
  })

  it('still computes lastPaidAt from only succeeded payments', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{
        id: 'player-3', name: 'Cara', payment_plan: 'full', age_groups: [],
        payments: [
          { paid_at: '2026-08-01', status: 'succeeded', installment_label: 'registration' },
          { paid_at: '2026-09-01', status: 'pending', installment_label: 'full' },
        ],
      }],
      error: null,
    })
    const result = await getAllPlayers()
    expect(result[0].lastPaidAt).toBe('2026-08-01')
    expect(result[0].regFeePaid).toBe(true)
    expect(result[0].hasPayments).toBe(true)
  })

  it('sets paymentStatus to paidUp when getAmountDue returns null', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'player-4', name: 'Dan', payment_plan: 'full', age_groups: [], payments: [] }],
      error: null,
    })
    ;(getAmountDue as jest.Mock).mockResolvedValueOnce(null)
    const result = await getAllPlayers()
    expect(result[0].paymentStatus).toEqual({ kind: 'paidUp' })
  })

  it('sets paymentStatus to awaitingRegistration when the registration fee is next due', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'player-5', name: 'Eve', payment_plan: 'full', age_groups: [], payments: [] }],
      error: null,
    })
    ;(getAmountDue as jest.Mock).mockResolvedValueOnce({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
    const result = await getAllPlayers()
    expect(result[0].paymentStatus).toEqual({ kind: 'awaitingRegistration' })
  })

  it('sets paymentStatus to owes with the label and amount when a season installment is next due', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'player-6', name: 'Finn', payment_plan: 'monthly', age_groups: [], payments: [] }],
      error: null,
    })
    ;(getAmountDue as jest.Mock).mockResolvedValueOnce({ label: 'september', amountCents: 6000, isFirstInstallment: false })
    const result = await getAllPlayers()
    expect(result[0].paymentStatus).toEqual({ kind: 'owes', label: 'september', amountCents: 6000 })
  })

  it('computes monthlyStatus from paid and pending installment labels', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{
        id: 'player-7', name: 'Gina', payment_plan: 'monthly', age_groups: [], join_month: 'august',
        payments: [
          { paid_at: '2026-08-01', status: 'succeeded', installment_label: 'registration' },
          { paid_at: '2026-08-01', status: 'succeeded', installment_label: 'august' },
          { paid_at: null, status: 'pending', installment_label: 'september' },
        ],
      }],
      error: null,
    })
    ;(getAmountDue as jest.Mock).mockResolvedValueOnce({ label: 'september', amountCents: 6000, isFirstInstallment: false })
    const result = await getAllPlayers()
    expect(result[0].monthlyStatus).toEqual([
      { month: 'august', status: 'paid' },
      { month: 'september', status: 'pending' },
      { month: 'october', status: 'outstanding' },
      { month: 'november', status: 'outstanding' },
    ])
  })

  it('computes monthlyStatus for a full-plan player, applying the lump-sum status to every applicable month', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{
        id: 'player-8', name: 'Hank', payment_plan: 'full', age_groups: [], join_month: 'october',
        payments: [
          { paid_at: '2026-10-01', status: 'succeeded', installment_label: 'registration' },
          { paid_at: '2026-10-01', status: 'succeeded', installment_label: 'full' },
        ],
      }],
      error: null,
    })
    ;(getAmountDue as jest.Mock).mockResolvedValueOnce(null)
    const result = await getAllPlayers()
    expect(result[0].monthlyStatus).toEqual([
      { month: 'august', status: 'notApplicable' },
      { month: 'september', status: 'notApplicable' },
      { month: 'october', status: 'paid' },
      { month: 'november', status: 'paid' },
    ])
  })
})

describe('deletePlayer', () => {
  it('deletes the player when they have no payment history', async () => {
    // deletePlayer's real call chain is:
    //   .from('payments').select('id').eq('player_id', ...).limit(1)   -- payments check; eq() stays chainable, limit() is TERMINAL
    //   .from('players').delete().eq('id', ...)                        -- the actual delete; eq() is TERMINAL here
    // eq() is called twice across this function, so its queue needs an
    // explicit chainable entry for the first (non-terminal) call — a bare
    // mockResolvedValueOnce would return a Promise instead of mockSupabase
    // for the first call, and the following .limit(1) would throw "limit
    // is not a function".
    mockSupabase.select.mockReturnValueOnce(mockSupabase) // payments .select('id') -> chainable
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // payments .eq('player_id', ...) -> chainable, NOT terminal
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // payments .limit(1) -> TERMINAL, no payments
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // players .delete().eq('id', ...) -> TERMINAL

    const result = await deletePlayer('player-1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
    expect(mockSupabase.select).toHaveBeenCalledWith('id')
    expect(mockSupabase.eq).toHaveBeenNthCalledWith(2, 'id', 'player-1')
  })

  it('refuses to delete a player with any payment history, and does not call delete', async () => {
    mockSupabase.select.mockReturnValueOnce(mockSupabase) // payments .select('id') -> chainable
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // payments .eq('player_id', ...) -> chainable, NOT terminal
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'pay-1' }], error: null }) // payments .limit(1) -> TERMINAL, one payment found
    // delete() is never reached in this test, so no second eq() queuing is needed.

    const result = await deletePlayer('player-1')
    expect(result.error).toBe('Cannot delete a player with payment history — cancel instead.')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('returns a friendly error when the delete itself fails', async () => {
    mockSupabase.select.mockReturnValueOnce(mockSupabase) // payments .select('id') -> chainable
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // payments .eq('player_id', ...) -> chainable, NOT terminal
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // payments .limit(1) -> TERMINAL, no payments
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } }) // players .delete().eq('id', ...) -> TERMINAL, fails

    const result = await deletePlayer('player-1')
    expect(result.error).toBe('Failed to delete player')
  })
})
