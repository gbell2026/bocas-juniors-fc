create type player_status as enum ('active', 'inactive', 'injured', 'away');
create type payment_method_type as enum ('paypal', 'monzo', 'revolut', 'cash');
create type payment_status_type as enum ('succeeded', 'pending', 'failed');
create type media_type as enum ('photo', 'video');
create type user_role_type as enum ('parent', 'coach', 'admin', 'player');

create table user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role_type not null
);

create table parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  parent_id uuid not null references parents(id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  position text not null,
  status player_status not null default 'inactive',
  return_date date,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  payment_method payment_method_type not null,
  amount integer not null,
  currency text not null default 'usd',
  status payment_status_type not null default 'pending',
  paid_at timestamptz,
  notes text
);

create table media (
  id uuid primary key default gen_random_uuid(),
  cloudinary_public_id text not null,
  type media_type not null,
  caption text,
  pinned boolean not null default false,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  published boolean not null default true
);

create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- RLS
alter table user_roles enable row level security;
alter table parents enable row level security;
alter table players enable row level security;
alter table payments enable row level security;
alter table media enable row level security;
alter table settings enable row level security;

-- user_roles: service role only (no user-facing policies)
create policy "no_user_access" on user_roles using (false);

-- parents: own row only
create policy "parent_select_own" on parents for select using (user_id = auth.uid());
create policy "parent_update_own" on parents for update using (user_id = auth.uid());

-- players: parent reads/updates their players
create policy "parent_select_players" on players for select
  using (parent_id in (select id from parents where user_id = auth.uid()));
create policy "parent_update_players" on players for update
  using (parent_id in (select id from parents where user_id = auth.uid()));

-- payments: parent reads own payments
create policy "parent_select_payments" on payments for select
  using (parent_id in (select id from parents where user_id = auth.uid()));

-- media: anyone reads published
create policy "public_select_media" on media for select using (published = true);

-- settings: anyone reads
create policy "public_select_settings" on settings for select using (true);
