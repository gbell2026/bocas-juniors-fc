jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))
// Deliberate deviation from this repo's convention of only mocking
// @/lib/supabase/server — driving getPaymentSchedule's real DB-mock chain here
// would be disproportionate to what these tests actually verify (forecast
// aggregation, not schedule computation, which has its own tests).
jest.mock('@/app/actions/payment', () => ({ getPaymentSchedule: jest.fn() }))

import {
  getFinanceSeasons, createFinanceSeason, updateFinanceSeason, setSeasonStartingBalance,
  getFinanceCategories, createFinanceCategory, renameFinanceCategory, deleteFinanceCategory,
  getFinanceEntries, createFinanceEntry, updateFinanceEntry, deleteFinanceEntry,
  getFinanceBudgets, setFinanceBudget, getFinancePnL, getOutstandingBalanceForecast,
} from '../finances'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getPaymentSchedule } from '@/app/actions/payment'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  order: jest.fn(),
  single: jest.fn(),
  limit: jest.fn(),
  upsert: jest.fn(),
  in: jest.fn(),
  gte: jest.fn(),
  lt: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('getFinanceSeasons', () => {
  it('returns seasons ordered newest first', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 's1', label: '2026 Season', start_date: '2026-08-01', end_date: '2026-12-31', created_at: '2026-01-01', starting_balance_cents: 180000 }],
      error: null,
    })
    const result = await getFinanceSeasons()
    expect(result).toEqual([{ id: 's1', label: '2026 Season', startDate: '2026-08-01', endDate: '2026-12-31', startingBalanceCents: 180000 }])
    expect(mockSupabase.order).toHaveBeenCalledWith('start_date', { ascending: false })
  })
})

describe('setSeasonStartingBalance', () => {
  it("updates a season's starting balance", async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await setSeasonStartingBalance('s1', 180000)
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ starting_balance_cents: 180000 })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 's1')
  })
})

describe('createFinanceSeason', () => {
  it('creates a season', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceSeason({ label: '2026 Season', startDate: '2026-08-01', endDate: '2026-12-31' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ label: '2026 Season', start_date: '2026-08-01', end_date: '2026-12-31' })
  })

  it('rejects an end date on or before the start date', async () => {
    const result = await createFinanceSeason({ label: '2026 Season', startDate: '2026-12-31', endDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

describe('updateFinanceSeason', () => {
  it('updates a season', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateFinanceSeason('s1', { label: 'Renamed', startDate: '2026-08-01', endDate: '2026-12-31' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ label: 'Renamed', start_date: '2026-08-01', end_date: '2026-12-31' })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 's1')
  })

  it('rejects an end date on or before the start date', async () => {
    const result = await updateFinanceSeason('s1', { label: 'Renamed', startDate: '2026-12-31', endDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})

describe('getFinanceCategories', () => {
  it('returns categories', async () => {
    // getFinanceCategories calls .order('kind').order('name') — two calls in one
    // chain. The first must return mockSupabase (chainable); only the second
    // resolves. Queuing just one mockResolvedValueOnce here would be consumed
    // by the FIRST call instead, breaking the chain — queue both explicitly.
    mockSupabase.order.mockReturnValueOnce(mockSupabase) // .order('kind')
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'c1', name: 'Wages', kind: 'expense', auto_source: null }],
      error: null,
    }) // .order('name')
    const result = await getFinanceCategories()
    expect(result).toEqual([{ id: 'c1', name: 'Wages', kind: 'expense', autoSource: null }])
  })
})

describe('createFinanceCategory', () => {
  it('creates a manual category', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceCategory({ name: 'Referee Fees', kind: 'expense' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ name: 'Referee Fees', kind: 'expense', auto_source: null })
  })
})

describe('renameFinanceCategory', () => {
  it('renames a manual category', async () => {
    // renameFinanceCategory calls .eq('id', id) twice: once (chainable) before
    // the auto_source .single() lookup, then again (terminal) for the update.
    // Queuing only one mockResolvedValueOnce would be consumed by the FIRST
    // (chainable) call, breaking .single() — queue the chainable return first.
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // auto_source check .eq('id', id)
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // update .eq('id', id)
    const result = await renameFinanceCategory('c1', 'New Name')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ name: 'New Name' })
  })

  it('refuses to rename an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'registration' }, error: null })
    const result = await renameFinanceCategory('c1', 'New Name')
    expect(result.error).toBe('This category is computed automatically and can\'t be renamed')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})

describe('deleteFinanceCategory', () => {
  it('refuses to delete an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'subscription' }, error: null })
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category is computed automatically and can\'t be deleted')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a category with logged entries', async () => {
    // The implementation queries entries and budgets unconditionally (not
    // short-circuited) before checking either result, so both .limit(1) calls
    // always happen — queue a value for both, even though only the first
    // (entries) is what this test is actually asserting on.
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'e1' }], error: null }) // entries: has one
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // budgets: none
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category has logged entries or a budget — remove those first')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a category with a budget set', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no entries
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'b1' }], error: null }) // has a budget
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category has logged entries or a budget — remove those first')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('deletes a manual category with no entries or budgets', async () => {
    // .eq() is called 4 times in this path: auto_source check (chainable,
    // before .single()), the entries check (chainable, before .limit()), the
    // budgets check (chainable, before .limit()), and finally the delete
    // itself (terminal). Only the last should resolve — the first three must
    // be queued to return mockSupabase, or the terminal value gets
    // front-consumed by the very first call and breaks .single().
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // auto_source check .eq('id', id)
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // entries check .eq('category_id', id)
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no entries
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // budgets check .eq('category_id', id)
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no budget
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // the delete itself .eq('id', id)
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
  })
})

