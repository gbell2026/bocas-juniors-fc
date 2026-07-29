# Registration Payment Plans Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let parents choose "pay in full ($30)" or "monthly ($30 Aug, $60/mo Sep–Nov, $210 total)" at registration, require a terms-of-commitment checkbox, and show paid/outstanding status on both the parent's Profile page and the admin Players table.

**Architecture:** A new pure module (`src/lib/payment-schedule.ts`) is the single source of truth for the installment schedule and due-amount logic. Everything else — the registration action, the payment-request actions, the Profile page panel, and the admin table — calls into that one module rather than reimplementing the schedule. Two new Postgres enums and two new columns carry the plan/installment data; a migration also corrects the long-stale `membership_fee_cents` setting.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role actions), Jest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-29-registration-payment-plans.md`

---

## Chunk 1: Data layer — schema, schedule logic, payment/registration actions

### Task 1: Migration — new enums, columns, backfill, fee correction

**Files:**
- Create: `supabase/migrations/005_registration_payment_plans.sql`

- [ ] **Step 1: Write the migration**

```sql
-- New enums for payment plan choice and per-payment installment tagging.
create type payment_plan_type as enum ('full', 'monthly');
create type installment_label_type as enum ('full', 'august', 'september', 'october', 'november');

-- Existing players default to 'full' — no behavior change for anyone registered before this.
alter table players add column payment_plan payment_plan_type not null default 'full';

-- Nullable: historical payments predate this feature.
alter table payments add column installment_label installment_label_type;

-- Backfill: every payment that already succeeded predates installment tracking and
-- represents the old flat fee — tag it 'full' so it doesn't look unaccounted-for.
update payments set installment_label = 'full' where status = 'succeeded';

-- The seeded membership fee ($25, from 002_seed_settings.sql) is stale — the real
-- current fee is $30. That seed file already ran in production, so this corrects
-- the live row directly rather than editing the old seed (same reasoning as the
-- payment-handle migration in the Tangerine Toucans rebrand).
update settings set value = '3000', updated_at = now() where key = 'membership_fee_cents';
```

- [ ] **Step 2: Apply the migration**

This project applies migrations manually (see the comment in `002_seed_settings.sql` and the precedent in the rebrand's Cloudinary/payment-handle work) — either via the Supabase CLI (`supabase db push` if linked) or by pasting the SQL into Supabase Studio's SQL editor. Confirm with the user which is available in this environment before running it against the live database — this touches production schema and data.

- [ ] **Step 3: Verify**

After applying, confirm in Supabase Studio (or via CLI) that:
- `players.payment_plan` exists, defaults to `'full'`
- `payments.installment_label` exists, nullable
- Every row in `payments` with `status = 'succeeded'` now has `installment_label = 'full'`
- `settings` row with `key = 'membership_fee_cents'` now has `value = '3000'`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_registration_payment_plans.sql
git commit -m "feat: add payment plan schema (enums, columns, backfill, fee correction)"
```

---

### Task 2: Update generated Supabase types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Add the two new enums to the `Enums` block**

Old (in `public.Enums`):
```typescript
    Enums: {
      media_type: "photo" | "video"
      payment_method_type: "paypal" | "monzo" | "revolut" | "cash"
      payment_status_type: "succeeded" | "pending" | "failed"
      player_status: "active" | "inactive" | "injured" | "away"
      user_role_type: "parent" | "coach" | "admin" | "player"
    }
```
New:
```typescript
    Enums: {
      media_type: "photo" | "video"
      payment_method_type: "paypal" | "monzo" | "revolut" | "cash"
      payment_plan_type: "full" | "monthly"
      payment_status_type: "succeeded" | "pending" | "failed"
      installment_label_type: "full" | "august" | "september" | "october" | "november"
      player_status: "active" | "inactive" | "injured" | "away"
      user_role_type: "parent" | "coach" | "admin" | "player"
    }
```

- [ ] **Step 2: Add `installment_label` to the `payments` table's Row/Insert/Update**

Old:
```typescript
      payments: {
        Row: {
          amount: number
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          player_id: string
          status: Database["public"]["Enums"]["payment_status_type"]
        }
        Insert: {
          amount: number
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          player_id: string
          status?: Database["public"]["Enums"]["payment_status_type"]
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          parent_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          player_id?: string
          status?: Database["public"]["Enums"]["payment_status_type"]
        }
```
New:
```typescript
      payments: {
        Row: {
          amount: number
          currency: string
          id: string
          installment_label: Database["public"]["Enums"]["installment_label_type"] | null
          notes: string | null
          paid_at: string | null
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          player_id: string
          status: Database["public"]["Enums"]["payment_status_type"]
        }
        Insert: {
          amount: number
          currency?: string
          id?: string
          installment_label?: Database["public"]["Enums"]["installment_label_type"] | null
          notes?: string | null
          paid_at?: string | null
          parent_id: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          player_id: string
          status?: Database["public"]["Enums"]["payment_status_type"]
        }
        Update: {
          amount?: number
          currency?: string
          id?: string
          installment_label?: Database["public"]["Enums"]["installment_label_type"] | null
          notes?: string | null
          paid_at?: string | null
          parent_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          player_id?: string
          status?: Database["public"]["Enums"]["payment_status_type"]
        }
```

