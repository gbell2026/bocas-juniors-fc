# Get Involved Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sponsor section and "Get Involved" CTA to the homepage, a `/get-involved` form page that saves submissions to Supabase and sends email via Resend, and an admin panel section to view and manage submissions.

**Architecture:** The homepage gets two new static sections (sponsors + CTA). A new `/get-involved` page renders a client form component that calls a server action to insert into a `get_involved_submissions` table and send a notification email via Resend. The admin panel gains a `GetInvolvedSubmissions` component to view and mark submissions as handled.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (service role), Resend (email), React Testing Library + Jest

---

## Chunk 1: Foundation

### Task 1: Install Resend + database migration + types update

**Files:**
- Create: `supabase/migrations/004_get_involved_submissions.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Install the Resend package**

```bash
npm install resend
```

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/004_get_involved_submissions.sql`:

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

- [ ] **Step 3: Apply the migration in Supabase dashboard (MANUAL GATE — requires human)**

This step cannot be done by an agent. A human must: go to Supabase project SQL Editor, paste and run the SQL above. Verify the new table appears in Table Editor. The agent should skip this step and continue — the migration file is committed for the human to apply.

- [ ] **Step 4: Add the `get_involved_submissions` table block to `src/lib/supabase/types.ts`**

In the `public.Tables` block (after the `media` table block ending at line 77 and before `parents` at line 78), insert:

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

- [ ] **Step 5: Add the convenience type alias**

At the bottom of `src/lib/supabase/types.ts`, after line 397 (`export type UserRole = ...`), add:

```ts
export type GetInvolvedSubmission = Database['public']['Tables']['get_involved_submissions']['Row']
```

- [ ] **Step 6: Run the test suite to confirm no type errors**

```bash
npx jest --passWithNoTests
```

Expected: all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/004_get_involved_submissions.sql src/lib/supabase/types.ts package.json package-lock.json
git commit -m "feat: add get_involved_submissions table, types, and resend package"
```

---

### Task 2: `submitGetInvolved` server action

**Files:**
- Create: `src/app/actions/get-involved.ts`
- Test: `src/__tests__/actions/get-involved.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/actions/get-involved.test.ts`:

```ts
import { submitGetInvolved } from '@/app/actions/get-involved'