describe('getFinanceEntries', () => {
  it('returns entries for a season, newest first', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'e1', season_id: 's1', category_id: 'c1', amount_cents: 50000, entry_date: '2026-09-01', note: 'Kit sponsor', status: 'confirmed', finance_categories: { name: 'Sponsorship' } }],
      error: null,
    })
    const result = await getFinanceEntries('s1')
    expect(result).toEqual([{ id: 'e1', categoryId: 'c1', categoryName: 'Sponsorship', amountCents: 50000, entryDate: '2026-09-01', note: 'Kit sponsor', status: 'confirmed' }])
  })
})

describe('createFinanceEntry', () => {
  it('creates an entry for a manual category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceEntry({ seasonId: 's1', categoryId: 'c1', amountCents: 50000, entryDate: '2026-09-01', note: 'Kit sponsor', status: 'confirmed' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      season_id: 's1', category_id: 'c1', amount_cents: 50000, entry_date: '2026-09-01', note: 'Kit sponsor', status: 'confirmed',
    })
  })

  it('refuses to create an entry for an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'registration' }, error: null })
    const result = await createFinanceEntry({ seasonId: 's1', categoryId: 'c1', amountCents: 50000, entryDate: '2026-09-01', status: 'confirmed' })
    expect(result.error).toBe("This category is computed automatically — it can't be logged manually")
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

describe('updateFinanceEntry', () => {
  it('updates an entry, including moving it from forecasted to confirmed', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateFinanceEntry('e1', { amountCents: 60000, entryDate: '2026-09-02', note: 'Updated', status: 'confirmed' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ amount_cents: 60000, entry_date: '2026-09-02', note: 'Updated', status: 'confirmed' })
  })
})

describe('deleteFinanceEntry', () => {
  it('deletes an entry', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteFinanceEntry('e1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
  })
})

describe('getFinanceBudgets', () => {
  it('returns budgets for a season as a map of category id to target', async () => {
    mockSupabase.eq.mockResolvedValueOnce({
      data: [{ category_id: 'c1', target_amount_cents: 200000 }],
      error: null,
    })
    const result = await getFinanceBudgets('s1')
    expect(result).toEqual({ c1: 200000 })
  })
})

describe('setFinanceBudget', () => {
  it('upserts a budget target', async () => {
    mockSupabase.upsert = jest.fn().mockResolvedValueOnce({ error: null })
    const result = await setFinanceBudget({ seasonId: 's1', categoryId: 'c1', targetAmountCents: 200000 })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      { season_id: 's1', category_id: 'c1', target_amount_cents: 200000 },
      { onConflict: 'season_id,category_id' }
    )
  })
})

