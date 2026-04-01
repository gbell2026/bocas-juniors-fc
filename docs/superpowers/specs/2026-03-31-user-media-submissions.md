# Bocas Juniors FC — User Media Submissions Spec

**Date:** 2026-03-31
**Scope:** Allow any site visitor (no login required) to submit photos and videos from the gallery page. Submissions are held in a pending queue and must be approved by an admin before appearing in the gallery. Max 50MB per file.

---

## Overview

A "Submit a Photo/Video" button on the gallery page opens a full-screen upload modal. Visitors upload directly to Cloudinary using an unsigned upload preset (configured in the Cloudinary dashboard — no server-side signing required). The file is saved to the `media` table with `published = false`. An admin approves or rejects submissions from a new Pending Submissions section in the admin panel.

---

## Cloudinary Setup (manual step — done once)

Before deploying, create an **unsigned upload preset** in the Cloudinary dashboard:

1. Go to Settings → Upload → Upload presets → Add upload preset
2. Set **Signing Mode** to `Unsigned`
3. Set **Folder** to `bocas-juniors`
4. Set **Allowed formats** to `jpg, jpeg, png, gif, webp, mp4, mov, avi`
5. Set **Max file size** to `51200` KB (50MB)
6. Save the preset name — add it to `.env.local` and Vercel as:
   ```
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<preset-name>
   ```

`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` is already present in `.env.local` and Vercel — no change needed.

The existing signed endpoint (`/api/cloudinary/sign`) is unchanged and still used by the admin uploader.

---

## Data Model Changes

**Migration:** `supabase/migrations/003_media_public_submissions.sql`

(Migrations 001 and 002 exist; 003 is the next in sequence. The club shop migration was designed but never applied as that feature was parked.)

Two changes to the `media` table:
1. Make `uploaded_by` nullable — anonymous submissions have no user ID. The column has a foreign key to `auth.users`; a nullable FK is valid in Postgres.
2. Add `submitter_name text` — optional display name provided by the submitter.

```sql
alter table media alter column uploaded_by drop not null;
alter table media add column submitter_name text;
```

**Types update:** After applying the migration, update `src/lib/supabase/types.ts` manually (do not regenerate — the file has hand-written convenience aliases at the bottom that would be lost). Change the `Media` type convenience alias to:

```ts
export type Media = {
  id: string
  cloudinary_public_id: string
  type: 'photo' | 'video'
  caption: string | null
  published: boolean
  pinned: boolean
  uploaded_at: string
  uploaded_by: string | null       // was: string
  submitter_name: string | null    // new
}
```

Also update the `Database` type definition block for the `media` table — in both `Row` and `Insert`, change `uploaded_by` to `string | null` and add `submitter_name: string | null`.

**RLS:** No new policies needed. `submitMediaRecord` uses `createSupabaseServiceClient()` (service role), which bypasses RLS entirely — the same pattern used by all existing admin actions. The existing `published = true` filter on the public SELECT policy means unapproved submissions are never returned to public queries.

---

## Gallery Page

**File:** `src/app/gallery/page.tsx` — add `<GalleryPageClient>` wrapper
**File:** `src/components/gallery/gallery-page-client.tsx` ← new
**File:** `src/components/gallery/upload-modal.tsx` ← new

`gallery/page.tsx` remains a server component. It fetches published media and passes them to a new thin client wrapper:

```tsx
// src/app/gallery/page.tsx (updated)
import { GalleryPageClient } from '@/components/gallery/gallery-page-client'
// ... fetch items as before ...
return (
  <main className="bg-brand-dark min-h-screen">
    <PageHeader title="Gallery" subtitle="Photos & videos from the pitch" />
    <GalleryPageClient items={items} />
  </main>
)
```

`GalleryPageClient` is a `'use client'` component that:
- Holds `modalOpen: boolean` state
- Renders a "Submit a Photo/Video" `btn-secondary` button above the grid
- Renders `<GalleryClient items={items} />` (existing component, unchanged)
- Renders `<UploadModal open={modalOpen} onClose={() => setModalOpen(false)} />` when open

---

## UploadModal Component

**File:** `src/components/gallery/upload-modal.tsx`

A full-screen overlay modal. On mobile it fills the viewport from the bottom (`items-end`); on desktop it is centred (`sm:items-center`) with max-width 600px.

### State

```ts
type FileEntry = {
  id: string             // crypto.randomUUID() assigned on add
  file: File
  preview: string        // object URL for images; empty string for video
  caption: string
  progress: number       // 0–100
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

// Component state:
files: FileEntry[]
submitterName: string
phase: 'selecting' | 'uploading' | 'complete'
```

### Behaviour

**File selection:**
- Hidden `<input type="file" multiple accept="image/*,video/*">` triggered by the drop zone tap/click
- Drag-and-drop also triggers file add via `onDrop`
- On file add: validate each file ≤ 50MB client-side. Files over the limit are silently skipped and a visible error message lists the rejected filenames.
- Images: `URL.createObjectURL(file)` stored as `preview`; call `URL.revokeObjectURL` when the entry is removed or the modal closes
- Videos: `preview = ''`; render a generic video camera icon instead
- Each thumbnail has a × remove button
- Optional name field: single `<input placeholder="Your name (optional)">` for the whole submission
- Optional caption: `<input placeholder="Add a caption…">` per file, shown below its thumbnail
- **Upload button is disabled when `files` is empty**

