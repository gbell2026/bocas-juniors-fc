-- Club Name, Team Name, and Division stay required — a team needs these to
-- function (be schedulable, show in standings). Contact details are no
-- longer required at signup; the admin can always follow up with the club
-- directly once approved.
alter table league_clubs
  alter column contact_name drop not null,
  alter column contact_email drop not null,
  alter column contact_phone drop not null;
