-- Default membership fee: $25.00 = 2500 cents. Update via Supabase Studio.
-- Update paypal_me_url, monzo_details, revolut_details via Supabase Studio after deploy.
insert into settings (key, value, updated_at)
values
  ('membership_fee_cents', '2500', now()),
  ('paypal_me_url', 'https://paypal.me/bocasjuniorsfc', now()),
  ('monzo_details', 'Sort: 00-00-00 / Acc: 00000000 / Ref: [player name]', now()),
  ('revolut_details', '@bocasjuniorsfc on Revolut', now());
