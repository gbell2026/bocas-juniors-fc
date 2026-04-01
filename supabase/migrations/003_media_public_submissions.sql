-- Allow anonymous submissions (no auth user)
alter table media alter column uploaded_by drop not null;

-- Store optional submitter display name
alter table media add column submitter_name text;

-- Note: anonymous inserts use the service-role client and bypass RLS.
-- No anon INSERT policy is needed. If the insert path ever switches to
-- an anon-key client, a policy must be added here.
