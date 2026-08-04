-- Adds a distinct one-time "registration" installment, separate from the
-- season payment plan (full/monthly). Kept in its own migration file since
-- Postgres cannot use a newly-added enum value in the same transaction it
-- was added in.
alter type installment_label_type add value 'registration';
