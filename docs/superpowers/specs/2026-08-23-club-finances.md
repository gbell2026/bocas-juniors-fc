# Club Finances (P&L) — Design Spec

**Date:** 2026-08-23
**Status:** Approved

## Background

The admin has no way to track club-wide finances. Registration fees and monthly/season subscription payments already exist as rows in the `payments` table, but there's no view of overall income vs. expenses, and no way to log the club's other income (sponsorship) or any expenses at all (wages, equipment, travel). This is the second of two features requested together; the first (a per-player months-paid visual) has already shipped.

## Scope

**This build:**
- A new "Finances" tab in `/admin`, admin-only (matching every other admin tab — no coach access)
- Seasons you define yourself (label + date range), used to scope everything else
- A fixed-but-editable list of income/expense categories, two of which (Registration Fees, Subscriptions) are auto-computed from existing `payments` rows; the rest are manually logged
- Manual entry logging for income (Sponsorship, Other Income) and expenses (Wages, Equipment, Travel, Other Expense)
- One budget target per category per season, compared against actuals (Budget / Actual / Variance)
- A P&L table: Income categories, Expense categories, then Total Income / Total Expenses / Net, each with Budget / Actual / Variance

**Explicitly out of scope:**
- Recurring/scheduled expenses (e.g. auto-generating a monthly wage entry) — confirmed with the user, manual logging only
- Monthly-granularity budgets — one target per category per season is enough
- Receipts/attachments on entries
- Tying seasons to the existing `league_divisions` season dates — finances seasons are their own independent concept, since club finances (e.g. wages) run outside league scheduling
- Any reporting/export beyond the on-page P&L table (no CSV export, no charts)

## Data model

New migration `supabase/migrations/019_club_finances.sql`. Follows the existing `staff_members` pattern: RLS enabled with a `using (false)` policy on every table, since all access goes through the service-role client in server actions — never direct client-side Supabase queries.

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
  -- 'registration' and 'subscription' are computed from the payments table;
  -- everything else is manually logged via finance_entries. No other value
  -- is valid here — this isn't a general-purpose enum, just a marker for
  -- the two categories with a live data source.
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

`category_id` uses `on delete restrict` rather than `cascade` — a category with logged entries or a budget against it can't be deleted out from under that history. The category management UI enforces the friendlier version of this same rule (see UI section) so the admin gets a clear message instead of a raw database error, but the constraint is the actual backstop.

## Auto-computed categories

For a category with `auto_source = 'registration'`, its actual for a season is the sum of `payments.amount` where `status = 'succeeded'`, `installment_label = 'registration'`, and `paid_at` falls within `[season.start_date, season.end_date]`. For `auto_source = 'subscription'`, same query but `installment_label in ('full', 'august', 'september', 'october', 'november')` — every label that represents the season fee, whether paid as one lump sum or per month.

These two categories have no `finance_entries` rows and aren't editable through the manual-entry form — the UI shows their actual as read-only, computed live each time the Finances tab loads. A budget target can still be set for them, same as any other category.

## Server actions

New file `src/app/actions/finances.ts`, following this codebase's existing `'use server'` action-file-per-domain convention (mirrors `staff.ts`, `announcements.ts`):

- `getFinanceSeasons()` — list all seasons, newest first
- `createFinanceSeason({ label, startDate, endDate })` / `updateFinanceSeason(id, { label, startDate, endDate })`
- `getFinanceCategories()` — list all categories
- `createFinanceCategory({ name, kind })` — always `auto_source: null`; only the two seeded auto-categories ever have one
- `renameFinanceCategory(id, name)`
- `deleteFinanceCategory(id)` — returns `{ error }` if the category has any `finance_entries` or a `finance_budgets` row, mirroring the `deletePlayer` guard-with-friendly-error pattern already established in `src/app/actions/admin.ts`
- `getFinanceEntries(seasonId)` — manual entries for a season, joined with category name
- `createFinanceEntry({ seasonId, categoryId, amountCents, entryDate, note })` — rejects if the target category is an auto-source category
- `updateFinanceEntry(id, { amountCents, entryDate, note })` / `deleteFinanceEntry(id)`
- `getFinanceBudgets(seasonId)` — budget rows for a season
- `setFinanceBudget({ seasonId, categoryId, targetAmountCents })` — upsert on the `(season_id, category_id)` unique constraint
- `getFinancePnL(seasonId)` — the single call the Finances tab's main view uses. Returns every category with `{ id, name, kind, budgetCents, actualCents }`, computing auto-category actuals via the payments query above and manual-category actuals by summing that category's `finance_entries` for the season. The P&L table and its totals are derived client-side from this one payload — no separate totals endpoint.

## UI

New tab in `admin-dashboard.tsx`'s `TABS` array: `{ key: 'finances', label: 'Finances' }`. New component `src/components/admin/finances-admin.tsx`.

**Season picker**: a `<select>` of existing seasons, defaulting to whichever season's date range contains today, falling back to the most recently created one if none match (or an empty state prompting "Create a season to get started" if there are none yet). A collapsible "Manage Seasons" area below it, reusing the League Divisions create/edit form shape (label + two date inputs, inline edit-in-place per existing season) — this is the same shape as `league-divisions.tsx`, just relabeled.

**P&L table**: for the selected season, one row per category (Income categories first, then Expense categories), columns Budget | Actual | Variance (`actual - budget`, styled green when ≥ 0 and the club's favor — i.e. positive for income categories, negative-or-zero for expense categories — red otherwise). A totals section below: Total Income, Total Expenses, Net (Income − Expense), each with its own Budget/Actual/Variance, budget totals being the sum of each side's category budgets.

**Budget editing**: each row's Budget cell is an inline-editable number input (dollars, converted to cents on save), same interaction shape as other inline-editable admin fields in this codebase — click to edit, save button, no separate "budget page."

**Manual entry logging**: a form below the table — category `<select>` (manual categories only, grouped Income/Expense), amount, date, note — plus a list of that season's manual entries underneath (date, category, amount, note, edit/delete), reusing the list-with-inline-edit-and-delete shape from `league-divisions.tsx` / `staff-admin.tsx`.

**Category management**: a small collapsible section to add a new category (name + kind) or rename an existing manual category. Auto-source categories (Registration Fees, Subscriptions) can't be renamed or deleted — the UI simply doesn't show those controls for them, rather than showing a disabled button.

No i18n — confirmed no existing `/admin` component uses `useLocale()`/`t.*`; this codebase's admin section is English-only internal tooling, and Finances follows that same convention.

## Testing

- `finance-schedule`-equivalent pure logic (variance calculation, auto-actual date-range filtering) covered with unit tests, following the existing `payment-schedule.test.ts` style — no Supabase mocking needed for pure functions.
- `src/app/actions/__tests__/finances.test.ts` for the new server actions, mocking `createSupabaseServiceClient` following the exact pattern in `admin.test.ts`.
- No component tests for `finances-admin.tsx`, consistent with the rest of `/admin` (none of `players-table.tsx`, `league-divisions.tsx`, `staff-admin.tsx`, etc. have component tests in this codebase — only the manual `getMonthlyStatus`-style pure logic and server actions get automated coverage there).
