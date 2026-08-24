create type finance_entry_status as enum ('confirmed', 'forecasted');

-- Defaulting to 'confirmed' means every entry logged before this migration
-- reads identically to how it does today — no backfill needed.
alter table finance_entries
  add column status finance_entry_status not null default 'confirmed';
