# Announcements & Staff Bios Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two independent public content sections: an Announcements board (admin posts, logged-in parents comment) and a Staff Bios ("Our Team") page (admin manages coach/staff profiles with photos).

**Architecture:** Two new Postgres table groups (`announcements`/`announcement_comments`, and `staff_members`), each with RLS enabled and a deny-all policy — all access goes through `'use server'` actions using the service-role client, matching the established pattern from the League feature. Comment-posting introduces one new pattern for this codebase: a server action that uses the session-aware `createSupabaseServerClient()` to authenticate the caller, then the service-role client for the actual read/write.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Postgres + service-role and session-aware server actions), Jest + React Testing Library, Tailwind CSS. Same stack as the rest of this site.

---

## Chunk 1: Schema

### Task 1: Migration — announcements schema

**Files:**
- Create: `supabase/migrations/008_announcements.sql`

- [ ] **Step 1: Write the migration**

```sql
create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Denormalized from the commenter's `parents` record at post time so the
  -- comment list doesn't need a join back to `parents` on every read. If a
  -- commenting user somehow has no parents row, the server action falls
  -- back to a generic label rather than failing the comment — this is a
  -- display nicety, not a security boundary.
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index announcement_comments_announcement_id_idx on announcement_comments(announcement_id);

-- RLS: same "deny-all, service-role only" pattern as the League feature.
-- Every read/write goes through a 'use server' action using the
-- service-role client — comment authorship is verified server-side via a
-- session-aware client before the service-role client ever writes.
alter table announcements enable row level security;
alter table announcement_comments enable row level security;

create policy "no_direct_access" on announcements using (false);
create policy "no_direct_access" on announcement_comments using (false);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push --yes` (the Supabase CLI should already be linked to the project from prior work on this repo).
Expected: migration `008_announcements.sql` applies cleanly with no errors.

- [ ] **Step 3: Verify**

Run: `npx supabase db push --dry-run` — expect "Remote database is up to date."

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_announcements.sql
git commit -m "feat: add announcements and announcement_comments schema"
```

---

### Task 2: Migration — staff_members schema

**Files:**
- Create: `supabase/migrations/009_staff_members.sql`

- [ ] **Step 1: Write the migration**

```sql
create table staff_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role_title text not null,
  bio text not null,
  -- Stored as a Cloudinary public ID, matching the existing
  -- media.cloudinary_public_id / league_clubs.badge_cloudinary_public_id
  -- convention — never a full URL.
  photo_cloudinary_public_id text,
  created_at timestamptz not null default now()
);

alter table staff_members enable row level security;
create policy "no_direct_access" on staff_members using (false);
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push --yes`
Expected: migration `009_staff_members.sql` applies cleanly with no errors.

- [ ] **Step 3: Verify**

Run: `npx supabase db push --dry-run` — expect "Remote database is up to date."

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_staff_members.sql
git commit -m "feat: add staff_members schema"
```

---

### Task 3: Regenerate Supabase types

**Files:**
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Generate fresh types from the live schema**

Run: `npx supabase gen types typescript --linked > /tmp/generated-types.ts` (strip any stray `WARN:` lines the CLI may print to stdout before using the file — check with `head -3 /tmp/generated-types.ts` and `grep -v '^WARN:' /tmp/generated-types.ts > /tmp/generated-types-clean.ts` if needed).

- [ ] **Step 2: Diff against the current file**

Run: `diff <(head -n $(grep -n "// Convenience type aliases" src/lib/supabase/types.ts | cut -d: -f1 | head -1) src/lib/supabase/types.ts) /tmp/generated-types-clean.ts` — confirm the only differences are the expected additions: `announcements`, `announcement_comments`, and `staff_members` table types. No unrelated changes should appear.

- [ ] **Step 3: Reconstruct the file**

Replace the generated portion of `src/lib/supabase/types.ts` with the new generated content, preserving the existing "Convenience type aliases" block at the bottom, and add these new aliases to that block:

```typescript
export type AnnouncementRow = Database['public']['Tables']['announcements']['Row']
export type AnnouncementCommentRow = Database['public']['Tables']['announcement_comments']['Row']
export type StaffMemberRow = Database['public']['Tables']['staff_members']['Row']
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors (the pre-existing, unrelated `submitter_name` gallery-test errors are not introduced by this change and remain out of scope).

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat: add Announcements and Staff Bios types to generated Supabase types"
```

