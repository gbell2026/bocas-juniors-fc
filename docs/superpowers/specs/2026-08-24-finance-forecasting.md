# Finance Forecasting — Design Spec

**Date:** 2026-08-24
**Status:** Approved

## Background

The club finances (P&L) feature shipped with a Budget/Actual/Variance view: Actual is always confirmed, already-happened money (succeeded payments for Registration Fees/Subscriptions, logged entries for every other category). There's no way to represent money that's planned but hasn't happened yet — an admin can't distinguish "we spent $200 on referee fees" from "we expect to spend about $200 on referee fees next month," and there's no visibility into how much registration/subscription revenue is still outstanding from active players.

## Scope

**This build:**
- A `confirmed`/`forecasted` status on every manually-logged entry (both income and expense categories)
- A new Forecasted column and a Total (Actual + Forecasted) column in the P&L table, with Variance now comparing Total against Budget
- Registration Fees and Subscriptions gain a computed Forecasted value: the total still owed by active players, split by installment type, independent of which finance season is selected
- Editing an entry's status is how a forecasted line item becomes confirmed once it actually happens — no separate "confirm" action

**Explicitly out of scope:**
- Any change to how Actual is computed for any category — it stays exactly as shipped
- Forecasting for categories other than Registration Fees/Subscriptions among the auto-source pair — no other automatic forecast sources
- Any season-date-based filtering of the outstanding-balance forecast (see Data below — it's a live snapshot, not season-scoped)
- Recurring/scheduled forecasted entries (e.g. "forecast $500/month automatically") — still manual entry only, consistent with the original feature's scope decision

## Data model

New migration (next available number after `019_club_finances.sql`). Adds one enum and one column:

```sql
create type finance_entry_status as enum ('confirmed', 'forecasted');

alter table finance_entries
  add column status finance_entry_status not null default 'confirmed';
```

Defaulting to `'confirmed'` means every entry logged before this migration reads identically to how it does today — no backfill needed, no behavior change for existing data.

## Server actions (`src/app/actions/finances.ts`)

- `FinanceEntryInput` gains a required `status: 'confirmed' | 'forecasted'` field; `createFinanceEntry` writes it to the new column.
- `updateFinanceEntry`'s input gains the same `status` field, so editing an entry can change its status — this is the "mark forecasted entry as confirmed" workflow, no separate action needed.
- `getFinanceEntries` returns `status` on `FinanceEntry`.
- `FinancePnLRow` gains `forecastedCents` and `totalCents` (`actualCents + forecastedCents`) alongside the existing `budgetCents`/`actualCents`.
- `getFinancePnL`'s per-category `forecastedCents`:
  - For a manual category: sum of that category's `finance_entries` rows for the season where `status = 'forecasted'`. **This is the one behavior change to an existing number:** `actualCents` for manual categories must now filter to `status = 'confirmed'` only, since a forecasted entry is by definition not yet actual. Today, every logged entry (there was no status column) counts as Actual; after this migration, only `confirmed`-status entries do, and `forecasted`-status entries move into the new Forecasted column instead.
  - For Registration Fees/Subscriptions: `actualCents` is unchanged (still `payments` where `status = 'succeeded'`, within the season's date range). `forecastedCents` is a new computation — see below — and is NOT filtered by the season's date range, per the scoping decision.

### Outstanding-balance forecast for Registration Fees / Subscriptions

A new function, `getOutstandingBalanceForecast()`, returns `{ registrationCents: number; subscriptionCents: number }`:

1. Fetch all players where `status` is not `'inactive'` and not `'cancelled'` — the same exclusion already used by `getRosterForCoach` (`src/app/actions/roster.ts:20`), since both questions are "who's an active part of the club right now."
2. For each, call the existing `getPaymentSchedule(playerId)` (`src/app/actions/payment.ts`), which already returns every installment in that player's plan tagged `'paid' | 'pending' | 'outstanding'`.
3. Sum `amountCents` for every installment where `status !== 'paid'` — this deliberately includes `'pending'` (a parent self-reported payment you haven't confirmed yet) alongside `'outstanding'`, since neither represents money that's actually landed. Split the sum into `registrationCents` (label `'registration'`) and `subscriptionCents` (every other label).

`getFinancePnL` calls this once (not per-category) and uses `registrationCents`/`subscriptionCents` as the `forecastedCents` for the two matching categories.

**Performance note:** this issues one `getPaymentSchedule` call per active player (each of which does its own small set of queries), consistent with the existing N-calls-via-`Promise.all` pattern already used by `getAllPlayers`/`getRosterForCoach` for the equivalent "check every player's due status" problem. Fine at this club's scale; not something this spec optimizes further.

## UI (`src/components/admin/finances-admin.tsx`)

- The entry create form gains a status `<select>` (Confirmed / Forecasted), defaulting to Confirmed.
- The entry edit-in-place form gains the same `<select>`, pre-filled with the entry's current status — changing it and saving is how an entry moves from forecasted to confirmed (or, less commonly, back).
- Each entry in the log list shows its status as a small badge (e.g. "Forecasted" in an amber/muted style) next to the amount, so the list itself makes clear which lines are firm vs. planned.
- P&L table columns become: Category | Budget | Actual | Forecasted | Total | Variance. `Total = Actual + Forecasted`. Variance keeps its existing club's-favor sign convention (flipped for expense categories) but now compares `Total` against `Budget` instead of `Actual` against `Budget`.
- Totals rows (Total Income / Total Expenses / Net) get the same additional columns, computed the same way as today's Budget/Actual totals but summed across `forecastedCents`/`totalCents` too.

## Testing

- `src/app/actions/__tests__/finances.test.ts`: extend `createFinanceEntry`/`updateFinanceEntry` tests to cover the `status` field; extend `getFinancePnL`'s test to cover a mix of confirmed and forecasted manual entries (confirming `actualCents` only sums confirmed, `forecastedCents` only sums forecasted, `totalCents` is their sum); add a new test for `getOutstandingBalanceForecast` covering: a player with an outstanding registration fee, a player with an outstanding subscription installment, a player with a pending (unconfirmed) payment counted as forecast, a fully-paid player contributing $0, and a cancelled/inactive player excluded entirely.
- Following this codebase's established convention, no new component tests for `finances-admin.tsx` (matches every other admin component — only pure logic and server actions get automated coverage).
