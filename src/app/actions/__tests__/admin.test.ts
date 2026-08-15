jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { createCoachAccount, getCoachAccounts, deleteCoachAccount, updatePlayerAgeGroups } from '../admin'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  auth: { admin: { createUser: jest.fn(), deleteUser: jest.fn(), getUserById: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
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
