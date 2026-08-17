'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { shortDivisionLabel } from '@/lib/league/fixture-calendar'

export type PracticeScheduleEntry = {
  id: string; date: string; time: string; location: string | null; notes: string | null; cancelled: boolean
}

export type LeagueMatchScheduleEntry = {
  id: string; date: string; kickoff: string | null; division: string
  homeTeam: string; awayTeam: string; cancelled: boolean
  homeScore: number | null; awayScore: number | null
}

export type HomeSchedule = { practices: PracticeScheduleEntry[]; matches: LeagueMatchScheduleEntry[] }

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Two independent, differently-windowed feeds for the homepage: practices
 * (next 14 days) and every league match across every club/division (next 7
 * days) — unlike the old getUpcomingSchedule, this deliberately does NOT
 * filter matches down to just this club's own games, since the homepage
 * now shows the full league schedule.
 */
export async function getHomeSchedule(): Promise<HomeSchedule> {
  const supabase = createSupabaseServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const { data: practiceRows } = await supabase
    .from('practices').select('*')
    .gte('practice_date', today).lt('practice_date', addDays(today, 14))
    .order('practice_date', { ascending: true }).order('practice_time', { ascending: true })

  const practices: PracticeScheduleEntry[] = (practiceRows ?? []).map(p => ({
    id: p.id,
    date: p.practice_date,
    time: p.practice_time,
    location: p.location,
    notes: p.notes,
    cancelled: p.cancelled,
  }))

  const matches = await getUpcomingLeagueMatches(today, addDays(today, 7))

  return { practices, matches }
}

async function getUpcomingLeagueMatches(today: string, until: string): Promise<LeagueMatchScheduleEntry[]> {
  const supabase = createSupabaseServiceClient()

  const { data: fixtureRows } = await supabase
    .from('league_fixtures').select('*')
    .gte('match_date', today).lt('match_date', until)
    .order('match_date', { ascending: true }).order('kickoff', { ascending: true })
  if (!fixtureRows || fixtureRows.length === 0) return []

  const { data: divisions } = await supabase.from('league_divisions').select('id, name')
  const divisionNameById = new Map((divisions ?? []).map(d => [d.id, d.name]))

  const teamIds = Array.from(new Set(fixtureRows.flatMap(f => [f.home_team_id, f.away_team_id])))
  const { data: teams } = await supabase.from('league_teams').select('id, name').in('id', teamIds)
  const teamNameById = new Map((teams ?? []).map(t => [t.id, t.name]))

  return fixtureRows.map(f => ({
    id: f.id,
    date: f.match_date,
    kickoff: f.kickoff ? f.kickoff.slice(0, 5) : null,
    division: shortDivisionLabel(divisionNameById.get(f.division_id) ?? ''),
    homeTeam: teamNameById.get(f.home_team_id) ?? 'Unknown',
    awayTeam: teamNameById.get(f.away_team_id) ?? 'Unknown',
    cancelled: f.cancelled,
    homeScore: f.home_score,
    awayScore: f.away_score,
  }))
}
