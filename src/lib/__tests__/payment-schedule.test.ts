import { getNextDue, isRegistrationFeePaid, getPlanTotalCents, getSchedule, getMonthlyStatus } from '../payment-schedule'

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

describe('joinMonth proration', () => {
  it('defaults to august, matching pre-proration behavior exactly', () => {
    expect(getSchedule('monthly')).toEqual(getSchedule('monthly', false, 'august'))
    expect(getSchedule('full')).toEqual(getSchedule('full', false, 'august'))
  })

  it('monthly plan skips installments before the join month', () => {
    expect(getSchedule('monthly', false, 'october')).toEqual([
      { label: 'registration', amountCents: 3000 },
      { label: 'october', amountCents: 6000 },
      { label: 'november', amountCents: 6000 },
    ])
  })

  it('monthly plan for a november joiner only owes registration + November', () => {
    expect(getSchedule('monthly', false, 'november')).toEqual([
      { label: 'registration', amountCents: 3000 },
      { label: 'november', amountCents: 6000 },
    ])
  })

  it('full plan becomes the sum of the remaining months, paid as one installment', () => {
    // October + November = $60 + $60 = $120
    expect(getSchedule('full', false, 'october')).toEqual([
      { label: 'registration', amountCents: 3000 },
      { label: 'full', amountCents: 12000 },
    ])
  })

  it('full plan for a september joiner sums September + October + November', () => {
    expect(getSchedule('full', false, 'september')).toEqual([
      { label: 'registration', amountCents: 3000 },
      { label: 'full', amountCents: 18000 },
    ])
  })

  it('sibling discount still halves the prorated amount', () => {
    expect(getSchedule('full', true, 'october')).toEqual([
      { label: 'registration', amountCents: 3000 },
      { label: 'full', amountCents: 6000 },
    ])
  })

  it('getNextDue and getPlanTotalCents respect joinMonth too', () => {
    expect(getNextDue('monthly', ['registration'], false, 'october')).toEqual({ label: 'october', amountCents: 6000, isFirstInstallment: false })
    expect(getPlanTotalCents('monthly', false, 'october')).toBe(15000) // 3000 + 6000 + 6000
  })
})

describe('getMonthlyStatus', () => {
  it('monthly plan: each month reflects its own paid/pending/outstanding status', () => {
    expect(getMonthlyStatus('monthly', ['registration', 'august'], ['september'], 'august')).toEqual([
      { month: 'august', status: 'paid' },
      { month: 'september', status: 'pending' },
      { month: 'october', status: 'outstanding' },
      { month: 'november', status: 'outstanding' },
    ])
  })

  it('monthly plan: months before the join month are notApplicable', () => {
    expect(getMonthlyStatus('monthly', ['registration', 'october'], [], 'october')).toEqual([
      { month: 'august', status: 'notApplicable' },
      { month: 'september', status: 'notApplicable' },
      { month: 'october', status: 'paid' },
      { month: 'november', status: 'outstanding' },
    ])
  })

  it('full plan: the lump-sum status applies to every applicable month at once when paid', () => {
    expect(getMonthlyStatus('full', ['registration', 'full'], [], 'august')).toEqual([
      { month: 'august', status: 'paid' },
      { month: 'september', status: 'paid' },
      { month: 'october', status: 'paid' },
      { month: 'november', status: 'paid' },
    ])
  })

  it('full plan: the lump-sum status applies to every applicable month at once when pending', () => {
    expect(getMonthlyStatus('full', ['registration'], ['full'], 'august')).toEqual([
      { month: 'august', status: 'pending' },
      { month: 'september', status: 'pending' },
      { month: 'october', status: 'pending' },
      { month: 'november', status: 'pending' },
    ])
  })

  it('full plan: outstanding lump sum leaves every applicable month outstanding, and pre-join months notApplicable', () => {
    expect(getMonthlyStatus('full', ['registration'], [], 'october')).toEqual([
      { month: 'august', status: 'notApplicable' },
      { month: 'september', status: 'notApplicable' },
      { month: 'october', status: 'outstanding' },
      { month: 'november', status: 'outstanding' },
    ])
  })
})
