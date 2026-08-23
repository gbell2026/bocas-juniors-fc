# Club Finances (P&L) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Finances" tab to `/admin` that tracks club income (auto-computed Registration Fees/Subscriptions from existing payments, plus manually-logged Sponsorship/Other Income) and expenses (Wages/Equipment/Travel/Other Expense), against a per-category-per-season budget, shown as a Budget/Actual/Variance P&L table.

**Architecture:** Four new Postgres tables (`finance_seasons`, `finance_categories`, `finance_entries`, `finance_budgets`), each behind a `using (false)` RLS policy — all access goes through `'use server'` actions in a new `src/app/actions/finances.ts`, using the service-role client, following this codebase's existing per-domain action-file convention (`staff.ts`, `announcements.ts`). A new `src/components/admin/finances-admin.tsx` client component, wired into `admin-dashboard.tsx` as a new tab, provides season management, the P&L table with inline budget editing, category management, and manual entry logging — reusing UI shapes already established in `league-divisions.tsx` (create/edit-in-place with label + date range) and `staff-admin.tsx` (list with inline edit/delete).

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role client), Tailwind, Jest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-23-club-finances.md`

---

## Chunk 1: Data layer — migration, types, server actions

### Task 1: Database migration and generated types

**Files:**
- Create: `supabase/migrations/019_club_finances.sql`
- Modify: `src/lib/supabase/types.ts`

This task has no tests of its own (pure SQL + hand-maintained type definitions) — it's verified by every later task's tests actually compiling and passing against these types.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/019_club_finances.sql`:

```sql
create type finance_category_kind as enum ('income', 'expense');

create table finance_seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_date date not null,
  end_date date not null,
  created_at timestamptz not null default now()
);

create table finance_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind finance_category_kind not null,
  -- 'registration' and 'subscription' are computed from the payments
  -- table; every other category is manually logged via finance_entries.
  -- Not a general-purpose enum — just a marker for the two categories
  -- with a live data source. Rename/delete on these is blocked in
  -- src/app/actions/finances.ts, not by a DB constraint.
  auto_source text check (auto_source in ('registration', 'subscription')),
  created_at timestamptz not null default now()
);

create table finance_entries (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references finance_seasons(id) on delete cascade,
  category_id uuid not null references finance_categories(id) on delete restrict,
  amount_cents integer not null,
  entry_date date not null,
  note text,
  created_at timestamptz not null default now()
);

create table finance_budgets (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references finance_seasons(id) on delete cascade,
  category_id uuid not null references finance_categories(id) on delete restrict,
  target_amount_cents integer not null,
  unique (season_id, category_id)
);

-- Same "deny-all, service-role only" pattern as staff_members
-- (009_staff_members.sql) and every league_* table (006_league.sql) —
-- every read/write goes through a 'use server' action.
alter table finance_seasons enable row level security;
alter table finance_categories enable row level security;
alter table finance_entries enable row level security;
alter table finance_budgets enable row level security;
create policy "no_direct_access" on finance_seasons using (false);
create policy "no_direct_access" on finance_categories using (false);
create policy "no_direct_access" on finance_entries using (false);
create policy "no_direct_access" on finance_budgets using (false);

insert into finance_categories (name, kind, auto_source) values
  ('Registration Fees', 'income', 'registration'),
  ('Subscriptions', 'income', 'subscription'),
  ('Sponsorship', 'income', null),
  ('Other Income', 'income', null),
  ('Wages', 'expense', null),
  ('Equipment', 'expense', null),
  ('Travel', 'expense', null),
  ('Other Expense', 'expense', null);
```

- [ ] **Step 2: Confirm with the user, then apply the migration**

This is a production database change — confirm with the user before running. The project is already linked (`supabase/.temp/project-ref`), so:

Run: `supabase db push`
Expected: reports migration `019_club_finances.sql` applied successfully, with no errors.

- [ ] **Step 3: Add hand-maintained types**

This codebase maintains `src/lib/supabase/types.ts` by hand alongside each migration (no generation script in `package.json` — confirmed by checking; e.g. migration 018's `player_status` enum addition and its `types.ts` update were separate commits). Find the `Database['public']['Tables']` object and the `Database['public']['Enums']` object in `src/lib/supabase/types.ts`. Add four new `Tables` entries and one new `Enums` entry, following the exact `Row`/`Insert`/`Update`/`Relationships` shape already used for `staff_members` (nullable columns get `| null` in `Row` and `?: ... | null` in `Insert`/`Update`; columns with a DB default get `?:` in `Insert`):

```ts
      finance_seasons: {
        Row: {
          id: string
          label: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: {
          id?: string
          label: string
          start_date: string
          end_date: string
          created_at?: string
        }
        Update: {
          id?: string
          label?: string
          start_date?: string
          end_date?: string
          created_at?: string
        }
        Relationships: []
      }
      finance_categories: {
        Row: {
          id: string
          name: string
          kind: Database['public']['Enums']['finance_category_kind']
          auto_source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          kind: Database['public']['Enums']['finance_category_kind']
          auto_source?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          kind?: Database['public']['Enums']['finance_category_kind']
          auto_source?: string | null
          created_at?: string
        }
        Relationships: []
      }
      finance_entries: {
        Row: {
          id: string
          season_id: string
          category_id: string
          amount_cents: number
          entry_date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          season_id: string
          category_id: string
          amount_cents: number
          entry_date: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          season_id?: string
          category_id?: string
          amount_cents?: number
          entry_date?: string
          note?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_entries_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "finance_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      finance_budgets: {
        Row: {
          id: string
          season_id: string
          category_id: string
          target_amount_cents: number
        }
        Insert: {
          id?: string
          season_id: string
          category_id: string
          target_amount_cents: number
        }
        Update: {
          id?: string
          season_id?: string
          category_id?: string
          target_amount_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "finance_budgets_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "finance_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "finance_categories"
            referencedColumns: ["id"]
          }
        ]
      }
```

And in `Database['public']['Enums']`:

```ts
      finance_category_kind: "income" | "expense"
```

Look at how `staff_members` is wired into the `Tables` object and match its exact placement style (alphabetical or grouped — check the file and follow whatever ordering convention is already there).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (only the 3 pre-existing unrelated gallery test errors)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/019_club_finances.sql src/lib/supabase/types.ts
git commit -m "feat: add club finances database schema"
```

---

### Task 2: Season server actions

**Files:**
- Create: `src/app/actions/finances.ts`
- Test: `src/app/actions/__tests__/finances.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/app/actions/__tests__/finances.test.ts`:

```ts
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { getFinanceSeasons, createFinanceSeason, updateFinanceSeason } from '../finances'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('getFinanceSeasons', () => {
  it('returns seasons ordered newest first', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 's1', label: '2026 Season', start_date: '2026-08-01', end_date: '2026-12-31', created_at: '2026-01-01' }],
      error: null,
    })
    const result = await getFinanceSeasons()
    expect(result).toEqual([{ id: 's1', label: '2026 Season', startDate: '2026-08-01', endDate: '2026-12-31' }])
    expect(mockSupabase.order).toHaveBeenCalledWith('start_date', { ascending: false })
  })
})

