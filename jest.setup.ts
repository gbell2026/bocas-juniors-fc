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
