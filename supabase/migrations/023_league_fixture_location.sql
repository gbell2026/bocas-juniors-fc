-- Per-fixture venue. NULL means the league's default ground (Airport Field);
-- only the exceptions carry a value, shown next to those fixtures.
alter table league_fixtures add column location text;
