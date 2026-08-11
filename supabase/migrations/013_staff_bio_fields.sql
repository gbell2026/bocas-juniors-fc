-- Expands staff bios beyond a single free-text paragraph, matching the
-- staff bio template being used to collect this info (nationality,
-- one-line intro, background, qualifications, philosophy, favourite team,
-- fun fact). All nullable — existing rows have none of these, and even
-- going forward only name/role_title/bio are required by the admin form.
alter table staff_members
  add column nationality text,
  add column one_line_intro text,
  add column background text,
  add column qualifications text,
  add column philosophy text,
  add column favourite_team text,
  add column fun_fact text;
