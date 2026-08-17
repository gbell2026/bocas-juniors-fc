# Cancel/Delete Player Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin cancel a player (reversible) or, when they have zero payment history, permanently delete them — fixing accidental duplicate registrations without ever risking a player's financial records.

**Architecture:** A new `cancelled` value on the existing `player_status` Postgres enum, three small server actions (`cancelPlayer`, `restorePlayer`, `deletePlayer` — the last server-validates against `payments` before allowing a delete), a small extension to the existing `getAllPlayers()` to compute `hasPayments` per player, and UI additions to the existing admin players table. Downstream, the coach roster query and the parent-facing status label map both need to account for the new status.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role client), Jest, Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-08-17-cancel-delete-player.md`

---

## Chunk 1: Schema, actions, UI, downstream consistency

### Task 1: Migration — add `cancelled` to `player_status`

**Files:**
- Create: `supabase/migrations/018_player_cancelled_status.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 'cancelled' is distinct from 'inactive' (which means "registered, not yet
-- activated" — see roster.ts) — it means an admin has deliberately removed
-- this player from active operation, reversible via restorePlayer().
alter type player_status add value 'cancelled';
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/018_player_cancelled_status.sql
git commit -m "feat: add cancelled status to player_status enum"
```

(Applying this migration to production is Task 9, at the end of this plan, gated on explicit confirmation — same pattern as every other schema change this session.)

---

### Task 2: Update Supabase types for `cancelled`

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add `cancelled` to the `player_status` enum type and Constants array**

Find (in the `Enums` block, ~line 649):
```ts
      player_status: "active" | "inactive" | "injured" | "away"
```
Replace with:
```ts
      player_status: "active" | "inactive" | "injured" | "away" | "cancelled"
```

Find (in the `Constants` block, ~line 795):
```ts
      player_status: ["active", "inactive", "injured", "away"],
```
Replace with:
```ts
      player_status: ["active", "inactive", "injured", "away", "cancelled"],
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (same pre-existing 3 gallery test errors as every other task this session)

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add cancelled to player_status type"
```

---

### Task 3: `cancelPlayer`, `restorePlayer`, `deletePlayer` actions (TDD)

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/app/actions/__tests__/admin.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/app/actions/__tests__/admin.test.ts`. First, extend the top import line to include the three new functions:
```ts
import { createCoachAccount, getCoachAccounts, deleteCoachAccount, updatePlayerAgeGroups, cancelPlayer, restorePlayer, deletePlayer } from '../admin'
```

Then add these new `describe` blocks (anywhere after the existing ones, e.g. at the end of the file):

```ts
describe('cancelPlayer', () => {
  it('sets status to cancelled and clears return_date', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await cancelPlayer('player-1')
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'cancelled', return_date: null })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'player-1')
  })
})

describe('restorePlayer', () => {
  it('sets status back to active', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    await restorePlayer('player-1')
    expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'active' })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'player-1')
  })
})

describe('deletePlayer', () => {
  it('deletes the player when they have no payment history', async () => {
    mockSupabase.select.mockReturnValueOnce(mockSupabase) // payments .select('id') -> chainable
    mockSupabase.eq
      .mockResolvedValueOnce({ data: [], error: null }) // payments .eq('player_id', ...).limit(1) -> TERMINAL, no payments
      .mockResolvedValueOnce({ error: null }) // players .delete().eq('id', ...) -> TERMINAL

    const result = await deletePlayer('player-1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
  })

  it('refuses to delete a player with any payment history, and does not call delete', async () => {
    mockSupabase.select.mockReturnValueOnce(mockSupabase) // payments .select('id') -> chainable
    mockSupabase.eq.mockResolvedValueOnce({ data: [{ id: 'pay-1' }], error: null }) // payments .eq(...).limit(1) -> TERMINAL, one payment found

    const result = await deletePlayer('player-1')
    expect(result.error).toBe('Cannot delete a player with payment history — cancel instead.')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })
})
```

`deletePlayer`'s payments lookup uses `.limit(1)`, which the current `mockSupabase` object doesn't have a mock for yet — add it:
```ts
const mockSupabase = {
  auth: { admin: { createUser: jest.fn(), deleteUser: jest.fn(), getUserById: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn(),
}
```
Note: `limit` has no default `mockReturnThis()` since it's always the terminal call in `deletePlayer`'s payments check (`.select('id').eq('player_id', playerId).limit(1)`) — but the test code above resolves the value on `eq`, not `limit`, because the real query chain is `select → eq → limit`, and `limit` is what actually gets awaited. Re-read this carefully when writing the implementation in Step 3: **the mock queuing above needs to match the real call chain exactly, including which function is the terminal one** — write the implementation first if it's easier to get the chain right, then align the test's mock queue to match it call-for-call (same rigor as every other Jest mock-queue test in this codebase's recent history — see the `getFixtureCalendar` test in `docs/superpowers/plans/2026-08-16-fixtures-calendar.md` for what happens when this isn't done carefully).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/admin.test.ts`
Expected: FAIL — `cancelPlayer`/`restorePlayer`/`deletePlayer` are not exported from `../admin`

- [ ] **Step 3: Implement the three actions**

Add to `src/app/actions/admin.ts`, near the other player-related functions (`updatePlayerStatus`, `updatePlayerPaymentPlan`, `updatePlayerAgeGroups`):

```ts
// Reversible — sets the player aside without touching their payment
// history. Does not preserve a prior injured/away status or return_date;
// restorePlayer always lands them back on 'active'. This is a deliberate
// simplification (see spec) — if a restored player still needs
// injured/away re-applied, admin does that afterward via the status
// dropdown.
export async function cancelPlayer(playerId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ status: 'cancelled', return_date: null }).eq('id', playerId)
}

