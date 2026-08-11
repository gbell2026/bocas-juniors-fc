-- Lets admin mark a League fixture as cancelled, so the homepage schedule
-- widget (and the public League page) can surface it — previously fixtures
-- had no concept of being called off.
alter table league_fixtures add column cancelled boolean not null default false;
