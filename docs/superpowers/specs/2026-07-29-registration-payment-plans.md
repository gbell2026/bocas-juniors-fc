# Registration Payment Plans

## Summary

Registration currently charges a single flat membership fee. This adds a choice at registration between paying in full or paying monthly (at a higher total), a terms-of-commitment checkbox, and ongoing visibility into what's still owed — both for parents (Profile page) and admins (Players table).

## Pricing (this season only, hardcoded — not a general date calculator)

Season: August 15 – December 1.

| Plan | Schedule | Total |
|---|---|---|
| Full | One payment at registration | **$30** |
| Monthly | Aug $30 → Sep $60 → Oct $60 → Nov $60 | **$210** |

The membership fee setting (`settings.membership_fee_cents`, currently seeded at `2500` = $25) is out of date — this work also corrects it to `3000` ($30) via a new migration (the seed file already ran in production; editing it won't affect the live row, per the same reasoning as the payment-handle migration in the rebrand work).

First payment is **$30 either way** (full plan's total, or monthly's August installment) — no special-casing needed for the very first charge.

**Late registration:** if a parent registers after the season's already underway (e.g., in October), the monthly plan still starts from the first unpaid installment in the fixed sequence (August), not from whichever calendar month it currently is. Confirmed with the user as the intended behavior — simplest, and this season's registration window is expected to cluster right around Aug 15 anyway.

## Data model

Two additions, both to already-migrated tables (new migration file, not edits to `001_initial_schema.sql`):

- `players.payment_plan text not null default 'full' check (payment_plan in ('full', 'monthly'))` — existing players default to `'full'`, no behavior change for them.
- `payments.installment_label text` — tags what a payment covers: `'full'`, `'august'`, `'september'`, `'october'`, or `'november'`. Nullable for historical rows; existing **succeeded** payments get backfilled to `'full'` as part of the same migration (they predate this feature and represent the old flat fee).

Explicitly tagging the label (rather than inferring from `paid_at` date) avoids fragility if a parent pays an installment early or late.

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

## Registration form changes

Added to the existing "Player Info" step (not a new top-level step — the existing flow's step 2 is already "Payment", so plan choice belongs alongside the rest of the registration inputs, submitted together):

1. **Plan choice** — two options shown with their real totals: "Pay in Full — $30" vs. "Monthly — $30 in August, $60/mo Sep–Nov ($210 total)".
2. **Terms checkbox** (required to submit): *"I agree to keep my child registered with the Tangerine Toucans through at least the first half of the season, regardless of the payment plan I choose."*

`registerParentAndPlayer` gains `paymentPlan: 'full' | 'monthly'` and `agreedToTerms: boolean` params; server rejects if `agreedToTerms` isn't `true` (don't trust client-side-only validation for a required legal-ish commitment). `payment_plan` is stored on the player row at insert time.

The immediately-following payment step (existing PayPal/Monzo/Revolut/Cash flow) is unchanged in mechanism — it just now charges whatever the server computes as currently due (which, for a fresh registration, is always $30).

## Ongoing collection & status display

- **Profile page** (`PaymentOptionsPanel`): becomes plan-aware. Instead of always showing a flat fee, it fetches the player's current amount due (server-computed, per above) and shows that — or a "fully paid" state with no payment panel if nothing's outstanding. A separate, always-visible line shows registration-fee paid/outstanding status regardless of the monthly plan's remaining installments.
- **Admin Players table**: new column showing the same paid/outstanding status per player, sourced from the same shared logic (not a second implementation) — reused via `getAllPlayers` returning the computed status alongside existing player fields.

## Out of scope

- General reusable date-based proration calculator for future seasons (explicitly deferred — this season's schedule is hardcoded).
- Automated recurring billing/reminders for monthly installments — collection stays manual (parent pays via existing methods when they see it's due; no auto-charge, no email reminders).
- Shirt number field (raised, then explicitly withdrawn during this brainstorm — not part of this spec).
