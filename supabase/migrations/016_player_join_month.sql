create type join_month_type as enum ('august', 'september', 'october', 'november');

-- Default 'august' backfills every existing player as having joined at the
-- start of the season, matching the pricing they already agreed to — only
-- new registrations make an actual choice here.
alter table players add column join_month join_month_type not null default 'august';
