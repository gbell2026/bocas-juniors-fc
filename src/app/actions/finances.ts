'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { JOIN_MONTHS } from '@/lib/payment-schedule'
import type { InstallmentLabel } from '@/lib/supabase/types'
import { getPaymentSchedule } from '@/app/actions/payment'

export type FinanceSeason = { id: string; label: string; startDate: string; endDate: string }

export async function getFinanceSeasons(): Promise<FinanceSeason[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('finance_seasons').select('*').order('start_date', { ascending: false })
  return (data ?? []).map(s => ({ id: s.id, label: s.label, startDate: s.start_date, endDate: s.end_date }))
}

export type FinanceSeasonInput = { label: string; startDate: string; endDate: string }

export async function createFinanceSeason(input: FinanceSeasonInput): Promise<{ error?: string }> {
  if (new Date(input.endDate) <= new Date(input.startDate)) {
    return { error: 'Season end date must be after the start date' }
  }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_seasons').insert({
    label: input.label,
    start_date: input.startDate,
    end_date: input.endDate,
  })
  if (error) return { error: 'Failed to create season' }
  return {}
}

export async function updateFinanceSeason(id: string, input: FinanceSeasonInput): Promise<{ error?: string }> {
  if (new Date(input.endDate) <= new Date(input.startDate)) {
    return { error: 'Season end date must be after the start date' }
  }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_seasons').update({
    label: input.label,
    start_date: input.startDate,
    end_date: input.endDate,
  }).eq('id', id)
  if (error) return { error: 'Failed to update season' }
  return {}
}

export type FinanceCategory = { id: string; name: string; kind: 'income' | 'expense'; autoSource: 'registration' | 'subscription' | null }

export async function getFinanceCategories(): Promise<FinanceCategory[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('finance_categories').select('*').order('kind').order('name')
  return (data ?? []).map(c => ({
    id: c.id, name: c.name, kind: c.kind,
    autoSource: c.auto_source as 'registration' | 'subscription' | null,
  }))
}

export async function createFinanceCategory(input: { name: string; kind: 'income' | 'expense' }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_categories').insert({ name: input.name, kind: input.kind, auto_source: null })
  if (error) return { error: 'Failed to create category' }
  return {}
}

export async function renameFinanceCategory(id: string, name: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: category } = await supabase.from('finance_categories').select('auto_source').eq('id', id).single()
  if (category?.auto_source) {
    return { error: "This category is computed automatically and can't be renamed" }
  }
  const { error } = await supabase.from('finance_categories').update({ name }).eq('id', id)
  if (error) return { error: 'Failed to rename category' }
  return {}
}

export async function deleteFinanceCategory(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: category } = await supabase.from('finance_categories').select('auto_source').eq('id', id).single()
  if (category?.auto_source) {
    return { error: "This category is computed automatically and can't be deleted" }
  }

  const { data: entries } = await supabase.from('finance_entries').select('id').eq('category_id', id).limit(1)
  const { data: budgets } = await supabase.from('finance_budgets').select('id').eq('category_id', id).limit(1)
  if ((entries ?? []).length > 0 || (budgets ?? []).length > 0) {
    return { error: 'This category has logged entries or a budget — remove those first' }
  }

  const { error } = await supabase.from('finance_categories').delete().eq('id', id)
  if (error) return { error: 'Failed to delete category' }
  return {}
}

export type FinanceEntryStatus = 'confirmed' | 'forecasted'
export type FinanceEntry = { id: string; categoryId: string; categoryName: string; amountCents: number; entryDate: string; note: string | null; status: FinanceEntryStatus }

export async function getFinanceEntries(seasonId: string): Promise<FinanceEntry[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('finance_entries')
    .select('*, finance_categories(name)')
    .eq('season_id', seasonId)
    .order('entry_date', { ascending: false })
  return (data ?? []).map((e: any) => ({
    id: e.id, categoryId: e.category_id, categoryName: e.finance_categories.name,
    amountCents: e.amount_cents, entryDate: e.entry_date, note: e.note, status: e.status,
  }))
}

export type FinanceEntryInput = { seasonId: string; categoryId: string; amountCents: number; entryDate: string; note?: string; status: FinanceEntryStatus }

export async function createFinanceEntry(input: FinanceEntryInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: category } = await supabase.from('finance_categories').select('auto_source').eq('id', input.categoryId).single()
  if (category?.auto_source) {
    return { error: "This category is computed automatically — it can't be logged manually" }
  }
  const { error } = await supabase.from('finance_entries').insert({
    season_id: input.seasonId, category_id: input.categoryId,
    amount_cents: input.amountCents, entry_date: input.entryDate, note: input.note ?? null, status: input.status,
  })
  if (error) return { error: 'Failed to create entry' }
  return {}
}

