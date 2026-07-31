jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { createStaffMember, updateStaffMember, deleteStaffMember } from '../staff'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('createStaffMember', () => {
  it('creates the staff member on success', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createStaffMember({ name: 'Jane Smith', roleTitle: 'Head Coach', bio: 'Coaching for 10 years.' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jane Smith', role_title: 'Head Coach', bio: 'Coaching for 10 years.', photo_cloudinary_public_id: null,
    }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await createStaffMember({ name: 'x', roleTitle: 'y', bio: 'z' })
    expect(result.error).toBe('Failed to add staff member')
  })
})

describe('updateStaffMember', () => {
  it('updates the staff member on success', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateStaffMember('s1', { name: 'Jane Smith', roleTitle: 'Head Coach', bio: 'Updated bio.' })
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await updateStaffMember('s1', { name: 'x', roleTitle: 'y', bio: 'z' })
    expect(result.error).toBe('Failed to update staff member')
  })
})

describe('deleteStaffMember', () => {
  it('deletes the staff member on success', async () => {
    mockSupabase.delete.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteStaffMember('s1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.delete.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteStaffMember('s1')
    expect(result.error).toBe('Failed to delete staff member')
  })
})
