# Bocas Juniors FC — Coach Roster & Accounts Spec

**Date:** 2026-08-15
**Scope:** A new `coach` login role (the `user_role_type` enum already includes `'coach'`, but nothing in the app uses it yet). Admins can create coach accounts. Both coaches and admins can view a new `/roster` page listing every registered player, grouped by age group, showing name, position, and whether they have anything unpaid — with a "Mark Paid" action reusing the existing cash-payment logic. Admins gain a way to assign one or more age groups to each player (a player can belong to more than one, for players who play up an age group) and a small UI to create/list/revoke coach accounts. Parents' existing `/profile` view (their own children only) is unchanged.

---

## Data Model Changes

**Migration:** `supabase/migrations/015_player_age_groups.sql`

```sql
alter table players add column age_groups text[] not null default '{}';
```

No RLS changes needed — but note this is *not* because RLS blocks direct client access the way `user_roles`' `using (false)` does. `players` actually has real client-facing policies (`parent_select_players`, `parent_update_players` in `001_initial_schema.sql`) letting a parent's own browser session read/update their own player row directly via the anon key, with no column restriction. In practice the app never exercises this — every `players` access in app code goes through `createSupabaseServiceClient()` — but this is a **pre-existing gap**, not one this feature closes: a parent could already self-write `status` or `payment_plan` by calling supabase-js directly instead of going through the UI, and `age_groups` joins that same exposure. Out of scope to fix here (see Out of Scope) — flagged so it isn't mistaken for a solved problem.

**Types update:** After applying the migration, manually update `src/lib/supabase/types.ts` (do not regenerate — hand-written aliases at the bottom would be lost, per existing convention). Add `age_groups: string[]` to the `players` table's `Row`, and `age_groups?: string[]` to `Insert`/`Update`.

**Age group values:** Hardcoded to `'U10' | 'U14'` — matching the two existing League divisions. Defined once as:

```ts
// src/lib/age-groups.ts ← new
export const AGE_GROUPS = ['U10', 'U14'] as const
export type AgeGroup = typeof AGE_GROUPS[number]
```

No relationship to the League feature's `league_divisions` table — these are two independent concepts (League divisions are for inter-club fixtures; a registered player's `age_groups` here is purely for this club-internal roster view). Out of scope: keeping them in sync if the club's age groups ever change — see Out of Scope.

---

## Coach Accounts

### Creating a coach account

**File:** `src/app/actions/admin.ts` — add:

```ts
export async function createCoachAccount(input: { name: string; email: string; password: string }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  })
  if (authError || !authData.user) return { error: 'Failed to create login' }

  const { error: roleError } = await supabase
    .from('user_roles').insert({ user_id: authData.user.id, role: 'coach' })
  if (roleError) {
    await supabase.auth.admin.deleteUser(authData.user.id) // rollback, matches registerParentAndPlayer's pattern
    return { error: 'Failed to assign coach role' }
  }

  return {}
}
```

`input.name` is not stored anywhere yet (there's no `coaches` table — a coach's display name lives on their `staff_members` bio row, which has no link to `auth.users`). It's accepted here only so the create-account form can show a readable label in the same request/response cycle; the coach list (below) displays email, not name. Linking coach accounts to `staff_members` rows is out of scope — see Out of Scope.

### Listing and revoking coach accounts

```ts
export async function getCoachAccounts(): Promise<{ userId: string; email: string }[]> {
  const supabase = createSupabaseServiceClient()
  const { data: roleRows } = await supabase.from('user_roles').select('user_id').eq('role', 'coach')
  const results: { userId: string; email: string }[] = []
  for (const row of roleRows ?? []) {
    const { data } = await supabase.auth.admin.getUserById(row.user_id)
    if (data.user?.email) results.push({ userId: row.user_id, email: data.user.email })
  }
  return results
}

export async function deleteCoachAccount(userId: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error: roleError } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'coach')
  if (roleError) return { error: 'Failed to remove coach role' }
  await supabase.auth.admin.deleteUser(userId) // best-effort; role removal alone already revokes /roster access
  return {}
}
```

### Admin UI

**File:** `src/components/admin/coach-accounts.tsx` ← new

Client component, same shape as `staff-admin.tsx`: a list of existing coach accounts (email + a "Remove" button calling `deleteCoachAccount`) above a small create form (name/email/password inputs, `createCoachAccount` on submit). Placed in the **Players & Payments** tab in `admin-dashboard.tsx`, below `PlayersTable` — coach-account management is closely related to who can see/manage the roster.

**Note:** the password is admin-set and typed directly into a plain text/password input here — there's no invite-email flow (out of scope, see below). The admin is expected to communicate the password to the coach directly (e.g. WhatsApp), the same way club business already happens.

