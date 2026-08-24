'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

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