---

### Task 4: Chunk 1 verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated `submitter_name` errors remain.

- [ ] **Step 2: Full test suite**

Run: `npx jest`
Expected: all suites pass (nothing in this chunk touches test files).

---

## Chunk 2: Announcements

**Note on test coverage:** matching this codebase's established convention, this chunk gives full TDD treatment to every write action in `announcements.ts` (`createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement`, `postComment`, `deleteComment` all have real logic — error handling, and for `postComment`, an auth check and a name-lookup fallback). The single read (`getAnnouncements`) is implemented without a dedicated failing-test step, matching the convention for simple reads elsewhere in this codebase. `AnnouncementCard`, the public page, and the admin component get no dedicated tests, matching the convention for display/action components established throughout the League feature.

### Task 5: Announcements server actions (TDD)

**Files:**
- Create: `src/app/actions/announcements.ts`
- Test: `src/app/actions/__tests__/announcements.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}))

import { createAnnouncement, updateAnnouncement, deleteAnnouncement, postComment, deleteComment } from '../announcements'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

const mockService = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

const mockSession = {
  auth: { getUser: jest.fn() },
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockService)
  ;(createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSession)
  jest.clearAllMocks()
  // Note: jest.clearAllMocks() resets call history but not the persistent
  // mockReturnValue/mockResolvedValue/mockReturnThis set above — matching
  // this codebase's established convention (see payment.test.ts).
})

describe('createAnnouncement', () => {
  it('creates the announcement on success', async () => {
    mockService.insert.mockResolvedValueOnce({ error: null })
    const result = await createAnnouncement({ title: 'Training moved', body: 'New time: 6pm Saturday.' })
    expect(result.error).toBeUndefined()
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Training moved' }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.insert.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await createAnnouncement({ title: 'x', body: 'y' })
    expect(result.error).toBe('Failed to create announcement')
  })
})

describe('updateAnnouncement', () => {
  it('updates the announcement on success', async () => {
    mockService.update.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: null })
    const result = await updateAnnouncement('a1', { title: 'Updated', body: 'New body' })
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.update.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await updateAnnouncement('a1', { title: 'x', body: 'y' })
    expect(result.error).toBe('Failed to update announcement')
  })
})

describe('deleteAnnouncement', () => {
  it('deletes the announcement on success', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteAnnouncement('a1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteAnnouncement('a1')
    expect(result.error).toBe('Failed to delete announcement')
  })
})

describe('postComment', () => {
  it('rejects when there is no authenticated user, without touching the database', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: null } })
    const result = await postComment('a1', 'hello')
    expect(result.error).toBe('You must be logged in to comment.')
    expect(mockService.insert).not.toHaveBeenCalled()
  })

  it('uses the parent record name when one exists', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockService.single.mockResolvedValueOnce({ data: { name: 'Jane Doe' }, error: null }) // parents lookup
    mockService.insert.mockResolvedValueOnce({ error: null }) // comment insert

    const result = await postComment('a1', 'hello')
    expect(result.error).toBeUndefined()
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({
      announcement_id: 'a1', user_id: 'user-1', author_name: 'Jane Doe', body: 'hello',
    }))
  })

  it('falls back to a generic name when no parent record exists', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-2' } } })
    mockService.single.mockResolvedValueOnce({ data: null, error: null }) // no parents row
    mockService.insert.mockResolvedValueOnce({ error: null })

    const result = await postComment('a1', 'hello')
    expect(result.error).toBeUndefined()
    expect(mockService.insert).toHaveBeenCalledWith(expect.objectContaining({ author_name: 'A club member' }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSession.auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } })
    mockService.single.mockResolvedValueOnce({ data: { name: 'Jane Doe' }, error: null })
    mockService.insert.mockResolvedValueOnce({ error: { message: 'db error' } })

    const result = await postComment('a1', 'hello')
    expect(result.error).toBe('Failed to post comment')
  })
})

describe('deleteComment', () => {
  it('deletes the comment on success', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteComment('c1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockService.delete.mockReturnValueOnce(mockService)
    mockService.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteComment('c1')
    expect(result.error).toBe('Failed to delete comment')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest announcements.test`
Expected: `FAIL` — `Cannot find module '../announcements'`.

