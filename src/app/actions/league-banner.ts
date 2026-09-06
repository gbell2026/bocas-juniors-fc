'use server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const KEY_ACTIVE = 'league_postponed'
const KEY_MESSAGE = 'league_postponed_message'

export type LeagueBanner = { active: boolean; message: string }

// Public: the homepage postponement banner state, stored as two `settings`
// rows so no schema change is needed.
export async function getLeagueBanner(): Promise<LeagueBanner> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('settings').select('key, value').in('key', [KEY_ACTIVE, KEY_MESSAGE])
  const map = new Map((data ?? []).map(r => [r.key, r.value]))
  return {
    active: map.get(KEY_ACTIVE) === 'true',
    message: map.get(KEY_MESSAGE) ?? '',
  }
}

// Admin: show/hide/update the banner. Gated by the /admin middleware guard, in
// line with the other league admin actions.
export async function setLeagueBanner(input: LeagueBanner): Promise<{ error?: string }> {
  const message = input.message.trim()
  if (input.active && !message) return { error: 'Enter a message before showing the banner.' }

  const now = new Date().toISOString()
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('settings').upsert(
    [
      { key: KEY_ACTIVE, value: input.active ? 'true' : 'false', updated_at: now },
      { key: KEY_MESSAGE, value: message, updated_at: now },
    ],
    { onConflict: 'key' }
  )
  if (error) return { error: 'Failed to save the banner' }

  revalidatePath('/')
  return {}
}
