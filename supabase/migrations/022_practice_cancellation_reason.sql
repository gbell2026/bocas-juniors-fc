-- Free-text reason shown on the homepage when a practice is cancelled, e.g.
-- "heavy rain and a waterlogged pitch". Nullable — a cancellation can have no
-- stated reason. Cleared back to null when a practice is un-cancelled.
alter table practices add column cancellation_reason text;