- [ ] **Step 3: Implement the module**

```typescript
'use server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export type Announcement = { id: string; title: string; body: string; createdAt: string }
export type Comment = { id: string; announcementId: string; authorName: string; body: string; createdAt: string }

// Public: all announcements newest-first, each with its comments oldest-first.
export async function getAnnouncements(): Promise<(Announcement & { comments: Comment[] })[]> {
  const supabase = createSupabaseServiceClient()
  const { data: announcements } = await supabase
    .from('announcements').select('*').order('created_at', { ascending: false })
  const { data: comments } = await supabase
    .from('announcement_comments').select('*').order('created_at', { ascending: true })

  const commentsByAnnouncement = new Map<string, Comment[]>()
  for (const c of comments ?? []) {
    const list = commentsByAnnouncement.get(c.announcement_id) ?? []
    list.push({ id: c.id, announcementId: c.announcement_id, authorName: c.author_name, body: c.body, createdAt: c.created_at })
    commentsByAnnouncement.set(c.announcement_id, list)
  }

  return (announcements ?? []).map(a => ({
    id: a.id, title: a.title, body: a.body, createdAt: a.created_at,
    comments: commentsByAnnouncement.get(a.id) ?? [],
  }))
}

export type CreateAnnouncementInput = { title: string; body: string }

// Admin: create a new announcement.
export async function createAnnouncement(input: CreateAnnouncementInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcements').insert({ title: input.title, body: input.body })
  if (error) return { error: 'Failed to create announcement' }
  return {}
}

// Admin: edit an existing announcement.
export async function updateAnnouncement(id: string, input: CreateAnnouncementInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('announcements')
    .update({ title: input.title, body: input.body, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: 'Failed to update announcement' }
  return {}
}

// Admin: delete an announcement (its comments cascade-delete with it).
export async function deleteAnnouncement(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) return { error: 'Failed to delete announcement' }
  return {}
}

// Public, but requires an authenticated session: post a comment on an
// announcement. Derives the caller's identity from their real session via
// the session-aware client — never trust a client-supplied user id — then
// uses the service-role client for the parents lookup and the actual write.
export async function postComment(announcementId: string, body: string): Promise<{ error?: string }> {
  const supabaseSession = await createSupabaseServerClient()
  const { data: { user } } = await supabaseSession.auth.getUser()
  if (!user) return { error: 'You must be logged in to comment.' }

  const supabase = createSupabaseServiceClient()
  const { data: parent } = await supabase.from('parents').select('name').eq('user_id', user.id).single()
  const authorName = parent?.name ?? 'A club member'

  const { error } = await supabase.from('announcement_comments').insert({
    announcement_id: announcementId,
    user_id: user.id,
    author_name: authorName,
    body,
  })
  if (error) return { error: 'Failed to post comment' }
  return {}
}

// Admin: delete any comment.
export async function deleteComment(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('announcement_comments').delete().eq('id', id)
  if (error) return { error: 'Failed to delete comment' }
  return {}
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest announcements.test`
Expected: `PASS`, all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/announcements.ts src/app/actions/__tests__/announcements.test.ts
git commit -m "feat: add Announcements server actions with TDD coverage"
```

---

### Task 6: Public Announcements page and comment card

**Files:**
- Create: `src/app/announcements/page.tsx`
- Create: `src/components/announcements/announcement-card.tsx`

- [ ] **Step 1: Create the announcement card component**

```tsx
'use client'
import { useState } from 'react'
import { postComment, getAnnouncements } from '@/app/actions/announcements'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso))
}

