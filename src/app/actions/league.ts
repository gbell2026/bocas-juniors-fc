'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { computeStandings } from '@/lib/league/standings'

export type RegisterLeagueTeamInput = {
  clubName: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  badgeCloudinaryPublicId?: string
  teamName: string
  divisionId: string
}

export type RegisterLeagueTeamResult = { clubId?: string; teamId?: string; error?: string }

function isValidSquadNumber(n: number) {
  return Number.isInteger(n) && n > 0
}

// Public, unauthenticated: a club registering a brand-new team. Creates a
// club + team, landing as 'pending'. No roster here — players are added
// afterwards via addLeaguePlayer, once the team is approved, so a club
// registering isn't blocked on having a finalised squad up front.
// Contact details are optional (an admin can follow up directly once
// approved); Club Name, Team Name, and Division stay required since a team
// needs these to actually be schedulable. Rolls back the club if the team
// insert fails, since a club with no team is confusing junk for the admin
// approval queue to sort through.
export async function registerLeagueTeam(input: RegisterLeagueTeamInput): Promise<RegisterLeagueTeamResult> {
  const supabase = createSupabaseServiceClient()

  // A division stops accepting new teams once its schedule has been
  // generated (see spec: "Division open status"). The registration
  // dropdown should only list open divisions (getOpenDivisions), but this
  // closes the gap against a stale/direct call targeting a closed one.
  const { data: existingFixture } = await supabase
    .from('league_fixtures').select('id').eq('division_id', input.divisionId).limit(1)
  if (existingFixture && existingFixture.length > 0) {
    return { error: 'division_closed' }
  }

  const { data: club, error: clubError } = await supabase
    .from('league_clubs')
    .insert({
      name: input.clubName,
      contact_name: input.contactName || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
      badge_cloudinary_public_id: input.badgeCloudinaryPublicId ?? null,
    })
    .select()
    .single()
  if (clubError || !club) return { error: 'submission_failed' }

  const { data: team, error: teamError } = await supabase
    .from('league_teams')
    .insert({ club_id: club.id, division_id: input.divisionId, name: input.teamName })
    .select()
    .single()
  if (teamError || !team) {
    await supabase.from('league_clubs').delete().eq('id', club.id)
    return { error: 'submission_failed' }
  }

  return { clubId: club.id, teamId: team.id }
}

// Public: approved clubs only — used by the "Add a Team" flow, letting an
// already-approved club register another team (e.g. a second age group)
// without re-entering their contact details or creating a duplicate club.
export async function getApprovedClubs() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('league_clubs').select('id, name').eq('status', 'approved').order('name')
  return data ?? []
}

export type AddLeagueTeamInput = { clubId: string; teamName: string; divisionId: string }
export type AddLeagueTeamResult = { teamId?: string; error?: string }

// Public: adds a new team to an already-approved club — same division-open
// guard as registerLeagueTeam, plus confirming the club is a real, approved
// club before attaching a team to it.
export async function addLeagueTeam(input: AddLeagueTeamInput): Promise<AddLeagueTeamResult> {
  const supabase = createSupabaseServiceClient()

  const { data: existingFixture } = await supabase
    .from('league_fixtures').select('id').eq('division_id', input.divisionId).limit(1)
  if (existingFixture && existingFixture.length > 0) {
    return { error: 'division_closed' }
  }

  const { data: club } = await supabase
    .from('league_clubs').select('id').eq('id', input.clubId).eq('status', 'approved').single()
  if (!club) return { error: 'club_not_found' }

  const { data: team, error: teamError } = await supabase
    .from('league_teams')
    .insert({ club_id: input.clubId, division_id: input.divisionId, name: input.teamName })
    .select()
    .single()
  if (teamError || !team) return { error: 'submission_failed' }

  return { teamId: team.id }
}

export type AddLeaguePlayerInput = {
  teamId: string
  name: string
  dateOfBirth: string
  squadNumber: number
}

