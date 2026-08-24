-- A one-time, per-season opening balance (e.g. cash carried over from the
-- prior year), set manually from the P&L view — not computed, not rolled
-- forward automatically between seasons.
alter table finance_seasons
  add column starting_balance_cents integer not null default 0;
