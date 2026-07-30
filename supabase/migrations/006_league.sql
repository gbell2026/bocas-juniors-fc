-- Shared status enum for the three approval-gated League entities.
create type league_status_type as enum ('pending', 'approved', 'rejected');

create table league_clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  badge_cloudinary_public_id text,
  status league_status_type not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league_divisions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  season_start_date date not null,
  season_end_date date not null,
  created_at timestamptz not null default now()
);

create table league_teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references league_clubs(id) on delete cascade,
  division_id uuid not null references league_divisions(id) on delete restrict,
  name text not null,
  status league_status_type not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table league_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references league_teams(id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  squad_number integer not null,
  status league_status_type not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Squad numbers only need to be unique among a team's *approved* roster —
-- two still-pending submissions (or a pending + a rejected one) may
-- legitimately clash; the conflict is caught at approval time instead
-- (see league-admin.ts's approveLeaguePlayer), since submissions are
-- anonymous and can't see each other's numbers ahead of time.
create unique index league_players_team_squad_number_approved_idx
  on league_players (team_id, squad_number)
  where status = 'approved';

create table league_fixtures (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references league_divisions(id) on delete cascade,
  home_team_id uuid not null references league_teams(id) on delete restrict,
  away_team_id uuid not null references league_teams(id) on delete restrict,
  match_date date not null,
  home_score integer,
  away_score integer,
  created_at timestamptz not null default now()
);

-- RLS: same "deny-all, service-role only" pattern as user_roles in
-- 001_initial_schema.sql. Every League read/write goes through a
-- 'use server' action using the service-role client — there is no
-- direct anon access to these tables (unlike `media`'s public-select
-- policy), because registration submissions need server-side validation
-- (e.g. the squad-number approval check) that RLS alone can't express.
alter table league_clubs enable row level security;
alter table league_divisions enable row level security;
alter table league_teams enable row level security;
alter table league_players enable row level security;
alter table league_fixtures enable row level security;

create policy "no_direct_access" on league_clubs using (false);
create policy "no_direct_access" on league_divisions using (false);
create policy "no_direct_access" on league_teams using (false);
create policy "no_direct_access" on league_players using (false);
create policy "no_direct_access" on league_fixtures using (false);
