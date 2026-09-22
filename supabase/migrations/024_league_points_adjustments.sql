-- Administrative points adjustments (e.g. a deduction for fielding an
-- overage player, or a late kickoff) — standings were previously computed
-- purely from match results, with no way to record a penalty against a team.
create table league_points_adjustments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references league_teams(id) on delete cascade,
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- RLS: same "deny-all, service-role only" pattern used throughout the
-- League feature — every read/write goes through a 'use server' action.
alter table league_points_adjustments enable row level security;
create policy "no_direct_access" on league_points_adjustments using (false);
