'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth'

export type PracticeBanner = {
  active: boolean
  date: string
  reason: string
}

const KEYS = {
  active: 'practice_cancelled',
  date: 'practice_cancelled_date',
  reason: 'practice_cancelled_reason',
} as const

export async function getPracticeBanner(): Promise<PracticeBanner> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', [KEYS.active, KEYS.date, KEYS.reason])

  const map = Object.fromEntries((data ?? []).map(s => [s.key, s.value]))
  return {
    active: map[KEYS.active] === 'true',
    date: map[KEYS.date] ?? '',
    reason: map[KEYS.reason] ?? '',
  }
}

export async function setPracticeBanner(
  input: PracticeBanner
): Promise<{ error: string | null }> {
  if (!(await isAdmin())) return { error: 'Not authorised.' }

  const active = Boolean(input.active)
  const date = input.date.trim()
  const reason = input.reason.trim()

  if (active && !date && !reason) {
    return { error: 'Add a date or a reason before showing the banner.' }
  }

  const now = new Date().toISOString()
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('settings').upsert([
    { key: KEYS.active, value: active ? 'true' : 'false', updated_at: now },
    { key: KEYS.date, value: date, updated_at: now },
    { key: KEYS.reason, value: reason, updated_at: now },
  ])
  if (error) return { error: error.message }

  revalidatePath('/')
  return { error: null }
}