- [ ] **Step 3: Add `payment_plan` to the `players` table's Row/Insert/Update**

Old:
```typescript
      players: {
        Row: {
          created_at: string
          date_of_birth: string
          id: string
          name: string
          parent_id: string
          position: string
          return_date: string | null
          status: Database["public"]["Enums"]["player_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          id?: string
          name: string
          parent_id: string
          position: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          id?: string
          name?: string
          parent_id?: string
          position?: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
```
New:
```typescript
      players: {
        Row: {
          created_at: string
          date_of_birth: string
          id: string
          name: string
          parent_id: string
          payment_plan: Database["public"]["Enums"]["payment_plan_type"]
          position: string
          return_date: string | null
          status: Database["public"]["Enums"]["player_status"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date_of_birth: string
          id?: string
          name: string
          parent_id: string
          payment_plan?: Database["public"]["Enums"]["payment_plan_type"]
          position: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date_of_birth?: string
          id?: string
          name?: string
          parent_id?: string
          payment_plan?: Database["public"]["Enums"]["payment_plan_type"]
          position?: string
          return_date?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          user_id?: string | null
        }
```

- [ ] **Step 4: Add convenience type aliases**

Old (near the bottom of the file):
```typescript
export type PlayerStatus = Database['public']['Enums']['player_status']
export type PaymentMethod = Database['public']['Enums']['payment_method_type']
export type PaymentStatus = Database['public']['Enums']['payment_status_type']
```
New:
```typescript
export type PlayerStatus = Database['public']['Enums']['player_status']
export type PaymentMethod = Database['public']['Enums']['payment_method_type']
export type PaymentStatus = Database['public']['Enums']['payment_status_type']
export type PaymentPlan = Database['public']['Enums']['payment_plan_type']
export type InstallmentLabel = Database['public']['Enums']['installment_label_type']
```

- [ ] **Step 5: Verify the file is valid TypeScript**

Run: `npx tsc --noEmit`
Expected: no new errors (existing `any`-casts elsewhere in the codebase are unaffected by this change).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add payment_plan and installment_label to generated Supabase types"
```

---

### Task 3: Payment schedule module (TDD)

**Files:**
- Create: `src/lib/payment-schedule.ts`
- Test: `src/lib/__tests__/payment-schedule.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import { getNextDue, isRegistrationFeePaid, getPlanTotalCents } from '../payment-schedule'

