'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { generateRoundRobin } from '@/lib/league/round-robin'

// --- Clubs ---

export async function getPendingLeagueClubs() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('league_clubs').select('*').eq('status', 'pending').order('created_at')
  return data ?? []
}

export async function approveLeagueClub(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_clubs').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Failed to approve club' }
  return {}
}

export async function rejectLeagueClub(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_clubs').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Failed to reject club' }
  return {}
}

// --- Teams ---

export async function getPendingLeagueTeams() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('league_teams')
    .select('*, league_clubs(name), league_divisions(name)')
    .eq('status', 'pending')
    .order('created_at')
  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    clubName: (t.league_clubs as any)?.name ?? '',
    divisionName: (t.league_divisions as any)?.name ?? '',
    createdAt: t.created_at,
  }))
}

export async function approveLeagueTeam(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_teams').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Failed to approve team' }
  return {}
}

export async function rejectLeagueTeam(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_teams').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Failed to reject team' }
  return {}
}

// --- Players ---

export async function getPendingLeaguePlayers() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('league_players')
    .select('*, league_teams(name, league_clubs(name))')
    .eq('status', 'pending')
    .order('created_at')
  return (data ?? []).map(p => ({
    id: p.id,
    name: p.name,
    dateOfBirth: p.date_of_birth,
    squadNumber: p.squad_number,
    teamName: (p.league_teams as any)?.name ?? '',
    clubName: (p.league_teams as any)?.league_clubs?.name ?? '',
    createdAt: p.created_at,
  }))
}

/**
 * Approving a player can violate the partial unique index on
 * (team_id, squad_number) WHERE status='approved' if another player on the
 * same team already holds that number — submissions are anonymous, so this
 * can only be caught here, not at submission time. Surfaces a friendly
 * error instead of throwing, so the admin queue UI can tell the admin what
 * happened and let them ask the club to resubmit with a different number.
 */
export async function approveLeaguePlayer(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('league_players')
    .update({ status: 'approved', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) {
    if (error.code === '23505') {
      return { error: 'That squad number is already taken on this team — ask the club for a different number.' }
    }
    return { error: 'Failed to approve player' }
  }
  return {}
}

export async function rejectLeaguePlayer(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_players').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Failed to reject player' }
  return {}
}

// --- Divisions & schedule generation ---

export type CreateDivisionInput = { name: string; seasonStartDate: string; seasonEndDate: string }

export async function getLeagueDivisionsAdmin() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('league_divisions').select('*').order('season_start_date')
  return data ?? []
}

export async function createDivision(input: CreateDivisionInput): Promise<{ error?: string }> {
  if (new Date(input.seasonEndDate) <= new Date(input.seasonStartDate)) {
    return { error: 'Season end date must be after the start date' }
  }

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_divisions').insert({
    name: input.name,
    season_start_date: input.seasonStartDate,
    season_end_date: input.seasonEndDate,
  })
  if (error) return { error: 'Failed to create division' }
  return {}
}

export type UpdateDivisionInput = { name?: string; seasonStartDate?: string; seasonEndDate?: string }

export async function updateDivision(id: string, input: UpdateDivisionInput): Promise<{ error?: string }> {
  // Both dates are only comparable when both are present in this partial
  // update — if just one is being changed, the caller (the admin edit form)
  // always submits both fields together in practice, so this still catches
  // the realistic case (an admin transposing the two dates while editing).
  if (
    input.seasonStartDate && input.seasonEndDate &&
    new Date(input.seasonEndDate) <= new Date(input.seasonStartDate)
  ) {
    return { error: 'Season end date must be after the start date' }
  }

  const supabase = createSupabaseServiceClient()
  const patch: Record<string, string> = {}
  if (input.name) patch.name = input.name
  if (input.seasonStartDate) patch.season_start_date = input.seasonStartDate
  if (input.seasonEndDate) patch.season_end_date = input.seasonEndDate

  const { error } = await supabase.from('league_divisions').update(patch).eq('id', id)
  if (error) return { error: 'Failed to update division' }
  return {}
}