describe('submitGetInvolved', () => {
  it('is exported as a function', () => {
    expect(typeof submitGetInvolved).toBe('function')
  })

  it('returns error when required fields are missing', async () => {
    const result = await submitGetInvolved({
      name: '',
      email: 'test@test.com',
      interests: ['Sponsoring the kit'],
    })
    expect(result).toEqual({ error: 'Please fill in all required fields.' })
  })

  it('returns error when interests array is empty', async () => {
    const result = await submitGetInvolved({
      name: 'Jane',
      email: 'jane@test.com',
      interests: [],
    })
    expect(result).toEqual({ error: 'Please fill in all required fields.' })
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest get-involved --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/app/actions/get-involved'`

- [ ] **Step 3: Create `src/app/actions/get-involved.ts`**

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

- [ ] **Step 4: Run to verify PASS**

```bash
npx jest get-involved
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/get-involved.ts src/__tests__/actions/get-involved.test.ts
git commit -m "feat: add submitGetInvolved server action with Resend email"
```

---

## Chunk 2: Homepage Changes

### Task 3: Replace sponsors block + add Get Involved CTA on homepage

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the sponsors section and add the Get Involved CTA**

In `src/app/page.tsx`:

1. Remove line 4 (`// Replace SPONSOR_1 etc...` comment)
2. Remove line 5 (`const sponsors: string[] = []`)
3. Remove line 8 (`const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`)
4. Replace the entire sponsors block (lines 57–72) with the hardcoded sponsor section + Get Involved CTA:

```tsx
{/* Sponsors */}
<section className="py-12 px-4 text-center bg-brand-surface">
  <h2 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Our Sponsors</h2>
  <div className="flex flex-wrap justify-center gap-8 items-center">
    <Image
      src="/bocas%20dance%20logo.png"
      alt="Bocas Dance Collective"
      width={120}
      height={64}
      className="h-16 w-auto object-contain"
    />
  </div>
</section>

{/* Get Involved CTA */}
<section className="py-14 px-4 bg-brand-dark border-t border-brand-border text-center">
  <h2 className="font-heading text-white text-4xl uppercase tracking-wider mb-3">Get Involved</h2>
  <p className="text-white/60 mb-7 max-w-md mx-auto">
    Want to support Bocas Juniors FC? We&apos;re looking for sponsors, volunteers, and partners to help grow the club.
  </p>
  <Link href="/get-involved" className="btn-primary">Become a Supporter</Link>
</section>
```

The full updated `src/app/page.tsx` should be:

```tsx
import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative min-h-[500px] flex items-center justify-center text-center overflow-hidden">
        <Image
          src="/beach-hero.jpg"
          alt="Bocas Juniors FC training on the beach"
          fill
          className="object-cover"
          style={{ objectPosition: 'center 35%' }}
          priority
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(8,4,24,0.38) 0%, rgba(8,4,24,0.52) 50%, rgba(8,4,24,0.82) 100%)',
          }}
        />
        <div className="relative flex flex-col items-center px-6 py-16">
          <Image
            src="/logo.png"
            width={120}
            height={120}
            alt="Bocas Juniors FC"
            className="mb-5 drop-shadow-2xl"
          />
          <h1
            className="font-heading text-white uppercase tracking-widest"
            style={{ fontSize: '4.5rem', lineHeight: 1 }}
          >
            Bocas Juniors FC
          </h1>
          <p className="text-brand-cyan font-bold uppercase tracking-[0.3em] text-xs mt-3">
            Youth Football · Bocas del Toro, Panama
          </p>
          <div className="flex gap-4 mt-7 flex-wrap justify-center">
            <Link href="/register" className="btn-primary">
              Register Your Child
            </Link>
            <Link href="/gallery" className="btn-secondary">
              View Gallery
            </Link>
          </div>
        </div>
      </section>

      {/* Sponsors */}
      <section className="py-12 px-4 text-center bg-brand-surface">
        <h2 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Our Sponsors</h2>
        <div className="flex flex-wrap justify-center gap-8 items-center">
          <Image
            src="/bocas%20dance%20logo.png"
            alt="Bocas Dance Collective"
            width={120}
            height={64}
            className="h-16 w-auto object-contain"
          />
        </div>
      </section>

      {/* Get Involved CTA */}
      <section className="py-14 px-4 bg-brand-dark border-t border-brand-border text-center">
        <h2 className="font-heading text-white text-4xl uppercase tracking-wider mb-3">Get Involved</h2>
        <p className="text-white/60 mb-7 max-w-md mx-auto">
          Want to support Bocas Juniors FC? We&apos;re looking for sponsors, volunteers, and partners to help grow the club.
        </p>
        <Link href="/get-involved" className="btn-primary">Become a Supporter</Link>
      </section>

      {/* WhatsApp floating button */}
      <a
        href="https://wa.me/447462557960"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact us on WhatsApp"
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:scale-110 transition"
        style={{ background: '#25D366' }}
      >
        <svg viewBox="0 0 24 24" fill="white" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* CTA */}
      <section className="py-14 px-4 bg-brand-surface border-t-[3px] border-brand-cyan text-center">
        <h2 className="font-heading text-white text-4xl uppercase tracking-wider mb-3">Ready to Join?</h2>
        <p className="text-white/60 mb-7">Register your child and pay the membership fee online.</p>
        <Link href="/register" className="btn-primary">Register Now</Link>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Run the test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 3: Verify in dev server**

```bash
npm run dev
```

Visit `http://localhost:3000`. Confirm:
- Bocas Dance Collective logo appears in a "Our Sponsors" section
- "Get Involved" section appears below sponsors with "Become a Supporter" button
- Button links to `/get-involved` (page will 404 for now — that's expected)
- "Ready to Join?" CTA still appears at the bottom
- WhatsApp button still floats in bottom-right

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add sponsors section and Get Involved CTA to homepage"
```

---

## Chunk 3: Get Involved Page + Form

### Task 4: GetInvolvedForm component

**Files:**
- Create: `src/components/get-involved/get-involved-form.tsx`
- Test: `src/__tests__/components/get-involved-form.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/get-involved-form.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GetInvolvedForm } from '@/components/get-involved/get-involved-form'

jest.mock('@/app/actions/get-involved', () => ({
  submitGetInvolved: jest.fn().mockResolvedValue({ error: null }),
}))

describe('GetInvolvedForm', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders all form fields', () => {
    render(<GetInvolvedForm />)
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/business/i)).toBeInTheDocument()
    expect(screen.getByText(/sponsoring the website/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/anything else/i)).toBeInTheDocument()
  })

  it('submit button is disabled when required fields are empty', () => {
    render(<GetInvolvedForm />)
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('submit button is enabled when name, email, and at least one interest are filled', () => {
    render(<GetInvolvedForm />)
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'jane@test.com' } })
    fireEvent.click(screen.getByText(/sponsoring the website/i))
    expect(screen.getByRole('button', { name: /send/i })).toBeEnabled()
  })

  it('shows thank-you message on successful submit', async () => {
    const { submitGetInvolved } = require('@/app/actions/get-involved')
    submitGetInvolved.mockResolvedValue({ error: null })

    render(<GetInvolvedForm />)
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'jane@test.com' } })
    fireEvent.click(screen.getByText(/sponsoring the website/i))
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText(/thanks for getting in touch/i)).toBeInTheDocument()
    })
  })

  it('shows error message on failed submit', async () => {
    const { submitGetInvolved } = require('@/app/actions/get-involved')
    submitGetInvolved.mockResolvedValue({ error: 'Something went wrong' })

    render(<GetInvolvedForm />)
    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: 'Jane' } })
    fireEvent.change(screen.getByPlaceholderText(/email/i), { target: { value: 'jane@test.com' } })
    fireEvent.click(screen.getByText(/sponsoring the website/i))
    fireEvent.click(screen.getByRole('button', { name: /send/i }))

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest get-involved-form --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/components/get-involved/get-involved-form'`