describe('createFinanceSeason', () => {
  it('creates a season', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceSeason({ label: '2026 Season', startDate: '2026-08-01', endDate: '2026-12-31' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ label: '2026 Season', start_date: '2026-08-01', end_date: '2026-12-31' })
  })

  it('rejects an end date on or before the start date', async () => {
    const result = await createFinanceSeason({ label: '2026 Season', startDate: '2026-12-31', endDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

describe('updateFinanceSeason', () => {
  it('updates a season', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateFinanceSeason('s1', { label: 'Renamed', startDate: '2026-08-01', endDate: '2026-12-31' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ label: 'Renamed', start_date: '2026-08-01', end_date: '2026-12-31' })
    expect(mockSupabase.eq).toHaveBeenCalledWith('id', 's1')
  })

  it('rejects an end date on or before the start date', async () => {
    const result = await updateFinanceSeason('s1', { label: 'Renamed', startDate: '2026-12-31', endDate: '2026-08-01' })
    expect(result.error).toBe('Season end date must be after the start date')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: FAIL — `Cannot find module '../finances'`

- [ ] **Step 3: Create the actions file with season functions**

Create `src/app/actions/finances.ts`:

```ts
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export type FinanceSeason = { id: string; label: string; startDate: string; endDate: string }

export async function getFinanceSeasons(): Promise<FinanceSeason[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('finance_seasons').select('*').order('start_date', { ascending: false })
  return (data ?? []).map(s => ({ id: s.id, label: s.label, startDate: s.start_date, endDate: s.end_date }))
}

export type FinanceSeasonInput = { label: string; startDate: string; endDate: string }

export async function createFinanceSeason(input: FinanceSeasonInput): Promise<{ error?: string }> {
  if (new Date(input.endDate) <= new Date(input.startDate)) {
    return { error: 'Season end date must be after the start date' }
  }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_seasons').insert({
    label: input.label,
    start_date: input.startDate,
    end_date: input.endDate,
  })
  if (error) return { error: 'Failed to create season' }
  return {}
}

export async function updateFinanceSeason(id: string, input: FinanceSeasonInput): Promise<{ error?: string }> {
  if (new Date(input.endDate) <= new Date(input.startDate)) {
    return { error: 'Season end date must be after the start date' }
  }
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_seasons').update({
    label: input.label,
    start_date: input.startDate,
    end_date: input.endDate,
  }).eq('id', id)
  if (error) return { error: 'Failed to update season' }
  return {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: PASS, 4/4

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/finances.ts src/app/actions/__tests__/finances.test.ts
git commit -m "feat: add finance season server actions"
```

---

### Task 3: Category server actions

**Files:**
- Modify: `src/app/actions/finances.ts`
- Modify: `src/app/actions/__tests__/finances.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `src/app/actions/__tests__/finances.test.ts` (extend the existing import line and mock, add these `describe` blocks):

```ts
// change the import line at the top of the file to:
import {
  getFinanceSeasons, createFinanceSeason, updateFinanceSeason,
  getFinanceCategories, createFinanceCategory, renameFinanceCategory, deleteFinanceCategory,
} from '../finances'
```

```ts
describe('getFinanceCategories', () => {
  it('returns categories', async () => {
    // getFinanceCategories calls .order('kind').order('name') — two calls in one
    // chain. The first must return mockSupabase (chainable); only the second
    // resolves. Queuing just one mockResolvedValueOnce here would be consumed
    // by the FIRST call instead, breaking the chain — queue both explicitly.
    mockSupabase.order.mockReturnValueOnce(mockSupabase) // .order('kind')
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'c1', name: 'Wages', kind: 'expense', auto_source: null }],
      error: null,
    }) // .order('name')
    const result = await getFinanceCategories()
    expect(result).toEqual([{ id: 'c1', name: 'Wages', kind: 'expense', autoSource: null }])
  })
})

describe('createFinanceCategory', () => {
  it('creates a manual category', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceCategory({ name: 'Referee Fees', kind: 'expense' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({ name: 'Referee Fees', kind: 'expense', auto_source: null })
  })
})

describe('renameFinanceCategory', () => {
  it('renames a manual category', async () => {
    // renameFinanceCategory calls .eq('id', id) twice: once (chainable) before
    // the auto_source .single() lookup, then again (terminal) for the update.
    // Queuing only one mockResolvedValueOnce would be consumed by the FIRST
    // (chainable) call, breaking .single() — queue the chainable return first.
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // auto_source check .eq('id', id)
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // update .eq('id', id)
    const result = await renameFinanceCategory('c1', 'New Name')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ name: 'New Name' })
  })

  it('refuses to rename an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'registration' }, error: null })
    const result = await renameFinanceCategory('c1', 'New Name')
    expect(result.error).toBe('This category is computed automatically and can\'t be renamed')
    expect(mockSupabase.update).not.toHaveBeenCalled()
  })
})

describe('deleteFinanceCategory', () => {
  it('refuses to delete an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'subscription' }, error: null })
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category is computed automatically and can\'t be deleted')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a category with logged entries', async () => {
    // The implementation queries entries and budgets unconditionally (not
    // short-circuited) before checking either result, so both .limit(1) calls
    // always happen — queue a value for both, even though only the first
    // (entries) is what this test is actually asserting on.
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'e1' }], error: null }) // entries: has one
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // budgets: none
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category has logged entries or a budget — remove those first')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('refuses to delete a category with a budget set', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no entries
    mockSupabase.limit.mockResolvedValueOnce({ data: [{ id: 'b1' }], error: null }) // has a budget
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBe('This category has logged entries or a budget — remove those first')
    expect(mockSupabase.delete).not.toHaveBeenCalled()
  })

  it('deletes a manual category with no entries or budgets', async () => {
    // .eq() is called 4 times in this path: auto_source check (chainable,
    // before .single()), the entries check (chainable, before .limit()), the
    // budgets check (chainable, before .limit()), and finally the delete
    // itself (terminal). Only the last should resolve — the first three must
    // be queued to return mockSupabase, or the terminal value gets
    // front-consumed by the very first call and breaks .single().
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // auto_source check .eq('id', id)
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // entries check .eq('category_id', id)
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no entries
    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // budgets check .eq('category_id', id)
    mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null }) // no budget
    mockSupabase.eq.mockResolvedValueOnce({ error: null }) // the delete itself .eq('id', id)
    const result = await deleteFinanceCategory('c1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
  })
})
```

Add `single: jest.fn()` and `limit: jest.fn()` to the `mockSupabase` object at the top of the file (alongside the existing `order: jest.fn()`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: FAIL — the new functions don't exist yet

- [ ] **Step 3: Implement category functions**

Add to `src/app/actions/finances.ts`:

```ts
export type FinanceCategory = { id: string; name: string; kind: 'income' | 'expense'; autoSource: 'registration' | 'subscription' | null }

