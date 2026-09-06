jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { getLeagueBanner, setLeagueBanner } from '../league-banner'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  in: jest.fn(),
  upsert: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('getLeagueBanner', () => {
  it('maps the two settings rows', async () => {
    mockSupabase.in.mockResolvedValueOnce({
      data: [
        { key: 'league_postponed', value: 'true' },
        { key: 'league_postponed_message', value: 'Rained off — see you next week.' },
      ],
    })
    expect(await getLeagueBanner()).toEqual({
      active: true,
      message: 'Rained off — see you next week.',
    })
  })

  it('defaults to inactive/empty when nothing is stored', async () => {
    mockSupabase.in.mockResolvedValueOnce({ data: [] })
    expect(await getLeagueBanner()).toEqual({ active: false, message: '' })
  })
})

describe('setLeagueBanner', () => {
  it('refuses to activate with a blank message and does not write', async () => {
    const result = await setLeagueBanner({ active: true, message: '   ' })
    expect(result.error).toBeTruthy()
    expect(mockSupabase.upsert).not.toHaveBeenCalled()
  })

  it('upserts both keys and revalidates the homepage', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ error: null })
    const result = await setLeagueBanner({ active: true, message: '  Postponed  ' })

    expect(result.error).toBeUndefined()
    const [rows, opts] = mockSupabase.upsert.mock.calls[0]
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: 'league_postponed', value: 'true' }),
        expect.objectContaining({ key: 'league_postponed_message', value: 'Postponed' }),
      ])
    )
    expect(opts).toEqual({ onConflict: 'key' })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('stores false when hiding the banner', async () => {
    mockSupabase.upsert.mockResolvedValueOnce({ error: null })
    await setLeagueBanner({ active: false, message: '' })
    const [rows] = mockSupabase.upsert.mock.calls[0]
    expect(rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: 'league_postponed', value: 'false' })])
    )
  })
})
