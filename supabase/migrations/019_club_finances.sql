create type finance_category_kind as enum ('income', 'expense');

create table finance_seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind finance_category_kind not null,
  -- 'registration' and 'subscription' are computed from the payments
  -- table; every other category is manually logged via finance_entries.
  -- Not a general-purpose enum — just a marker for the two categories
  -- with a live data source. Rename/delete on these is blocked in
  -- src/app/actions/finances.ts, not by a DB constraint.
  auto_source text check (auto_source in ('registration', 'subscription')),
  created_at timestamptz not null default now()
);

create table finance_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references finance_seasons(id) on delete cascade,
  category_id uuid not null references finance_categories(id) on delete restrict,
  amount_cents integer not null,
  entry_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table finance_budgets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references finance_seasons(id) on delete cascade,
  category_id uuid not null references finance_categories(id) on delete restrict,
  target_amount_cents integer not null,
  unique (season_id, category_id)
);

-- Same "deny-all, service-role only" pattern as staff_members
-- (009_staff_members.sql) and every league_* table (006_league.sql) —
-- every read/write goes through a 'use server' action.
alter table finance_seasons enable row level security;
alter table finance_categories enable row level security;
alter table finance_entries enable row level security;
alter table finance_budgets enable row level security;
create policy "no_direct_access" on finance_seasons using (false);
create policy "no_direct_access" on finance_categories using (false);
create policy "no_direct_access" on finance_entries using (false);
create policy "no_direct_access" on finance_budgets using (false);

insert into finance_categories (name, kind, auto_source) values
  ('Registration Fees', 'income', 'registration'),
  ('Subscriptions', 'income', 'subscription'),
  ('Sponsorship', 'income', null),
  ('Other Income', 'income', null),
  ('Wages', 'expense', null),
  ('Equipment', 'expense', null),
  ('Travel', 'expense', null),
  ('Other Expense', 'expense', null);