---

## Role Lookup Helper

**File:** `src/app/actions/auth.ts` ← new

A single small server action, callable from client components (`login/page.tsx`, `nav.tsx`), since `user_roles` RLS (`using (false)`) blocks any direct client-side read:

```ts
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function getUserRole(userId: string): Promise<string | null> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId).single()
  return data?.role ?? null
}
```

---

## `/roster` Page

**File:** `src/app/roster/page.tsx` ← new

Server component. Auth + role check happens here directly (server-side, via service client — same reasoning as the `/admin` middleware guard: RLS blocks anything but service role from reading `user_roles`):

```tsx
export default async function RosterPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const role = await getUserRole(user.id)
  if (role !== 'coach' && role !== 'admin') redirect('/')

  const players = await getRosterForCoach()
  return (
    <main className="bg-brand-cream min-h-screen max-w-4xl mx-auto py-8 px-4">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink mb-6">Roster</h1>
      <RosterList players={players} />
    </main>
  )
}
```

Also add `/roster` to `middleware.ts`'s matcher, with the same role-gating logic already used for `/admin` (copy the existing service-role lookup block, but check for `'coach'` OR `'admin'` instead of just `'admin'`):

```ts
if (user && request.nextUrl.pathname.startsWith('/roster')) {
  // ...same service-role client construction as the /admin block...
  if (roleRow?.role !== 'admin' && roleRow?.role !== 'coach') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }
}
```
Update `matcher: ['/profile/:path*', '/admin/:path*', '/roster/:path*']`.

Note this is a deliberate departure from existing precedent, not a continuation of it: today, `/admin/page.tsx` and `/profile/page.tsx` each only check `if (!user) redirect('/login')` at the page level — the role gate for `/admin` lives *solely* in `middleware.ts`, with no page-level role re-check. `/roster/page.tsx` doing its own role check in addition to the middleware guard is a new, stricter pattern for this codebase (defense in depth), chosen because `/roster` is a brand-new access boundary — not because it matches what `/admin` already does.

### Data fetch

**File:** `src/app/actions/roster.ts` ← new

```ts
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { getAmountDue } from '@/app/actions/payment'

export type RosterPlayer = {
  id: string
  parentId: string
  name: string
  position: string
  ageGroups: string[]
  hasOutstanding: boolean
}

// Excludes 'inactive' players (left the club) — 'injured'/'away' still show,
// since they're still rostered, just not currently playing.
export async function getRosterForCoach(): Promise<RosterPlayer[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('players').select('*').neq('status', 'inactive').order('name')

  const players = data ?? []
  const dueChecks = await Promise.all(players.map(p => getAmountDue(p.id)))

  return players.map((p, i) => ({
    id: p.id,
    parentId: p.parent_id,
    name: p.name,
    position: p.position,
    ageGroups: p.age_groups,
    hasOutstanding: dueChecks[i] !== null,
  }))
}
```

