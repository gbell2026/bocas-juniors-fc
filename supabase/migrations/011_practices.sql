create table practices (
  id uuid primary key default gen_random_uuid(),
  practice_date date not null,
  practice_time time not null,
  location text,
  notes text,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS: same "deny-all, service-role only" pattern used throughout this
-- project — all access goes through 'use server' actions.
alter table practices enable row level security;
create policy "no_direct_access" on practices using (false);
