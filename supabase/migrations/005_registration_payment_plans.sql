-- New enums for payment plan choice and per-payment installment tagging.
create type payment_plan_type as enum ('full', 'monthly');
create type installment_label_type as enum ('full', 'august', 'september', 'october', 'november');

-- Existing players default to 'full' — no behavior change for anyone registered before this.
alter table players add column payment_plan payment_plan_type not null default 'full';

-- Nullable: historical payments predate this feature.
alter table payments add column installment_label installment_label_type;

-- Backfill: every payment row that exists at migration time predates installment
-- tracking and represents the old flat fee — tag it 'full' regardless of status
-- (not just 'succeeded'). This matters for any payment that's still 'pending' right
-- now and gets confirmed via confirmPayment() *after* this migration ships: confirmPayment
-- only ever updates status/paid_at, never installment_label, so if we only backfilled
-- 'succeeded' rows, that payment would flip to 'succeeded' with a null label post-deploy
-- and getAmountDue would then wrongly ignore it — making that player look like they still
-- owe their first installment despite having just paid it. Backfilling every existing row
-- up front (succeeded, pending, and failed alike) closes that gap entirely.
update payments set installment_label = 'full' where installment_label is null;

-- The seeded membership fee ($25, from 002_seed_settings.sql) is stale — the real
-- current fee is $30. That seed file already ran in production, so this corrects
-- the live row directly rather than editing the old seed (same reasoning as the
-- payment-handle migration in the Tangerine Toucans rebrand).
update settings set value = '3000', updated_at = now() where key = 'membership_fee_cents';
