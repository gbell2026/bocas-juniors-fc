import { getNextDue, isRegistrationFeePaid, getPlanTotalCents } from '../payment-schedule'

describe('getNextDue', () => {
  it('returns the full-plan installment when nothing is paid', () => {
    expect(getNextDue('full', [])).toEqual({ label: 'full', amountCents: 21000, isFirstInstallment: true })
  })

  it('returns null for the full plan once it is paid', () => {
    expect(getNextDue('full', ['full'])).toBeNull()
  })

  it('returns August as the first monthly installment when nothing is paid', () => {
    expect(getNextDue('monthly', [])).toEqual({ label: 'august', amountCents: 3000, isFirstInstallment: true })
  })

  it('returns September once August is paid', () => {
    expect(getNextDue('monthly', ['august'])).toEqual({ label: 'september', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns October once August and September are paid', () => {
    expect(getNextDue('monthly', ['august', 'september'])).toEqual({ label: 'october', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns November once August, September, and October are paid', () => {
    expect(getNextDue('monthly', ['august', 'september', 'october'])).toEqual({ label: 'november', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns null once all four monthly installments are paid', () => {
    expect(getNextDue('monthly', ['august', 'september', 'october', 'november'])).toBeNull()
  })

  it('ignores paid labels not relevant to the current plan', () => {
    // e.g. a player switched plans after some history — only same-plan labels count
    expect(getNextDue('monthly', ['full'])).toEqual({ label: 'august', amountCents: 3000, isFirstInstallment: true })
  })
})

describe('isRegistrationFeePaid', () => {
  it('is false for a fresh full-plan player', () => {
    expect(isRegistrationFeePaid('full', [])).toBe(false)
  })

  it('is true once the full plan is paid', () => {
    expect(isRegistrationFeePaid('full', ['full'])).toBe(true)
  })

  it('is false for a fresh monthly-plan player', () => {
    expect(isRegistrationFeePaid('monthly', [])).toBe(false)
  })

  it('is true once August (the first monthly installment) is paid, even with nothing else paid', () => {
    expect(isRegistrationFeePaid('monthly', ['august'])).toBe(true)
  })
})

describe('getPlanTotalCents', () => {
  it('full plan totals $210', () => {
    expect(getPlanTotalCents('full')).toBe(21000)
  })

  it('monthly plan totals $210', () => {
    expect(getPlanTotalCents('monthly')).toBe(21000)
  })
})
