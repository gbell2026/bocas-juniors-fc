// Mock Supabase service client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceClient: jest.fn(),
  createSupabaseServerClient: jest.fn(),
}))

// Mock Resend so the admin-notification email never makes a real network call in tests
const mockSend = jest.fn().mockResolvedValue({ error: null })
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}))

import { registerParentAndPlayer, addChildToParent } from '../register'
import { createSupabaseServiceClient, createSupabaseServerClient } from '@/lib/supabase/server'

const mockSupabase = {
  auth: { admin: { createUser: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

const mockSession = {
  auth: { getUser: jest.fn() },
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  ;(createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSession)
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
  expect(result.error).toBe('auth_error')
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
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
    to: ['g.bell2010@googlemail.com'],
    subject: expect.stringContaining('Junior'),
  }))
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
    to: ['jane@test.com'],
    subject: expect.stringContaining('Jane'),
  }))
})

it('returns an error if agreedToTerms is false, without creating anything', async () => {
  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
    paymentPlan: 'full', agreedToTerms: false,
  })
  expect(result.error).toBe('must_agree_terms')
  expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled()
})

describe('addChildToParent', () => {
  it('rejects when there is no authenticated user, without touching the database', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await addChildToParent({
      playerName: 'Second Kid', dateOfBirth: '2017-01-01', position: 'Midfielder', paymentPlan: 'full',
    })
    expect(result.error).toBe('login_required_child')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('adds the child under the caller\'s own parent record, derived from their session', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'parent-1', name: 'Jane', email: 'jane@test.com' }, error: null }) // parent lookup
      .mockResolvedValueOnce({ data: { id: 'player-2' }, error: null }) // player insert

    const result = await addChildToParent({
      playerName: 'Second Kid', dateOfBirth: '2017-01-01', position: 'Midfielder', paymentPlan: 'full',
    })
    expect(result.error).toBeUndefined()
    expect(result.playerId).toBe('player-2')
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ parent_id: 'parent-1', name: 'Second Kid', payment_plan: 'full' })
    )
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['g.bell2010@googlemail.com'],
      subject: expect.stringContaining('Second Kid'),
    }))
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
      to: ['jane@test.com'],
      subject: expect.stringContaining('Jane'),
    }))
  })

  it('returns an error when the caller has no parent record', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: null }) // no parent found

    const result = await addChildToParent({
      playerName: 'Second Kid', dateOfBirth: '2017-01-01', position: 'Midfielder', paymentPlan: 'full',
    })
    expect(result.error).toBe('parent_not_found')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })

  it('returns a friendly error on DB failure', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockSupabase.single
      .mockResolvedValueOnce({ data: { id: 'parent-1', name: 'Jane', email: 'jane@test.com' }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'db error' } })

    const result = await addChildToParent({
      playerName: 'Second Kid', dateOfBirth: '2017-01-01', position: 'Midfielder', paymentPlan: 'full',
    })
    expect(result.error).toBe('submission_failed')
  })
})