export async function getFinanceCategories(): Promise<FinanceCategory[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('finance_categories').select('*').order('kind').order('name')
  return (data ?? []).map(c => ({
    id: c.id, name: c.name, kind: c.kind,
    autoSource: c.auto_source as 'registration' | 'subscription' | null,
  }))
}

export async function createFinanceCategory(input: { name: string; kind: 'income' | 'expense' }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_categories').insert({ name: input.name, kind: input.kind, auto_source: null })
  if (error) return { error: 'Failed to create category' }
  return {}
}

export async function renameFinanceCategory(id: string, name: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: category } = await supabase.from('finance_categories').select('auto_source').eq('id', id).single()
  if (category?.auto_source) {
    return { error: "This category is computed automatically and can't be renamed" }
  }
  const { error } = await supabase.from('finance_categories').update({ name }).eq('id', id)
  if (error) return { error: 'Failed to rename category' }
  return {}
}

export async function deleteFinanceCategory(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: category } = await supabase.from('finance_categories').select('auto_source').eq('id', id).single()
  if (category?.auto_source) {
    return { error: "This category is computed automatically and can't be deleted" }
  }

  const { data: entries } = await supabase.from('finance_entries').select('id').eq('category_id', id).limit(1)
  const { data: budgets } = await supabase.from('finance_budgets').select('id').eq('category_id', id).limit(1)
  if ((entries ?? []).length > 0 || (budgets ?? []).length > 0) {
    return { error: 'This category has logged entries or a budget — remove those first' }
  }

  const { error } = await supabase.from('finance_categories').delete().eq('id', id)
  if (error) return { error: 'Failed to delete category' }
  return {}
}
```

`renameFinanceCategory` and `deleteFinanceCategory` each inline their own `auto_source` check rather than sharing a helper, since the error message differs between them ("renamed" vs "deleted") and a shared helper would need the verb as a parameter for little benefit at this size.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/finances.ts src/app/actions/__tests__/finances.test.ts
git commit -m "feat: add finance category server actions"
```

---

### Task 4: Entry server actions

**Files:**
- Modify: `src/app/actions/finances.ts`
- Modify: `src/app/actions/__tests__/finances.test.ts`

- [ ] **Step 1: Write the failing tests**

Update the import line again to add `getFinanceEntries, createFinanceEntry, updateFinanceEntry, deleteFinanceEntry`. Add:

```ts
describe('getFinanceEntries', () => {
  it('returns entries for a season, newest first', async () => {
    mockSupabase.order.mockResolvedValueOnce({
      data: [{ id: 'e1', season_id: 's1', category_id: 'c1', amount_cents: 50000, entry_date: '2026-09-01', note: 'Kit sponsor', finance_categories: { name: 'Sponsorship' } }],
      error: null,
    })
    const result = await getFinanceEntries('s1')
    expect(result).toEqual([{ id: 'e1', categoryId: 'c1', categoryName: 'Sponsorship', amountCents: 50000, entryDate: '2026-09-01', note: 'Kit sponsor' }])
  })
})

describe('createFinanceEntry', () => {
  it('creates an entry for a manual category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: null }, error: null })
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createFinanceEntry({ seasonId: 's1', categoryId: 'c1', amountCents: 50000, entryDate: '2026-09-01', note: 'Kit sponsor' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      season_id: 's1', category_id: 'c1', amount_cents: 50000, entry_date: '2026-09-01', note: 'Kit sponsor',
    })
  })

  it('refuses to create an entry for an auto-source category', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: { auto_source: 'registration' }, error: null })
    const result = await createFinanceEntry({ seasonId: 's1', categoryId: 'c1', amountCents: 50000, entryDate: '2026-09-01' })
    expect(result.error).toBe("This category is computed automatically — it can't be logged manually")
    expect(mockSupabase.insert).not.toHaveBeenCalled()
  })
})

describe('updateFinanceEntry', () => {
  it('updates an entry', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateFinanceEntry('e1', { amountCents: 60000, entryDate: '2026-09-02', note: 'Updated' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.update).toHaveBeenCalledWith({ amount_cents: 60000, entry_date: '2026-09-02', note: 'Updated' })
  })
})

describe('deleteFinanceEntry', () => {
  it('deletes an entry', async () => {
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteFinanceEntry('e1')
    expect(result.error).toBeUndefined()
    expect(mockSupabase.delete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: FAIL — new functions don't exist

- [ ] **Step 3: Implement entry functions**

Add to `src/app/actions/finances.ts`:

```ts
export type FinanceEntry = { id: string; categoryId: string; categoryName: string; amountCents: number; entryDate: string; note: string | null }

export async function getFinanceEntries(seasonId: string): Promise<FinanceEntry[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('finance_entries')
    .select('*, finance_categories(name)')
    .eq('season_id', seasonId)
    .order('entry_date', { ascending: false })
  return (data ?? []).map((e: any) => ({
    id: e.id, categoryId: e.category_id, categoryName: e.finance_categories.name,
    amountCents: e.amount_cents, entryDate: e.entry_date, note: e.note,
  }))
}

export type FinanceEntryInput = { seasonId: string; categoryId: string; amountCents: number; entryDate: string; note?: string }

export async function createFinanceEntry(input: FinanceEntryInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { data: category } = await supabase.from('finance_categories').select('auto_source').eq('id', input.categoryId).single()
  if (category?.auto_source) {
    return { error: "This category is computed automatically — it can't be logged manually" }
  }
  const { error } = await supabase.from('finance_entries').insert({
    season_id: input.seasonId, category_id: input.categoryId,
    amount_cents: input.amountCents, entry_date: input.entryDate, note: input.note ?? null,
  })
  if (error) return { error: 'Failed to create entry' }
  return {}
}

export async function updateFinanceEntry(id: string, input: { amountCents: number; entryDate: string; note?: string }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_entries').update({
    amount_cents: input.amountCents, entry_date: input.entryDate, note: input.note ?? null,
  }).eq('id', id)
  if (error) return { error: 'Failed to update entry' }
  return {}
}

export async function deleteFinanceEntry(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_entries').delete().eq('id', id)
  if (error) return { error: 'Failed to delete entry' }
  return {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/finances.ts src/app/actions/__tests__/finances.test.ts
git commit -m "feat: add finance entry server actions"
```

---

### Task 5: Budget server actions

**Files:**
- Modify: `src/app/actions/finances.ts`
- Modify: `src/app/actions/__tests__/finances.test.ts`

- [ ] **Step 1: Write the failing tests**

Update the import line to add `getFinanceBudgets, setFinanceBudget`. Add:

```ts
describe('getFinanceBudgets', () => {
  it('returns budgets for a season as a map of category id to target', async () => {
    mockSupabase.eq.mockResolvedValueOnce({
      data: [{ category_id: 'c1', target_amount_cents: 200000 }],
      error: null,
    })
    const result = await getFinanceBudgets('s1')
    expect(result).toEqual({ c1: 200000 })
  })
})

describe('setFinanceBudget', () => {
  it('upserts a budget target', async () => {
    mockSupabase.upsert = jest.fn().mockResolvedValueOnce({ error: null })
    const result = await setFinanceBudget({ seasonId: 's1', categoryId: 'c1', targetAmountCents: 200000 })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      { season_id: 's1', category_id: 'c1', target_amount_cents: 200000 },
      { onConflict: 'season_id,category_id' }
    )
  })
})
```

Add `upsert: jest.fn()` to `mockSupabase` at the top of the file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: FAIL — new functions don't exist

- [ ] **Step 3: Implement budget functions**

Add to `src/app/actions/finances.ts`:

```ts
export async function getFinanceBudgets(seasonId: string): Promise<Record<string, number>> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('finance_budgets').select('category_id, target_amount_cents').eq('season_id', seasonId)
  return Object.fromEntries((data ?? []).map(b => [b.category_id, b.target_amount_cents]))
}