`Promise.all` over `getAmountDue` (which itself makes 2-3 queries per player) is an N+1 pattern, same tradeoff already accepted elsewhere in this codebase (e.g. `announcement-card.tsx`'s refetch-everything comment) — fine at this club's roster size.

No parent contact info (name/email/phone) is included — the ask was specifically "name & position," and coaches don't need parent contact details for this view.

### Display

**File:** `src/components/roster/roster-list.tsx` ← new

Client component (needs the "Mark Paid" button's interactivity). Groups `players` by each entry in `ageGroups` — a player with `['U10', 'U14']` appears in both group sections, using `AGE_GROUPS` (from `src/lib/age-groups.ts`) to iterate groups in a fixed order. A player with an empty `ageGroups` array shows in an "Unassigned" section at the bottom, so a forgotten assignment is visible rather than silently dropped.

Each row: name, position, an "Outstanding" badge (`text-brand-primary`) when `hasOutstanding`, and — only when `hasOutstanding` — a "Mark Paid" button:

```tsx
async function handleMarkPaid(player: RosterPlayer) {
  setUpdating(player.id)
  await adminMarkCashPaid({ playerId: player.id, parentId: player.parentId, adminNotes: 'Cash paid directly — marked from roster' })
  setUpdating(null)
  window.location.reload()
}
```

Reuses `adminMarkCashPaid` from `src/app/actions/payment.ts` unchanged — it already has no internal role check (relies on route protection, same trust model as every other action in this codebase), so no changes needed there; `/roster`'s middleware guard is what makes this safe to expose to coaches.

---

## Admin: Age Group Assignment

**File:** `src/components/admin/players-table.tsx` — extend the existing per-row edit state to include `ageGroups: string[]`, with a checkbox per `AGE_GROUPS` value next to the existing Plan/Status dropdowns. The existing "Save Changes" button's handler additionally calls a new action:

```ts
// src/app/actions/admin.ts — add
export async function updatePlayerAgeGroups(playerId: string, ageGroups: string[]) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players').update({ age_groups: ageGroups }).eq('id', playerId)
}
```

`getAllPlayers` (already in `admin.ts`) needs `age_groups` added to its returned mapped object (`ageGroups: p.age_groups`) — the underlying `.select('*', ...)` already picks it up automatically once the migration lands. No type changes needed in `players-table.tsx`'s `PlayerWithParent` — it's `Player & {...}`, so `age_groups` is inherited the moment it's added to the `players` Row type in `types.ts`.

---

## Access Control Summary

- `/profile` — unchanged. Parent sees only their own children.
- `/roster` — new. `coach` or `admin` only.
- `/admin` — unchanged. `admin` only. Gains the new Coach Accounts section and age-group checkboxes in Players & Payments.

## Login Redirect

**File:** `src/app/login/page.tsx` — after a successful `signInWithPassword`, look up the role (import `getUserRole` from the new `src/app/actions/auth.ts`) before deciding where to send the user:

```ts
const { data: { user: signedInUser } } = await supabase.auth.getUser()
const role = signedInUser ? await getUserRole(signedInUser.id) : null
router.push(role === 'coach' ? '/roster' : '/profile')
```

Parents and admins keep going to `/profile` (an admin with no `parents` row just sees an empty player list there, same as today — not a regression, and out of scope to give admins a dedicated landing page here).

## Nav

**File:** `src/components/nav.tsx` — the existing `authLinks` block's "My Profile" link becomes role-aware. `nav.tsx` currently has two effects: one with a `[]` dep array that fetches `user`, and a separate `[user]`-keyed effect (currently driving the reg-fee-alert check) that fires once `user` resolves. Add the `getUserRole` call to that **second, `[user]`-keyed effect** — not the first one, where `user` would still be `null`. Import `getUserRole` from the new `src/app/actions/auth.ts`. Then swap the link:

```tsx
<Link href={role === 'coach' ? '/roster' : '/profile'} ...>
  {role === 'coach' ? t.nav.roster : t.nav.myProfile}
</Link>
```

New dictionary key `nav.roster` needed in `en.ts`/`es.ts` ("Roster" / "Plantilla"). This nav change affects the public-facing site's EN/ES toggle, so it goes through the existing `t.nav.*` pattern like every other nav label — unlike `/admin` and `/roster`'s *content*, which stay English-only as internal/staff tools per the existing i18n spec's scope boundary.

---

## Testing

Following this repo's convention (business logic gets unit tests; presentational component wiring generally doesn't):

- `src/app/actions/__tests__/admin.test.ts` (new, or add to existing if one exists — verify first) — `createCoachAccount`: rolls back the auth user if the `user_roles` insert fails; `updatePlayerAgeGroups`: calls update with the given array.
- `src/app/actions/__tests__/roster.test.ts` ← new — `getRosterForCoach`: excludes `inactive` players; maps `hasOutstanding` correctly from a mocked `getAmountDue`; includes players with empty `age_groups`. **Note:** every existing test in `src/app/actions/__tests__/` mocks only `@/lib/supabase/server`, never a sibling action module — this test deliberately deviates by also mocking `@/app/actions/payment` (`jest.mock('@/app/actions/payment')`), since driving `getAmountDue`'s real DB-mock chain end-to-end here would be disproportionate to what this test is actually verifying (the roster mapping logic, not payment-due computation, which already has its own tests). Flagged so this isn't mistaken for the established pattern.
- No dedicated component tests for `RosterList`, `CoachAccounts`, or the `PlayersTable` checkbox addition, matching existing precedent (`ManageLeagueClubs`, `StaffAdmin`, etc. are untested).

---

## Out of Scope

- Linking coach accounts to `staff_members` bio rows (no automatic name-matching; an admin creates a login for "Josh Miller" as a fully separate step from his staff bio existing).
- Invite-email flow for coach account creation — the admin sets and communicates the password directly.
- Coach password reset / self-service account management.
- Keeping `AGE_GROUPS` in sync with `league_divisions` if the club's age groups change — both would need manual updates (one is a hardcoded list in code, the other an admin-managed DB table).
- A dedicated admin landing page (admins keep landing on `/profile` after login, same as today).
- Any change to the existing `/profile`, `PaymentOptionsPanel`, or parent-facing payment-reporting flow.