- [ ] **Step 3: Create `src/components/get-involved/get-involved-form.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { submitGetInvolved } from '@/app/actions/get-involved'

const INTEREST_OPTIONS = [
  'Sponsoring the website',
  'Sponsoring the kit',
  'Helping on game days',
  'Donating equipment',
  'Becoming a volunteer',
  'Other',
]

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function GetInvolvedForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function toggleInterest(option: string) {
    setInterests(prev =>
      prev.includes(option) ? prev.filter(i => i !== option) : [...prev, option]
    )
  }

  const canSubmit = name.trim() !== '' && email.trim() !== '' && interests.length > 0 && status !== 'submitting'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setErrorMessage(null)

    const { error } = await submitGetInvolved({
      name: name.trim(),
      email: email.trim(),
      organisation: organisation.trim() || undefined,
      interests,
      message: message.trim() || undefined,
    })

    if (error) {
      setStatus('error')
      setErrorMessage(error)
    } else {
      setStatus('success')
    }
  }

  if (status === 'success') {
    return (
      <div className="text-center py-12">
        <p className="text-white font-bold text-lg mb-2">Thanks for getting in touch!</p>
        <p className="text-white/50 text-sm">We&apos;ll be in contact soon.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && <p className="text-brand-primary text-sm">{errorMessage}</p>}

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Name *
        </label>
        <input
          className="input w-full"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Email *
        </label>
        <input
          className="input w-full"
          type="email"
          placeholder="Email address"
          value={email}
          onChange={e => setEmail(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Business / Organisation
        </label>
        <input
          className="input w-full"
          placeholder="Business or organisation name (optional)"
          value={organisation}
          onChange={e => setOrganisation(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          I&apos;m interested in... *
        </label>
        <div className="space-y-2 mt-2">
          {INTEREST_OPTIONS.map(option => (
            <label key={option} className="flex items-center gap-2 text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={interests.includes(option)}
                onChange={() => toggleInterest(option)}
                className="accent-[#FF0055]"
                disabled={status === 'submitting'}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
          Message
        </label>
        <textarea
          className="input w-full"
          rows={4}
          placeholder="Anything else you'd like us to know? (optional)"
          value={message}
          onChange={e => setMessage(e.target.value)}
          disabled={status === 'submitting'}
        />
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {status === 'submitting' ? 'Sending...' : 'Send'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
npx jest get-involved-form
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/get-involved/get-involved-form.tsx src/__tests__/components/get-involved-form.test.tsx
git commit -m "feat: add GetInvolvedForm component"
```