describe('getFinancePnL', () => {
  const categories = [
    { id: 'reg', name: 'Registration Fees', kind: 'income', auto_source: 'registration' },
    { id: 'sub', name: 'Subscriptions', kind: 'income', auto_source: 'subscription' },
    { id: 'spon', name: 'Sponsorship', kind: 'income', auto_source: null },
    { id: 'wages', name: 'Wages', kind: 'expense', auto_source: null },
  ]
  const season = { id: 's1', start_date: '2026-08-01', end_date: '2026-11-30' }

  it('computes actuals from confirmed-only entries and payments, forecasted from forecasted entries and outstanding balances, against each category\'s budget', async () => {
    // getFinancePnL's real call sequence, traced against this mock's chaining:
    // 1. finance_seasons: .eq('id', seasonId) [chainable] -> .single() [terminal]
    // 2. finance_categories: .order('kind') [chainable] -> .order('name') [terminal]
    // 3. finance_budgets: .eq('season_id', seasonId) [terminal]
    // 4. payments (registration): .eq('status', 'succeeded') [chainable] -> .in(...) [chainable] -> .gte(...) [chainable] -> .lt(...) [terminal]
    // 5. payments (subscription): same shape as 4
    // 6. finance_entries: .eq('season_id', seasonId) [terminal]
    // 7. getOutstandingBalanceForecast: players .neq('status','inactive') [chainable] -> .neq('status','cancelled') [terminal],
    //    then getPaymentSchedule(playerId) per active player (mocked cross-module import)
    // Every non-terminal call in this chain is explicitly queued with mockReturnValueOnce(mockSupabase) below —
    // relying on a default return value here would let an EARLIER queued resolved-value entry get
    // front-consumed by an unrelated call, exactly the mock-ordering bug documented in
    // admin.test.ts's deletePlayer tests. Queue order below must match the real call order above exactly.

    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // 1a: season .eq('id', seasonId)
    mockSupabase.single.mockResolvedValueOnce({ data: season, error: null }) // 1b: season .single()

    mockSupabase.order.mockReturnValueOnce(mockSupabase) // 2a: categories .order('kind')
    mockSupabase.order.mockResolvedValueOnce({ data: categories, error: null }) // 2b: categories .order('name')

    mockSupabase.eq.mockResolvedValueOnce({ data: [{ category_id: 'wages', target_amount_cents: 100000 }], error: null }) // 3: budgets .eq('season_id', seasonId)

    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // 4a: registration payments .eq('status', 'succeeded')
    mockSupabase.in.mockReturnValueOnce(mockSupabase) // 4b: registration payments .in(...)
    mockSupabase.gte.mockReturnValueOnce(mockSupabase) // 4c: registration payments .gte(...)
    mockSupabase.lt.mockResolvedValueOnce({ data: [{ amount: 3000 }, { amount: 3000 }], error: null }) // 4d: registration payments .lt(...)

    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // 5a: subscription payments .eq('status', 'succeeded')
    mockSupabase.in.mockReturnValueOnce(mockSupabase) // 5b: subscription payments .in(...)
    mockSupabase.gte.mockReturnValueOnce(mockSupabase) // 5c: subscription payments .gte(...)
    mockSupabase.lt.mockResolvedValueOnce({ data: [{ amount: 21000 }], error: null }) // 5d: subscription payments .lt(...)

    mockSupabase.eq.mockResolvedValueOnce({ // 6: finance_entries .eq('season_id', seasonId)
      data: [
        { category_id: 'wages', amount_cents: 45000, status: 'confirmed' },
        { category_id: 'wages', amount_cents: 5000, status: 'forecasted' },
      ],
      error: null,
    })

    mockSupabase.neq.mockReturnValueOnce(mockSupabase) // 7a: players .neq('status', 'inactive')
    mockSupabase.neq.mockResolvedValueOnce({ data: [{ id: 'p1' }, { id: 'p2' }], error: null }) // 7b: players .neq('status', 'cancelled')
    ;(getPaymentSchedule as jest.Mock)
      .mockResolvedValueOnce([{ label: 'registration', amountCents: 3000, status: 'outstanding', discounted: false }]) // p1: owes reg fee
      .mockResolvedValueOnce([ // p2: reg paid, one subscription installment still pending
        { label: 'registration', amountCents: 3000, status: 'paid', discounted: false },
        { label: 'august', amountCents: 1500, status: 'pending', discounted: false },
      ])

    const result = await getFinancePnL('s1')

    expect(result).toEqual([
      { id: 'reg', name: 'Registration Fees', kind: 'income', budgetCents: 0, actualCents: 6000, forecastedCents: 3000, totalCents: 9000 },
      { id: 'sub', name: 'Subscriptions', kind: 'income', budgetCents: 0, actualCents: 21000, forecastedCents: 1500, totalCents: 22500 },
      { id: 'spon', name: 'Sponsorship', kind: 'income', budgetCents: 0, actualCents: 0, forecastedCents: 0, totalCents: 0 },
      { id: 'wages', name: 'Wages', kind: 'expense', budgetCents: 100000, actualCents: 45000, forecastedCents: 5000, totalCents: 50000 },
    ])

    // The date-range math (addOneDay + the UTC-pinned boundary strings) is the
    // riskiest part of this function — pin down its actual arguments so an
    // off-by-one or a swapped start/end would fail this test, not just produce
    // a silently wrong number on a real P&L report.
    expect(mockSupabase.gte).toHaveBeenNthCalledWith(1, 'paid_at', '2026-08-01T00:00:00.000Z')
    expect(mockSupabase.lt).toHaveBeenNthCalledWith(1, 'paid_at', '2026-12-01T00:00:00.000Z')
    expect(mockSupabase.gte).toHaveBeenNthCalledWith(2, 'paid_at', '2026-08-01T00:00:00.000Z')
    expect(mockSupabase.lt).toHaveBeenNthCalledWith(2, 'paid_at', '2026-12-01T00:00:00.000Z')

    // The subscription label list must stay derived from JOIN_MONTHS
    // (src/lib/payment-schedule.ts), not hand-copied, so it can't silently
    // drift out of sync with the real installment schedule.
    expect(mockSupabase.in).toHaveBeenNthCalledWith(1, 'installment_label', ['registration'])
    expect(mockSupabase.in).toHaveBeenNthCalledWith(2, 'installment_label', ['full', 'august', 'september', 'october', 'november'])
  })
})