**Upload:**
- "Upload X file(s)" button (disabled when `files.length === 0`) sets `phase = 'uploading'` and uploads sequentially
- Each file: `XMLHttpRequest` POST to `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/<resourceType>/upload` with `upload_preset` field set to `process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`
- `xhr.upload.onprogress` updates `FileEntry.progress` (0–100)
- On Cloudinary success (`response.public_id` present): call `submitMediaRecord` server action
- On Cloudinary error or network failure: set `FileEntry.status = 'error'`, set `FileEntry.error` to a human-readable message, continue with remaining files
- After all files complete: set `phase = 'complete'`

**Complete:**
- Show "Thanks for sharing! Your photos will appear once approved." message
- "Close" button → calls `onClose()` prop, which resets `modalOpen` to `false` in the parent
- On close: revoke all remaining object URLs, reset all state to initial values

### `submitMediaRecord` server action

**File:** `src/app/actions/media-submissions.ts` ← new

```ts
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export async function submitMediaRecord({
  cloudinaryPublicId,
  type,
  caption,
  submitterName,
}: {
  cloudinaryPublicId: string
  type: 'photo' | 'video'
  caption?: string
  submitterName?: string
}): Promise<{ error: string | null }>
```

Uses `createSupabaseServiceClient()`. Inserts into `media` with:
- `published: false`
- `uploaded_by: null`
- `submitter_name: submitterName ?? null`
- `caption: caption ?? null`
- `pinned: false`

Returns `{ error: null }` on success, `{ error: 'message' }` on failure. The modal displays the error message against the relevant file entry.

### Styling

- Overlay: `fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center`
- Panel: `bg-brand-surface w-full sm:max-w-xl sm:rounded-lg max-h-[90vh] overflow-y-auto p-5`
- Drop zone: `border-2 border-dashed border-brand-border rounded-lg p-8 text-center text-white/50 hover:border-brand-cyan transition cursor-pointer`
- Drop zone active (drag over): `border-brand-primary`
- Thumbnail grid: `grid grid-cols-3 gap-2 mt-4`
- Progress bar track: `bg-brand-border rounded-full h-1`; fill: `bg-brand-primary rounded-full h-1 transition-all`
- Labels: `text-brand-cyan font-bold uppercase tracking-wider text-xs`
- Inputs: `.input` class
- Upload button: `.btn-primary w-full`
- Disabled upload button: `opacity-50 cursor-not-allowed`

---

## Admin Panel — Pending Submissions

**File:** `src/components/admin/pending-submissions.tsx` ← new
**File:** `src/app/admin/page.tsx` — add pending fetch + render component
**File:** `src/app/actions/admin.ts` — add three new actions

### New server actions (add to `src/app/actions/admin.ts`)

```ts
export async function getPendingSubmissions(): Promise<Media[]>
// Returns all media rows where published = false, ordered by uploaded_at asc

export async function approveSubmission(id: string): Promise<void>
// Sets published = true for the given media id

export async function rejectSubmission(id: string, cloudinaryPublicId: string): Promise<void>
// 1. Calls cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: 'image' | 'video' })
//    - Use the `cloudinary` npm package (already installed — used in /api/cloudinary/sign)
//    - Configure with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET env vars (already present)
//    - Determine resource_type by checking if publicId path contains a known video extension, or attempt destroy with 'image' first then 'video' on failure
//    - Simpler: always pass resource_type: 'image' for images and 'video' for videos — store type in the function call from the component
// 2. Deletes the media row from the database
```

Update `rejectSubmission` signature to accept `resourceType`:

```ts
export async function rejectSubmission(
  id: string,
  cloudinaryPublicId: string,
  resourceType: 'image' | 'video'
): Promise<void>
```

The `PendingSubmissions` component passes `submission.type === 'video' ? 'video' : 'image'` as `resourceType`.

If the Cloudinary `destroy` call fails (e.g. file already deleted, network error), log the error and proceed to delete the database row anyway — failing open is correct for a moderation queue.

### PendingSubmissions component

Client component. Receives `submissions: Media[]` as prop. Holds local `items` state initialised from `submissions` prop. Uses optimistic removal on approve/reject.

Renders above the existing MediaUploader section in the admin page. Renders nothing when `items.length === 0`.

For each pending item:
- Thumbnail: for photos, `https://res.cloudinary.com/<cloudName>/image/upload/w_120,h_120,c_fill,q_auto,f_auto/<publicId>`. For videos, a generic video camera SVG icon.
- Submitter name: `submitter_name ?? 'Anonymous'`
- Caption (if any)
- Upload date (formatted as `DD MMM YYYY`)
- **Approve** button (`.btn-primary` small) → calls `approveSubmission(id)`, removes from `items`
- **Reject** button (`.btn-secondary` small with red tint: `border-brand-primary text-brand-primary`) → `window.confirm('Reject and delete this submission?')` → calls `rejectSubmission(id, cloudinaryPublicId, resourceType)`, removes from `items`

Section heading: `"Pending Submissions (${items.length})"` — `text-lg font-semibold mb-3`.

---

## Files Touched (complete list)

- `supabase/migrations/003_media_public_submissions.sql` ← new
- `src/lib/supabase/types.ts` — update `Media` type and DB type block
- `src/app/actions/media-submissions.ts` ← new
- `src/app/actions/admin.ts` — add `getPendingSubmissions`, `approveSubmission`, `rejectSubmission`
- `src/components/gallery/upload-modal.tsx` ← new
- `src/components/gallery/gallery-page-client.tsx` ← new
- `src/app/gallery/page.tsx` — use GalleryPageClient wrapper
- `src/components/admin/pending-submissions.tsx` ← new
- `src/app/admin/page.tsx` — add pending submissions fetch + render

---

## Out of Scope

- Email/push notifications for new submissions (deferred)
- Rate limiting on submissions
- Authenticated uploads (auth rework is a separate future project)
- Moderation of captions/names
