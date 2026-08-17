'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { HOME_CLUB_NAME } from '@/lib/league/home-club'

export type ScheduleEntry =
  | { type: 'practice'; id: string; date: string; time: string; location: string | null; notes: string | null; cancelled: boolean }
  | { type: 'match'; id: string; date: string; opponent: string; isHome: boolean; cancelled: boolean; homeScore: number | null; awayScore: number | null }

/**
 * Combines upcoming practices with this club's own League fixtures into one
 * sorted "what's next" feed for the homepage — practices come straight from
 * the `practices` table, matches come from `league_fixtures` for any team
 * belonging to the home club. Cancelled items are included (not filtered
 * out), so a parent sees "Tuesday's practice is cancelled" rather than it
 * silently disappearing.
 */
export async function getUpcomingSchedule(limit = 5): Promise<ScheduleEntry[]> {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: practiceRows } = await supabase
    .from('practices').select('*').gte('practice_date', today)
    .order('practice_date', { ascending: true }).order('practice_time', { ascending: true })

  const practices: ScheduleEntry[] = (practiceRows ?? []).map(p => ({
    type: 'practice' as const,
    id: p.id,
    date: p.practice_date,
    time: p.practice_time,
    location: p.location,
    notes: p.notes,
    cancelled: p.cancelled,
  }))

  const matches = await getUpcomingHomeClubMatches(today)

  return [...practices, ...matches]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

async function getUpcomingHomeClubMatches(today: string): Promise<ScheduleEntry[]> {
  const supabase = createSupabaseServiceClient()

  const { data: homeClub } = await supabase.from('league_clubs').select('id').eq('name', HOME_CLUB_NAME).single()
  if (!homeClub) return []

  const { data: homeTeams } = await supabase.from('league_teams').select('id').eq('club_id', homeClub.id)
  const homeTeamIds = new Set((homeTeams ?? []).map(t => t.id))
  if (homeTeamIds.size === 0) return []

  const { data: fixtureRows } = await supabase
    .from('league_fixtures').select('*').gte('match_date', today).order('match_date', { ascending: true })
  const relevantFixtures = (fixtureRows ?? []).filter(f => homeTeamIds.has(f.home_team_id) || homeTeamIds.has(f.away_team_id))
  if (relevantFixtures.length === 0) return []

  const opponentTeamIds = Array.from(new Set(
    relevantFixtures.flatMap(f => [f.home_team_id, f.away_team_id]).filter(id => !homeTeamIds.has(id))
  ))
  const { data: opponentTeams } = opponentTeamIds.length > 0
    ? await supabase.from('league_teams').select('id, name').in('id', opponentTeamIds)
    : { data: [] as { id: string; name: string }[] }
  const opponentNameById = new Map((opponentTeams ?? []).map(t => [t.id, t.name]))

  return relevantFixtures.map(f => {
    const isHome = homeTeamIds.has(f.home_team_id)
    const opponentId = isHome ? f.away_team_id : f.home_team_id
    return {
      type: 'match' as const,
      id: f.id,
      date: f.match_date,
      opponent: opponentNameById.get(opponentId) ?? 'TBD',
      isHome,
      cancelled: f.cancelled,
      homeScore: f.home_score,
      awayScore: f.away_score,
    }
  })
}