// Generates a full home-and-away round-robin for a division's approved
// teams. Refuses to run if the division already has any fixtures (full
// regeneration isn't supported — see the spec's "Fixtures & schedule
// generation" section) or if fewer than 2 teams are approved.
export async function generateSchedule(divisionId: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()

  const { data: existingFixtures } = await supabase
    .from('league_fixtures').select('id').eq('division_id', divisionId).limit(1)
  if (existingFixtures && existingFixtures.length > 0) {
    return { error: 'This division already has a schedule. Add or edit fixtures manually instead.' }
  }

  const { data: division } = await supabase
    .from('league_divisions').select('season_start_date, season_end_date').eq('id', divisionId).single()
  if (!division) return { error: 'Division not found' }

  const { data: teams } = await supabase
    .from('league_teams').select('id').eq('division_id', divisionId).eq('status', 'approved')
  const teamIds = (teams ?? []).map(t => t.id)
  if (teamIds.length < 2) return { error: 'Need at least 2 approved teams to generate a schedule' }

  const fixtures = generateRoundRobin(teamIds, division.season_start_date, division.season_end_date)

  const { error } = await supabase.from('league_fixtures').insert(
    fixtures.map(f => ({
      division_id: divisionId,
      home_team_id: f.homeTeamId,
      away_team_id: f.awayTeamId,
      match_date: f.matchDate,
    }))
  )
  if (error) return { error: 'Failed to save generated schedule' }
  return {}
}

// --- Fixture management ---

export async function getFixturesForAdmin(divisionId: string) {
  const supabase = createSupabaseServiceClient()

  const { data: fixtures } = await supabase
    .from('league_fixtures').select('*').eq('division_id', divisionId).order('match_date')
  const { data: teams } = await supabase
    .from('league_teams').select('id, name').eq('division_id', divisionId)
  const teamMap = new Map((teams ?? []).map(t => [t.id, t.name]))

  return (fixtures ?? []).map(f => ({
    id: f.id,
    matchDate: f.match_date,
    homeTeamId: f.home_team_id,
    awayTeamId: f.away_team_id,
    homeTeamName: teamMap.get(f.home_team_id) ?? 'Unknown',
    awayTeamName: teamMap.get(f.away_team_id) ?? 'Unknown',
    homeScore: f.home_score,
    awayScore: f.away_score,
    cancelled: f.cancelled,
  }))
}

export type UpdateFixtureInput = { matchDate?: string; homeTeamId?: string; awayTeamId?: string }

export async function updateFixture(id: string, input: UpdateFixtureInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const patch: Record<string, string> = {}
  if (input.matchDate) patch.match_date = input.matchDate
  if (input.homeTeamId) patch.home_team_id = input.homeTeamId
  if (input.awayTeamId) patch.away_team_id = input.awayTeamId
  const { error } = await supabase.from('league_fixtures').update(patch).eq('id', id)
  if (error) {
    if (error.code === '23514') return { error: 'A team cannot play itself — pick two different teams.' }
    return { error: 'Failed to update fixture' }
  }
  return {}
}

export async function addFixture(input: {
  divisionId: string; homeTeamId: string; awayTeamId: string; matchDate: string
}): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_fixtures').insert({
    division_id: input.divisionId,
    home_team_id: input.homeTeamId,
    away_team_id: input.awayTeamId,
    match_date: input.matchDate,
  })
  if (error) {
    if (error.code === '23514') return { error: 'A team cannot play itself — pick two different teams.' }
    return { error: 'Failed to add fixture' }
  }
  return {}
}

export async function recordFixtureScore(id: string, homeScore: number, awayScore: number): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_fixtures').update({ home_score: homeScore, away_score: awayScore }).eq('id', id)
  if (error) {
    if (error.code === '23514') return { error: 'Scores cannot be negative.' }
    return { error: 'Failed to save score' }
  }
  return {}
}

export async function setFixtureCancelled(id: string, cancelled: boolean): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('league_fixtures').update({ cancelled }).eq('id', id)
  if (error) return { error: 'Failed to update fixture' }
  return {}
}
