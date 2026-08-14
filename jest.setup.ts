import '@testing-library/jest-dom'

// Polyfill TextEncoder for jsdom environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util')
  global.TextEncoder = TextEncoder
  global.TextDecoder = TextDecoder
}

// Mock environment variables for testing
if (!process.env.RESEND_API_KEY) {
  process.env.RESEND_API_KEY = 're_test_key'
}

// LocaleProvider (src/lib/i18n/locale-context.tsx) calls useRouter() from
// next/navigation, which throws "invariant expected app router to be
// mounted" outside a real Next.js App Router context. Mocked globally since
// LocaleProvider wraps most of the component tree — every test rendering a
// component that calls useLocale() would otherwise need this individually.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: jest.fn(), push: jest.fn(), replace: jest.fn(), back: jest.fn(), forward: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