describe('getOutstandingBalanceForecast', () => {
  it('excludes inactive and cancelled players via the query itself', async () => {
    mockSupabase.neq.mockReturnValueOnce(mockSupabase) // .neq('status', 'inactive')
    mockSupabase.neq.mockResolvedValueOnce({ data: [], error: null }) // .neq('status', 'cancelled')
    await getOutstandingBalanceForecast()
    expect(mockSupabase.neq).toHaveBeenCalledWith('status', 'inactive')
    expect(mockSupabase.neq).toHaveBeenCalledWith('status', 'cancelled')
  })

  it('sums outstanding/pending installments across active players, split by registration vs. subscription, excluding paid ones', async () => {
    mockSupabase.neq.mockReturnValueOnce(mockSupabase)
    mockSupabase.neq.mockResolvedValueOnce({ data: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }], error: null })
    ;(getPaymentSchedule as jest.Mock)
      .mockResolvedValueOnce([ // p1: outstanding registration fee
        { label: 'registration', amountCents: 3000, status: 'outstanding', discounted: false },
      ])
      .mockResolvedValueOnce([ // p2: reg paid, a self-reported (pending) subscription installment still counts as forecast
        { label: 'registration', amountCents: 3000, status: 'paid', discounted: false },
        { label: 'august', amountCents: 1500, status: 'pending', discounted: false },
      ])
      .mockResolvedValueOnce([ // p3: fully paid — contributes $0
        { label: 'registration', amountCents: 3000, status: 'paid', discounted: false },
        { label: 'full', amountCents: 21000, status: 'paid', discounted: false },
      ])

    const result = await getOutstandingBalanceForecast()
    expect(result).toEqual({ registrationCents: 3000, subscriptionCents: 1500 })
  })
})
