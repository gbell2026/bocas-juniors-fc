import { getNextDue, isRegistrationFeePaid, getPlanTotalCents } from '../payment-schedule'

describe('getNextDue', () => {
  it('returns the registration fee first for a fresh full-plan player', () => {
    expect(getNextDue('full', [])).toEqual({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
  })

  it('returns the full-plan season installment once the registration fee is paid', () => {
    expect(getNextDue('full', ['registration'])).toEqual({ label: 'full', amountCents: 21000, isFirstInstallment: false })
  })

  it('returns null for the full plan once registration and the season fee are both paid', () => {
    expect(getNextDue('full', ['registration', 'full'])).toBeNull()
  })

  it('returns the registration fee first for a fresh monthly-plan player', () => {
    expect(getNextDue('monthly', [])).toEqual({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
  })

  it('returns August once the registration fee is paid', () => {
    expect(getNextDue('monthly', ['registration'])).toEqual({ label: 'august', amountCents: 3000, isFirstInstallment: false })
  })

  it('returns September once registration and August are paid', () => {
    expect(getNextDue('monthly', ['registration', 'august'])).toEqual({ label: 'september', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns October once registration, August, and September are paid', () => {
    expect(getNextDue('monthly', ['registration', 'august', 'september'])).toEqual({ label: 'october', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns November once registration, August, September, and October are paid', () => {
    expect(getNextDue('monthly', ['registration', 'august', 'september', 'october'])).toEqual({ label: 'november', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns null once registration and all four monthly installments are paid', () => {
    expect(getNextDue('monthly', ['registration', 'august', 'september', 'october', 'november'])).toBeNull()
  })

  it('ignores paid labels not relevant to the current plan', () => {
    // e.g. a player switched plans after some history — only same-plan labels count
    expect(getNextDue('monthly', ['full'])).toEqual({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
  })
})

describe('isRegistrationFeePaid', () => {
  it('is false for a fresh full-plan player', () => {
    expect(isRegistrationFeePaid('full', [])).toBe(false)
  })

  it('is true once the registration fee is paid, even if the season fee is not', () => {
    expect(isRegistrationFeePaid('full', ['registration'])).toBe(true)
  })

  it('is false for a fresh monthly-plan player', () => {
    expect(isRegistrationFeePaid('monthly', [])).toBe(false)
  })

  it('is true once the registration fee is paid, even with nothing else paid', () => {
    expect(isRegistrationFeePaid('monthly', ['registration'])).toBe(true)
  })

  it('is false if only August is paid without the registration fee', () => {
    expect(isRegistrationFeePaid('monthly', ['august'])).toBe(false)
  })
})

describe('getPlanTotalCents', () => {
  it('full plan totals $240 ($30 registration + $210 season)', () => {
    expect(getPlanTotalCents('full')).toBe(24000)
  })

  it('monthly plan totals $240 ($30 registration + $210 season)', () => {
    expect(getPlanTotalCents('monthly')).toBe(24000)
  })
})

describe('sibling discount (discounted = true)', () => {
  it('halves the full-plan season fee but not the registration fee', () => {
    expect(getNextDue('full', [], true)).toEqual({ label: 'registration', amountCents: 3000, isFirstInstallment: true })
    expect(getNextDue('full', ['registration'], true)).toEqual({ label: 'full', amountCents: 10500, isFirstInstallment: false })
  })

  it('halves every monthly installment but not the registration fee', () => {
    expect(getNextDue('monthly', ['registration'], true)).toEqual({ label: 'august', amountCents: 1500, isFirstInstallment: false })
    expect(getNextDue('monthly', ['registration', 'august'], true)).toEqual({ label: 'september', amountCents: 3000, isFirstInstallment: false })
    expect(getNextDue('monthly', ['registration', 'august', 'september'], true)).toEqual({ label: 'october', amountCents: 3000, isFirstInstallment: false })
    expect(getNextDue('monthly', ['registration', 'august', 'september', 'october'], true)).toEqual({ label: 'november', amountCents: 3000, isFirstInstallment: false })
  })

  it('full plan totals $135 discounted ($30 registration + $105 season)', () => {
    expect(getPlanTotalCents('full', true)).toBe(13500)
  })

  it('monthly plan totals $135 discounted ($30 registration + $105 season)', () => {
    expect(getPlanTotalCents('monthly', true)).toBe(13500)
  })

  it('defaults to full price when discounted is omitted', () => {
    expect(getNextDue('full', ['registration'])).toEqual({ label: 'full', amountCents: 21000, isFirstInstallment: false })
  })
})
