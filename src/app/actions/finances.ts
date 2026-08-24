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