export async function setFinanceBudget(input: { seasonId: string; categoryId: string; targetAmountCents: number }): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('finance_budgets').upsert(
    { season_id: input.seasonId, category_id: input.categoryId, target_amount_cents: input.targetAmountCents },
    { onConflict: 'season_id,category_id' }
  )
  if (error) return { error: 'Failed to set budget' }
  return {}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/finances.ts src/app/actions/__tests__/finances.test.ts
git commit -m "feat: add finance budget server actions"
```

---

### Task 6: The P&L aggregation action

**Files:**
- Modify: `src/app/actions/finances.ts`
- Modify: `src/app/actions/__tests__/finances.test.ts`

This is the one action the Finances tab's main view actually calls. It combines: every category, its budget (from Task 5's table), and its actual — computed live from `payments` for the two auto-source categories, or summed from `finance_entries` for every other category.

**Implementation note on the date-range filter:** the spec describes the auto-source actual query as `paid_at at time zone 'utc' >= start_date and paid_at at time zone 'utc' < end_date + 1` (half-open, UTC-pinned). This codebase's Supabase query builder doesn't have a `.gte()`/`.lt()` escape hatch for raw SQL expressions like `at time zone`, and no other action in this codebase uses raw SQL/RPC — every date filter elsewhere (e.g. `getFixtureCalendar` in `league.ts`) uses the standard `.gte()/.lte()` builder against plain values. The equivalent, builder-native way to get the identical UTC-pinned half-open range is to compare `paid_at` (a `timestamptz` column) against explicit UTC ISO-8601 boundary strings: `.gte('paid_at', \`${startDate}T00:00:00.000Z\`).lt('paid_at', \`${dayAfterEndDate}T00:00:00.000Z\`)`. A `timestamptz` column compared against a string with an explicit `Z` offset is unambiguous regardless of session timezone — this achieves exactly the spec's intended semantics through the established query-builder pattern instead of introducing raw SQL as a one-off.

- [ ] **Step 1: Write the failing tests**

Update the import line to add `getFinancePnL`. Add `in: jest.fn(), gte: jest.fn(), lt: jest.fn()` to the `mockSupabase` object at the top of the file (`in`/`gte` are chainable within a single call site, so no `mockReturnThis()` default is needed — every test that uses them queues each call explicitly, the same way `eq` and `order` already are below).

```ts
describe('getFinancePnL', () => {
  const categories = [
    { id: 'reg', name: 'Registration Fees', kind: 'income', auto_source: 'registration' },
    { id: 'sub', name: 'Subscriptions', kind: 'income', auto_source: 'subscription' },
    { id: 'spon', name: 'Sponsorship', kind: 'income', auto_source: null },
    { id: 'wages', name: 'Wages', kind: 'expense', auto_source: null },
  ]
  const season = { id: 's1', start_date: '2026-08-01', end_date: '2026-11-30' }

  it('computes actuals from payments for auto-source categories and from entries for manual categories, against each category\'s budget', async () => {
    // getFinancePnL's real call sequence, traced against this mock's chaining:
    // 1. finance_seasons: .eq('id', seasonId) [chainable] -> .single() [terminal]
    // 2. finance_categories: .order('kind') [chainable] -> .order('name') [terminal]
    // 3. finance_budgets: .eq('season_id', seasonId) [terminal]
    // 4. payments (registration): .eq('status', 'succeeded') [chainable] -> .in(...) [chainable] -> .gte(...) [chainable] -> .lt(...) [terminal]
    // 5. payments (subscription): same shape as 4
    // 6. finance_entries: .eq('season_id', seasonId) [terminal]
    // Every non-terminal call in this chain is explicitly queued with mockReturnValueOnce(mockSupabase) below —
    // relying on a default return value here would let an EARLIER queued resolved-value entry get
    // front-consumed by an unrelated call, exactly the mock-ordering bug documented in
    // admin.test.ts's deletePlayer tests. Queue order below must match the real call order above exactly.

    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // 1a: season .eq('id', seasonId)
    mockSupabase.single.mockResolvedValueOnce({ data: season, error: null }) // 1b: season .single()

    mockSupabase.order.mockReturnValueOnce(mockSupabase) // 2a: categories .order('kind')
    mockSupabase.order.mockResolvedValueOnce({ data: categories, error: null }) // 2b: categories .order('name')

    mockSupabase.eq.mockResolvedValueOnce({ data: [{ category_id: 'wages', target_amount_cents: 100000 }], error: null }) // 3: budgets .eq('season_id', seasonId)

    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // 4a: registration payments .eq('status', 'succeeded')
    mockSupabase.in.mockReturnValueOnce(mockSupabase) // 4b: registration payments .in(...)
    mockSupabase.gte.mockReturnValueOnce(mockSupabase) // 4c: registration payments .gte(...)
    mockSupabase.lt.mockResolvedValueOnce({ data: [{ amount: 3000 }, { amount: 3000 }], error: null }) // 4d: registration payments .lt(...)

    mockSupabase.eq.mockReturnValueOnce(mockSupabase) // 5a: subscription payments .eq('status', 'succeeded')
    mockSupabase.in.mockReturnValueOnce(mockSupabase) // 5b: subscription payments .in(...)
    mockSupabase.gte.mockReturnValueOnce(mockSupabase) // 5c: subscription payments .gte(...)
    mockSupabase.lt.mockResolvedValueOnce({ data: [{ amount: 21000 }], error: null }) // 5d: subscription payments .lt(...)

    mockSupabase.eq.mockResolvedValueOnce({ data: [{ category_id: 'wages', amount_cents: 45000 }], error: null }) // 6: finance_entries .eq('season_id', seasonId)

    const result = await getFinancePnL('s1')

    expect(result).toEqual([
      { id: 'reg', name: 'Registration Fees', kind: 'income', budgetCents: 0, actualCents: 6000 },
      { id: 'sub', name: 'Subscriptions', kind: 'income', budgetCents: 0, actualCents: 21000 },
      { id: 'spon', name: 'Sponsorship', kind: 'income', budgetCents: 0, actualCents: 0 },
      { id: 'wages', name: 'Wages', kind: 'expense', budgetCents: 100000, actualCents: 45000 },
    ])
  })
})
```

Write `getFinancePnL` (Step 3 below) to make its real Supabase calls in exactly this order: season lookup, categories, budgets, registration-payments, subscription-payments, entries. If you change the implementation's call order for any reason, you must update this test's mock queue to match the new order and re-verify RED before GREEN — a mismatch here fails with a confusing `TypeError` deep in the mock chain, not a clean assertion failure.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: FAIL — `getFinancePnL` doesn't exist

- [ ] **Step 3: Implement `getFinancePnL`**

Add to `src/app/actions/finances.ts`:

```ts
export type FinancePnLRow = { id: string; name: string; kind: 'income' | 'expense'; budgetCents: number; actualCents: number }

function addOneDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

export async function getFinancePnL(seasonId: string): Promise<FinancePnLRow[]> {
  const supabase = createSupabaseServiceClient()

  const { data: season } = await supabase.from('finance_seasons').select('start_date, end_date').eq('id', seasonId).single()
  if (!season) return []

  const { data: categoriesData } = await supabase.from('finance_categories').select('*').order('kind').order('name')
  const categories = categoriesData ?? []

  const { data: budgetsData } = await supabase.from('finance_budgets').select('category_id, target_amount_cents').eq('season_id', seasonId)
  const budgets = Object.fromEntries((budgetsData ?? []).map(b => [b.category_id, b.target_amount_cents]))

  const rangeStart = `${season.start_date}T00:00:00.000Z`
  const rangeEnd = `${addOneDay(season.end_date)}T00:00:00.000Z`

  async function paymentsTotal(labels: string[]): Promise<number> {
    const { data } = await supabase
      .from('payments')
      .select('amount')
      .eq('status', 'succeeded')
      .in('installment_label', labels)
      .gte('paid_at', rangeStart)
      .lt('paid_at', rangeEnd)
    return (data ?? []).reduce((sum, p) => sum + p.amount, 0)
  }

  const registrationTotal = await paymentsTotal(['registration'])
  const subscriptionTotal = await paymentsTotal(['full', 'august', 'september', 'october', 'november'])

  const { data: entriesData } = await supabase.from('finance_entries').select('category_id, amount_cents').eq('season_id', seasonId)
  const entryTotals: Record<string, number> = {}
  for (const e of entriesData ?? []) {
    entryTotals[e.category_id] = (entryTotals[e.category_id] ?? 0) + e.amount_cents
  }

  return categories.map(c => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    budgetCents: budgets[c.id] ?? 0,
    actualCents:
      c.auto_source === 'registration' ? registrationTotal
      : c.auto_source === 'subscription' ? subscriptionTotal
      : entryTotals[c.id] ?? 0,
  }))
}
```

The entries fetch now runs after both `paymentsTotal` calls, matching the test's queue order exactly (registration → subscription → entries).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/app/actions/__tests__/finances.test.ts`
Expected: PASS, all tests green

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx jest`
Expected: all suites pass (no other file touches `finances.ts`, so this should be unaffected, but confirm)

- [ ] **Step 6: Commit**

```bash
git add src/app/actions/finances.ts src/app/actions/__tests__/finances.test.ts
git commit -m "feat: add club finances P&L aggregation action"
```

**Chunk 1 complete.** All data-layer server actions exist and are tested. Nothing is wired into the UI yet — `/admin` is unchanged and still builds/runs exactly as before.

---

## Chunk 2: UI layer — Finances tab

### Task 7: Wire the Finances tab into the admin dashboard (stub)

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/components/admin/admin-dashboard.tsx`
- Create: `src/components/admin/finances-admin.tsx`

This task adds a working (if minimal) Finances tab — enough to confirm the wiring builds and renders — before the following tasks flesh out its contents.

- [ ] **Step 1: Fetch finance data in `admin/page.tsx`**

In `src/app/admin/page.tsx`, add to the imports:

```ts
import { getFinanceSeasons, getFinanceCategories } from '@/app/actions/finances'
```

Add `getFinanceSeasons()` and `getFinanceCategories()` to the `Promise.all` array (and corresponding destructured names, e.g. `financeSeasons, financeCategories`), then pass them as new props to `<AdminDashboard>`:

```tsx
      financeSeasons={financeSeasons}
      financeCategories={financeCategories}
```

- [ ] **Step 2: Create the stub `FinancesAdmin` component**

Create `src/components/admin/finances-admin.tsx`:

```tsx
'use client'
import type { FinanceSeason, FinanceCategory } from '@/app/actions/finances'

type Props = {
  seasons: FinanceSeason[]
  categories: FinanceCategory[]
}

export function FinancesAdmin({ seasons, categories }: Props) {
  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Finances</h2>
      <p className="text-brand-muted text-sm">{seasons.length} season(s), {categories.length} categories.</p>
    </section>
  )
}
```

- [ ] **Step 3: Wire the new tab into `admin-dashboard.tsx`**

In `src/components/admin/admin-dashboard.tsx`:

1. Add the import: `import { FinancesAdmin } from '@/components/admin/finances-admin'`
2. Add `import type { getFinanceSeasons, getFinanceCategories } from '@/app/actions/finances'`
3. Change `type Tab = 'overview' | 'players' | 'submissions' | 'league' | 'content'` to add `| 'finances'`
4. Add `{ key: 'finances', label: 'Finances' }` to the `TABS` array
5. Add to the `Props` type:
   ```ts
     financeSeasons: Awaited<ReturnType<typeof getFinanceSeasons>>
     financeCategories: Awaited<ReturnType<typeof getFinanceCategories>>
   ```
6. Add `financeSeasons, financeCategories,` to the destructured function parameters
7. Add a new render block, following the shape of the existing `{tab === 'content' && (...)}` block:
   ```tsx
         {tab === 'finances' && (
           <FinancesAdmin seasons={financeSeasons} categories={financeCategories} />
         )}
   ```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 5: Build check**

Run: `npx next build`
Expected: compiles successfully

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/page.tsx src/components/admin/admin-dashboard.tsx src/components/admin/finances-admin.tsx
git commit -m "feat: add Finances tab to admin dashboard"
```

---

### Task 8: Season picker and season management UI

**Files:**
- Modify: `src/components/admin/finances-admin.tsx`

- [ ] **Step 1: Implement season selection and the create/edit season form**

Replace the stub `FinancesAdmin` in `src/components/admin/finances-admin.tsx` with:

```tsx
'use client'
import { useState } from 'react'
import { createFinanceSeason, updateFinanceSeason } from '@/app/actions/finances'
import type { FinanceSeason, FinanceCategory } from '@/app/actions/finances'

type Props = {
  seasons: FinanceSeason[]
  categories: FinanceCategory[]
}

function defaultSeasonId(seasons: FinanceSeason[]): string {
  const today = new Date().toISOString().slice(0, 10)
  const current = seasons.find(s => s.startDate <= today && today <= s.endDate)
  return current?.id ?? seasons[0]?.id ?? ''
}

export function FinancesAdmin({ seasons: initialSeasons, categories }: Props) {
  const [seasons, setSeasons] = useState(initialSeasons)
  const [seasonId, setSeasonId] = useState(defaultSeasonId(initialSeasons))
  const [managingSeasons, setManagingSeasons] = useState(false)
  const [label, setLabel] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { label: string; startDate: string; endDate: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(s: FinanceSeason) {
    setEditingId(s.id)
    setEdits(prev => ({ ...prev, [s.id]: { label: s.label, startDate: s.startDate, endDate: s.endDate } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const result = await createFinanceSeason({ label, startDate, endDate })
      if (result.error) { setErrorMessage(result.error); return }
      setLabel(''); setStartDate(''); setEndDate('')
      window.location.reload()
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit) return
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateFinanceSeason(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setSeasons(prev => prev.map(s => s.id === id ? { ...s, ...edit } : s))
      setEditingId(null)
    } finally {
      setSaving(null)
    }
  }

  const selectedSeason = seasons.find(s => s.id === seasonId) ?? null

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink">Finances</h2>
        <button onClick={() => setManagingSeasons(v => !v)} className="btn-secondary text-xs px-3 py-1.5">
          {managingSeasons ? 'Done' : 'Manage Seasons'}
        </button>
      </div>

      {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}

      {seasons.length === 0 ? (
        <p className="text-brand-muted text-sm">Create a season to get started.</p>
      ) : (
        <select
          value={seasonId}
          onChange={e => setSeasonId(e.target.value)}
          className="input"
        >
          {seasons.map(s => (
            <option key={s.id} value={s.id}>{s.label} ({s.startDate} – {s.endDate})</option>
          ))}
        </select>
      )}

      {managingSeasons && (
        <div className="space-y-2 border border-brand-line rounded p-4">
          {seasons.map(s => (
            <div key={s.id} className="bg-brand-tint border border-brand-line rounded p-3">
              {editingId === s.id ? (
                <div className="space-y-2">
                  <input
                    className="input w-full"
                    value={edits[s.id]?.label ?? ''}
                    onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], label: e.target.value } }))}
                  />
                  <div className="flex gap-2">
                    <input
                      type="date" className="input flex-1"
                      value={edits[s.id]?.startDate ?? ''}
                      onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], startDate: e.target.value } }))}
                    />
                    <input
                      type="date" className="input flex-1"
                      value={edits[s.id]?.endDate ?? ''}
                      onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], endDate: e.target.value } }))}
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveEdit(s.id)} disabled={saving === s.id} className="btn-primary text-xs px-3 py-1.5">
                      {saving === s.id ? 'Saving…' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{s.label}</p>
                    <p className="text-brand-muted text-xs">{s.startDate} – {s.endDate}</p>
                  </div>
                  <button onClick={() => startEdit(s)} className="btn-secondary text-xs px-3 py-1.5">Edit</button>
                </div>
              )}
            </div>
          ))}

          <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
            <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Season</p>
            <input
              placeholder="Season label (e.g. 2026 Season)" required className="input w-full"
              value={label} onChange={e => setLabel(e.target.value)}
            />
            <div className="flex gap-2">
              <input type="date" required className="input flex-1" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <input type="date" required className="input flex-1" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
              {creating ? 'Creating…' : 'Create Season'}
            </button>
          </form>
        </div>
      )}

      {selectedSeason && <p className="text-brand-muted text-sm">Categories loaded: {categories.length}</p>}
    </section>
  )
}
```

This still doesn't show the P&L table (Task 9) — it's a working season picker/manager first, verified in isolation.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Build check**

Run: `npx next build`
Expected: compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/finances-admin.tsx
git commit -m "feat: add season picker and management to Finances tab"
```

