'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { Practice } from '@/lib/supabase/types'

export type PracticeInput = {
  practiceDate: string
  practiceTime: string
  location?: string
  notes?: string
}

export type PracticeItem = {
  id: string
  practiceDate: string
  practiceTime: string
  location: string | null
  notes: string | null
  cancelled: boolean
}

function mapPractice(row: Practice): PracticeItem {
  return {
    id: row.id,
    practiceDate: row.practice_date,
    practiceTime: row.practice_time,
    location: row.location,
    notes: row.notes,
    cancelled: row.cancelled,
  }
}

// Public: practices today or later, soonest first. Cancelled practices are
// still included (not filtered out) — a parent needs to see "Tuesday's
// practice is cancelled", not have it silently vanish.
export async function getUpcomingPractices(): Promise<PracticeItem[]> {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('practices').select('*').gte('practice_date', today)
    .order('practice_date', { ascending: true }).order('practice_time', { ascending: true })
  return (data ?? []).map(mapPractice)
}

// Admin: every practice, past and future, soonest-first — for the
// management list on /admin.
export async function getAllPractices(): Promise<PracticeItem[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('practices').select('*')
    .order('practice_date', { ascending: false }).order('practice_time', { ascending: false })
  return (data ?? []).map(mapPractice)
}

// Admin: add a new practice.
export async function createPractice(input: PracticeInput): Promise<{ error?: string }> {
  if (!input.practiceDate || !input.practiceTime) return { error: 'Date and time are both required.' }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('practices').insert({
    practice_date: input.practiceDate,
    practice_time: input.practiceTime,
    location: input.location || null,
    notes: input.notes || null,
  })
  if (error) return { error: 'Failed to add practice' }
  return {}
}

// Admin: edit an existing practice.
export async function updatePractice(id: string, input: PracticeInput): Promise<{ error?: string }> {
  if (!input.practiceDate || !input.practiceTime) return { error: 'Date and time are both required.' }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('practices')
    .update({
      practice_date: input.practiceDate,
      practice_time: input.practiceTime,
      location: input.location || null,
      notes: input.notes || null,
    })
    .eq('id', id)
  if (error) return { error: 'Failed to update practice' }
  return {}
}

// Admin: cancel or un-cancel a practice.
export async function setPracticeCancelled(id: string, cancelled: boolean): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('practices').update({ cancelled }).eq('id', id)
  if (error) return { error: 'Failed to update practice' }
  return {}
}

// Admin: remove a practice entirely.
export async function deletePractice(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('practices').delete().eq('id', id)
  if (error) return { error: 'Failed to delete practice' }
  return {}
}
