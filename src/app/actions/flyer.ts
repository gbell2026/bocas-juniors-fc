'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { shortDivisionLabel } from '@/lib/league/fixture-calendar'

export type FlyerFixture = {
  id: string
  kickoff: string | null // "HH:MM"
  homeTeam: string
  awayTeam: string
  homeBadge: string | null // Cloudinary public id
  awayBadge: string | null
}

export type FlyerDivision = {
  id: string
  name: string
  shortLabel: string
  teams: { name: string; badge: string | null }[]
  fixtures: FlyerFixture[]
}

export type KickoffFlyer = {
  sundayIso: string
  divisions: FlyerDivision[]
}

// The coming Sunday in UTC — today if today is already Sunday. Same
// "walk forward to Sunday" logic the fixture calendar uses internally.
function nextSundayIso(from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7))
  return d.toISOString().slice(0, 10)
}

// Public: every non-cancelled league fixture for the coming Sunday, grouped by
// division, with team names + club badges — the data behind the /flyer page.
export async function getKickoffFlyer(): Promise<KickoffFlyer> {
  const supabase = createSupabaseServiceClient()
  const sundayIso = nextSundayIso()

  const { data: fixtures } = await supabase
    .from('league_fixtures')
    .select('*')
    .eq('match_date', sundayIso)
    .eq('cancelled', false)
    .order('kickoff', { ascending: true })

  if (!fixtures || fixtures.length === 0) return { sundayIso, divisions: [] }

  const { data: divisions } = await supabase.from('league_divisions').select('id, name')
  const divisionNameById = new Map((divisions ?? []).map(d => [d.id, d.name]))

  const teamIds = Array.from(new Set(fixtures.flatMap(f => [f.home_team_id, f.away_team_id])))
  const { data: teams } = await supabase
    .from('league_teams')
    .select('id, name, league_clubs(badge_cloudinary_public_id)')
    .in('id', teamIds)
  const teamById = new Map(
    (teams ?? []).map(t => [
      t.id,
      { name: t.name, badge: (t.league_clubs as any)?.badge_cloudinary_public_id ?? null },
    ])
  )

  const byDivision = new Map<string, FlyerDivision>()
  for (const f of fixtures) {
    let entry = byDivision.get(f.division_id)
    if (!entry) {
      const name = divisionNameById.get(f.division_id) ?? ''
      entry = { id: f.division_id, name, shortLabel: shortDivisionLabel(name), teams: [], fixtures: [] }
      byDivision.set(f.division_id, entry)
    }
    const home = teamById.get(f.home_team_id) ?? { name: 'TBC', badge: null }
    const away = teamById.get(f.away_team_id) ?? { name: 'TBC', badge: null }
    entry.fixtures.push({
      id: f.id,
      kickoff: f.kickoff ? f.kickoff.slice(0, 5) : null,
      homeTeam: home.name,
      homeBadge: home.badge,
      awayTeam: away.name,
      awayBadge: away.badge,
    })
  }

  const result = Array.from(byDivision.values())
  for (const entry of result) {
    const seen = new Set<string>()
    for (const fx of entry.fixtures) {
      for (const [name, badge] of [
        [fx.homeTeam, fx.homeBadge],
        [fx.awayTeam, fx.awayBadge],
      ] as const) {
        if (name && !seen.has(name)) {
          seen.add(name)
          entry.teams.push({ name, badge })
        }
      }
    }
    entry.teams.sort((a, b) => a.name.localeCompare(b.name))
  }
  result.sort((a, b) => a.name.localeCompare(b.name))

  return { sundayIso, divisions: result }
}
