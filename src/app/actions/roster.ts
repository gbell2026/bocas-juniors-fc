'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getAmountDue } from '@/app/actions/payment'

export type RosterPlayer = {
  id: string
  parentId: string
  name: string
  position: string
  ageGroups: string[]
  hasOutstanding: boolean
}

// Excludes 'inactive' (registered but not yet activated — see the
// players table's default status) and 'cancelled' (admin-removed) players.
// 'injured'/'away' still show, since they're still rostered, just not
// currently playing.
export async function getRosterForCoach(): Promise<RosterPlayer[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('players').select('*').neq('status', 'inactive').neq('status', 'cancelled').order('name')

  const players = data ?? []
  const dueChecks = await Promise.all(players.map(p => getAmountDue(p.id)))

  return players.map((p, i) => ({
    id: p.id,
    parentId: p.parent_id,
    name: p.name,
    position: p.position,
    ageGroups: p.age_groups,
    hasOutstanding: dueChecks[i] !== null,
  }))
}