export function AnnouncementCard({ announcement, isLoggedIn }: { announcement: AnnouncementWithComments; isLoggedIn: boolean }) {
  const [comments, setComments] = useState(announcement.comments)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await postComment(announcement.id, body)
      if (result.error) { setError(result.error); return }
      setBody('')
      // No per-announcement comment fetch exists — refetch everything and
      // pull out just this announcement's fresh comment list. Acceptable at
      // this site's scale (small club, infrequent posting).
      const fresh = await getAnnouncements()
      const updated = fresh.find(a => a.id === announcement.id)
      if (updated) setComments(updated.comments)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="bg-brand-tint border border-brand-line rounded-lg p-5">
      <h2 className="font-heading text-brand-ink text-xl uppercase tracking-wide">{announcement.title}</h2>
      <p className="text-brand-mutedWarm text-xs mt-1">{formatDate(announcement.createdAt)}</p>
      <p className="text-brand-ink/90 mt-3 whitespace-pre-wrap">{announcement.body}</p>

      {comments.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-brand-line pt-4">
          {comments.map(c => (
            <div key={c.id} className="text-sm">
              <span className="font-bold text-brand-primaryDeep">{c.authorName}</span>{' '}
              <span className="text-brand-mutedWarm text-xs">{formatDate(c.createdAt)}</span>
              <p className="text-brand-ink/80">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      {isLoggedIn ? (
        <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Add a comment…"
            value={body}
            onChange={e => setBody(e.target.value)}
            required
          />
          <button type="submit" disabled={submitting} className="btn-secondary text-xs px-3 disabled:opacity-50">
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </form>
      ) : (
        <p className="text-brand-mutedWarm text-xs mt-4">
          <a href="/login" className="underline">Log in</a> to leave a comment.
        </p>
      )}
      {error && <p role="alert" className="text-red-500 text-xs mt-2">{error}</p>}
    </article>
  )
}
```

- [ ] **Step 2: Create the public page**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { createBrowserClient } from '@/lib/supabase/client'
import { getAnnouncements } from '@/app/actions/announcements'
import { AnnouncementCard } from '@/components/announcements/announcement-card'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<AnnouncementWithComments[] | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    getAnnouncements().then(setAnnouncements).catch(() => setAnnouncements([]))
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setIsLoggedIn(!!data.user)).catch(() => setIsLoggedIn(false))
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="Announcements" subtitle="Club News & Updates" />
      <div className="py-8 px-4 max-w-2xl mx-auto space-y-6">
        {announcements === null ? (
          <p className="text-brand-muted text-center py-8">Loading announcements…</p>
        ) : announcements.length === 0 ? (
          <p className="text-brand-muted text-center py-8">No announcements yet.</p>
        ) : (
          announcements.map(a => (
            <AnnouncementCard key={a.id} announcement={a} isLoggedIn={isLoggedIn} />
          ))
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors remain.

- [ ] **Step 4: Commit**

```bash
git add src/app/announcements/page.tsx src/components/announcements/announcement-card.tsx
git commit -m "feat: add public Announcements page with commenting"
```

---

### Task 7: Admin Announcements management, nav, and wiring

**Files:**
- Create: `src/components/admin/announcements-admin.tsx`
- Modify: `src/components/nav.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create the admin component**

```tsx
'use client'
import { useState } from 'react'
import { createAnnouncement, updateAnnouncement, deleteAnnouncement, deleteComment } from '@/app/actions/announcements'
import type { getAnnouncements } from '@/app/actions/announcements'

type AnnouncementWithComments = Awaited<ReturnType<typeof getAnnouncements>>[number]

export function AnnouncementsAdmin({ announcements: initial }: { announcements: AnnouncementWithComments[] }) {
  const [announcements, setAnnouncements] = useState(initial)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, { title: string; body: string }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(a: AnnouncementWithComments) {
    setEditingId(a.id)
    setEdits(prev => ({ ...prev, [a.id]: { title: a.title, body: a.body } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const result = await createAnnouncement({ title, body })
      if (result.error) { setErrorMessage(result.error); return }
      setTitle(''); setBody('')
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.title || !edit.body) {
      setErrorMessage('Title and body are both required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await updateAnnouncement(id, edit)
      if (result.error) { setErrorMessage(result.error); return }
      setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, title: edit.title, body: edit.body } : a))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage(null)
    setSaving(id)
    try {
      const result = await deleteAnnouncement(id)
      if (result.error) { setErrorMessage(result.error); return }
      setAnnouncements(prev => prev.filter(a => a.id !== id))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDeleteComment(announcementId: string, commentId: string) {
    setErrorMessage(null)
    setSaving(commentId)
    try {
      const result = await deleteComment(commentId)
      if (result.error) { setErrorMessage(result.error); return }
      setAnnouncements(prev => prev.map(a => a.id === announcementId
        ? { ...a, comments: a.comments.filter(c => c.id !== commentId) }
        : a
      ))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Announcements</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="space-y-2 mb-4">
        {announcements.map(a => (
          <div key={a.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === a.id ? (
              <div className="space-y-2">
                <input
                  className="input w-full"
                  value={edits[a.id]?.title ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [a.id]: { ...prev[a.id], title: e.target.value } }))}
                />
                <textarea
                  className="input w-full"
                  rows={3}
                  value={edits[a.id]?.body ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [a.id]: { ...prev[a.id], body: e.target.value } }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(a.id)} disabled={saving === a.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === a.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{a.title}</p>
                    <p className="text-brand-muted text-xs">{a.body}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => startEdit(a)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Edit</button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={saving === a.id}
                      className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                    >
                      {saving === a.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
                {a.comments.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-brand-line pt-2">
                    {a.comments.map(c => (
                      <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                        <span><span className="font-bold">{c.authorName}:</span> {c.body}</span>
                        <button
                          onClick={() => handleDeleteComment(a.id, c.id)}
                          disabled={saving === c.id}
                          className="text-brand-primary disabled:opacity-50 flex-shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">New Announcement</p>
        <input
          placeholder="Title" required className="input w-full"
          value={title} onChange={e => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Body" required rows={3} className="input w-full"
          value={body} onChange={e => setBody(e.target.value)}
        />
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Creating…' : 'Create Announcement'}
        </button>
      </form>
    </section>
  )
}
```

- [ ] **Step 2: Add "Announcements" to the nav**

In `src/components/nav.tsx`, change ONLY the `links` array (leave everything else in the file — the reg-fee banner feature — completely untouched):

Old:
```typescript
const links = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/league', label: 'League' },
  { href: '/register', label: 'Register' },
  { href: '/contact', label: 'Contact' },
]
```

New:
```typescript
const links = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/league', label: 'League' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/register', label: 'Register' },
  { href: '/contact', label: 'Contact' },
]
```

- [ ] **Step 3: Wire into the Admin Dashboard**

In `src/app/admin/page.tsx`:

Add to the imports:
```typescript
import { AnnouncementsAdmin } from '@/components/admin/announcements-admin'
import { getAnnouncements } from '@/app/actions/announcements'
```

Add `getAnnouncements()` to the `Promise.all` array and destructure its result as `announcements`:
```typescript
  const [
    players, pendingPayments, totalRevenueCents, pendingSubmissions, getInvolvedSubmissions,
    pendingLeagueClubs, pendingLeagueTeams, pendingLeaguePlayers, leagueDivisions, approvedLeagueTeams,
    announcements,
  ] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
    getPendingSubmissions(),
    getGetInvolvedSubmissions(),
    getPendingLeagueClubs(),
    getPendingLeagueTeams(),
    getPendingLeaguePlayers(),
    getLeagueDivisionsAdmin(),
    getApprovedTeams(),
    getAnnouncements(),
  ])
```

Add the component to the JSX, after the `LeagueFixturesAdmin` section:
```tsx
      <LeagueFixturesAdmin divisions={leagueDivisions} teams={approvedLeagueTeams} />

      <AnnouncementsAdmin announcements={announcements} />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors remain.

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/announcements-admin.tsx src/components/nav.tsx src/app/admin/page.tsx
git commit -m "feat: add admin Announcements management, wire into nav and dashboard"
```

---

### Task 8: Chunk 2 verification

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors remain.

---

## Chunk 3: Staff Bios ("Our Team")

**Note on test coverage:** matching this codebase's established convention, this chunk gives full TDD treatment to the write actions in `staff.ts` (`createStaffMember`, `updateStaffMember`, `deleteStaffMember`). The single read (`getStaffMembers`) and all UI components get no dedicated tests, matching the convention for simple reads and display/action components elsewhere in this codebase.

### Task 9: Staff server actions (TDD)

**Files:**
- Create: `src/app/actions/staff.ts`
- Test: `src/app/actions/__tests__/staff.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { createStaffMember, updateStaffMember, deleteStaffMember } from '../staff'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

describe('createStaffMember', () => {
  it('creates the staff member on success', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null })
    const result = await createStaffMember({ name: 'Jane Smith', roleTitle: 'Head Coach', bio: 'Coaching for 10 years.' })
    expect(result.error).toBeUndefined()
    expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Jane Smith', role_title: 'Head Coach', bio: 'Coaching for 10 years.', photo_cloudinary_public_id: null,
    }))
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await createStaffMember({ name: 'x', roleTitle: 'y', bio: 'z' })
    expect(result.error).toBe('Failed to add staff member')
  })
})

describe('updateStaffMember', () => {
  it('updates the staff member on success', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await updateStaffMember('s1', { name: 'Jane Smith', roleTitle: 'Head Coach', bio: 'Updated bio.' })
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.update.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await updateStaffMember('s1', { name: 'x', roleTitle: 'y', bio: 'z' })
    expect(result.error).toBe('Failed to update staff member')
  })
})

describe('deleteStaffMember', () => {
  it('deletes the staff member on success', async () => {
    mockSupabase.delete.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: null })
    const result = await deleteStaffMember('s1')
    expect(result.error).toBeUndefined()
  })

  it('surfaces a friendly error on DB failure', async () => {
    mockSupabase.delete.mockReturnValueOnce(mockSupabase)
    mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const result = await deleteStaffMember('s1')
    expect(result.error).toBe('Failed to delete staff member')
  })
})
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx jest staff.test`
Expected: `FAIL` — `Cannot find module '../staff'`.

- [ ] **Step 3: Implement the module**

```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export type StaffMember = {
  id: string
  name: string
  roleTitle: string
  bio: string
  photoCloudinaryPublicId: string | null
  createdAt: string
}

// Public: all staff members in the order they were added.
export async function getStaffMembers(): Promise<StaffMember[]> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase.from('staff_members').select('*').order('created_at')
  return (data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    roleTitle: s.role_title,
    bio: s.bio,
    photoCloudinaryPublicId: s.photo_cloudinary_public_id,
    createdAt: s.created_at,
  }))
}

export type StaffMemberInput = { name: string; roleTitle: string; bio: string; photoCloudinaryPublicId?: string | null }

// Admin: add a new staff member.
export async function createStaffMember(input: StaffMemberInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('staff_members').insert({
    name: input.name,
    role_title: input.roleTitle,
    bio: input.bio,
    photo_cloudinary_public_id: input.photoCloudinaryPublicId ?? null,
  })
  if (error) return { error: 'Failed to add staff member' }
  return {}
}

// Admin: edit an existing staff member.
export async function updateStaffMember(id: string, input: StaffMemberInput): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('staff_members')
    .update({
      name: input.name,
      role_title: input.roleTitle,
      bio: input.bio,
      photo_cloudinary_public_id: input.photoCloudinaryPublicId ?? null,
    })
    .eq('id', id)
  if (error) return { error: 'Failed to update staff member' }
  return {}
}

// Admin: remove a staff member.
export async function deleteStaffMember(id: string): Promise<{ error?: string }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('staff_members').delete().eq('id', id)
  if (error) return { error: 'Failed to delete staff member' }
  return {}
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx jest staff.test`
Expected: `PASS`, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/staff.ts src/app/actions/__tests__/staff.test.ts
git commit -m "feat: add Staff Bios server actions with TDD coverage"
```

---

### Task 10: Public "Our Team" page

**Files:**
- Create: `src/app/team/page.tsx`

- [ ] **Step 1: Create the public page**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { getStaffMembers } from '@/app/actions/staff'
import { cloudinaryUrl } from '@/lib/cloudinary-url'

type Staff = Awaited<ReturnType<typeof getStaffMembers>>

export default function TeamPage() {
  const [staff, setStaff] = useState<Staff | null>(null)

  useEffect(() => {
    getStaffMembers().then(setStaff).catch(() => setStaff([]))
  }, [])

  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="Our Team" subtitle="Coaches & Admin Staff" />
      <div className="py-8 px-4 max-w-4xl mx-auto">
        {staff === null ? (
          <p className="text-brand-muted text-center py-8">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-brand-muted text-center py-8">No staff members listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {staff.map(s => (
              <div key={s.id} className="bg-brand-tint border border-brand-line rounded-lg p-5 text-center">
                {s.photoCloudinaryPublicId ? (
                  <img
                    src={cloudinaryUrl(s.photoCloudinaryPublicId, 200)}
                    alt={s.name}
                    className="w-24 h-24 rounded-full object-cover mx-auto mb-3"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-brand-tint mx-auto mb-3" />
                )}
                <p className="font-heading text-brand-ink uppercase tracking-wide">{s.name}</p>
                <p className="text-brand-primaryDeep text-xs font-bold uppercase tracking-wider mt-1">{s.roleTitle}</p>
                <p className="text-brand-ink/80 text-sm mt-3">{s.bio}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors remain.

- [ ] **Step 3: Commit**

```bash
git add src/app/team/page.tsx
git commit -m "feat: add public Our Team page"
```

---

### Task 11: Admin Staff Bios management, nav, and wiring

**Files:**
- Create: `src/components/admin/staff-admin.tsx`
- Modify: `src/components/nav.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Create the admin component**

```tsx
'use client'
import { useState } from 'react'
import { createStaffMember, updateStaffMember, deleteStaffMember } from '@/app/actions/staff'
import type { getStaffMembers } from '@/app/actions/staff'
import { cloudinaryUrl } from '@/lib/cloudinary-url'

type Staff = Awaited<ReturnType<typeof getStaffMembers>>[number]
type EditState = { name: string; roleTitle: string; bio: string; photoFile: File | null }

async function uploadPhoto(file: File): Promise<string | undefined> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
  const fd = new FormData()
  fd.append('file', file)
  fd.append('upload_preset', uploadPreset)
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: fd })
  if (!res.ok) throw new Error('Photo upload failed')
  const data = await res.json()
  return data.public_id as string | undefined
}

export function StaffAdmin({ staff: initial }: { staff: Staff[] }) {
  const [staff, setStaff] = useState(initial)
  const [name, setName] = useState('')
  const [roleTitle, setRoleTitle] = useState('')
  const [bio, setBio] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, EditState>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  function startEdit(s: Staff) {
    setEditingId(s.id)
    setEdits(prev => ({ ...prev, [s.id]: { name: s.name, roleTitle: s.roleTitle, bio: s.bio, photoFile: null } }))
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMessage(null)
    setCreating(true)
    try {
      const photoCloudinaryPublicId = photoFile ? await uploadPhoto(photoFile) : undefined
      const result = await createStaffMember({ name, roleTitle, bio, photoCloudinaryPublicId })
      if (result.error) { setErrorMessage(result.error); return }
      setName(''); setRoleTitle(''); setBio(''); setPhotoFile(null)
      window.location.reload()
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const edit = edits[id]
    if (!edit || !edit.name || !edit.roleTitle || !edit.bio) {
      setErrorMessage('Name, role, and bio are all required.')
      return
    }
    setErrorMessage(null)
    setSaving(id)
    try {
      const existing = staff.find(s => s.id === id)
      const photoCloudinaryPublicId = edit.photoFile
        ? await uploadPhoto(edit.photoFile)
        : existing?.photoCloudinaryPublicId ?? null
      const result = await updateStaffMember(id, { name: edit.name, roleTitle: edit.roleTitle, bio: edit.bio, photoCloudinaryPublicId })
      if (result.error) { setErrorMessage(result.error); return }
      setStaff(prev => prev.map(s => s.id === id
        ? { ...s, name: edit.name, roleTitle: edit.roleTitle, bio: edit.bio, photoCloudinaryPublicId: photoCloudinaryPublicId ?? null }
        : s
      ))
      setEditingId(null)
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setSaving(null)
    }
  }

  async function handleDelete(id: string) {
    setErrorMessage(null)
    setDeleting(id)
    try {
      const result = await deleteStaffMember(id)
      if (result.error) { setErrorMessage(result.error); return }
      setStaff(prev => prev.filter(s => s.id !== id))
    } catch {
      setErrorMessage('Something went wrong. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Our Team ({staff.length})</h2>
      {errorMessage && <p className="text-brand-primary text-sm mb-2">{errorMessage}</p>}

      <div className="space-y-2 mb-4">
        {staff.map(s => (
          <div key={s.id} className="bg-brand-tint border border-brand-line rounded p-3">
            {editingId === s.id ? (
              <div className="space-y-2">
                <input
                  className="input w-full" placeholder="Name"
                  value={edits[s.id]?.name ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], name: e.target.value } }))}
                />
                <input
                  className="input w-full" placeholder="Role / Title"
                  value={edits[s.id]?.roleTitle ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], roleTitle: e.target.value } }))}
                />
                <textarea
                  className="input w-full" rows={3} placeholder="Bio"
                  value={edits[s.id]?.bio ?? ''}
                  onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], bio: e.target.value } }))}
                />
                <input
                  type="file" accept="image/*" className="input w-full"
                  onChange={e => setEdits(prev => ({ ...prev, [s.id]: { ...prev[s.id], photoFile: e.target.files?.[0] ?? null } }))}
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSaveEdit(s.id)} disabled={saving === s.id} className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50">
                    {saving === s.id ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  {s.photoCloudinaryPublicId ? (
                    <img src={cloudinaryUrl(s.photoCloudinaryPublicId, 60)} alt={s.name} className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-tint" />
                  )}
                  <div>
                    <p className="text-brand-ink font-bold text-sm">{s.name}</p>
                    <p className="text-brand-muted text-xs">{s.roleTitle}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => startEdit(s)} className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50">Edit</button>
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={deleting === s.id}
                    className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {deleting === s.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="border border-brand-line rounded p-4 space-y-3">
        <p className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs">Add Staff Member</p>
        <input placeholder="Name" required className="input w-full" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Role / Title" required className="input w-full" value={roleTitle} onChange={e => setRoleTitle(e.target.value)} />
        <textarea placeholder="Bio" required rows={3} className="input w-full" value={bio} onChange={e => setBio(e.target.value)} />
        <div>
          <label htmlFor="staffPhoto" className="block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1">Photo (optional)</label>
          <input id="staffPhoto" type="file" accept="image/*" className="input w-full" onChange={e => setPhotoFile(e.target.files?.[0] ?? null)} />
        </div>
        <button type="submit" disabled={creating} className="btn-primary text-sm w-full">
          {creating ? 'Adding…' : 'Add Staff Member'}
        </button>
      </form>
    </section>
  )
}
```

- [ ] **Step 2: Add "Our Team" to the nav**

In `src/components/nav.tsx`, change ONLY the `links` array again (this is a second, independent edit to the same array Task 7 already touched — apply on top of that change):

```typescript
const links = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/league', label: 'League' },
  { href: '/announcements', label: 'Announcements' },
  { href: '/team', label: 'Our Team' },
  { href: '/register', label: 'Register' },
  { href: '/contact', label: 'Contact' },
]
```

- [ ] **Step 3: Wire into the Admin Dashboard**

In `src/app/admin/page.tsx`, add to the imports:
```typescript
import { StaffAdmin } from '@/components/admin/staff-admin'
import { getStaffMembers } from '@/app/actions/staff'
```

Add `getStaffMembers()` to the `Promise.all` array and destructure its result as `staffMembers`:
```typescript
  const [
    players, pendingPayments, totalRevenueCents, pendingSubmissions, getInvolvedSubmissions,
    pendingLeagueClubs, pendingLeagueTeams, pendingLeaguePlayers, leagueDivisions, approvedLeagueTeams,
    announcements, staffMembers,
  ] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
    getPendingSubmissions(),
    getGetInvolvedSubmissions(),
    getPendingLeagueClubs(),
    getPendingLeagueTeams(),
    getPendingLeaguePlayers(),
    getLeagueDivisionsAdmin(),
    getApprovedTeams(),
    getAnnouncements(),
    getStaffMembers(),
  ])
```

Add the component to the JSX, after `AnnouncementsAdmin`:
```tsx
      <AnnouncementsAdmin announcements={announcements} />

      <StaffAdmin staff={staffMembers} />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated errors remain.

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/staff-admin.tsx src/components/nav.tsx src/app/admin/page.tsx
git commit -m "feat: add admin Staff Bios management, wire into nav and dashboard"
```

---

## Chunk 4: Final verification

### Task 12: Full verification

- [ ] **Step 1: Full test suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: only the 3 pre-existing, unrelated `submitter_name` errors remain.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds, `/announcements` and `/team` appear in the route list.

- [ ] **Step 4: Manual walkthrough note**

A full interactive walkthrough (posting an announcement, commenting as a parent, adding a staff member with a photo) requires a real browser session and writes real rows to the linked Supabase project — per this repo's established precedent (see the League and registration-payment-plans features), this should either be done by the site owner directly, or explicitly authorized before an agent does it against the live database. Document this as the recommended final check before merging, but do not perform it automatically.

- [ ] **Step 5: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final verification pass for Announcements and Staff Bios"
```
