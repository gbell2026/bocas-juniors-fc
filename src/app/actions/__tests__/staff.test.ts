jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { createStaffMember, updateStaffMember, deleteStaffMember } from '../staff'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

const STAFF_ROW = {
  id: 'staff-1', name: 'Jane Smith', role_title: 'Head Coach', bio: 'Coaching for 10 years.',
  photo_cloudinary_public_id: null, nationality: null, one_line_intro: null, background: null,
  qualifications: null, philosophy: null, favourite_team: null, fun_fact: null, created_at: '2026-01-01',
}

describe('createStaffMember', () => {
  it('creates the staff member and returns it, mapped to camelCase', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: STAFF_ROW, error: null })
    const result = await createStaffMember({ name: 'Jane Smith', roleTitle: 'Head Coach', bio: 'Coaching for 10 years.' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jane Smith', role_title: 'Head Coach', bio: 'Coaching for 10 years.', photo_cloudinary_public_id: null,
    }))
    expect(result.staff).toEqual({
      id: 'staff-1', name: 'Jane Smith', roleTitle: 'Head Coach', bio: 'Coaching for 10 years.',
      photoCloudinaryPublicId: null, nationality: null, oneLineIntro: null, background: null,
      qualifications: null, philosophy: null, favouriteTeam: null, funFact: null, createdAt: '2026-01-01',
    })
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const result = await createStaffMember({ name: 'x', roleTitle: 'y', bio: 'z' })
    expect(result.error).toBe('Failed to add staff member')
    expect(result.staff).toBeUndefined()
  })

  it('maps the optional rich bio fields to snake_case, defaulting to null when omitted', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: STAFF_ROW, error: null })
    await createStaffMember({
      name: 'Josh', roleTitle: 'Director of Coaching', bio: 'About Josh.',
      nationality: 'American — Colorado, USA', oneLineIntro: 'A passionate youth coach.',
      background: 'Played since age 4.', qualifications: 'USSF National D License.',
      philosophy: 'Fun first.', favouriteTeam: 'Any team that competes.', funFact: 'Scored an odd goal once.',
    })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      nationality: 'American — Colorado, USA',
      one_line_intro: 'A passionate youth coach.',
      background: 'Played since age 4.',
      qualifications: 'USSF National D License.',
      philosophy: 'Fun first.',
      favourite_team: 'Any team that competes.',
      fun_fact: 'Scored an odd goal once.',
    }))
  })

  it('defaults every optional rich field to null when not provided', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: STAFF_ROW, error: null })
    await createStaffMember({ name: 'Jane', roleTitle: 'Coach', bio: 'Bio.' })
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      nationality: null, one_line_intro: null, background: null,
      qualifications: null, philosophy: null, favourite_team: null, fun_fact: null,
    }))
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
