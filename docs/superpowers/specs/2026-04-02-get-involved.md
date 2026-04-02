# Bocas Juniors FC — Get Involved Spec

**Date:** 2026-04-02
**Scope:** Add a sponsor section to the homepage, a "Get Involved" CTA, a hidden `/get-involved` form page, and an admin panel section to view and manage submissions. Submissions are saved to Supabase and trigger an email notification via Resend.

---

## Overview

Three related additions:

1. **Sponsor section on homepage** — hardcoded Bocas Dance Collective logo, replacing the current empty/hidden sponsors block.
2. **Get Involved CTA on homepage** — a section prompting visitors to support the club, linking to `/get-involved`.
3. **`/get-involved` page** — not linked in navigation. Full-page form collecting name, email, business/org name, interests (multi-select), and an optional message. On submit: saves to Supabase + sends an email to the admin via Resend.
4. **Admin panel section** — view all "Get Involved" submissions, mark as handled.

---

## Resend Setup (manual step — done once)

1. Create a free account at resend.com
2. Generate an API key
3. Add to `.env.local` and Vercel:
   ```
   RESEND_API_KEY=<key>
   ```
4. Install the package:
   ```bash
   npm install resend
   ```

The sender address used will be `onboarding@resend.dev` (works on free tier without domain verification). The recipient is `g.bell2010@gmail.com`.

---

## Data Model

**Migration:** `supabase/migrations/004_get_involved_submissions.sql`

```sql
create table get_involved_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  organisation text,
  interests text[] not null,
  message text,
  submitted_at timestamptz not null default now(),
  handled boolean not null default false
);
```

No RLS needed — the table is only accessed via service role (server actions bypass RLS).

**Types update:** After applying the migration, manually add to `src/lib/supabase/types.ts`:

In the `public.Tables` block, add:

```ts
get_involved_submissions: {
  Row: {
    id: string
    name: string
    email: string
    organisation: string | null
    interests: string[]
    message: string | null
    submitted_at: string
    handled: boolean
  }
  Insert: {
    id?: string
    name: string
    email: string
    organisation?: string | null
    interests: string[]
    message?: string | null
    submitted_at?: string
    handled?: boolean
  }
  Update: {
    id?: string
    name?: string
    email?: string
    organisation?: string | null
    interests?: string[]
    message?: string | null
    submitted_at?: string
    handled?: boolean
  }
  Relationships: []
}
```

Also add a convenience alias at the bottom of the file:

```ts
export type GetInvolvedSubmission = Database['public']['Tables']['get_involved_submissions']['Row']
```

---

## Homepage Changes

**File:** `src/app/page.tsx`

### Sponsor section

Replace the current dynamic sponsor block (lines 57–72, conditioned on `sponsors.length > 0`) with a hardcoded static block:

```tsx
{/* Sponsors */}
<section className="py-12 px-4 text-center bg-brand-surface">
  <h2 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Our Sponsors</h2>
  <div className="flex flex-wrap justify-center gap-8 items-center">
    {/* File is confirmed at public/bocas%20dance%20logo.png — filename includes a space */}
    <Image
      src="/bocas%20dance%20logo.png"
      alt="Bocas Dance Collective"
      width={120}
      height={64}
      className="h-16 w-auto object-contain"
    />
  </div>
</section>
```

Remove the `const sponsors: string[] = []` line, the `const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` line, and the comment on the line above them (`// Replace SPONSOR_1 etc. with actual Cloudinary public IDs after uploading sponsor logos`) — all are no longer needed.

### Get Involved CTA

After completing the sponsors replacement above, in source order insert immediately after the new sponsors `</section>` and before the WhatsApp `<a>` element (the WhatsApp button is `position: fixed` so it appears visually floating — insert before it in source, not visually). The existing "Ready to Join?" CTA section at the bottom of the page remains unchanged — both CTAs coexist.

```tsx
{/* Get Involved CTA */}
<section className="py-14 px-4 bg-brand-dark border-t border-brand-border text-center">
  <h2 className="font-heading text-white text-4xl uppercase tracking-wider mb-3">Get Involved</h2>
  <p className="text-white/60 mb-7 max-w-md mx-auto">
    Want to support Bocas Juniors FC? We&apos;re looking for sponsors, volunteers, and partners to help grow the club.
  </p>
  <Link href="/get-involved" className="btn-primary">Become a Supporter</Link>
</section>
```

---

## Get Involved Page

**File:** `src/app/get-involved/page.tsx` ← new

A server component. Not linked in the navigation. Layout consistent with rest of site.

