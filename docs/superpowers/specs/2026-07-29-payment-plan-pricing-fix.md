# Payment Plan Pricing Fix — Design Spec

**Date:** 2026-07-29
**Status:** Approved

## Background

The registration-payment-plans feature (shipped in `docs/superpowers/specs/2026-07-29-registration-payment-plans.md`) launched with "Pay in Full" priced at $30 flat, while "Monthly" totals $210 ($30 August + $60/month September–November). This is backwards: a parent could pay $30 in full and owe nothing further, while a parent on the monthly plan pays $210 for the same season. There is no reason anyone would choose Monthly under that pricing.

## Fix

**"Pay in Full" must cost $210** — the same total as the Monthly plan. It represents paying the exact same season fee as one lump sum instead of four installments. The Monthly schedule itself is unchanged and was already correct: August (half month, $30), September ($60), October ($60), November ($60) = $210 total.

## Changes

### 1. `src/lib/payment-schedule.ts`
`FULL_PLAN`'s single installment amount changes from `3000` to `21000` cents. No other logic changes — `getNextDue`, `isRegistrationFeePaid`, and `getPlanTotalCents` all continue to work unchanged, since they're driven entirely by the `FULL_PLAN`/`MONTHLY_PLAN` data.

### 2. `src/lib/__tests__/payment-schedule.test.ts`
Update the three assertions that hardcode the old `full` amount (3000) to the new one (21000):
- `getNextDue('full', [])` → expects `amountCents: 21000`
- `getNextDue('monthly', ['full'])` → expects `amountCents: 3000` for `august` (unaffected — this test is about the monthly plan ignoring an irrelevant `'full'` label; no change needed here, listed for completeness)
- `getPlanTotalCents('full')` → expects `21000` instead of `3000`

### 3. `src/app/actions/__tests__/payment.test.ts`
Update the two assertions referencing the old full-plan amount (3000 → 21000):
- `getAmountDue` test expecting `{ label: 'full', amountCents: 3000, ... }`
- `requestPayment` test asserting `insert` was called with `amount: 3000, installment_label: 'full'`

### 4. `src/components/register/registration-form.tsx`
Update the "Pay in Full" option's displayed label and description:
- Old: `Pay in Full — $30` / `One payment, due now.`
- New: `Pay in Full — $210` / `One payment covering the whole season (August–November).`

### 5. Terms checkbox wording
Replace the current terms text (which only commits to *staying registered*) with explicit financial-liability language, since the real commitment being asked for is to pay all four installments' worth of fees regardless of which plan is chosen or whether the child continues playing:

Old:
> "I agree to keep my child registered with the Tangerine Toucans through at least the first half of the season, regardless of the payment plan I choose."

New:
> "I understand that regardless of the payment plan I choose, I am financially liable for all registration fees for the first half of the season (August–November, $210 total), even if my child stops playing before the season ends."

## Out of scope

- No change to the Monthly plan's schedule or amounts — those were already correct.
- No change to the settings-table `membership_fee_cents` value (unused by the schedule module; it was already corrected to $30 in a prior migration for historical/display reasons unrelated to this fix, and nothing reads it for pricing anymore).
- No change to any already-completed payment records — this only affects the amount charged for *future* full-plan payments going forward.