---

### Task 9: P&L table with inline budget editing

**Files:**
- Modify: `src/components/admin/finances-admin.tsx`

- [ ] **Step 1: Add P&L fetching and the table**

In `src/components/admin/finances-admin.tsx`, add imports:

```ts
import { useEffect } from 'react'
import { getFinancePnL, setFinanceBudget } from '@/app/actions/finances'
import type { FinancePnLRow } from '@/app/actions/finances'
```

Add state and a fetch effect inside `FinancesAdmin`, near the top with the other `useState` calls:

```ts
  const [pnl, setPnl] = useState<FinancePnLRow[]>([])
  const [loadingPnl, setLoadingPnl] = useState(false)
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({})
  const [savingBudget, setSavingBudget] = useState<string | null>(null)

  useEffect(() => {
    if (!seasonId) { setPnl([]); return }
    setLoadingPnl(true)
    getFinancePnL(seasonId).then(setPnl).finally(() => setLoadingPnl(false))
  }, [seasonId])

  async function handleSaveBudget(categoryId: string) {
    const raw = budgetEdits[categoryId]
    if (raw === undefined) return
    const cents = Math.round(parseFloat(raw) * 100)
    if (Number.isNaN(cents)) return
    setSavingBudget(categoryId)
    try {
      await setFinanceBudget({ seasonId, categoryId, targetAmountCents: cents })
      setPnl(prev => prev.map(r => r.id === categoryId ? { ...r, budgetCents: cents } : r))
      setBudgetEdits(prev => { const next = { ...prev }; delete next[categoryId]; return next })
    } finally {
      setSavingBudget(null)
    }
  }

  function formatCents(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`
  }

  const income = pnl.filter(r => r.kind === 'income')
  const expense = pnl.filter(r => r.kind === 'expense')
  const totalIncomeBudget = income.reduce((sum, r) => sum + r.budgetCents, 0)
  const totalIncomeActual = income.reduce((sum, r) => sum + r.actualCents, 0)
  const totalExpenseBudget = expense.reduce((sum, r) => sum + r.budgetCents, 0)
  const totalExpenseActual = expense.reduce((sum, r) => sum + r.actualCents, 0)
