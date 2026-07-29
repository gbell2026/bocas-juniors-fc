# Registration Payment Plans

## Summary

Registration currently charges a single flat membership fee. This adds a choice at registration between paying in full or paying monthly (at a higher total), a terms-of-commitment checkbox, and ongoing visibility into what's still owed — both for parents (Profile page) and admins (Players table).

## Pricing (this season only, hardcoded — not a general date calculator)

Season: August 15 – December 1.

| Plan | Schedule | Total |
|---|---|---|
| Full | One payment at registration | **$30** |
| Monthly | Aug $30 → Sep $60 → Oct $60 → Nov $60 | **$210** |

The membership fee setting (`settings.membership_fee_cents`, currently seeded at `2500` = $25) is out of date — this work also corrects it to `3000` ($30). This correction, the two new columns below, and the historical-data backfill all belong in **one single new migration file** (e.g. `005_registration_payment_plans.sql`) — they're one unit of related change, not separate migrations. (The old seed file already ran in production; editing it won't affect the live row, per the same reasoning as the payment-handle migration in the rebrand work.)

First payment is **$30 either way** (full plan's total, or monthly's August installment) — no special-casing needed for the very first charge.

**Late registration:** if a parent registers after the season's already underway (e.g., in October), the monthly plan still starts from the first unpaid installment in the fixed sequence (August), not from whichever calendar month it currently is. Confirmed with the user as the intended behavior — simplest, and this season's registration window is expected to cluster right around Aug 15 anyway.

## Data model

Two additions, both to already-migrated tables. The codebase's existing convention for this kind of fixed-value column is a real Postgres `enum` (see `player_status`, `payment_method_type`, `payment_status_type` in `001_initial_schema.sql`) — follow that convention rather than `text` + `check`:

- New enum `payment_plan_type` (`'full'`, `'monthly'`). `players.payment_plan payment_plan_type not null default 'full'` — existing players default to `'full'`, no behavior change for them.
- New enum `installment_label_type` (`'full'`, `'august'`, `'september'`, `'october'`, `'november'`). `payments.installment_label installment_label_type` — nullable (historical rows predate this feature). Existing **succeeded** payments get backfilled to `'full'` as part of the same migration.

Explicitly tagging the label (rather than inferring from `paid_at` date) avoids fragility if a parent pays an installment early or late.

**Changing a player's plan after registration:** admins can already edit a player's `status` inline in the Players table (`updatePlayerStatus` action) — add `payment_plan` as an equivalent admin-editable field in that same table/action, for the case where a plan was mis-selected at signup or a parent wants to switch later.

## Shared schedule logic

One source of truth for the installment sequence and amounts, used by both the parent-facing payment flow and the admin-facing status displays — not duplicated:

```
FULL_PLAN:    [{ label: 'full',      amountCents: 3000 }]
MONTHLY_PLAN: [{ label: 'august',    amountCents: 3000 },
               { label: 'september', amountCents: 6000 },
               { label: 'october',   amountCents: 6000 },
               { label: 'november',  amountCents: 6000 }]
```

Given a player's `payment_plan` and their existing **succeeded** payments (by `installment_label`), the "current amount due" is the first installment in that plan's sequence with no matching succeeded payment. If every installment has a succeeded payment, the player is fully paid (no payment panel shown, just a paid confirmation).

"Registration fee paid" (the status shown in both places below) means: a succeeded payment exists for the *first* installment in the player's plan sequence (`'full'` for the full plan, `'august'` for monthly) — i.e., they've completed the initial payment required to be considered registered, regardless of whether later monthly installments are still outstanding.

This due-amount computation happens **server-side**, derived from the player's stored plan and actual payment history — never trusting a client-supplied amount, matching the existing pattern in `adminMarkCashPaid`.

**This requires rewriting how payments get created, not just how due-amounts get displayed.** Today, `requestPayment` and `adminMarkCashPaid` (`src/app/actions/payment.ts`) both read `settings.membership_fee_cents` directly as a flat amount and don't record what a payment is *for*. Both functions need to:
1. Look up the player's `payment_plan` and their succeeded payments' `installment_label`s.
2. Compute the current-due installment via the shared schedule logic above (ignore any amount the client might send).
3. Insert the payment with `amount` set to that installment's `amountCents` and `installment_label` set to that installment's label.

`getPaymentSettings` keeps returning `monzoDetails`/`revolutDetails`/`paypalMeUrl` as today (unrelated to plan) but no longer returns a single flat `feeCents` — callers get the per-player due amount from a new function instead (see below).

## Registration form changes

Added to the existing "Player Info" step (not a new top-level step — the existing flow's step 2 is already "Payment", so plan choice belongs alongside the rest of the registration inputs, submitted together):

1. **Plan choice** — two options shown with their real totals: "Pay in Full — $30" vs. "Monthly — $30 in August, $60/mo Sep–Nov ($210 total)".
2. **Terms checkbox** (required to submit): *"I agree to keep my child registered with the Tangerine Toucans through at least the first half of the season, regardless of the payment plan I choose."*

`registerParentAndPlayer` gains `paymentPlan: 'full' | 'monthly'` and `agreedToTerms: boolean` params; server rejects if `agreedToTerms` isn't `true` (don't trust client-side-only validation for a required legal-ish commitment). `payment_plan` is stored on the player row at insert time.

The immediately-following payment step (existing PayPal/Monzo/Revolut/Cash flow) is unchanged in mechanism — it just now charges whatever the server computes as currently due (which, for a fresh registration, is always $30).

## Ongoing collection & status display

- **Profile page** (`PaymentOptionsPanel`): becomes plan-aware. Instead of always showing a flat fee, it fetches the player's current amount due (server-computed, per above) and shows that — or, if nothing's outstanding, a fully-paid state instead of the payment panel: **"You're all paid up for the season!"** A separate, always-visible line shows registration-fee status: **"Registration fee: Paid"** or **"Registration fee: Outstanding"**, independent of whether later monthly installments remain.
- **Admin Players table**: new column labeled **"Reg. Fee"** showing **"Paid"** / **"Outstanding"** per player, sourced from the same shared logic (not a second implementation) — reused via `getAllPlayers` returning the computed status alongside existing player fields.

## Housekeeping implied by the schema change

Regenerate `src/lib/supabase/types.ts` from the new schema (new enums, new columns), and update `src/app/actions/__tests__/register.test.ts` / `src/app/actions/__tests__/payment.test.ts` for the new params and installment-tagging behavior — following the same conventions those files already use for the existing fields.

## Out of scope

- General reusable date-based proration calculator for future seasons (explicitly deferred — this season's schedule is hardcoded).
- Automated recurring billing/reminders for monthly installments — collection stays manual (parent pays via existing methods when they see it's due; no auto-charge, no email reminders).
- Shirt number field (raised, then explicitly withdrawn during this brainstorm — not part of this spec).
