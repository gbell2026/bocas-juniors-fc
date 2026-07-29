// Mock Supabase service client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceClient: jest.fn(),
}))

import { registerParentAndPlayer } from '../register'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  auth: { admin: { createUser: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

it('returns error if auth.admin.createUser fails', async () => {
  mockSupabase.auth.admin.createUser.mockResolvedValue({
    data: { user: null }, error: { message: 'Email taken' }
  })
  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
    paymentPlan: 'full', agreedToTerms: true,
  })
  expect(result.error).toBe('Email taken')
})

it('returns playerId on success', async () => {
  mockSupabase.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-1' } }, error: null
  })
  // parents and players use .insert().select().single() — mock via single()
  mockSupabase.single
    .mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null }) // parents
    .mockResolvedValueOnce({ data: { id: 'player-1' }, error: null }) // players
  // user_roles uses .insert() directly (no .select().single()) — must resolve as a promise
  mockSupabase.insert
    .mockReturnValueOnce(mockSupabase)  // parents .insert() → chained to .select()
    .mockReturnValueOnce(mockSupabase)  // players .insert() → chained to .select()
    .mockResolvedValueOnce({ error: null }) // user_roles .insert() → awaited directly
  mockSupabase.select.mockReturnThis()
  mockSupabase.from.mockReturnThis()

  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
    paymentPlan: 'full', agreedToTerms: true,
  })
  expect(result.playerId).toBe('player-1')
  expect(result.parentId).toBe('parent-1')
  expect(mockSupabase.insert).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ payment_plan: 'full' })
  )
})

it('returns an error if agreedToTerms is false, without creating anything', async () => {
  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
    paymentPlan: 'full', agreedToTerms: false,
  })
  expect(result.error).toBe('You must agree to the registration terms.')
  expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled()
})
