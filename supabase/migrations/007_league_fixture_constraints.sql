-- Defensive integrity constraints for league_fixtures, flagged during code
-- review of the standings calculator: nothing previously prevented a
-- fixture from pairing a team against itself (which would silently corrupt
-- standings — both "sides" resolve to the same row, doubling `played` and
-- netting goal difference to zero) or from storing a negative score.
-- generateRoundRobin/the admin fixture UI never produce these cases today,
-- but there was no constraint actually preventing bad data at the DB layer.
alter table league_fixtures
  add constraint league_fixtures_teams_distinct check (home_team_id <> away_team_id);

alter table league_fixtures
  add constraint league_fixtures_home_score_non_negative check (home_score is null or home_score >= 0);

alter table league_fixtures
  add constraint league_fixtures_away_score_non_negative check (away_score is null or away_score >= 0);
