import { submitGetInvolved } from '@/app/actions/get-involved'

describe('submitGetInvolved', () => {
  it('is exported as a function', () => {
    expect(typeof submitGetInvolved).toBe('function')
  })

  it('returns error when required fields are missing', async () => {
    const result = await submitGetInvolved({
      name: '',
      email: 'test@test.com',
      interests: ['Sponsoring the kit'],
    })
    expect(result).toEqual({ error: 'required_fields' })
  })

  it('returns error when interests array is empty', async () => {
    const result = await submitGetInvolved({
      name: 'Jane',
      email: 'jane@test.com',
      interests: [],
    })
    expect(result).toEqual({ error: 'required_fields' })
  })
})