```tsx
import { PageHeader } from '@/components/page-header'
import { GetInvolvedForm } from '@/components/get-involved/get-involved-form'

export default function GetInvolvedPage() {
  return (
    <main className="bg-brand-dark min-h-screen">
      <PageHeader
        title="Get Involved"
        subtitle="Support Bocas Juniors FC — on and off the pitch"
      />
      <div className="max-w-xl mx-auto px-4 py-10">
        <GetInvolvedForm />
      </div>
    </main>
  )
}
```

---

## GetInvolvedForm Component

**File:** `src/components/get-involved/get-involved-form.tsx` ← new

`'use client'` component. Holds all form state locally. Calls a server action on submit.

### Interest options (constant, in order)

```ts
const INTEREST_OPTIONS = [
  'Sponsoring the website',
  'Sponsoring the kit',
  'Helping on game days',
  'Donating equipment',
  'Becoming a volunteer',
  'Other',
]
```

### State

```ts
name: string          // required
email: string         // required
organisation: string  // optional
interests: string[]   // required, min length 1
message: string       // optional
status: 'idle' | 'submitting' | 'success' | 'error'
errorMessage: string | null
```

### Behaviour

- All fields are controlled inputs
- Interests are rendered as checkboxes; toggling adds/removes from `interests` array
- Submit button is disabled when:
  - `name` is empty
  - `email` is empty
  - `interests.length === 0`
  - `status === 'submitting'`
- On submit: set `status = 'submitting'`, call `submitGetInvolved(...)` server action
- On success (`error === null`): set `status = 'success'` — render thank-you message instead of form
- On error: set `status = 'error'`, set `errorMessage`, keep form editable

### Thank-you state

When `status === 'success'`, render:
```
"Thanks for getting in touch! We'll be in contact soon."
```
No redirect. No reset — the form is gone, replaced by the message.

### Styling

- Section label: `text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1`
- Inputs: `.input` class (existing global style)
- Textarea: `.input` class, `rows={4}`
- Checkbox label: `flex items-center gap-2 text-white/80 cursor-pointer`
- Checkbox: `accent-[#FF0055]` (brand-primary)
- Submit button: `.btn-primary w-full`
- Disabled submit: `opacity-50 cursor-not-allowed`
- Error message: `text-brand-primary text-sm mt-2`

---

## Server Action — submitGetInvolved

**File:** `src/app/actions/get-involved.ts` ← new

The file must start with `'use server'` as its first line. Full implementation:

```ts
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function submitGetInvolved({
  name,
  email,
  organisation,
  interests,
  message,
}: {
  name: string
  email: string
  organisation?: string
  interests: string[]
  message?: string
}): Promise<{ error: string | null }> {
  if (!name || !email || interests.length === 0) {
    return { error: 'Please fill in all required fields.' }
  }

  const supabase = createSupabaseServiceClient()
  const { error: dbError } = await supabase.from('get_involved_submissions').insert({
    name,
    email,
    organisation: organisation || null,
    interests,
    message: message || null,
  })
  if (dbError) return { error: dbError.message }

  try {
    const { error: emailError } = await resend.emails.send({
      from: 'Bocas Juniors FC <onboarding@resend.dev>',
      to: ['g.bell2010@gmail.com'],
      subject: `New Get Involved submission — ${name}`,
      text: `New Get Involved Submission\n\nName: ${name}\nEmail: ${email}\nOrganisation: ${organisation || 'N/A'}\nInterested in: ${interests.join(', ')}\nMessage: ${message || 'N/A'}`,
    })
    if (emailError) console.error('Resend error:', emailError)
  } catch (e) {
    console.error('Resend threw:', e)
  }

  return { error: null }
}
```

---

## Admin Panel — Get Involved Submissions

**File:** `src/components/admin/get-involved-submissions.tsx` ← new

The file must begin with `'use client'` as its first line.

Imports:
```ts
import { GetInvolvedSubmission } from '@/lib/supabase/types'
import { markSubmissionHandled } from '@/app/actions/admin'
```

Client component. Receives `submissions: GetInvolvedSubmission[]` as prop.

Component state:
```ts
items: GetInvolvedSubmission[]     // initialised from submissions prop
processing: Set<string>            // IDs currently awaiting markSubmissionHandled
errorMessage: string | null        // error from last failed markSubmissionHandled call
```

Renders nothing when `items.length === 0`.

Section heading: `"Get Involved Submissions (N unhandled)"` — N counts items where `handled === false`. `text-lg font-semibold mb-3`.