export async function updateFinanceEntry(id: string, input: { amountCents: number; entryDate: string; note?: string; status: FinanceEntryStatus }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_entries').update({
    amount_cents: input.amountCents, entry_date: input.entryDate, note: input.note ?? null, status: input.status,
  }).eq('id', id)
  if (error) return { error: 'Failed to update entry' }
  return {}
}

export async function deleteFinanceEntry(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) return { error: 'Failed to delete entry' }
  return {}
}

export async function getFinanceBudgets(seasonId: string): Promise<Record<string, number>> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('finance_budgets').select('category_id, target_amount_cents').eq('season_id', seasonId)
  return Object.fromEntries((data ?? []).map(b => [b.category_id, b.target_amount_cents]))
}

export async function setFinanceBudget(input: { seasonId: string; categoryId: string; targetAmountCents: number }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_budgets').upsert(
    { season_id: input.seasonId, category_id: input.categoryId, target_amount_cents: input.targetAmountCents },
    { onConflict: 'season_id,category_id' }
  )
  if (error) return { error: 'Failed to set budget' }
  return {}
}

export type FinancePnLRow = { id: string; name: string; kind: 'income' | 'expense'; budgetCents: number; actualCents: number; forecastedCents: number; totalCents: number }

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

// Live snapshot of what active players still owe, independent of which
// finance season is selected — see the "Explicitly out of scope" note in
// docs/superpowers/specs/2026-08-24-finance-forecasting.md on why this isn't
// season-date-filtered. 'pending' (a parent self-reported payment not yet
// confirmed) counts alongside 'outstanding', since neither is money that's
// actually landed.
export async function getOutstandingBalanceForecast(): Promise<{ registrationCents: number; subscriptionCents: number }> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('players').select('id').neq('status', 'inactive').neq('status', 'cancelled')
  const players = data ?? []
  const schedules = await Promise.all(players.map(p => getPaymentSchedule(p.id)))

  let registrationCents = 0
  let subscriptionCents = 0
  for (const schedule of schedules) {
    for (const item of schedule) {
      if (item.status === 'paid') continue
      if (item.label === 'registration') registrationCents += item.amountCents
      else subscriptionCents += item.amountCents
    }
  }
  return { registrationCents, subscriptionCents }
}

export async function getFinancePnL(seasonId: string): Promise<FinancePnLRow[]> {
  const supabase = createSupabaseServiceClient()

  const { data: season } = await supabase.from('finance_seasons').select('start_date, end_date').eq('id', seasonId).single()
  if (!season) return []

  const { data: categoriesData } = await supabase.from('finance_categories').select('*').order('kind').order('name')
  const categories = categoriesData ?? []

  const { data: budgetsData } = await supabase.from('finance_budgets').select('category_id, target_amount_cents').eq('season_id', seasonId)
  const budgets = Object.fromEntries((budgetsData ?? []).map(b => [b.category_id, b.target_amount_cents]))

  const rangeStart = `${season.start_date}T00:00:00.000Z`
  const rangeEnd = `${addOneDay(season.end_date)}T00:00:00.000Z`

  async function paymentsTotal(labels: InstallmentLabel[]): Promise<number> {
    const { data } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded')
      .in('installment_label', labels)
      .gte('paid_at', rangeStart)
      .lt('paid_at', rangeEnd)
    return (data ?? []).reduce((sum, p) => sum + p.amount, 0)
  }

  const registrationTotal = await paymentsTotal(['registration'])
  // 'full' (lump-sum season fee) plus every month a player can join in (per-month
  // season fee) — derived from JOIN_MONTHS rather than hardcoded, so this list
  // can't silently drift out of sync with src/lib/payment-schedule.ts if a future
  // plan/join-month change adds a new installment label.
  const subscriptionTotal = await paymentsTotal(['full', ...JOIN_MONTHS])

  const { data: entriesData } = await supabase.from('finance_entries').select('category_id, amount_cents, status').eq('season_id', seasonId)
  const confirmedTotals: Record<string, number> = {}
  const forecastedTotals: Record<string, number> = {}
  for (const e of entriesData ?? []) {
    const bucket = e.status === 'forecasted' ? forecastedTotals : confirmedTotals
    bucket[e.category_id] = (bucket[e.category_id] ?? 0) + e.amount_cents
  }

  const outstanding = await getOutstandingBalanceForecast()

  return categories.map(c => {
    const actualCents =
      c.auto_source === 'registration' ? registrationTotal
      : c.auto_source === 'subscription' ? subscriptionTotal
      : confirmedTotals[c.id] ?? 0
    const forecastedCents =
      c.auto_source === 'registration' ? outstanding.registrationCents
      : c.auto_source === 'subscription' ? outstanding.subscriptionCents
      : forecastedTotals[c.id] ?? 0
    return {
      id: c.id,
      name: c.name,
      kind: c.kind,
      budgetCents: budgets[c.id] ?? 0,
      actualCents,
      forecastedCents,
      totalCents: actualCents + forecastedCents,
    }
  })
}
