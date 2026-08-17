# Admin Players Table Redesign — Design Spec

**Date:** 2026-08-17
**Status:** Approved

## Background

The admin players table (`src/components/admin/players-table.tsx`) has 11 columns (Player, Position, Age Group, DOB, Parent, Plan, Reg. Fee, Status, Return Date, Last Paid, Actions) and requires horizontal scrolling to view fully. It also only surfaces whether the one-time registration fee has been paid — there's no way to tell at a glance whether a player's ongoing season/monthly installments are up to date.

## Scope

**This build:**
- Collapsible rows: each row shows a trimmed set of columns by default, expandable to reveal the rest
- A new "Payment Status" column reflecting ongoing season/installment standing (distinct from the existing Reg. Fee column, which stays as-is)

**Explicitly out of scope:**
- Any change to the underlying `updatePlayerStatus`/`updatePlayerPaymentPlan`/`updatePlayerAgeGroups`/`cancelPlayer`/`restorePlayer`/`deletePlayer`/`adminMarkCashPaid` actions — this is a display/layout change only
- Sorting, filtering, or pagination — not requested
- Any change to `pending-payments.tsx` (the separate pending-payments card list) or any other admin view

## Collapsed row

Columns, in order: **Player | Parent | Status | Reg. Fee | Payment Status | (expand toggle)** — six columns, fits without horizontal scroll on a typical laptop viewport.

- The `Status` column shown here is the player's status pill (active/inactive/injured/away/cancelled) as **read-only display text**, not the editable `<select>` — editing status is an expanded-row action, same as today's "Save Changes" flow.
- Reg. Fee keeps its current "Paid"/"Outstanding" display exactly as-is.
- Clicking anywhere on the row (outside of interactive elements once expanded) toggles expand/collapse. Expansion state is local component state (`Set<string>` of expanded player ids, or a `Record<string, boolean>` — implementer's choice, no persistence needed across page reloads).
- The whole row keeps its existing `opacity-60` treatment when `status === 'cancelled'`, both collapsed and expanded.

## Expanded row

Below the collapsed summary, reveals (reusing the exact existing editable controls, unchanged in behavior): Position, Age Group checkboxes, DOB, Payment Plan select, editable Status select + Return Date, Last Paid, and all the action buttons (Save Changes, Mark Cash Paid, Cancel/Restore, Delete) exactly as they exist today — this task only relocates them from always-visible table cells into a conditionally-rendered block, it does not change what they do or how they're wired.

## Payment Status column

Computed the same way `getRosterForCoach()` already computes `hasOutstanding` — one `getAmountDue(playerId)` call per player, via `Promise.all`, added to `getAllPlayers()` in `src/app/actions/admin.ts`.

`getAmountDue` (`src/app/actions/payment.ts`, already built, unchanged by this spec) returns `(Installment & { isFirstInstallment: boolean }) | null`, where `Installment = { label: InstallmentLabel; amountCents: number }` and `InstallmentLabel` is one of `'registration' | 'full' | 'august' | 'september' | 'october' | 'november'`.

Three display states, derived from that return value:
- **`null`** (nothing left owing at all) → **"Paid up"**
- **Non-null, `isFirstInstallment: true`** (the registration fee itself is the next thing due) → **"Awaiting registration"** — deliberately deferring to the existing Reg. Fee column for detail here rather than duplicating it
- **Non-null, `isFirstInstallment: false`** (registration is paid, a season/monthly installment is next due) → **"Owes $X (Label)"**, e.g. "Owes $60 (September)" — this is the case the admin currently has no visibility into

Label formatting: capitalize month labels as-is (`august` → `August`); `full` → `Season Fee` (a full-plan player who hasn't paid their lump season payment yet); `registration` never reaches this branch (handled by the `isFirstInstallment` case above). A small local label map in the component (or a colocated helper), following the same plain-object-lookup pattern already used for `methodLabel` in `pending-payments.tsx` — no i18n needed, admin stays English-only per established convention.

## Data layer

`getAllPlayers()` in `src/app/actions/admin.ts` gains a `paymentStatus` field per player, of type:
```ts
type PaymentStatusInfo =
  | { kind: 'paidUp' }
  | { kind: 'awaitingRegistration' }
  | { kind: 'owes'; label: InstallmentLabel; amountCents: number }
```
computed via `getAmountDue(p.id)` (imported from `@/app/actions/payment`) for every player, in parallel via `Promise.all`, mirroring `getRosterForCoach()`'s existing pattern exactly.

## Testing

- TDD for `getAllPlayers()`'s new `paymentStatus` computation in `src/app/actions/__tests__/admin.test.ts` (already has a `describe('getAllPlayers', ...)` block from a prior feature): one test per state (`paidUp`, `awaitingRegistration`, `owes` with a season label). `getAmountDue` is mocked the same way `roster.test.ts` already mocks it (`jest.mock('@/app/actions/payment', () => ({ getAmountDue: jest.fn() }))`) rather than driving its real DB-mock chain — same deliberate-deviation rationale already documented in `roster.test.ts` for this exact function.
- No new component test for `players-table.tsx` or its expand/collapse interaction, consistent with this component's established no-test precedent (confirmed multiple times this session).
