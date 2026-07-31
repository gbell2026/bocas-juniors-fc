jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}))

import { createAnnouncement, updateAnnouncement, deleteAnnouncement, postComment, deleteComment } from '../announcements'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

const mockService = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

const mockSession = {
  auth: { getUser: jest.fn() },
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockService)
  ;(createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSession)
  jest.clearAllMocks()
  // Note: jest.clearAllMocks() resets call history but not the persistent
  // mockReturnValue/mockResolvedValue/mockReturnThis set above — matching
  // this codebase's established convention (see payment.test.ts).
})

describe('createAnnouncement', () => {
  it('creates the announcement on success', async () => {
    mockService.insert.mockResolvedValueOnce({ error: null })
    const result = await createAnnouncement({ title: 'Training moved', body: 'New time: 6pm Saturday.' })
    expect(result.error).toBeUndefined()
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Training moved' }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.insert.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await createAnnouncement({ title: 'x', body: 'y' })
    expect(result.error).toBe('Failed to create announcement')
  })

  it('rejects a blank title or body without touching the database', async () => {
    const result = await createAnnouncement({ title: '   ', body: 'y' })
    expect(result.error).toBe('Title and body are both required.')
    expect(mockService.insert).not.toHaveBeenCalled()
  })
})

describe('updateAnnouncement', () => {
  it('updates the announcement on success', async () => {
    mockService.update.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: null })
    const result = await updateAnnouncement('a1', { title: 'Updated', body: 'New body' })
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.update.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await updateAnnouncement('a1', { title: 'x', body: 'y' })
    expect(result.error).toBe('Failed to update announcement')
  })

  it('rejects a blank title or body without touching the database', async () => {
    const result = await updateAnnouncement('a1', { title: 'x', body: '   ' })
    expect(result.error).toBe('Title and body are both required.')
    expect(mockService.update).not.toHaveBeenCalled()
  })
})

describe('deleteAnnouncement', () => {
  it('deletes the announcement on success', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteAnnouncement('a1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteAnnouncement('a1')
    expect(result.error).toBe('Failed to delete announcement')
  })
})

describe('postComment', () => {
  it('rejects when there is no authenticated user, without touching the database', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await postComment('a1', 'hello')
    expect(result.error).toBe('You must be logged in to comment.')
    expect(mockService.insert).not.toHaveBeenCalled()
  })

  it('uses the parent record name when one exists', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockService.single.mockResolvedValueOnce({ data: { name: 'Jane Doe' }, error: null }) // parents lookup
    mockService.insert.mockResolvedValueOnce({ error: null }) // comment insert

    const result = await postComment('a1', 'hello')
    expect(result.error).toBeUndefined()
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({
      announcement_id: 'a1', user_id: 'user-1', author_name: 'Jane Doe', body: 'hello',
    }))
  })

  it('falls back to a generic name when no parent record exists', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-2' } } })
    mockService.single.mockResolvedValueOnce({ data: null, error: null }) // no parents row
    mockService.insert.mockResolvedValueOnce({ error: null })

    const result = await postComment('a1', 'hello')
    expect(result.error).toBeUndefined()
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({ author_name: 'A club member' }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockService.single.mockResolvedValueOnce({ data: { name: 'Jane Doe' }, error: null })
    mockService.insert.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await postComment('a1', 'hello')
    expect(result.error).toBe('Failed to post comment')
  })

  it('rejects a blank comment body without touching the database', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    const result = await postComment('a1', '   ')
    expect(result.error).toBe('Comment cannot be empty.')
    expect(mockService.insert).not.toHaveBeenCalled()
  })
})

describe('deleteComment', () => {
  it('deletes the comment on success', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteComment('c1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteComment('c1')
    expect(result.error).toBe('Failed to delete comment')
  })
})
