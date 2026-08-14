import { parseLocale } from '../locale'

describe('parseLocale', () => {
  it('returns es when given es', () => {
    expect(parseLocale('es')).toBe('es')
  })

  it('returns en when given en', () => {
    expect(parseLocale('en')).toBe('en')
  })

  it('defaults to en when given undefined', () => {
    expect(parseLocale(undefined)).toBe('en')
  })

  it('defaults to en when given an unrecognized value', () => {
    expect(parseLocale('fr')).toBe('en')
  })
})
