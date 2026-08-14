# User Media Submissions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow any site visitor to submit photos/videos from the gallery page; submissions are held in a pending queue and approved by an admin before appearing in the gallery.

**Architecture:** A `GalleryPageClient` wrapper holds modal state and renders a Submit button above the existing gallery grid. The `UploadModal` uploads files directly to Cloudinary via an unsigned preset, then calls a server action to save each file to the `media` table with `published = false`. The admin panel gains a `PendingSubmissions` component to approve (set `published = true`) or reject (delete from Cloudinary + DB) each submission.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Supabase (service role), Cloudinary (unsigned upload preset + `cloudinary` npm package for server-side delete), React Testing Library + Jest

---

## Pre-flight: Cloudinary unsigned preset (manual — do this before running the app)

1. Log in to [cloudinary.com](https://cloudinary.com) → Settings → Upload → Upload presets → **Add upload preset**
2. Signing Mode: **Unsigned**
3. Folder: `bocas-juniors`
4. Allowed formats: `jpg, jpeg, png, gif, webp, mp4, mov, avi`
5. Max file size: `51200` KB (50MB)
6. Save. Copy the preset name into `.env.local`:
   ```
   NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-preset-name
   ```
   Also add this variable to Vercel → Settings → Environment Variables.

---

## Chunk 1: Foundation

### Task 1: Database migration + types update

**Files:**
- Create: `supabase/migrations/003_media_public_submissions.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/003_media_public_submissions.sql`:

```sql
-- Allow anonymous submissions (no auth user)
alter table media alter column uploaded_by drop not null;

-- Store optional submitter display name
alter table media add column submitter_name text;
```

- [ ] **Step 2: Apply the migration in Supabase dashboard**

Go to your Supabase project → SQL Editor → paste and run the SQL above.

Verify: in Table Editor, `media` table now shows `uploaded_by` as nullable and a new `submitter_name` column.

- [ ] **Step 3: Update the media type block in `src/lib/supabase/types.ts`**

Find the `media` table block (around line 42). Replace it with:

```ts
media: {
  Row: {
    caption: string | null
    cloudinary_public_id: string
    id: string
    pinned: boolean
    published: boolean
    submitter_name: string | null
    type: Database["public"]["Enums"]["media_type"]
    uploaded_at: string
    uploaded_by: string | null
  }
  Insert: {
    caption?: string | null
    cloudinary_public_id: string
    id?: string
    pinned?: boolean
    published?: boolean
    submitter_name?: string | null
    type: Database["public"]["Enums"]["media_type"]
    uploaded_at?: string
    uploaded_by?: string | null
  }
  Update: {
    caption?: string | null
    cloudinary_public_id?: string
    id?: string
    pinned?: boolean
    published?: boolean
    submitter_name?: string | null
    type?: Database["public"]["Enums"]["media_type"]
    uploaded_at?: string
    uploaded_by?: string | null
  }
  Relationships: []
}
```

The `Media` convenience alias at the bottom of the file (`type Media = Database['public']['Tables']['media']['Row']`) automatically picks up these changes — do not change it.

- [ ] **Step 4: Run the test suite to confirm no type errors**

```bash
npx jest --passWithNoTests
```

Expected: all 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/003_media_public_submissions.sql src/lib/supabase/types.ts
git commit -m "feat: make media.uploaded_by nullable, add submitter_name column"
```

---

### Task 2: `submitMediaRecord` server action

**Files:**
- Create: `src/app/actions/media-submissions.ts`
- Test: `src/__tests__/actions/media-submissions.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/actions/media-submissions.test.ts`:

```ts
// Server actions can't be unit-tested in isolation easily — test via integration.
// This file is a placeholder that confirms the module exports correctly.
import { submitMediaRecord } from '@/app/actions/media-submissions'

describe('submitMediaRecord', () => {
  it('is exported as a function', () => {
    expect(typeof submitMediaRecord).toBe('function')
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest media-submissions --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/app/actions/media-submissions'`

- [ ] **Step 3: Create `src/app/actions/media-submissions.ts`**

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
}): Promise<{ error: string | null }> {
  const supabase = createSupabaseServiceClient()
  const { error } = await supabase.from('media').insert({
    cloudinary_public_id: cloudinaryPublicId,
    type,
    caption: caption ?? null,
    submitter_name: submitterName ?? null,
    uploaded_by: null,
    published: false,
    pinned: false,
  })
  return { error: error ? error.message : null }
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
npx jest media-submissions
```

Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/media-submissions.ts src/__tests__/actions/media-submissions.test.ts
git commit -m "feat: add submitMediaRecord server action"
```

---

## Chunk 2: Gallery Upload UI

### Task 3: UploadModal component

**Files:**
- Create: `src/components/gallery/upload-modal.tsx`
- Test: `src/__tests__/components/upload-modal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/upload-modal.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { UploadModal } from '@/components/gallery/upload-modal'

// Suppress XMLHttpRequest not implemented warnings in jsdom
global.XMLHttpRequest = jest.fn(() => ({
  open: jest.fn(),
  send: jest.fn(),
  setRequestHeader: jest.fn(),
  upload: { onprogress: null },
  onload: null,
  onerror: null,
  status: 200,
  responseText: '{}',
})) as any

describe('UploadModal', () => {
  const onClose = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when open is false', () => {
    const { container } = render(<UploadModal open={false} onClose={onClose} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the drop zone when open', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    expect(screen.getByText(/tap to add photos/i)).toBeInTheDocument()
  })

  it('upload button is disabled when no files are selected', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('shows error for files over 50MB and does not add them', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigFile = new File(['x'.repeat(1)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 51 * 1024 * 1024 })
    fireEvent.change(input, { target: { files: [bigFile] } })
    expect(screen.getByText(/too large/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled()
  })

  it('calls onClose when the × button is clicked', () => {
    render(<UploadModal open={true} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest upload-modal --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/components/gallery/upload-modal'`

- [ ] **Step 3: Create `src/components/gallery/upload-modal.tsx`**

```tsx
'use client'
import { useRef, useState, useCallback } from 'react'
import { submitMediaRecord } from '@/app/actions/media-submissions'

const MAX_BYTES = 50 * 1024 * 1024 // 50MB

type FileEntry = {
  id: string
  file: File
  preview: string
  caption: string
  progress: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

type Phase = 'selecting' | 'uploading' | 'complete'

function makeEntry(file: File): FileEntry {
  const isImage = file.type.startsWith('image/')
  return {
    id: crypto.randomUUID(),
    file,
    preview: isImage ? URL.createObjectURL(file) : '',
    caption: '',
    progress: 0,
    status: 'pending',
  }
}

function uploadToCloudinary(
  file: File,
  cloudName: string,
  uploadPreset: string,
  onProgress: (pct: number) => void
): Promise<{ publicId: string | null; error: string | null }> {
  return new Promise(resolve => {
    const xhr = new XMLHttpRequest()
    const resourceType = file.type.startsWith('video/') ? 'video' : 'image'
    const fd = new FormData()
    fd.append('file', file)
    fd.append('upload_preset', uploadPreset)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (data.public_id) resolve({ publicId: data.public_id, error: null })
        else resolve({ publicId: null, error: data.error?.message ?? 'Upload failed' })
      } catch {
        resolve({ publicId: null, error: 'Upload failed' })
      }
    }
    xhr.onerror = () => resolve({ publicId: null, error: 'Network error' })
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`)
    xhr.send(fd)
  })
}

