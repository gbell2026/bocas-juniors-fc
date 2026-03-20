/**
 * @jest-environment node
 */
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}))
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: { api_sign_request: jest.fn().mockReturnValue('mock-sig') },
  }
}))

import { POST } from '../route'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

it('returns 403 if user is not admin', async () => {
  (createSupabaseServerClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  })
  ;(createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { role: 'parent' }, error: null }),
  })
  const req = new Request('http://localhost/api/cloudinary/sign', { method: 'POST', body: '{}' })
  const res = await POST(req as any)
  expect(res.status).toBe(403)
})