export async function restorePlayer(playerId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
}

// Permanently removes a player row — only when they have zero payment
// records (of ANY status: pending, succeeded, or failed). payments.player_id
// is `on delete cascade`, so deleting a player with payment history would
// silently destroy their financial records; this check exists specifically
// to make that impossible, and is re-validated here even though the UI
// already hides the Delete button once payments exist — never trust the
// client alone for the one irreversible path in this feature.
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/admin.test.ts`
Expected: PASS. If the `deletePlayer` tests fail specifically on mock-chain shape, re-check the exact sequence of `.select()`/`.eq()`/`.limit()` calls the real implementation makes and adjust the test's mock queuing to match — do not simplify the implementation to make a wrong test pass.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/admin.ts src/app/actions/__tests__/admin.test.ts
git commit -m "feat: add cancelPlayer, restorePlayer, deletePlayer actions"
```

---

### Task 4: `getAllPlayers()` — add `hasPayments` (TDD)

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/app/actions/__tests__/admin.test.ts`

`getAllPlayers()` currently has no test coverage at all — this task adds its first tests, covering both the pre-existing `lastPaidAt`/`regFeePaid` computation and the new `hasPayments` field, rather than testing `hasPayments` in isolation against untested surrounding logic.

- [ ] **Step 1: Write the failing tests**

Add `getAllPlayers` to the existing import line in `src/app/actions/__tests__/admin.test.ts`:
```ts
import { createCoachAccount, getCoachAccounts, deleteCoachAccount, updatePlayerAgeGroups, cancelPlayer, restorePlayer, deletePlayer, getAllPlayers } from '../admin'
```

Add a new `describe` block. `getAllPlayers` calls `.from('players').select(...).order('name')` — `order` isn't in the current `mockSupabase`, add it:
```ts
const mockSupabase = {
  auth: { admin: { createUser: jest.fn(), deleteUser: jest.fn(), getUserById: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn(),
  order: jest.fn(),
}
```

```ts
describe('getAllPlayers', () => {
  it('sets hasPayments true when the player has any payment row, regardless of status', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{
        id: 'player-1', name: 'Alice', payment_plan: 'full', age_groups: ['U10'],
        payments: [{ paid_at: null, status: 'pending', installment_label: 'registration' }],
      }],
      error: null,
    })
    const result = await getAllPlayers()
    expect(result[0].hasPayments).toBe(true)
  })

  it('sets hasPayments false when the player has no payment rows', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'player-2', name: 'Bob', payment_plan: 'full', age_groups: [], payments: [] }],
      error: null,
    })
    const result = await getAllPlayers()
    expect(result[0].hasPayments).toBe(false)
  })

  it('still computes lastPaidAt from only succeeded payments', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{
        id: 'player-3', name: 'Cara', payment_plan: 'full', age_groups: [],
        payments: [
          { paid_at: '2026-08-01', status: 'succeeded', installment_label: 'registration' },
          { paid_at: '2026-09-01', status: 'pending', installment_label: 'full' },
        ],
      }],
      error: null,
    })
    const result = await getAllPlayers()
    expect(result[0].lastPaidAt).toBe('2026-08-01')
    expect(result[0].hasPayments).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/admin.test.ts`
Expected: FAIL — `hasPayments` is `undefined` in the result, not `true`/`false`

- [ ] **Step 3: Add `hasPayments` to `getAllPlayers`'s mapping**

In `src/app/actions/admin.ts`, find the existing `getAllPlayers` function and change its `return` mapping from:
```ts
    return {
      ...p,
      lastPaidAt: succeeded.map((pay: any) => pay.paid_at).sort().at(-1) ?? null,
      regFeePaid: isRegistrationFeePaid(p.payment_plan, paidLabels),
      ageGroups: p.age_groups,
    }