describe('getNextDue', () => {
  it('returns the full-plan installment when nothing is paid', () => {
    expect(getNextDue('full', [])).toEqual({ label: 'full', amountCents: 3000, isFirstInstallment: true })
  })

  it('returns null for the full plan once it is paid', () => {
    expect(getNextDue('full', ['full'])).toBeNull()
  })

  it('returns August as the first monthly installment when nothing is paid', () => {
    expect(getNextDue('monthly', [])).toEqual({ label: 'august', amountCents: 3000, isFirstInstallment: true })
  })

  it('returns September once August is paid', () => {
    expect(getNextDue('monthly', ['august'])).toEqual({ label: 'september', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns October once August and September are paid', () => {
    expect(getNextDue('monthly', ['august', 'september'])).toEqual({ label: 'october', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns November once August, September, and October are paid', () => {
    expect(getNextDue('monthly', ['august', 'september', 'october'])).toEqual({ label: 'november', amountCents: 6000, isFirstInstallment: false })
  })

  it('returns null once all four monthly installments are paid', () => {
    expect(getNextDue('monthly', ['august', 'september', 'october', 'november'])).toBeNull()
  })

  it('ignores paid labels not relevant to the current plan', () => {
    // e.g. a player switched plans after some history — only same-plan labels count
    expect(getNextDue('monthly', ['full'])).toEqual({ label: 'august', amountCents: 3000, isFirstInstallment: true })
  })
})

describe('isRegistrationFeePaid', () => {
  it('is false for a fresh full-plan player', () => {
    expect(isRegistrationFeePaid('full', [])).toBe(false)
  })

  it('is true once the full plan is paid', () => {
    expect(isRegistrationFeePaid('full', ['full'])).toBe(true)
  })

  it('is false for a fresh monthly-plan player', () => {
    expect(isRegistrationFeePaid('monthly', [])).toBe(false)
  })

  it('is true once August (the first monthly installment) is paid, even with nothing else paid', () => {
    expect(isRegistrationFeePaid('monthly', ['august'])).toBe(true)
  })
})

describe('getPlanTotalCents', () => {
  it('full plan totals $30', () => {
    expect(getPlanTotalCents('full')).toBe(3000)
  })

  it('monthly plan totals $210', () => {
    expect(getPlanTotalCents('monthly')).toBe(21000)
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest payment-schedule`
Expected: `FAIL` — `Cannot find module '../payment-schedule'` (the module doesn't exist yet).

- [ ] **Step 3: Implement the module**

```typescript
import type { PaymentPlan, InstallmentLabel } from './supabase/types'

export type Installment = { label: InstallmentLabel; amountCents: number }

const FULL_PLAN: Installment[] = [
  { label: 'full', amountCents: 3000 },
]

const MONTHLY_PLAN: Installment[] = [
  { label: 'august', amountCents: 3000 },
  { label: 'september', amountCents: 6000 },
  { label: 'october', amountCents: 6000 },
  { label: 'november', amountCents: 6000 },
]

function getSchedule(plan: PaymentPlan): Installment[] {
  return plan === 'full' ? FULL_PLAN : MONTHLY_PLAN
}

/**
 * Given a plan and the installment labels that already have a *succeeded* payment,
 * returns the next installment due, or null if every installment in the plan is paid.
 */
export function getNextDue(
  plan: PaymentPlan,
  paidLabels: InstallmentLabel[]
): (Installment & { isFirstInstallment: boolean }) | null {
  const schedule = getSchedule(plan)
  const paidSet = new Set(paidLabels)
  const index = schedule.findIndex(inst => !paidSet.has(inst.label))
  if (index === -1) return null
  return { ...schedule[index], isFirstInstallment: index === 0 }
}

/**
 * "Registration fee paid" means the *first* installment in the plan's sequence
 * has a succeeded payment — regardless of whether later monthly installments
 * are still outstanding.
 */
export function isRegistrationFeePaid(plan: PaymentPlan, paidLabels: InstallmentLabel[]): boolean {
  const firstLabel = getSchedule(plan)[0].label
  return paidLabels.includes(firstLabel)
}

export function getPlanTotalCents(plan: PaymentPlan): number {
  return getSchedule(plan).reduce((sum, inst) => sum + inst.amountCents, 0)
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest payment-schedule`
Expected: `PASS`, all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payment-schedule.ts src/lib/__tests__/payment-schedule.test.ts
git commit -m "feat: add payment schedule module with TDD coverage"
```

---

### Task 4: Rewrite payment actions to use the schedule (TDD)

**Files:**
- Modify: `src/app/actions/payment.ts`
- Test: `src/app/actions/__tests__/payment.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the full content of `src/app/actions/__tests__/payment.test.ts`:

```typescript
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { requestPayment, confirmPayment, denyPayment, getAmountDue } from '../payment'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('getAmountDue', () => {
  it('returns the full-plan amount for a full-plan player with no succeeded payments', async () => {
    mockSupabase.single.mockResolvedValue({ data: { payment_plan: 'full' }, error: null })
    mockSupabase.eq.mockReturnValue({ ...mockSupabase, then: undefined }) // chain continues to a final await
    // players.select().eq().single() -> { payment_plan: 'full' }
    // payments.select().eq().eq() resolves to an array (no succeeded payments yet)
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase) // players .eq('id', ...)
      .mockImplementationOnce(() => Promise.resolve({ data: [], error: null })) // payments .eq('status', 'succeeded')
    const result = await getAmountDue('player-1')
    expect(result).toEqual({ label: 'full', amountCents: 3000, isFirstInstallment: true })
  })
})

describe('requestPayment', () => {
  it('inserts a pending payment tagged with the currently-due installment', async () => {
    mockSupabase.single.mockResolvedValue({ data: { payment_plan: 'full' }, error: null })
    ;(mockSupabase.eq as jest.Mock)
      .mockImplementationOnce(() => mockSupabase)
      .mockImplementationOnce(() => Promise.resolve({ data: [], error: null }))
    mockSupabase.insert.mockResolvedValue({ error: null })

    const result = await requestPayment({
      playerId: 'p1', parentId: 'pa1', method: 'paypal',
      parentName: 'Jane', playerName: 'Junior',
    })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 3000, installment_label: 'full' })
    )
  })
})

it('confirmPayment sets status to succeeded and activates player', async () => {
  mockSupabase.single.mockResolvedValue({ data: { player_id: 'player-1' }, error: null })
  await confirmPayment('pay-1')
  expect(mockSupabase.from).toHaveBeenCalledWith('players')
})

it('denyPayment sets status to failed on the correct payment row', async () => {
  await denyPayment('pay-1')
  expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'failed' })
  expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'pay-1')
})
```

Note: the mock chain here is intentionally a bit manual (`mockImplementationOnce` twice) because `getAmountDue` makes two separate Supabase calls (one for the player's plan, one for their succeeded payments) rather than one. If this proves awkward once you're actually running it, it's fine to simplify the mock setup — the important behavioral assertions are the two `expect` calls, not the exact mock plumbing.

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest payment.test`
Expected: `FAIL` — `getAmountDue` doesn't exist yet, and the old `requestPayment`/`adminMarkCashPaid` still read a flat `membership_fee_cents`.

- [ ] **Step 3: Implement**

Replace the full content of `src/app/actions/payment.ts`:

```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentMethod, PaymentPlan, InstallmentLabel } from '@/lib/supabase/types'
import { getNextDue } from '@/lib/payment-schedule'

export type RequestPaymentResult = { error?: string }

/**
 * Computes what a player currently owes, based on their stored payment plan
 * and which installments already have a succeeded payment. Returns null if
 * every installment in their plan is paid. This is the single source of
 * truth for "amount due" — callers must not accept a client-supplied amount.
 */
export async function getAmountDue(playerId: string) {
  const supabase = createSupabaseServiceClient()

  const { data: player } = await supabase
    .from('players').select('payment_plan').eq('id', playerId).single()
  const plan = (player?.payment_plan ?? 'full') as PaymentPlan

  const { data: succeededPayments } = await supabase
    .from('payments').select('installment_label')
    .eq('player_id', playerId).eq('status', 'succeeded')

  const paidLabels = (succeededPayments ?? [])
    .map(p => p.installment_label)
    .filter((label): label is InstallmentLabel => label !== null)

  return getNextDue(plan, paidLabels)
}

// Parent-initiated: create a pending payment record for any method
export async function requestPayment({
  playerId, parentId, method, parentName, playerName,
}: {
  playerId: string; parentId: string; method: PaymentMethod
  parentName: string; playerName: string
}): Promise<RequestPaymentResult> {
  const supabase = createSupabaseServiceClient()

  const due = await getAmountDue(playerId)
  if (!due) return { error: 'No payment is currently due for this player' }

  const { error } = await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: method,
    amount: due.amountCents,
    installment_label: due.label,
    currency: 'usd',
    status: 'pending',
    notes: `${method} payment requested by ${parentName} for ${playerName}`,
  })

  if (error) return { error: 'Failed to create payment request' }

  // MVP: log to console. Phase 2: send email via Resend.
  console.log(`[ADMIN NOTIFY] ${method} payment requested: ${parentName} for ${playerName}`)
  return {}
}

// Admin: confirm a pending payment (any method)
export async function confirmPayment(paymentId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('payments')
    .update({ status: 'succeeded', paid_at: new Date().toISOString() })
    .eq('id', paymentId)
  const { data: payment } = await supabase
    .from('payments').select('player_id').eq('id', paymentId).single()
  if (payment) {
    await supabase.from('players').update({ status: 'active' }).eq('id', payment.player_id)
  }
  return {}
}

// Admin: deny a pending payment (any method)
export async function denyPayment(paymentId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('payments')
    .update({ status: 'failed' })
    .eq('id', paymentId)
  return {}
}

// Admin: directly mark a player as paid with cash (no prior pending record needed)
export async function adminMarkCashPaid({
  playerId, parentId, adminNotes,
}: { playerId: string; parentId: string; adminNotes?: string }) {
  const supabase = createSupabaseServiceClient()

  const due = await getAmountDue(playerId)
  if (!due) return { error: 'No payment is currently due for this player' }

  await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: 'cash',
    amount: due.amountCents,
    installment_label: due.label,
    currency: 'usd',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    notes: adminNotes ?? 'Cash paid directly — marked by admin',
  })
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
  return {}
}

// Server action called by PaymentOptionsPanel to fetch settings for display
// (payment provider details only — the fee amount is per-player, see getAmountDue)
export async function getPaymentSettings() {
  const supabase = createSupabaseServiceClient()
  const { data: settings } = await supabase.from('settings').select('*')
  const map = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  return {
    paypalMeUrl: map.paypal_me_url ?? '',
    monzoDetails: map.monzo_details ?? '',
    revolutDetails: map.revolut_details ?? '',
  }
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest payment.test`
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/payment.ts src/app/actions/__tests__/payment.test.ts
git commit -m "feat: derive payment amounts from the shared schedule instead of a flat fee"
```

---

### Task 5: Registration action — plan choice and terms (TDD)

**Files:**
- Modify: `src/app/actions/register.ts`
- Test: `src/app/actions/__tests__/register.test.ts`

- [ ] **Step 1: Write the failing test (add to the existing file)**

Add this test to `src/app/actions/__tests__/register.test.ts`, alongside the existing two:

```typescript
it('returns an error if agreedToTerms is false, without creating anything', async () => {
  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
    paymentPlan: 'full', agreedToTerms: false,
  })
  expect(result.error).toBe('You must agree to the registration terms.')
  expect(mockSupabase.auth.admin.createUser).not.toHaveBeenCalled()
})
```

Also update the existing two tests' `registerParentAndPlayer(...)` calls to include `paymentPlan: 'full', agreedToTerms: true` in their input objects (TypeScript will otherwise fail to compile once the params become required).

- [ ] **Step 2: Run the tests to confirm the new one fails**

Run: `npx jest register.test`
Expected: `FAIL` on the new test (and likely a TypeScript error on the other two until Step 1's edit is applied to them too) — `registerParentAndPlayer` doesn't yet validate `agreedToTerms` or accept `paymentPlan`.

- [ ] **Step 3: Implement**

Old (`src/app/actions/register.ts`):
```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export type RegisterInput = {
  parentName: string; email: string; phone: string; password: string
  playerName: string; dateOfBirth: string; position: string
}