// Public, unauthenticated: adding a player to an already-approved team.
// Guards against submitting against a not-yet-approved or rejected team —
// the public dropdown should only ever list approved teams, but this closes
// the gap against a stale/direct call.
export async function addLeaguePlayer(input: AddLeaguePlayerInput): Promise<{ error?: string }> {
  if (!isValidSquadNumber(input.squadNumber)) {
    return { error: 'invalid_squad_number' }
  }

  const supabase = createSupabaseServiceClient()

  const { data: team } = await supabase
    .from('league_teams').select('id, status').eq('id', input.teamId).single()
  if (!team || team.status !== 'approved') return { error: 'team_not_found' }

  const { error } = await supabase.from('league_players').insert({
    team_id: input.teamId,
    name: input.name,
    date_of_birth: input.dateOfBirth,
    squad_number: input.squadNumber,
  })
  if (error) return { error: 'submission_failed' }
  return {}
}

// All divisions, regardless of whether a schedule has been generated yet —
// used for the Fixtures/Table tab's division selector (a division with a
// schedule is exactly the kind of division those tabs need to show).
export async function getDivisions() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('league_divisions').select('*').order('season_start_date')
  return data ?? []
}

// Only divisions that don't have a generated schedule yet — used for the
// "register a new team" division dropdown (see "Division open status" in
// the spec). A division stops being open the moment generateSchedule runs.
export async function getOpenDivisions() {
  const supabase = createSupabaseServiceClient()
  const { data: divisions } = await supabase.from('league_divisions').select('*').order('season_start_date')
  const { data: fixtures } = await supabase.from('league_fixtures').select('division_id')
  const divisionIdsWithFixtures = new Set((fixtures ?? []).map(f => f.division_id))
  return (divisions ?? []).filter(d => !divisionIdsWithFixtures.has(d.id))
}

// Flat list of all approved teams (across every division), joined with
// their club's name/badge — used for the public "add a player to an
// existing team" dropdown (shown as "Club — Team (Division)").
export async function getApprovedTeams() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('league_teams')
    .select('id, name, division_id, league_clubs(name, badge_cloudinary_public_id), league_divisions(name)')
    .eq('status', 'approved')
    .order('name')
  return (data ?? []).map(t => ({
    id: t.id,
    name: t.name,
    divisionId: t.division_id,
    clubName: (t.league_clubs as any)?.name ?? '',
    badgeCloudinaryPublicId: (t.league_clubs as any)?.badge_cloudinary_public_id ?? null,
    divisionName: (t.league_divisions as any)?.name ?? '',
  }))
}

// Fixtures are fetched flat and joined to team names in application code
// (rather than an embedded Supabase select) because league_fixtures has
// TWO foreign keys into league_teams (home_team_id, away_team_id) — an
// embedded select would need constraint-name disambiguation for each side,
// which is more fragile than a plain JS Map lookup for a table this size.
export async function getFixtures(divisionId: string) {
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

// Wraps the pure `computeStandings` (already unit-tested in isolation) with
// the DB reads it needs, then re-attaches team display info for rendering.
export async function getStandings(divisionId: string) {
  const supabase = createSupabaseServiceClient()

  const { data: teams } = await supabase
    .from('league_teams')
    .select('id, name, league_clubs(badge_cloudinary_public_id)')
    .eq('division_id', divisionId)
    .eq('status', 'approved')

  const { data: fixtures } = await supabase
    .from('league_fixtures')
    .select('home_team_id, away_team_id, home_score, away_score')
    .eq('division_id', divisionId)

  const teamList = teams ?? []
  const standings = computeStandings(
    teamList.map(t => t.id),
    (fixtures ?? []).map(f => ({
      homeTeamId: f.home_team_id,
      awayTeamId: f.away_team_id,
      homeScore: f.home_score,
      awayScore: f.away_score,
    }))
  )

  return standings.map(row => {
    const team = teamList.find(t => t.id === row.teamId)
    return {
      ...row,
      teamName: team?.name ?? 'Unknown',
      badgeCloudinaryPublicId: (team?.league_clubs as any)?.badge_cloudinary_public_id ?? null,
    }
  })
}