export function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [submitterName, setSubmitterName] = useState('')
  const [phase, setPhase] = useState<Phase>('selecting')
  const [sizeErrors, setSizeErrors] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  function reset() {
    files.forEach(f => { if (f.preview) URL.revokeObjectURL(f.preview) })
    setFiles([])
    setSubmitterName('')
    setPhase('selecting')
    setSizeErrors([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  const addFiles = useCallback((incoming: File[]) => {
    const rejected: string[] = []
    const valid: FileEntry[] = []
    for (const f of incoming) {
      if (f.size > MAX_BYTES) rejected.push(f.name)
      else valid.push(makeEntry(f))
    }
    setSizeErrors(rejected.length ? [`${rejected.join(', ')} too large (max 50MB)`] : [])
    if (valid.length) setFiles(prev => [...prev, ...valid])
  }, [])

  function removeFile(id: string) {
    setFiles(prev => {
      const entry = prev.find(f => f.id === id)
      if (entry?.preview) URL.revokeObjectURL(entry.preview)
      return prev.filter(f => f.id !== id)
    })
  }

  function updateEntry(id: string, patch: Partial<FileEntry>) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f))
  }

  async function handleUpload() {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!
    setPhase('uploading')

    for (const entry of files) {
      updateEntry(entry.id, { status: 'uploading' })
      const { publicId, error: uploadError } = await uploadToCloudinary(
        entry.file,
        cloudName,
        uploadPreset,
        (pct) => updateEntry(entry.id, { progress: pct })
      )
      if (!publicId) {
        updateEntry(entry.id, { status: 'error', error: uploadError ?? 'Upload failed' })
        continue
      }
      const type = entry.file.type.startsWith('video/') ? 'video' : 'photo'
      const { error: dbError } = await submitMediaRecord({
        cloudinaryPublicId: publicId,
        type,
        caption: entry.caption || undefined,
        submitterName: submitterName || undefined,
      })
      if (dbError) updateEntry(entry.id, { status: 'error', error: dbError, progress: 100 })
      else updateEntry(entry.id, { status: 'done', progress: 100 })
    }

    setPhase('complete')
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-brand-surface w-full sm:max-w-xl sm:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-brand-border">
          <h2 className="font-heading text-white uppercase tracking-wider text-lg">Submit a Photo/Video</h2>
          <button
            aria-label="close"
            onClick={handleClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5">
          {phase === 'complete' ? (
            <div className="text-center py-8">
              <p className="text-white font-bold text-lg mb-2">Thanks for sharing!</p>
              <p className="text-white/50 text-sm mb-6">Your photos will appear once approved.</p>
              <button onClick={handleClose} className="btn-primary">Close</button>
            </div>
          ) : (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center text-white/50 hover:border-brand-cyan transition cursor-pointer ${isDragging ? 'border-brand-primary' : 'border-brand-border'}`}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                  e.preventDefault()
                  setIsDragging(false)
                  addFiles(Array.from(e.dataTransfer.files))
                }}
              >
                <p className="text-sm font-bold uppercase tracking-wider">Tap to add photos/videos</p>
                <p className="text-xs mt-1">or drag and drop · max 50MB per file</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*"
                className="hidden"
                onChange={e => { if (e.target.files) addFiles(Array.from(e.target.files)) }}
              />

              {/* Size errors */}
              {sizeErrors.map((err, i) => (
                <p key={i} className="text-brand-primary text-xs mt-2">{err}</p>
              ))}

              {/* File previews */}
              {files.length > 0 && (
                <>
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {files.map(entry => (
                      <div key={entry.id} className="relative">
                        <div className="aspect-square bg-brand-border rounded overflow-hidden">
                          {entry.preview
                            ? <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">▶</div>
                          }
                        </div>
                        <button
                          onClick={() => removeFile(entry.id)}
                          className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-brand-primary"
                          aria-label={`remove ${entry.file.name}`}
                        >
                          ×
                        </button>
                        {/* Progress bar */}
                        {entry.status === 'uploading' && (
                          <div className="mt-1 bg-brand-border rounded-full h-1">
                            <div
                              className="bg-brand-primary rounded-full h-1 transition-all"
                              style={{ width: `${entry.progress}%` }}
                            />
                          </div>
                        )}
                        {entry.status === 'done' && (
                          <p className="text-brand-cyan text-[10px] mt-1 text-center">✓ Uploaded</p>
                        )}
                        {entry.status === 'error' && (
                          <p className="text-brand-primary text-[10px] mt-1">{entry.error}</p>
                        )}
                        <input
                          className="input w-full mt-1 text-xs py-1"
                          placeholder="Add a caption…"
                          value={entry.caption}
                          onChange={e => updateEntry(entry.id, { caption: e.target.value })}
                          disabled={phase === 'uploading'}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Name field */}
                  <div className="mt-4">
                    <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs block mb-1">
                      Your name (optional)
                    </label>
                    <input
                      className="input w-full"
                      placeholder="Your name"
                      value={submitterName}
                      onChange={e => setSubmitterName(e.target.value)}
                      disabled={phase === 'uploading'}
                    />
                  </div>
                </>
              )}

              {/* Upload button */}
              <button
                onClick={handleUpload}
                disabled={files.length === 0 || phase === 'uploading'}
                className="btn-primary w-full mt-5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {phase === 'uploading'
                  ? 'Uploading…'
                  : `Upload${files.length > 0 ? ` ${files.length} file${files.length > 1 ? 's' : ''}` : ''}`
                }
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify PASS**

```bash
npx jest upload-modal
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/gallery/upload-modal.tsx src/__tests__/components/upload-modal.test.tsx
git commit -m "feat: add UploadModal component"
```

---

### Task 4: GalleryPageClient wrapper + gallery page update

**Files:**
- Create: `src/components/gallery/gallery-page-client.tsx`
- Modify: `src/app/gallery/page.tsx`
- Test: `src/__tests__/components/gallery-page-client.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/gallery-page-client.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { GalleryPageClient } from '@/components/gallery/gallery-page-client'

// Mock heavy dependencies
jest.mock('@/components/gallery/gallery-client', () => ({
  GalleryClient: () => <div data-testid="gallery-client" />,
}))
jest.mock('@/components/gallery/upload-modal', () => ({
  UploadModal: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? <div data-testid="upload-modal"><button onClick={onClose}>close</button></div> : null,
}))

describe('GalleryPageClient', () => {
  it('renders the gallery and submit button', () => {
    render(<GalleryPageClient items={[]} />)
    expect(screen.getByTestId('gallery-client')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit a photo/i })).toBeInTheDocument()
  })

  it('opens the modal when submit button is clicked', () => {
    render(<GalleryPageClient items={[]} />)
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /submit a photo/i }))
    expect(screen.getByTestId('upload-modal')).toBeInTheDocument()
  })

  it('closes the modal when onClose is called', () => {
    render(<GalleryPageClient items={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /submit a photo/i }))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest gallery-page-client --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/components/gallery/gallery-page-client'`

- [ ] **Step 3: Create `src/components/gallery/gallery-page-client.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { GalleryClient } from './gallery-client'
import { UploadModal } from './upload-modal'
import type { Media } from '@/lib/supabase/types'

export function GalleryPageClient({ items }: { items: Media[] }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div className="px-4 pt-4">
        <button
          onClick={() => setModalOpen(true)}
          className="btn-secondary"
        >
          Submit a Photo/Video
        </button>
      </div>
      <GalleryClient items={items} />
      <UploadModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
```

- [ ] **Step 4: Update `src/app/gallery/page.tsx`**

Replace the full file content:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { GalleryPageClient } from '@/components/gallery/gallery-page-client'

export default async function GalleryPage() {
  const supabase = await createSupabaseServerClient()
  const { data: media } = await supabase
    .from('media')
    .select('*')
    .eq('published', true)
    .order('pinned', { ascending: false })
    .order('uploaded_at', { ascending: false })

  return (
    <main className="bg-brand-dark min-h-screen">
      <PageHeader title="Gallery" subtitle="Photos & videos from the pitch" />
      <GalleryPageClient items={media ?? []} />
    </main>
  )
}
```

- [ ] **Step 5: Run full test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 6: Verify in dev server**

```bash
npm run dev
```

Visit `http://localhost:3000/gallery`. Confirm:
- "Submit a Photo/Video" button appears above the gallery grid
- Clicking it opens the modal
- Modal closes with the × button
- Gallery still loads and filters work

- [ ] **Step 7: Commit**

```bash
git add src/components/gallery/gallery-page-client.tsx src/__tests__/components/gallery-page-client.test.tsx src/app/gallery/page.tsx
git commit -m "feat: add GalleryPageClient with submit button and upload modal"
```

---

## Chunk 3: Admin Approval

### Task 5: Admin server actions for pending submissions

**Files:**
- Modify: `src/app/actions/admin.ts`

- [ ] **Step 1: Add the three new actions to `src/app/actions/admin.ts`**

Add at the end of the file:

```ts
export async function getPendingSubmissions() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('media')
    .select('*')
    .eq('published', false)
    .order('uploaded_at', { ascending: true })
  return data ?? []
}

export async function approveSubmission(id: string): Promise<void> {
  const supabase = createSupabaseServiceClient()
  await supabase.from('media').update({ published: true }).eq('id', id)
}

export async function rejectSubmission(
  id: string,
  cloudinaryPublicId: string,
  resourceType: 'image' | 'video'
): Promise<void> {
  // Delete from Cloudinary first (fail open — proceed to DB delete even if this fails)
  try {
    const { v2: cloudinary } = await import('cloudinary')
    cloudinary.config({
      cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })
    await cloudinary.uploader.destroy(cloudinaryPublicId, { resource_type: resourceType })
  } catch (err) {
    console.error('Cloudinary delete failed (proceeding to DB delete):', err)
  }
  const supabase = createSupabaseServiceClient()
  await supabase.from('media').delete().eq('id', id)
}
```

Also add `type { Media }` to the imports at the top of `admin.ts`:

```ts
import type { PlayerStatus, Media } from '@/lib/supabase/types'
```

And update the `getPendingSubmissions` return type:

```ts
export async function getPendingSubmissions(): Promise<Media[]>
```

(Add the `: Promise<Media[]>` annotation to the function signature.)

- [ ] **Step 2: Run test suite**

```bash
npx jest --passWithNoTests
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/admin.ts
git commit -m "feat: add getPendingSubmissions, approveSubmission, rejectSubmission actions"
```

---

### Task 6: PendingSubmissions component

**Files:**
- Create: `src/components/admin/pending-submissions.tsx`
- Test: `src/__tests__/components/pending-submissions.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/pending-submissions.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PendingSubmissions } from '@/components/admin/pending-submissions'
import * as actions from '@/app/actions/admin'
import type { Media } from '@/lib/supabase/types'

jest.mock('@/app/actions/admin', () => ({
  approveSubmission: jest.fn().mockResolvedValue(undefined),
  rejectSubmission: jest.fn().mockResolvedValue(undefined),
}))

const submission: Media = {
  id: '1',
  cloudinary_public_id: 'bocas-juniors/test-photo',
  type: 'photo',
  caption: 'A great shot',
  published: false,
  pinned: false,
  uploaded_at: '2026-04-01T10:00:00Z',
  uploaded_by: null,
  submitter_name: 'Jane Doe',
}

describe('PendingSubmissions', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders nothing when there are no submissions', () => {
    const { container } = render(<PendingSubmissions submissions={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the submission count heading', () => {
    render(<PendingSubmissions submissions={[submission]} />)
    expect(screen.getByText(/pending submissions \(1\)/i)).toBeInTheDocument()
  })

  it('shows submitter name, caption, and date', () => {
    render(<PendingSubmissions submissions={[submission]} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('A great shot')).toBeInTheDocument()
  })

  it('shows "Anonymous" when submitter_name is null', () => {
    render(<PendingSubmissions submissions={[{ ...submission, submitter_name: null }]} />)
    expect(screen.getByText('Anonymous')).toBeInTheDocument()
  })

  it('calls approveSubmission and removes item on Approve click', async () => {
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => {
      expect(actions.approveSubmission).toHaveBeenCalledWith('1')
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })
  })

  it('calls rejectSubmission with confirm and removes item on Reject click', async () => {
    window.confirm = jest.fn().mockReturnValue(true)
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(actions.rejectSubmission).toHaveBeenCalledWith('1', 'bocas-juniors/test-photo', 'image')
      expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument()
    })
  })

  it('does not call rejectSubmission when confirm is cancelled', async () => {
    window.confirm = jest.fn().mockReturnValue(false)
    render(<PendingSubmissions submissions={[submission]} />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() => {
      expect(actions.rejectSubmission).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npx jest pending-submissions --passWithNoTests
```

Expected: FAIL — `Cannot find module '@/components/admin/pending-submissions'`

- [ ] **Step 3: Create `src/components/admin/pending-submissions.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { Media } from '@/lib/supabase/types'
import { approveSubmission, rejectSubmission } from '@/app/actions/admin'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PendingSubmissions({ submissions: initial }: { submissions: Media[] }) {
  const [items, setItems] = useState(initial)

  if (items.length === 0) return null

  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  async function handleApprove(id: string) {
    await approveSubmission(id)
    setItems(prev => prev.filter(s => s.id !== id))
  }

  async function handleReject(item: Media) {
    if (!window.confirm('Reject and delete this submission?')) return
    const resourceType = item.type === 'video' ? 'video' : 'image'
    await rejectSubmission(item.id, item.cloudinary_public_id, resourceType)
    setItems(prev => prev.filter(s => s.id !== item.id))
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Pending Submissions ({items.length})</h2>
      <div className="space-y-3">
        {items.map(item => (
          <div
            key={item.id}
            className="flex gap-4 items-start bg-brand-surface border border-brand-border rounded p-3"
          >
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded bg-brand-border overflow-hidden flex-shrink-0 flex items-center justify-center">
              {item.type === 'photo' ? (
                <img
                  src={`https://res.cloudinary.com/${cloud}/image/upload/w_120,h_120,c_fill,q_auto,f_auto/${item.cloudinary_public_id}`}
                  alt={item.caption ?? ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white/30 text-2xl">▶</span>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{item.submitter_name ?? 'Anonymous'}</p>
              {item.caption && <p className="text-white/50 text-xs mt-0.5">{item.caption}</p>}
              <p className="text-white/30 text-xs mt-0.5">{formatDate(item.uploaded_at)}</p>
            </div>
            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={() => handleApprove(item.id)}
                className="btn-primary text-xs px-3 py-1.5"
              >
                Approve
              </button>
              <button
                onClick={() => handleReject(item)}
                className="text-xs px-3 py-1.5 border border-brand-primary text-brand-primary rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition"
              >
                Reject
              </button>
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
npx jest pending-submissions
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/pending-submissions.tsx src/__tests__/components/pending-submissions.test.tsx
git commit -m "feat: add PendingSubmissions admin component"
```

---

### Task 7: Wire PendingSubmissions into admin page

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
import { getPendingPayments, getAllPlayers, getTotalRevenue, getPendingSubmissions } from '@/app/actions/admin'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [players, pendingPayments, totalRevenueCents, pendingSubmissions] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
    getPendingSubmissions(),
  ])

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>

      <PendingPayments payments={pendingPayments as any} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
        <PlayersTable players={players as any} />
      </section>

      <PendingSubmissions submissions={pendingSubmissions as any} />

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

1. Visit `http://localhost:3000/gallery` — click "Submit a Photo/Video", upload a small test image
2. Visit `http://localhost:3000/admin` (logged in as admin) — confirm the submission appears in "Pending Submissions"
3. Click Approve — confirm it disappears from pending and appears in the gallery
4. Submit another test image, then Reject it — confirm it disappears and is gone from Cloudinary

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: wire PendingSubmissions into admin page"
```

---

## Final Step: Push to Vercel

- [ ] **Push to origin main**

```bash
git push origin main
```

Confirm the Vercel build succeeds. Visit the live site:
- Gallery page: "Submit a Photo/Video" button is visible
- Upload a test photo to confirm the modal works on mobile
- Admin panel: pending submission appears and can be approved