For each submission:
- Name + email (email as `mailto:` link, `text-brand-cyan`)
- Organisation (if present), prefixed with a subtle label
- Interests displayed as small inline badges: `bg-brand-border text-white/70 rounded px-2 py-0.5 text-xs`
- Message (if present)
- Date formatted as `DD MMM YYYY`
- **Mark as Handled** button (`.btn-secondary` small) — calls `markSubmissionHandled(id)` server action; on success, updates `items` to set that item's `handled = true` (does NOT remove from list). Handled rows are displayed dimmed: `opacity-40`.
- Handled rows show "Handled" text instead of the button.

In-flight guard: track `processing: Set<string>` in `useState`. Because mutating a `Set` does not trigger a re-render, always replace state with a new `Set` copy:
```ts
setProcessing(prev => new Set(prev).add(id))     // add
setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })  // remove
```

Date formatting: use `new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(submitted_at))` — no date library needed.

The **Mark as Handled** button is also disabled while the ID is in the `processing` set (in addition to being disabled when the row is already handled).

Error handling: wrap the `markSubmissionHandled` call in try/catch/finally. Reset `errorMessage` to `null` at the start of each handler invocation. In the catch block, extract the message with `e instanceof Error ? e.message : 'Something went wrong'` and set it into an `errorMessage: string | null` state. In the `finally` block, always remove the ID from `processing` (so the button is never permanently disabled after an error). Render the error message as a `text-brand-primary text-sm` paragraph at the top of the submissions list (above all rows).

---

## Admin Actions

**File:** `src/app/actions/admin.ts` — add two new functions

**Prerequisite:** Complete the `src/lib/supabase/types.ts` update first — `GetInvolvedSubmission` must exist before this file can compile.

Add `GetInvolvedSubmission` to the **existing** `import type { ... } from '@/lib/supabase/types'` line at the top of the file — do not add a second import.

Note: `getGetInvolvedSubmissions` throws on DB error (intentionally different from other admin fetch functions that return `[]`). This causes the entire admin page `Promise.all` to reject on DB failure, which Next.js surfaces as an error boundary — acceptable for an internal admin tool.

```ts
export async function getGetInvolvedSubmissions(): Promise<GetInvolvedSubmission[]> {
  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('get_involved_submissions')
    .select('*')
    .order('submitted_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function markSubmissionHandled(id: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('get_involved_submissions')
    .update({ handled: true })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
```

---

## Admin Page

**File:** `src/app/admin/page.tsx`

Add these imports:
```ts
import { GetInvolvedSubmissions } from '@/components/admin/get-involved-submissions'
// and add getGetInvolvedSubmissions to the existing actions import line
import { getPendingPayments, getAllPlayers, getTotalRevenue, getPendingSubmissions, getGetInvolvedSubmissions } from '@/app/actions/admin'
```

Update the `Promise.all` destructuring to add `getGetInvolvedSubmissions()` as the **last** entry:
```ts
const [players, pendingPayments, totalRevenueCents, pendingSubmissions, getInvolvedSubmissions] = await Promise.all([
  getAllPlayers(),
  getPendingPayments(),
  getTotalRevenue(),
  getPendingSubmissions(),
  getGetInvolvedSubmissions(),
])
```

Place `<GetInvolvedSubmissions submissions={getInvolvedSubmissions} />` immediately after the header `<div>` (the one containing the `<h1>` and total revenue) and before `<PendingPayments>`. The final render order of the `<main>` body:

1. Header `<div>` (existing — h1 + revenue)
2. `<GetInvolvedSubmissions submissions={getInvolvedSubmissions} />` ← new
3. `<PendingPayments payments={...} />`
4. Players `<section>` with `<PlayersTable>`
5. `<PendingSubmissions submissions={...} />`
6. Upload Media `<section>` with `<MediaUploader>`

---

## Files Touched (complete list)

- `supabase/migrations/004_get_involved_submissions.sql` ← new
- `src/lib/supabase/types.ts` — add table block + `GetInvolvedSubmission` alias
- `src/app/actions/get-involved.ts` ← new
- `src/app/actions/admin.ts` — add `getGetInvolvedSubmissions`, `markSubmissionHandled`; import `GetInvolvedSubmission`
- `src/app/page.tsx` — replace sponsors block; add Get Involved CTA section; remove unused vars
- `src/app/get-involved/page.tsx` ← new
- `src/components/get-involved/get-involved-form.tsx` ← new
- `src/components/admin/get-involved-submissions.tsx` ← new
- `src/app/admin/page.tsx` — add fetch + render `GetInvolvedSubmissions`

---

## Out of Scope

- Navigation link to `/get-involved` (intentionally hidden)
- Rate limiting on form submissions
- Spam protection / CAPTCHA
- Deleting submissions from admin
- Email replies to submitters
- Resend domain verification (using `onboarding@resend.dev` on free tier)