```

Add a `variance` helper and a row-rendering function above the `return`:

```ts
  function variance(row: FinancePnLRow): number {
    const diff = row.actualCents - row.budgetCents
    return row.kind === 'income' ? diff : -diff
  }
```

Replace the `{selectedSeason && <p className="text-brand-muted text-sm">Categories loaded: {categories.length}</p>}` placeholder line with the actual P&L table:

```tsx
      {selectedSeason && (
        loadingPnl ? (
          <p className="text-brand-muted text-sm">Loading…</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-brand-creamAlt">
              <tr>
                {['Category', 'Budget', 'Actual', 'Variance'].map(h => (
                  <th key={h} className="text-left p-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...income, ...expense].map(row => {
                const isAuto = categories.find(c => c.id === row.id)?.autoSource != null
                const v = variance(row)
                return (
                  <tr key={row.id} className="border-t">
                    <td className="p-3 font-medium">{row.name}</td>
                    <td className="p-3">
                      {budgetEdits[row.id] !== undefined ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="number" step="0.01" className="input w-24"
                            value={budgetEdits[row.id]}
                            onChange={e => setBudgetEdits(prev => ({ ...prev, [row.id]: e.target.value }))}
                          />
                          <button
                            onClick={() => handleSaveBudget(row.id)}
                            disabled={savingBudget === row.id}
                            className="btn-primary text-xs px-2 py-1"
                          >Save</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setBudgetEdits(prev => ({ ...prev, [row.id]: (row.budgetCents / 100).toFixed(2) }))}
                          className="hover:underline"
                        >{formatCents(row.budgetCents)}</button>
                      )}
                    </td>
                    <td className="p-3">{formatCents(row.actualCents)}{isAuto && <span className="text-brand-mutedWarm text-xs ml-1">(auto)</span>}</td>
                    <td className={`p-3 font-medium ${v >= 0 ? 'text-green-600' : 'text-brand-primary'}`}>
                      {v >= 0 ? '+' : ''}{formatCents(v)}
                    </td>
                  </tr>
                )
              })}
              <tr className="border-t-2 font-bold">
                <td className="p-3">Total Income</td>
                <td className="p-3">{formatCents(totalIncomeBudget)}</td>
                <td className="p-3">{formatCents(totalIncomeActual)}</td>
                <td className="p-3">{formatCents(totalIncomeActual - totalIncomeBudget)}</td>
              </tr>
              <tr className="font-bold">
                <td className="p-3">Total Expenses</td>
                <td className="p-3">{formatCents(totalExpenseBudget)}</td>
                <td className="p-3">{formatCents(totalExpenseActual)}</td>
                <td className="p-3">{formatCents(totalExpenseActual - totalExpenseBudget)}</td>
              </tr>
              <tr className="border-t-2 font-bold">
                <td className="p-3">Net</td>
                <td className="p-3">{formatCents(totalIncomeBudget - totalExpenseBudget)}</td>
                <td className="p-3">{formatCents(totalIncomeActual - totalExpenseActual)}</td>
                <td className="p-3">{formatCents((totalIncomeActual - totalExpenseActual) - (totalIncomeBudget - totalExpenseBudget))}</td>
              </tr>
            </tbody>
          </table>
        )
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Build check**

