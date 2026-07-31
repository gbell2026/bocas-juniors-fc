create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalized from the commenter's `parents` record at post time so the
  -- comment list doesn't need a join back to `parents` on every read. If a
  -- commenting user somehow has no parents row, the server action falls
  -- back to a generic label rather than failing the comment — this is a
  -- display nicety, not a security boundary.
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index announcement_comments_announcement_id_idx on announcement_comments(announcement_id);

-- RLS: same "deny-all, service-role only" pattern as the League feature.
-- Every read/write goes through a 'use server' action using the
-- service-role client — comment authorship is verified server-side via a
-- session-aware client before the service-role client ever writes.
alter table announcements enable row level security;
alter table announcement_comments enable row level security;

create policy "no_direct_access" on announcements using (false);
create policy "no_direct_access" on announcement_comments using (false);
