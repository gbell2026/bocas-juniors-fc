# Cancel / Delete a Player — Design Spec

**Date:** 2026-08-17
**Status:** Approved

## Background

Admin has no way to remove a player from the roster. Some parents have accidentally registered the same child twice, and there's no way to correct that, nor any way to mark a player as having left the club mid-season while preserving their payment history. This is the first of three related admin features (the other two — a payment audit trail and a weekly email summary — are separate, later specs).

## Scope

**This build:**
- A new `cancelled` player status, distinct from the existing `inactive` (which already means "newly registered, not yet activated" — not "left the team")
- A "Cancel" action for any player, reversible via "Restore"
- A "Delete" action, but **only** offered when the player has zero payment rows (of any status — pending, succeeded, or failed) — this prevents ever silently destroying financial history, since `payments.player_id` has `on delete cascade`
- Cancelled players excluded from the coach-facing `/roster` page, same as `inactive` already is
- Cancelled players still visible (greyed out) in the admin players table, and still visible to their own parent on `/profile` (with a translated "Cancelled" status label)

**Explicitly out of scope:**
- Bulk cancel/delete
- Any change to the payment records themselves (that's the payment audit trail spec)
- Automatically detecting/flagging likely duplicates — admin manually decides which of two entries to cancel/delete

## Data model

```sql
alter type player_status add value 'cancelled';
```

New full enum: `'active' | 'inactive' | 'injured' | 'away' | 'cancelled'`. Applied as its own migration statement (standard Postgres `ADD VALUE` pattern, no transaction conflict).

`cancelled` is **not** one of the options in the existing generic status dropdown (`active`/`inactive`/`injured`/`away`) in the admin players table — it's only reachable via the dedicated Cancel/Restore buttons described below, kept deliberately separate from the multi-field "Save Changes" flow (which also touches payment plan and age groups) so cancelling is always an explicit, single-purpose action.

## Server actions

New exports in `src/app/actions/admin.ts`, alongside the existing `updatePlayerStatus`/`updatePlayerPaymentPlan`/`updatePlayerAgeGroups`:

```ts
export async function cancelPlayer(playerId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ status: 'cancelled', return_date: null }).eq('id', playerId)
}

export async function restorePlayer(playerId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
}

export async function deletePlayer(playerId: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: payments } = await supabase.from('payments').select('id').eq('player_id', playerId).limit(1)
  if (payments && payments.length > 0) {
    return { error: 'Cannot delete a player with payment history — cancel instead.' }
  }
  const { error } = await supabase.from('players').delete().eq('id', playerId)
  if (error) return { error: 'Failed to delete player' }
  return {}
}
```

`deletePlayer`'s payment check re-validates server-side even though the UI will already hide the Delete button once payments exist — never trust the client to enforce this, since it's the one irreversible path in this feature. Error strings are returned as plain English (not i18n error codes), matching the established convention that admin-facing text stays English-only.

`getAllPlayers()` (existing, in the same file) already joins `payments(paid_at, status, installment_label)` per player — extend its per-player mapping to also compute `hasPayments: (p.payments ?? []).length > 0`, so the UI knows whether to offer Delete or Cancel without a separate round-trip.

## Admin UI

`src/components/admin/players-table.tsx`:

- `PlayerWithParent` type gains `hasPayments: boolean`.
- Any row with `status === 'cancelled'` renders with the same muted/greyed treatment already used elsewhere in the codebase for cancelled items (`opacity-60`), and its Actions cell shows only a "Restore" button (calls `restorePlayer`, then refreshes).
- Every other row's Actions cell gains, below the existing "Save Changes" / "Mark Cash Paid" buttons:
  - If `hasPayments`: a "Cancel" button (calls `cancelPlayer`, then refreshes) — no confirmation prompt, since it's reversible via Restore.
  - If `!hasPayments`: a "Delete" button instead, gated behind `window.confirm('Permanently delete this player? This cannot be undone.')` (matching the existing confirm pattern used for rejecting Get Involved submissions in `pending-submissions.tsx`), calling `deletePlayer` and surfacing its `error` (if any) the same way other actions in this component already do.

## Downstream consistency

- `src/app/actions/roster.ts`: the coach roster query changes from `.neq('status', 'inactive')` to `.neq('status', 'inactive').neq('status', 'cancelled')`, so cancelled players never appear to coaches.
- `src/lib/i18n/en.ts` and `es.ts`: `t.profile.playerInfo.statuses` gains `cancelled: 'Cancelled'` / `cancelled: 'Cancelado'` (the latter already used verbatim elsewhere in `es.ts`, e.g. `t.league.calendar.cancelled`), so a parent viewing their own cancelled child's status on `/profile` doesn't hit an undefined translation lookup.

## Testing

- TDD for `cancelPlayer`/`restorePlayer`/`deletePlayer` in a new or extended `src/app/actions/__tests__/admin.test.ts`: cancel sets status and clears return_date; restore sets status back to active; delete succeeds when zero payments exist; delete is blocked (with the expected error, no DB delete call made) when at least one payment row exists regardless of that payment's status.
- `getAllPlayers`'s `hasPayments` computation covered alongside its existing `lastPaidAt`/`regFeePaid` test coverage (if any exists — check `admin.test.ts` for current coverage of `getAllPlayers` before assuming a new test file vs. extending one).
- No new component test for `players-table.tsx`, consistent with this codebase's established pattern of not unit-testing admin table components (e.g. `league-fixtures-admin.tsx` has none either).