```
to:
```ts
    return {
      ...p,
      lastPaidAt: succeeded.map((pay: any) => pay.paid_at).sort().at(-1) ?? null,
      regFeePaid: isRegistrationFeePaid(p.payment_plan, paidLabels),
      ageGroups: p.age_groups,
      hasPayments: ((p.payments as any[]) ?? []).length > 0,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/admin.test.ts`
Expected: PASS

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/admin.ts src/app/actions/__tests__/admin.test.ts
git commit -m "feat: compute hasPayments in getAllPlayers"
```

---

### Task 5: Admin UI — Cancel/Restore/Delete buttons

**Files:**
- Modify: `src/components/admin/players-table.tsx`

- [ ] **Step 1: Extend the `PlayerWithParent` type**

Find:
```ts
type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
  regFeePaid: boolean
}
```
Replace with:
```ts
type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
  regFeePaid: boolean
  hasPayments: boolean
}
```

- [ ] **Step 2: Import the three new actions**

Find:
```ts
import { updatePlayerStatus, updatePlayerPaymentPlan, updatePlayerAgeGroups } from '@/app/actions/admin'
```
Replace with:
```ts
import { updatePlayerStatus, updatePlayerPaymentPlan, updatePlayerAgeGroups, cancelPlayer, restorePlayer, deletePlayer } from '@/app/actions/admin'
```

- [ ] **Step 3: Add the three handlers**

Add these alongside the existing `handleStatusSave`/`handleMarkCashPaid`:
```ts
  async function handleCancel(p: PlayerWithParent) {
    setUpdating(p.id)
    await cancelPlayer(p.id)
    setUpdating(null)
    window.location.reload()
  }

  async function handleRestore(p: PlayerWithParent) {
    setUpdating(p.id)
    await restorePlayer(p.id)
    setUpdating(null)
    window.location.reload()
  }

  async function handleDelete(p: PlayerWithParent) {
    if (!window.confirm('Permanently delete this player? This cannot be undone.')) return
    setUpdating(p.id)
    const result = await deletePlayer(p.id)
    setUpdating(null)
    if (result.error) { window.alert(result.error); return }
    window.location.reload()
  }
```

- [ ] **Step 4: Grey out cancelled rows**

Find the row's opening tag:
```tsx
              <tr key={p.id} className="border-t align-top">
```
Replace with:
```tsx
              <tr key={p.id} className={`border-t align-top ${p.status === 'cancelled' ? 'opacity-60' : ''}`}>
```

- [ ] **Step 5: Swap the Actions cell content based on status/hasPayments**

Find the Actions `<td>`:
```tsx
                <td className="p-3 space-y-1">
                  <button
                    onClick={() => handleStatusSave(p)}
                    disabled={updating === p.id}
                    className="btn-primary text-xs block w-full"
                  >Save Changes</button>
                  <button
                    onClick={() => handleMarkCashPaid(p)}
                    disabled={updating === p.id}
                    className="btn-secondary text-xs block w-full"
                  >Mark Cash Paid</button>
                </td>
```
Replace with:
```tsx
                <td className="p-3 space-y-1">
                  {p.status === 'cancelled' ? (
                    <button
                      onClick={() => handleRestore(p)}
                      disabled={updating === p.id}
                      className="btn-primary text-xs block w-full"
                    >Restore</button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStatusSave(p)}
                        disabled={updating === p.id}
                        className="btn-primary text-xs block w-full"
                      >Save Changes</button>
                      <button
                        onClick={() => handleMarkCashPaid(p)}
                        disabled={updating === p.id}
                        className="btn-secondary text-xs block w-full"
                      >Mark Cash Paid</button>
                      {p.hasPayments ? (
                        <button
                          onClick={() => handleCancel(p)}
                          disabled={updating === p.id}
                          className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition disabled:opacity-50 w-full"
                        >Cancel</button>
                      ) : (
                        <button
                          onClick={() => handleDelete(p)}
                          disabled={updating === p.id}
                          className="text-xs px-3 py-1.5 border border-red-600 text-red-600 rounded font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition disabled:opacity-50 w-full"
                        >Delete</button>
                      )}
                    </>
                  )}
                </td>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 7: Manual/build check**

Run: `npx next build` — confirm no errors. If a real browser isn't available in this environment, that's the fallback verification (consistent with earlier sessions' plans).

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/players-table.tsx
git commit -m "feat: add cancel/restore/delete controls to the admin players table"
```

(No new component test — matches this component's established no-test precedent.)

---

### Task 6: Exclude cancelled players from the coach roster (TDD)

**Files:**
- Modify: `src/app/actions/roster.ts`
- Modify: `src/app/actions/__tests__/roster.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/app/actions/__tests__/roster.test.ts`, in the existing `describe('getRosterForCoach', ...)` block:
```ts
  it('excludes cancelled players via the query itself', async () => {
    mockSupabase.order.mockResolvedValueOnce({ data: [], error: null })
    await getRosterForCoach()
    expect(mockSupabase.neq).toHaveBeenCalledWith('status', 'cancelled')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/actions/__tests__/roster.test.ts`
Expected: FAIL — `mockSupabase.neq` was never called with `('status', 'cancelled')`

- [ ] **Step 3: Update the query and its comment**

In `src/app/actions/roster.ts`, the current comment above `getRosterForCoach` is inaccurate — `'inactive'` means "registered, not yet activated" (see `players` table's default status and `adminMarkCashPaid`/`confirmPayment`, which flip a player to `'active'` on payment confirmation), not "left the club." Fix the comment while updating the query:

Find:
```ts
// Excludes 'inactive' players (left the club) — 'injured'/'away' still
// show, since they're still rostered, just not currently playing.
export async function getRosterForCoach(): Promise<RosterPlayer[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('players').select('*').neq('status', 'inactive').order('name')
```
Replace with:
```ts
// Excludes 'inactive' (registered but not yet activated — see the
// players table's default status) and 'cancelled' (admin-removed) players.
// 'injured'/'away' still show, since they're still rostered, just not
// currently playing.
export async function getRosterForCoach(): Promise<RosterPlayer[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('players').select('*').neq('status', 'inactive').neq('status', 'cancelled').order('name')
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/roster.test.ts`
Expected: PASS (existing tests still pass, new test passes)

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/roster.ts src/app/actions/__tests__/roster.test.ts
git commit -m "feat: exclude cancelled players from the coach roster"
```

---

### Task 7: i18n — `cancelled` player status label

**Files:**
- Modify: `src/lib/i18n/en.ts`
- Modify: `src/lib/i18n/es.ts`

- [ ] **Step 1: Add the English key**

Find (in `t.profile.playerInfo.statuses`):
```ts
      statuses: { active: 'Active', inactive: 'Inactive', injured: 'Injured', away: 'Away' },
```
Replace with:
```ts
      statuses: { active: 'Active', inactive: 'Inactive', injured: 'Injured', away: 'Away', cancelled: 'Cancelled' },
```

- [ ] **Step 2: Add the Spanish key**

Find the equivalent block in `es.ts` and add `cancelled: 'Cancelado'` (matching the exact word already used elsewhere in this file, e.g. `t.league.calendar.cancelled`).

- [ ] **Step 3: Typecheck (verifies `es` still satisfies `typeof en`)**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n/en.ts src/lib/i18n/es.ts
git commit -m "feat: add cancelled player status translation"
```

---

### Task 8: Full verification

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated gallery test errors

- [ ] **Step 2: Lint the changed files**

Run: `npx eslint src/app/actions/admin.ts src/app/actions/__tests__/admin.test.ts src/app/actions/roster.ts src/app/actions/__tests__/roster.test.ts src/components/admin/players-table.tsx src/lib/i18n/en.ts src/lib/i18n/es.ts src/lib/supabase/types.ts`
Expected: no output (clean) — if any pre-existing lint issue shows up in a file this plan touches, cross-check it existed before this plan (same approach used in prior plans this session) rather than treating it as new

- [ ] **Step 3: Full test suite**

Run: `npx jest`
Expected: all suites pass

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: "Compiled successfully"

---

### Task 9: Apply migration to production

**STOP — this step changes the live database schema. Confirm with the user before running it.**

- [ ] **Step 1: Apply the migration**

Run: `supabase db push`
Expected: prompts to confirm pushing `018_player_cancelled_status.sql`, then "Finished supabase db push."

- [ ] **Step 2: Manual check**

Visit `/admin` (or run `npm run dev` + curl fallback if no browser is available), confirm the Cancel/Restore/Delete buttons appear as expected for players with and without payment history.

- [ ] **Step 3: Confirm before pushing to origin**

Per this session's established pattern, do not push to `origin/main` without explicit user confirmation, even though all local commits are already made per-task above.
