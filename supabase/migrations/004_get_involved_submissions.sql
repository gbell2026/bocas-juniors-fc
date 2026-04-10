create table get_involved_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organisation text,
  interests text[] not null,
  message text,
  submitted_at timestamptz not null default now(),
  handled boolean not null default false
);