export type RegisterResult =
  | { playerId: string; parentId: string; userId: string; error?: never }
  | { error: string; playerId?: never; parentId?: never; userId?: never }

export async function registerParentAndPlayer(input: RegisterInput): Promise<RegisterResult> {
  const supabase = createSupabaseServiceClient()

  // 1. Create auth user
```
New:
```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentPlan } from '@/lib/supabase/types'

export type RegisterInput = {
  parentName: string; email: string; phone: string; password: string
  playerName: string; dateOfBirth: string; position: string
  paymentPlan: PaymentPlan; agreedToTerms: boolean
}

export type RegisterResult =
  | { playerId: string; parentId: string; userId: string; error?: never }
  | { error: string; playerId?: never; parentId?: never; userId?: never }

export async function registerParentAndPlayer(input: RegisterInput): Promise<RegisterResult> {
  if (!input.agreedToTerms) {
    return { error: 'You must agree to the registration terms.' }
  }

  const supabase = createSupabaseServiceClient()

  // 1. Create auth user
```

Then in the player-insert block, old:
```typescript
    .insert({
      parent_id: parent.id,
      name: input.playerName,
      date_of_birth: input.dateOfBirth,
      position: input.position,
    })
```
New:
```typescript
    .insert({
      parent_id: parent.id,
      name: input.playerName,
      date_of_birth: input.dateOfBirth,
      position: input.position,
      payment_plan: input.paymentPlan,
    })
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest register.test`
Expected: `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/register.ts src/app/actions/__tests__/register.test.ts
git commit -m "feat: require terms agreement and store payment plan at registration"
```

---

### Task 6: Chunk 1 verification

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

---

## Chunk 2: UI — registration form, payment panel, admin table

### Task 7: Registration form — plan choice and terms checkbox

**Files:**
- Modify: `src/components/register/registration-form.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
'use client'
import { useState } from 'react'
import { registerParentAndPlayer } from '@/app/actions/register'
import type { PaymentPlan } from '@/lib/supabase/types'

type Props = { onSuccess: (playerId: string, parentId: string, parentName: string, playerName: string) => void }

export function RegistrationForm({ onSuccess }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await registerParentAndPlayer({
      parentName: fd.get('parentName') as string,
      email: fd.get('email') as string,
      phone: fd.get('phone') as string,
      password: fd.get('password') as string,
      playerName: fd.get('playerName') as string,
      dateOfBirth: fd.get('dateOfBirth') as string,
      position: fd.get('position') as string,
      paymentPlan: fd.get('paymentPlan') as PaymentPlan,
      agreedToTerms: fd.get('agreedToTerms') === 'on',
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSuccess(result.playerId!, result.parentId!, fd.get('parentName') as string, fd.get('playerName') as string)
  }

  const labelClass = 'block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <fieldset className="space-y-4">
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">Player Details</legend>
        <div>
          <label htmlFor="playerName" className={labelClass}>Player Name</label>
          <input id="playerName" name="playerName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="dateOfBirth" className={labelClass}>Date of Birth</label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="position" className={labelClass}>Position</label>
          <select id="position" name="position" required className="input w-full">
            <option value="">Select…</option>
            {['Goalkeeper', 'Defender', 'Midfielder', 'Forward'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">Parent / Guardian Details</legend>
        <div>
          <label htmlFor="parentName" className={labelClass}>Parent Name</label>
          <input id="parentName" name="parentName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="phone" className={labelClass}>Phone</label>
          <input id="phone" name="phone" type="tel" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className={labelClass}>Password</label>
          <input id="password" name="password" type="password" minLength={8} required className="input w-full" />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">Payment Plan</legend>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="radio" name="paymentPlan" value="full" required className="mt-1" />
          <span>
            <span className="block font-bold">Pay in Full — $30</span>
            <span className="block text-sm text-brand-muted">One payment, due now.</span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="radio" name="paymentPlan" value="monthly" required className="mt-1" />
          <span>
            <span className="block font-bold">Monthly — $210 total</span>
            <span className="block text-sm text-brand-muted">$30 in August, then $60/month September–November.</span>
          </span>
        </label>
      </fieldset>

      <label className="flex items-start gap-2 text-sm cursor-pointer">
        <input type="checkbox" name="agreedToTerms" required className="mt-1" />
        <span>
          I agree to keep my child registered with the Tangerine Toucans through at least the
          first half of the season, regardless of the payment plan I choose.
        </span>
      </label>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Registering…' : 'Register & Pay'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open `/register`, confirm: both plan radios are required (submit is blocked with no selection — browser-native validation), the terms checkbox is required, and submitting with valid data still moves to the payment step as before.

- [ ] **Step 3: Commit**

```bash
git add src/components/register/registration-form.tsx
git commit -m "feat: add payment plan choice and terms checkbox to registration form"
```

---

### Task 8: Payment Options panel — plan-aware amount due and paid status

**Files:**
- Modify: `src/components/payment/payment-options-panel.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { getPaymentSettings, requestPayment, getAmountDue } from '@/app/actions/payment'
import type { PaymentMethod } from '@/lib/supabase/types'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type AmountDue = Awaited<ReturnType<typeof getAmountDue>>
type Props = { playerId: string; parentId: string; parentName: string; playerName: string }
type MethodState = 'idle' | 'awaiting_confirm' | 'loading' | 'sent' | 'error'

export function PaymentOptionsPanel({ playerId, parentId, parentName, playerName }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [due, setDue] = useState<AmountDue | undefined>(undefined) // undefined = loading, null = fully paid
  const [regFeePaid, setRegFeePaid] = useState(false)
  const [monzoCopied, setMonzoCopied] = useState(false)
  const [revolutCopied, setRevolutCopied] = useState(false)
  const [methodState, setMethodState] = useState<Record<PaymentMethod, MethodState>>({
    paypal: 'idle', monzo: 'idle', revolut: 'idle', cash: 'idle',
  })

  useEffect(() => {
    getPaymentSettings().then(setSettings)
    refreshDue()
  }, [])

  async function refreshDue() {
    const result = await getAmountDue(playerId)
    setDue(result)
    setRegFeePaid(result === null || !result.isFirstInstallment)
  }

  if (!settings || due === undefined) return <p className="text-brand-muted py-8 text-center">Loading payment options…</p>

  const regFeeStatus = (
    <p className={`text-sm font-bold ${regFeePaid ? 'text-green-600' : 'text-brand-primary'}`}>
      Registration fee: {regFeePaid ? 'Paid' : 'Outstanding'}
    </p>
  )

  if (due === null) {
    return (
      <div className="max-w-lg mx-auto py-8 px-4 space-y-3 text-center">
        {regFeeStatus}
        <p className="font-heading text-brand-ink text-xl uppercase tracking-wider">
          You&apos;re all paid up for the season!
        </p>
      </div>
    )
  }

  const fee = `$${(due.amountCents / 100).toFixed(2)}`

  async function handleConfirm(method: PaymentMethod) {
    setMethodState(s => ({ ...s, [method]: 'loading' }))
    const result = await requestPayment({ playerId, parentId, method, parentName, playerName })
    setMethodState(s => ({ ...s, [method]: result.error ? 'error' : 'sent' }))
    if (!result.error) refreshDue()
  }

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      {regFeeStatus}
      <h2 className="font-heading text-brand-ink text-2xl uppercase tracking-wider">Pay Membership Fee — {fee}</h2>
      <p className="text-sm text-brand-muted">Choose a payment method below. Once you&apos;ve paid, click the confirmation button so the admin can verify your payment.</p>

      {/* PayPal / Card */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay via PayPal or Credit/Debit Card</h3>
        <p className="text-sm text-brand-muted">Opens PayPal. You can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments.</p>
        {methodState.paypal === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Payment request sent — admin will confirm shortly.</p>
        ) : methodState.paypal === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <a
              href={settings.paypalMeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
              onClick={() => setMethodState(s => ({ ...s, paypal: 'awaiting_confirm' }))}
            >
              Pay {fee} via PayPal / Card ↗
            </a>
            {methodState.paypal === 'awaiting_confirm' && (
              <button
                onClick={() => handleConfirm('paypal')}
                className="btn-secondary text-sm"
              >
                I&apos;ve paid
              </button>
            )}
          </div>
        )}
      </div>

      {/* Monzo */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay via Monzo bank transfer</h3>
        <div className="bg-brand-creamAlt rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-brand-ink/80">
          <span>{settings.monzoDetails}</span>
          <button
            onClick={() => copyToClipboard(settings.monzoDetails, setMonzoCopied)}
            className="text-brand-primary text-xs shrink-0"
          >
            {monzoCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {methodState.monzo === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Transfer confirmed — admin will verify shortly.</p>
        ) : methodState.monzo === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('monzo')}
            disabled={methodState.monzo === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.monzo === 'loading' ? 'Sending…' : "I&apos;ve sent the transfer"}
          </button>
        )}
      </div>

      {/* Revolut */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay via Revolut bank transfer</h3>
        <div className="bg-brand-creamAlt rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-brand-ink/80">
          <span>{settings.revolutDetails}</span>
          <button
            onClick={() => copyToClipboard(settings.revolutDetails, setRevolutCopied)}
            className="text-brand-primary text-xs shrink-0"
          >
            {revolutCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {methodState.revolut === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Transfer confirmed — admin will verify shortly.</p>
        ) : methodState.revolut === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('revolut')}
            disabled={methodState.revolut === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.revolut === 'loading' ? 'Sending…' : "I&apos;ve sent the transfer"}
          </button>
        )}
      </div>

      {/* Cash */}
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
        <h3 className="font-bold text-brand-ink">Pay by Cash</h3>
        <p className="text-sm text-brand-muted">Bring cash to the next training session. Click below to notify the admin.</p>
        {methodState.cash === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Admin notified — bring {fee} cash to training.</p>
        ) : methodState.cash === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('cash')}
            disabled={methodState.cash === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.cash === 'loading' ? 'Sending…' : "I’ll pay cash at training"}
          </button>
        )}
      </div>
    </div>
  )
}
```

Note: `regFeePaid` is derived entirely from `getAmountDue`'s result (`due === null` → everything's paid, so obviously the reg fee is too; otherwise `!due.isFirstInstallment` → some earlier installment, i.e. the reg fee, must already be paid) — no second server round-trip needed. Also note `handleConfirm` now calls `refreshDue()` after a successful request, since the amount due may change (though for a `pending` request it won't actually change until the admin confirms — this just keeps the panel consistent if you re-open it).

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, log in as a parent, view `/profile`. Confirm the fee shown matches the player's plan and no succeeded payments, and the registration-fee status line shows "Outstanding".

- [ ] **Step 3: Commit**

```bash
git add src/components/payment/payment-options-panel.tsx
git commit -m "feat: make Payment Options panel plan-aware with paid-status display"
```

---

### Task 9: Admin — payment plan editing and paid-status column

**Files:**
- Modify: `src/app/actions/admin.ts`
- Modify: `src/components/admin/players-table.tsx`

- [ ] **Step 1: Extend `getAllPlayers` in `src/app/actions/admin.ts`**

Old:
```typescript
export async function getAllPlayers() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('players')
    .select('*, parents(name, email), payments(paid_at, status)')
    .order('name')
  // Attach last succeeded payment date to each player
  return (data ?? []).map(p => ({
    ...p,
    lastPaidAt: (p.payments as any[])
      ?.filter((pay: any) => pay.status === 'succeeded')
      .map((pay: any) => pay.paid_at)
      .sort()
      .at(-1) ?? null,
  }))
}
```
New:
```typescript
export async function getAllPlayers() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('players')
    .select('*, parents(name, email), payments(paid_at, status, installment_label)')
    .order('name')
  // Attach last succeeded payment date and registration-fee-paid status to each player
  return (data ?? []).map(p => {
    const succeeded = (p.payments as any[])?.filter((pay: any) => pay.status === 'succeeded') ?? []
    const paidLabels = succeeded
      .map((pay: any) => pay.installment_label)
      .filter((label: any): label is InstallmentLabel => label !== null)
    return {
      ...p,
      lastPaidAt: succeeded.map((pay: any) => pay.paid_at).sort().at(-1) ?? null,
      regFeePaid: isRegistrationFeePaid(p.payment_plan, paidLabels),
    }
  })
}

export async function updatePlayerPaymentPlan(playerId: string, paymentPlan: PaymentPlan) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ payment_plan: paymentPlan }).eq('id', playerId)
}
```

Add these imports near the top of the file (alongside whatever's already imported there):
```typescript
import type { PaymentPlan, InstallmentLabel } from '@/lib/supabase/types'
import { isRegistrationFeePaid } from '@/lib/payment-schedule'
```

- [ ] **Step 2: Update `src/components/admin/players-table.tsx`**

Old:
```tsx
'use client'
import { useState } from 'react'
import { updatePlayerStatus } from '@/app/actions/admin'
import { adminMarkCashPaid } from '@/app/actions/payment'
import type { Player } from '@/lib/supabase/types'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string }>>({})

  function getEdit(p: Player) {
    return edits[p.id] ?? { status: p.status, returnDate: p.return_date ?? '' }
  }

  async function handleStatusSave(p: PlayerWithParent) {
    const { status, returnDate } = getEdit(p)
    setUpdating(p.id)
    await updatePlayerStatus(p.id, status as import('@/lib/supabase/types').PlayerStatus, returnDate || undefined)
    setUpdating(null)
    window.location.reload()
  }
```
New:
```tsx
'use client'
import { useState } from 'react'
import { updatePlayerStatus, updatePlayerPaymentPlan } from '@/app/actions/admin'
import { adminMarkCashPaid } from '@/app/actions/payment'
import type { Player, PaymentPlan } from '@/lib/supabase/types'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
  regFeePaid: boolean
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string; paymentPlan: PaymentPlan }>>({})

  function getEdit(p: PlayerWithParent) {
    return edits[p.id] ?? { status: p.status, returnDate: p.return_date ?? '', paymentPlan: p.payment_plan }
  }

  async function handleStatusSave(p: PlayerWithParent) {
    const { status, returnDate, paymentPlan } = getEdit(p)
    setUpdating(p.id)
    await updatePlayerStatus(p.id, status as import('@/lib/supabase/types').PlayerStatus, returnDate || undefined)
    await updatePlayerPaymentPlan(p.id, paymentPlan)
    setUpdating(null)
    window.location.reload()
  }
```

Old (table header row):
```tsx
        <thead className="bg-brand-creamAlt">
          <tr>
            {['Player', 'Position', 'DOB', 'Parent', 'Status', 'Return Date', 'Last Paid', 'Actions'].map(h => (
              <th key={h} className="text-left p-3">{h}</th>
            ))}
          </tr>
        </thead>
```
New:
```tsx
        <thead className="bg-brand-creamAlt">
          <tr>
            {['Player', 'Position', 'DOB', 'Parent', 'Plan', 'Reg. Fee', 'Status', 'Return Date', 'Last Paid', 'Actions'].map(h => (
              <th key={h} className="text-left p-3">{h}</th>
            ))}
          </tr>
        </thead>
```

Old (row cells, right after the Parent `<td>`):
```tsx
                <td className="p-3">{p.parents?.name}</td>
                <td className="p-3">
                  <select
                    value={edit.status}
```
New:
```tsx
                <td className="p-3">{p.parents?.name}</td>
                <td className="p-3">
                  <select
                    value={edit.paymentPlan}
                    disabled={updating === p.id}
                    onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, paymentPlan: e.target.value as PaymentPlan } }))}
                    className="border rounded p-1 text-sm"
                  >
                    {['full', 'monthly'].map(plan => (
                      <option key={plan} value={plan}>{plan}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <span className={p.regFeePaid ? 'text-green-600 font-medium' : 'text-brand-primary font-medium'}>
                    {p.regFeePaid ? 'Paid' : 'Outstanding'}
                  </span>
                </td>
                <td className="p-3">
                  <select
                    value={edit.status}
```

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, log in as admin, view `/admin`. Confirm the Players table shows the new "Plan" dropdown and "Reg. Fee" column, and that changing the plan dropdown + clicking "Save Status" persists (reload and re-check).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/admin.ts src/components/admin/players-table.tsx
git commit -m "feat: add payment plan editing and paid-status column to admin Players table"
```

---

### Task 10: Full verification

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Full build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual walkthrough**

In the dev server: register a new player choosing "Monthly", confirm the payment step charges $30 (August), then as admin mark it paid via cash, then reload the parent's `/profile` and confirm it now shows September's $60 due and "Registration fee: Paid". Also check `/admin`'s Players table shows "Paid" for that player and "monthly" as their plan.

- [ ] **Step 5: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final verification pass for registration payment plans"
```
