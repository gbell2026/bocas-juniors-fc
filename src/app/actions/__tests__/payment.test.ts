jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { requestPayment, confirmPayment, denyPayment } from '../payment'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

it('requestPayment inserts pending payment', async () => {
  mockSupabase.single.mockResolvedValue({ data: { value: '2500' }, error: null })
  mockSupabase.insert.mockResolvedValue({ error: null })
  const result = await requestPayment({
    playerId: 'p1', parentId: 'pa1', method: 'paypal',
    parentName: 'Jane', playerName: 'Junior',
  })
  expect(result.error).toBeUndefined()
})

it('confirmPayment sets status to succeeded and activates player', async () => {
  mockSupabase.single.mockResolvedValue({ data: { player_id: 'player-1' }, error: null })
  await confirmPayment('pay-1')
  expect(mockSupabase.from).toHaveBeenCalledWith('players')
})

it('denyPayment sets status to failed on the correct payment row', async () => {
  await denyPayment('pay-1')
  expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'failed' })
  expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'pay-1')
})
