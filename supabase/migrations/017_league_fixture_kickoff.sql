-- Nullable: existing fixtures (and any future fixture added without a
-- specified time, e.g. via the admin "Add Fixture Manually" form left
-- blank) remain valid. All fixtures in the real 2026 season import have
-- a kickoff set.
alter table league_fixtures add column kickoff time;
