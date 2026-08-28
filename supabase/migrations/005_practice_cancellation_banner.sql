-- Homepage "today's practice is cancelled" banner. Stored as settings rows so it
-- reuses the existing public-read RLS policy on `settings`.
insert into settings (key, value, updated_at)
values
  ('practice_cancelled', 'false', now()),
  ('practice_cancelled_date', '', now()),
  ('practice_cancelled_reason', '', now())
on conflict (key) do nothing;
