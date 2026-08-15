export type DivisionRoster = { divisionId: string; teams: { teamId: string; clubId: string }[] }

export type AlignTeamOrdersResult =
  | { ok: true; orderedTeamIds: Map<string, string[]> }
  | { ok: false; error: string }

/**
 * Produces a team-ID ordering per division such that clubs shared across
 * multiple divisions land in the same relative position in every division's
 * array. Since generateRoundRobin's round-by-round pairing is purely
 * positional (not identity-based), feeding it arrays built this way makes a
 * shared club's teams always fall in the same round — and therefore the
 * same date — across every division, as long as every division is later
 * generated over the same round-to-date mapping (same start date).
 *
 * The anchor club is placed first in every array. generateRoundRobin's
 * circle method never rotates position 0 out, so the anchor's teams play in
 * every single round, in every division — including round 1.
 *
 * Requires every division to have the same number of teams (the pairing
 * pattern itself depends on array length, so mismatched counts can't be
 * aligned) and the anchor club to have a team in every division provided.
 */
export function alignTeamOrders(divisions: DivisionRoster[], anchorClubId: string): AlignTeamOrdersResult {
  if (divisions.length === 0) return { ok: true, orderedTeamIds: new Map() }

  const teamCount = divisions[0].teams.length
  for (const d of divisions) {
    if (d.teams.length !== teamCount) {
      return {
        ok: false,
        error: `Divisions have different team counts (${divisions.map(x => x.teams.length).join(' vs ')}) — every division must have the same number of teams to align schedules.`,
      }
    }
    if (!d.teams.some(t => t.clubId === anchorClubId)) {
      return { ok: false, error: `The anchor club has no approved team in division "${d.divisionId}".` }
    }
  }

  // Global club order: anchor first, then every other distinct club in the
  // order first encountered while scanning the provided divisions.
  const seen = new Set<string>([anchorClubId])
  const clubOrder: string[] = [anchorClubId]
  for (const d of divisions) {
    for (const t of d.teams) {
      if (!seen.has(t.clubId)) {
        seen.add(t.clubId)
        clubOrder.push(t.clubId)
      }
    }
  }

  const orderedTeamIds = new Map<string, string[]>()
  for (const d of divisions) {
    const byClub = new Map(d.teams.map(t => [t.clubId, t.teamId]))
    const ordered = clubOrder
      .map(clubId => byClub.get(clubId))
      .filter((teamId): teamId is string => teamId !== undefined)
    orderedTeamIds.set(d.divisionId, ordered)
  }

  return { ok: true, orderedTeamIds }
}