Run: `npx next build`
Expected: compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/finances-admin.tsx
git commit -m "feat: add P&L table with inline budget editing to Finances tab"
```

---

### Task 10: Category management UI

**Files:**
- Modify: `src/components/admin/finances-admin.tsx`

- [ ] **Step 1: Add category add/rename/delete UI**

Add imports: `createFinanceCategory, renameFinanceCategory, deleteFinanceCategory` to the existing `@/app/actions/finances` import.

Add state near the other `useState` calls:

```ts
  const [categoryList, setCategoryList] = useState(categories)
  const [managingCategories, setManagingCategories] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryKind, setNewCategoryKind] = useState<'income' | 'expense'>('expense')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [categoryNameEdit, setCategoryNameEdit] = useState('')
  const [categoryBusy, setCategoryBusy] = useState<string | null>(null)
```

Add handlers:

```ts
  async function handleCreateCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreatingCategory(true)
    try {
      const result = await createFinanceCategory({ name: newCategoryName, kind: newCategoryKind })
      if (result.error) { setErrorMessage(result.error); return }
      setNewCategoryName('')
      window.location.reload()
    } finally {
      setCreatingCategory(false)
    }
  }

  async function handleRenameCategory(id: string) {
    setErrorMessage(null)
    setCategoryBusy(id)
    try {
      const result = await renameFinanceCategory(id, categoryNameEdit)
      if (result.error) { setErrorMessage(result.error); return }
      setCategoryList(prev => prev.map(c => c.id === id ? { ...c, name: categoryNameEdit } : c))
      setEditingCategoryId(null)
    } finally {
      setCategoryBusy(null)
    }
  }

  async function handleDeleteCategory(id: string) {
    setErrorMessage(null)
    setCategoryBusy(id)
    try {
      const result = await deleteFinanceCategory(id)
      if (result.error) { setErrorMessage(result.error); return }
      setCategoryList(prev => prev.filter(c => c.id !== id))
    } finally {
      setCategoryBusy(null)
    }
  }
