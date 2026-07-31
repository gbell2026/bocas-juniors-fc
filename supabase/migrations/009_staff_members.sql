create table staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_title text not null,
  bio text not null,
  -- Stored as a Cloudinary public ID, matching the existing
  -- media.cloudinary_public_id / league_clubs.badge_cloudinary_public_id
  -- convention — never a full URL.
  photo_cloudinary_public_id text,
  created_at timestamptz not null default now()
);

alter table staff_members enable row level security;
create policy "no_direct_access" on staff_members using (false);
