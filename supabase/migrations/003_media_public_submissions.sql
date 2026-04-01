-- Allow anonymous submissions (no auth user)
alter table media alter column uploaded_by drop not null;

-- Store optional submitter display name
alter table media add column submitter_name text;