```

Replace every use of `categories` in the JSX P&L table (from Task 9, the `categories.find(c => c.id === row.id)?.autoSource` lookup) with `categoryList`, so category renames are reflected without a reload. Add a "Manage Categories" section, placed after the P&L table's closing `)}`:

```tsx
      <div>
        <button onClick={() => setManagingCategories(v => !v)} className="btn-secondary text-xs px-3 py-1.5">
          {managingCategories ? 'Done' : 'Manage Categories'}
        </button>
      </div>

      {managingCategories && (
        <div className="space-y-2 border border-brand-line rounded p-4">
          {categoryList.map(c => (
            <div key={c.id} className="bg-brand-tint border border-brand-line rounded p-3 flex items-center justify-between gap-4">
              {editingCategoryId === c.id ? (
                <div className="flex gap-2 flex-1">
                  <input className="input flex-1" value={categoryNameEdit} onChange={e => setCategoryNameEdit(e.target.value)} />
                  <button onClick={() => handleRenameCategory(c.id)} disabled={categoryBusy === c.id} className="btn-primary text-xs px-3 py-1.5">Save</button>
                  <button onClick={() => setEditingCategoryId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{c.name}</p>
                    <p className="text-brand-muted text-xs capitalize">{c.kind}{c.autoSource && ' · auto'}</p>
                  </div>
                  {!c.autoSource && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setEditingCategoryId(c.id); setCategoryNameEdit(c.name) }} className="btn-secondary text-xs px-3 py-1.5">Rename</button>
                      <button
                        onClick={() => handleDeleteCategory(c.id)}
                        disabled={categoryBusy === c.id}
                        className="text-xs px-3 py-1.5 border border-red-600 text-red-600 rounded font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition disabled:opacity-50"
                      >Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}

          <form onSubmit={handleCreateCategory} className="border border-brand-line rounded p-4 space-y-3">
            <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Category</p>
            <input
              placeholder="Category name" required className="input w-full"
              value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
            />
            <select value={newCategoryKind} onChange={e => setNewCategoryKind(e.target.value as 'income' | 'expense')} className="input w-full">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <button type="submit" disabled={creatingCategory} className="btn-primary text-sm w-full">
              {creatingCategory ? 'Creating…' : 'Create Category'}
            </button>
          </form>
        </div>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Build check**

Run: `npx next build`
Expected: compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/finances-admin.tsx
git commit -m "feat: add category management to Finances tab"
```

---

### Task 11: Manual entry logging

**Files:**
- Modify: `src/components/admin/finances-admin.tsx`

- [ ] **Step 1: Add entry logging form and list**

Add imports: `getFinanceEntries, createFinanceEntry, updateFinanceEntry, deleteFinanceEntry` to the existing action import, and `FinanceEntry` to the type import.

Add state:

```ts
  const [entries, setEntries] = useState<FinanceEntry[]>([])
  const [entryCategoryId, setEntryCategoryId] = useState('')
  const [entryAmount, setEntryAmount] = useState('')
  const [entryDate, setEntryDate] = useState('')
  const [entryNote, setEntryNote] = useState('')
  const [creatingEntry, setCreatingEntry] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [entryEdits, setEntryEdits] = useState<Record<string, { amount: string; date: string; note: string }>>({})
  const [entryBusy, setEntryBusy] = useState<string | null>(null)
```

Extend the existing P&L `useEffect` to also load entries (or add a second effect — a second effect is simpler since it doesn't complicate the existing P&L loading-state logic):

```ts
  useEffect(() => {
    if (!seasonId) { setEntries([]); return }
    getFinanceEntries(seasonId).then(setEntries)
  }, [seasonId])
```

Manual categories only, for the entry form's dropdown:

```ts
  const manualCategories = categoryList.filter(c => !c.autoSource)
```

Handlers:

```ts
  async function handleCreateEntry(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreatingEntry(true)
    try {
      const amountCents = Math.round(parseFloat(entryAmount) * 100)
      const result = await createFinanceEntry({ seasonId, categoryId: entryCategoryId, amountCents, entryDate, note: entryNote || undefined })
      if (result.error) { setErrorMessage(result.error); return }
      setEntryAmount(''); setEntryDate(''); setEntryNote('')
      const [refreshedEntries, refreshedPnl] = await Promise.all([getFinanceEntries(seasonId), getFinancePnL(seasonId)])
      setEntries(refreshedEntries)
      setPnl(refreshedPnl)
    } finally {
      setCreatingEntry(false)
    }
  }

  async function handleSaveEntryEdit(id: string) {
    const edit = entryEdits[id]
    if (!edit) return
    setErrorMessage(null)
    setEntryBusy(id)
    try {
      const amountCents = Math.round(parseFloat(edit.amount) * 100)
      const result = await updateFinanceEntry(id, { amountCents, entryDate: edit.date, note: edit.note || undefined })
      if (result.error) { setErrorMessage(result.error); return }
      const [refreshedEntries, refreshedPnl] = await Promise.all([getFinanceEntries(seasonId), getFinancePnL(seasonId)])
      setEntries(refreshedEntries)
      setPnl(refreshedPnl)
      setEditingEntryId(null)
    } finally {
      setEntryBusy(null)
    }
  }

  async function handleDeleteEntry(id: string) {
    setErrorMessage(null)
    setEntryBusy(id)
    try {
      const result = await deleteFinanceEntry(id)
      if (result.error) { setErrorMessage(result.error); return }
      const [refreshedEntries, refreshedPnl] = await Promise.all([getFinanceEntries(seasonId), getFinancePnL(seasonId)])
      setEntries(refreshedEntries)
      setPnl(refreshedPnl)
    } finally {
      setEntryBusy(null)
    }
  }
```

Add the form and list JSX after the category management block:

```tsx
      {selectedSeason && (
        <div className="space-y-3">
          <h3 className="font-heading text-sm uppercase tracking-wide text-brand-ink">Log Income / Expense</h3>
          <form onSubmit={handleCreateEntry} className="border border-brand-line rounded p-4 space-y-3">
            <select required value={entryCategoryId} onChange={e => setEntryCategoryId(e.target.value)} className="input w-full">
              <option value="" disabled>Select a category</option>
              <optgroup label="Income">
                {manualCategories.filter(c => c.kind === 'income').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
              <optgroup label="Expense">
                {manualCategories.filter(c => c.kind === 'expense').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </optgroup>
            </select>
            <div className="flex gap-2">
              <input type="number" step="0.01" placeholder="Amount" required className="input flex-1" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} />
              <input type="date" required className="input flex-1" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
            <input placeholder="Note (optional)" className="input w-full" value={entryNote} onChange={e => setEntryNote(e.target.value)} />
            <button type="submit" disabled={creatingEntry} className="btn-primary text-sm w-full">
              {creatingEntry ? 'Logging…' : 'Log Entry'}
            </button>
          </form>

          <div className="space-y-2">
            {entries.map(entry => (
              <div key={entry.id} className="bg-brand-tint border border-brand-line rounded p-3">
                {editingEntryId === entry.id ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input type="number" step="0.01" className="input flex-1" value={entryEdits[entry.id]?.amount ?? ''} onChange={e => setEntryEdits(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], amount: e.target.value } }))} />
                      <input type="date" className="input flex-1" value={entryEdits[entry.id]?.date ?? ''} onChange={e => setEntryEdits(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], date: e.target.value } }))} />
                    </div>
                    <input className="input w-full" value={entryEdits[entry.id]?.note ?? ''} onChange={e => setEntryEdits(prev => ({ ...prev, [entry.id]: { ...prev[entry.id], note: e.target.value } }))} />
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveEntryEdit(entry.id)} disabled={entryBusy === entry.id} className="btn-primary text-xs px-3 py-1.5">Save</button>
                      <button onClick={() => setEditingEntryId(null)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-brand-ink font-bold text-sm">{entry.categoryName} — {formatCents(entry.amountCents)}</p>
                      <p className="text-brand-muted text-xs">{entry.entryDate}{entry.note ? ` · ${entry.note}` : ''}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setEditingEntryId(entry.id); setEntryEdits(prev => ({ ...prev, [entry.id]: { amount: (entry.amountCents / 100).toFixed(2), date: entry.entryDate, note: entry.note ?? '' } })) }}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >Edit</button>
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={entryBusy === entry.id}
                        className="text-xs px-3 py-1.5 border border-red-600 text-red-600 rounded font-bold uppercase tracking-wider hover:bg-red-600 hover:text-white transition disabled:opacity-50"
                      >Delete</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 3: Build check**

Run: `npx next build`
Expected: compiles successfully

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/finances-admin.tsx
git commit -m "feat: add manual income/expense entry logging to Finances tab"
```

---

### Task 12: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors beyond the 3 pre-existing unrelated gallery test errors

- [ ] **Step 2: Lint**

Run: `npx eslint src/app/actions/finances.ts src/app/actions/__tests__/finances.test.ts src/components/admin/finances-admin.tsx src/components/admin/admin-dashboard.tsx src/app/admin/page.tsx src/lib/supabase/types.ts`
Expected: clean (or only pre-existing issues already present in `admin-dashboard.tsx`/`types.ts` before this change — check with `git stash` if anything shows up, same as done for the months-paid feature)

- [ ] **Step 3: Full test suite**

Run: `npx jest`
Expected: all suites pass

- [ ] **Step 4: Full build**

Run: `npm run build`
Expected: compiles successfully, `/admin` route listed

- [ ] **Step 5: Manual check reminder**

`/admin` requires authentication and can't be checked via a plain `curl` (confirmed in the months-paid feature work — it 307-redirects to `/login`). If a browser is available, log in and manually verify: the Finances tab appears, a season can be created, the P&L table shows all 8 seeded categories with correct auto/manual actuals, a budget can be set inline, a manual entry can be logged and appears in both the entries list and the P&L table's Actual column, and category rename/delete work (with auto-source categories correctly showing no rename/delete controls). If no browser is available, say so explicitly rather than claiming this was verified.

- [ ] **Step 6: Do not push without explicit confirmation**

This plan includes one production database migration (Task 1). Confirm with the user before running `supabase db push` in Task 1, and confirm again before `git push` once all 12 tasks are complete — consistent with this project's established practice of never pushing or applying production changes without a fresh explicit confirmation each time.
