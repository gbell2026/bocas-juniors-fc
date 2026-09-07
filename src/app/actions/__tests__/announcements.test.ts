jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}))

const mockBatchSend = jest.fn().mockResolvedValue({ data: { data: [{ id: '1' }] }, error: null })
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ batch: { send: mockBatchSend } })),
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

const NEW_ROW = { id: 'a-1', title: 'Training moved', body: 'New time: 6pm Saturday.', created_at: '2026-09-06T00:00:00Z' }

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
  it('creates the announcement and returns the new row', async () => {
    mockService.single.mockResolvedValueOnce({ data: NEW_ROW, error: null })
    const result = await createAnnouncement({ title: 'Training moved', body: 'New time: 6pm Saturday.' })
    expect(result.error).toBeUndefined()
    expect(result.announcement).toEqual({
      id: 'a-1', title: 'Training moved', body: 'New time: 6pm Saturday.', createdAt: '2026-09-06T00:00:00Z',
    })
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Training moved' }))
    expect(result.email).toBeUndefined()
    expect(mockBatchSend).not.toHaveBeenCalled()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.single.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
    const result = await createAnnouncement({ title: 'x', body: 'y' })
    expect(result.error).toBe('Failed to create announcement')
  })

  it('rejects a blank title or body without touching the database', async () => {
    const result = await createAnnouncement({ title: '   ', body: 'y' })
    expect(result.error).toBe('Title and body are both required.')
    expect(mockService.insert).not.toHaveBeenCalled()
  })

  it('emails every distinct parent when emailParents is set', async () => {
    mockService.single.mockResolvedValueOnce({ data: NEW_ROW, error: null })
    mockService.select
      .mockReturnValueOnce(mockService) // insert(...).select() chain
      .mockResolvedValueOnce({ // parents.select('email')
        data: [{ email: 'a@x.com' }, { email: 'A@x.com' }, { email: 'b@x.com' }, { email: null }],
      })

    const result = await createAnnouncement({ title: 'Games off', body: 'Rained out.', emailParents: true })

    expect(mockBatchSend).toHaveBeenCalledTimes(1)
    const batch = mockBatchSend.mock.calls[0][0]
    expect(batch.map((m: { to: string[] }) => m.to[0])).toEqual(['a@x.com', 'b@x.com'])
    expect(result.email).toEqual({ sent: 2, failed: 0, error: undefined })
  })

  it('reports an email failure without failing the announcement', async () => {
    mockService.single.mockResolvedValueOnce({ data: NEW_ROW, error: null })
    mockService.select
      .mockReturnValueOnce(mockService)
      .mockResolvedValueOnce({ data: [{ email: 'a@x.com' }] })
    mockBatchSend.mockResolvedValueOnce({ data: null, error: { message: 'domain not verified' } })

    const result = await createAnnouncement({ title: 'Games off', body: 'Rained out.', emailParents: true })

    expect(result.announcement).toBeDefined()
    expect(result.email?.failed).toBe(1)
    expect(result.email?.error).toBeTruthy()
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
    expect(result.error).toBe('must_be_logged_in')
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
    expect(result.error).toBe('comment_failed')
  })

  it('rejects a blank comment body without touching the database', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    const result = await postComment('a1', '   ')
    expect(result.error).toBe('comment_required')
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