---

### Task 5: `/get-involved` page

**Files:**
- Create: `src/app/get-involved/page.tsx`

- [ ] **Step 1: Create `src/app/get-involved/page.tsx`**

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

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 3: Verify in dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/get-involved`. Confirm:
- PageHeader shows "Get Involved" title and subtitle
- Form renders with name, email, organisation fields
- Six interest checkboxes are visible
- Message textarea is present
- "Send" button is disabled until name, email, and at least one interest are filled
- After filling required fields and clicking Send, the form submits (will fail DB in dev without migration — that's expected; confirm the UI flow works)

- [ ] **Step 4: Commit**

```bash
git add src/app/get-involved/page.tsx
git commit -m "feat: add /get-involved page"
```

---

## Chunk 4: Admin Panel

### Task 6: Admin server actions for Get Involved submissions

**Files:**
- Modify: `src/app/actions/admin.ts`

- [ ] **Step 1: Update the import line at the top of `src/app/actions/admin.ts`**

Change line 3 from:

```ts
import type { PlayerStatus, Media } from '@/lib/supabase/types'
```

to:

```ts
import type { PlayerStatus, Media, GetInvolvedSubmission } from '@/lib/supabase/types'
```

- [ ] **Step 2: Add the two new actions at the end of `src/app/actions/admin.ts`**

Append after line 103 (after the closing `}` of `rejectSubmission`):

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

- [ ] **Step 3: Run test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/admin.ts
git commit -m "feat: add getGetInvolvedSubmissions and markSubmissionHandled actions"
```

---

### Task 7: GetInvolvedSubmissions admin component

**Files:**
- Create: `src/components/admin/get-involved-submissions.tsx`
- Test: `src/__tests__/components/get-involved-submissions.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/get-involved-submissions.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GetInvolvedSubmissions } from '@/components/admin/get-involved-submissions'
import * as actions from '@/app/actions/admin'
import type { GetInvolvedSubmission } from '@/lib/supabase/types'

jest.mock('@/app/actions/admin', () => ({
  markSubmissionHandled: jest.fn().mockResolvedValue(undefined),
}))

const submission: GetInvolvedSubmission = {
  id: '1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  organisation: 'Acme Corp',
  interests: ['Sponsoring the kit', 'Donating equipment'],
  message: 'Happy to help!',
  submitted_at: '2026-04-05T10:00:00Z',
  handled: false,
}

describe('GetInvolvedSubmissions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when there are no submissions', () => {
    const { container } = render(<GetInvolvedSubmissions submissions={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the heading with unhandled count', () => {
    render(<GetInvolvedSubmissions submissions={[submission]} />)
    expect(screen.getByText(/get involved submissions \(1 unhandled\)/i)).toBeInTheDocument()
  })

  it('shows submission details', () => {
    render(<GetInvolvedSubmissions submissions={[submission]} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('Sponsoring the kit')).toBeInTheDocument()
    expect(screen.getByText('Donating equipment')).toBeInTheDocument()
    expect(screen.getByText('Happy to help!')).toBeInTheDocument()
  })

  it('calls markSubmissionHandled and dims row on Mark as Handled click', async () => {
    render(<GetInvolvedSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /mark as handled/i }))
    await waitFor(() => {
      expect(actions.markSubmissionHandled).toHaveBeenCalledWith('1')
      expect(screen.getByText('Handled')).toBeInTheDocument()
    })
  })

  it('shows Handled text instead of button for already-handled submissions', () => {
    render(<GetInvolvedSubmissions submissions={[{ ...submission, handled: true }]} />)
    expect(screen.queryByRole('button', { name: /mark as handled/i })).not.toBeInTheDocument()
    expect(screen.getByText('Handled')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest get-involved-submissions --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/components/admin/get-involved-submissions'`

