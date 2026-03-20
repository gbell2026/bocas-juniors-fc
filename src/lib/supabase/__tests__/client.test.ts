describe('createBrowserClient', () => {
  it('returns a client without throwing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    const { createBrowserClient } = require('../client')
    expect(() => createBrowserClient()).not.toThrow()
  })
})