- [ ] **Step 3: Create `src/components/admin/get-involved-submissions.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { GetInvolvedSubmission } from '@/lib/supabase/types'
import { markSubmissionHandled } from '@/app/actions/admin'

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function GetInvolvedSubmissions({ submissions: initial }: { submissions: GetInvolvedSubmission[] }) {
  const [items, setItems] = useState(initial)
  const [processing, setProcessing] = useState<Set<string>>(new Set())
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  if (items.length === 0) return null

  const unhandledCount = items.filter(s => !s.handled).length

  async function handleMarkHandled(id: string) {
    setErrorMessage(null)
    setProcessing(prev => new Set(prev).add(id))
    try {
      await markSubmissionHandled(id)
      setItems(prev => prev.map(s => s.id === id ? { ...s, handled: true } : s))
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setProcessing(prev => { const s = new Set(prev); s.delete(id); return s })
    }
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Get Involved Submissions ({unhandledCount} unhandled)</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className={`bg-brand-surface border border-brand-border rounded p-4 ${item.handled ? 'opacity-40' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">{item.name}</p>
                <a href={`mailto:${item.email}`} className="text-brand-cyan text-xs">{item.email}</a>
                {item.organisation && (
                  <p className="text-white/50 text-xs mt-0.5">
                    <span className="text-white/30">Org:</span> {item.organisation}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.interests.map(interest => (
                    <span key={interest} className="bg-brand-border text-white/70 rounded px-2 py-0.5 text-xs">
                      {interest}
                    </span>
                  ))}
                </div>
                {item.message && <p className="text-white/60 text-xs mt-2">{item.message}</p>}
                <p className="text-white/30 text-xs mt-1">{formatDate(item.submitted_at)}</p>
              </div>
              <div className="flex-shrink-0">
                {item.handled ? (
                  <span className="text-white/40 text-xs font-bold uppercase">Handled</span>
                ) : (
                  <button
                    onClick={() => handleMarkHandled(item.id)}
                    disabled={processing.has(item.id)}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    Mark as Handled
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
npx jest get-involved-submissions
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/get-involved-submissions.tsx src/__tests__/components/get-involved-submissions.test.tsx
git commit -m "feat: add GetInvolvedSubmissions admin component"
```

---

### Task 8: Wire GetInvolvedSubmissions into admin page

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Update `src/app/admin/page.tsx`**

Replace the full file content:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlayersTable } from '@/components/admin/players-table'
import { PendingPayments } from '@/components/admin/pending-payments'
import { MediaUploader } from '@/components/admin/media-uploader'
import { PendingSubmissions } from '@/components/admin/pending-submissions'
import { GetInvolvedSubmissions } from '@/components/admin/get-involved-submissions'
import { getPendingPayments, getAllPlayers, getTotalRevenue, getPendingSubmissions, getGetInvolvedSubmissions } from '@/app/actions/admin'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [players, pendingPayments, totalRevenueCents, pendingSubmissions, getInvolvedSubmissions] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
    getPendingSubmissions(),
    getGetInvolvedSubmissions(),
  ])

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>

      <GetInvolvedSubmissions submissions={getInvolvedSubmissions} />

      <PendingPayments payments={pendingPayments as any} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
        <PlayersTable players={players as any} />
      </section>

      <PendingSubmissions submissions={pendingSubmissions} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Upload Media</h2>
        <MediaUploader uploadedBy={user.id} />
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 3: Verify end-to-end in dev server**

```bash
npm run dev
```

1. Visit `http://localhost:3000` — confirm sponsors section and "Get Involved" CTA appear
2. Click "Become a Supporter" — confirm `/get-involved` page loads with form
3. Fill in the form and submit (requires migration applied to Supabase)
4. Visit `http://localhost:3000/admin` (logged in) — confirm "Get Involved Submissions" section appears at top
5. Click "Mark as Handled" on a submission — confirm it dims and shows "Handled"

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: wire GetInvolvedSubmissions into admin page"
```

---

## Final Step: Push to Vercel

- [ ] **Push to origin main**

```bash
git push origin main
```

Confirm the Vercel build succeeds. Before deploying, ensure:
- `RESEND_API_KEY` is set in Vercel environment variables
- The migration has been applied to the production Supabase instance
