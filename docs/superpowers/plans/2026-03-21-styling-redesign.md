# Styling Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle all public-facing pages (nav, home, contact, register, gallery) with a dark punk-tropical aesthetic — black backgrounds, hot pink (#FF0055) primary actions, electric cyan (#00E5FF) accents, Anton headings, beach photo hero.

**Architecture:** Token-first — update Tailwind config and globals.css first so every downstream class change just works. Then update shared components (Nav, new PageHeader), then pages one by one. Gallery gets filter tab logic as the only new behaviour beyond styling.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, TypeScript, next/image, Jest + React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-21-styling-redesign.md`

---

## Chunk 1: Foundation

### Task 1: Update Tailwind colour tokens

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Search and note all brand-secondary and brand-teal usages**

Run:
```bash
grep -r "brand-secondary\|brand-teal" src/
```
Expected output includes `nav.tsx:30` and `page.tsx:17`. Note any others.

- [ ] **Step 2: Replace the brand colour object in tailwind.config.ts**

Replace the entire `brand:` block inside `theme.extend.colors` with:

```ts
brand: {
  primary: '#FF0055',   // Hot pink — primary buttons, left-border accents
  cyan:    '#00E5FF',   // Electric cyan — active states, labels, outlines, borders
  gold:    '#AC8D4E',   // Sand Gold — nav active underline (unchanged)
  dark:    '#0A0A0A',   // Near-black — page and nav backgrounds
  surface: '#111111',   // Dark card/section backgrounds
  border:  '#1E1E1E',   // Subtle dividers
  white:   '#FFFFFF',
},
```

Remove `brand-secondary`, `brand-teal`, and `brand-black` entries entirely.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: update brand colour tokens for dark redesign"
```

---

### Task 2: Update globals.css

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Remove dark mode media query and update body**

Remove the entire `@media (prefers-color-scheme: dark)` block.

Update `body`:
```css
body {
  color: #ffffff;
  background: #0A0A0A;
}
```

- [ ] **Step 2: Update component classes**

Replace the `@layer components` block with:

```css
@layer components {
  .input {
    @apply border border-brand-border bg-brand-surface rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary;
  }
  .btn-primary {
    @apply bg-brand-primary text-white px-4 py-2 rounded font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition;
    box-shadow: 0 4px 16px rgba(255, 0, 85, 0.4);
  }
  .btn-secondary {
    @apply border-2 border-brand-cyan text-brand-cyan px-4 py-2 rounded font-bold uppercase tracking-wider hover:bg-brand-cyan hover:text-black transition;
  }
  .btn-success {
    @apply bg-green-600 text-white px-3 py-1 rounded font-medium hover:bg-green-700 transition;
  }
  .btn-danger {
    @apply bg-red-600 text-white px-3 py-1 rounded font-medium hover:bg-red-700 transition;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update globals.css for dark theme — body, btn-primary, btn-secondary, input"
```

---

## Chunk 2: Shared Components

### Task 3: Create PageHeader component

**Files:**
- Create: `src/components/page-header.tsx`
- Create: `src/__tests__/components/page-header.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/components/page-header.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/page-header'

describe('PageHeader', () => {
  it('renders the title', () => {
    render(<PageHeader title="Gallery" />)
    expect(screen.getByRole('heading', { name: /gallery/i })).toBeInTheDocument()
  })

  it('renders the subtitle when provided', () => {
    render(<PageHeader title="Gallery" subtitle="Photos from the pitch" />)
    expect(screen.getByText(/photos from the pitch/i)).toBeInTheDocument()
  })

  it('does not render subtitle element when not provided', () => {
    render(<PageHeader title="Gallery" />)
    expect(screen.queryByText(/photos/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest page-header --no-coverage
```
Expected: FAIL — "Cannot find module '@/components/page-header'"

- [ ] **Step 3: Implement PageHeader**

Create `src/components/page-header.tsx`:

```tsx
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-brand-surface border-l-4 border-brand-primary px-6 py-5">
      <h1 className="font-heading text-white uppercase tracking-wider text-3xl">{title}</h1>
      {subtitle && (
        <p className="text-brand-cyan font-bold uppercase tracking-[0.25em] text-xs mt-1">{subtitle}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest page-header --no-coverage
```
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/page-header.tsx src/__tests__/components/page-header.test.tsx
git commit -m "feat: add PageHeader component with dark styling"
```

---

### Task 4: Restyle Nav

**Files:**
- Modify: `src/components/nav.tsx`

The nav currently uses `bg-brand-secondary` (now removed), a text wordmark, and unstyled auth links. We replace all of this.

- [ ] **Step 1: Rewrite nav.tsx**

Replace the entire file content with:

```tsx
'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/register', label: 'Register' },
  { href: '/contact', label: 'Contact' },
]

export function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState<{ id: string } | null>(null)

  useEffect(() => {
    const supabase = createBrowserClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  async function handleLogout() {
    const supabase = createBrowserClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="bg-brand-dark border-b-[3px] border-brand-cyan px-4 py-3 flex items-center justify-between">
      <Link href="/">
        <Image src="/logo.png" width={48} height={48} alt="Bocas Juniors FC" />
      </Link>
      <div className="flex items-center gap-5 text-xs font-bold uppercase tracking-wider">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? 'text-brand-cyan' : 'text-white/75 hover:text-white transition'}
          >
            {label}
          </Link>
        ))}
        {user ? (
          <>
            <Link
              href="/profile"
              className="bg-brand-surface border border-brand-border text-white px-4 py-1.5 rounded hover:border-brand-cyan transition"
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-white/60 hover:text-white transition"
            >
              Log Out
            </button>
          </>
        ) : (
          <Link href="/login" className="bg-brand-primary text-white px-4 py-1.5 rounded">
            Log In
          </Link>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify dev server renders nav correctly**

```bash
npm run dev
```
Open `http://localhost:3000` (start dev server first if not already running). Confirm: logo image shows in nav, dark background, cyan bottom border, hot pink Log In button.

- [ ] **Step 3: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat: restyle nav — dark background, logo, cyan border, updated auth states"
```

---

## Chunk 3: Home Page

### Task 5: Restyle home page hero and CTA

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Rewrite page.tsx**

Replace the entire file content with:

```tsx
import Image from 'next/image'
import Link from 'next/link'

// Replace SPONSOR_1 etc. with actual Cloudinary public IDs after uploading sponsor logos
const sponsors: string[] = []

export default function HomePage() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

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
      {sponsors.length > 0 && (
        <section className="py-12 px-4 text-center bg-brand-surface">
          <h2 className="text-xs font-bold text-white/40 mb-6 uppercase tracking-widest">Our Sponsors</h2>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {sponsors.map((id, i) => (
              <img
                key={i}
                src={`https://res.cloudinary.com/${cloud}/image/upload/h_80,q_auto,f_auto/${id}`}
                alt={`Sponsor ${i + 1}`}
                className="h-16 object-contain grayscale hover:grayscale-0 transition"
              />
            ))}
          </div>
        </section>
      )}

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

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```
Open `http://localhost:3000`. Confirm: beach photo shows in hero, dark overlay, logo visible, Anton heading, cyan subtitle, pink Register button, cyan-outline Gallery button, dark CTA section below with cyan top border.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: restyle home page — beach photo hero, dark CTA section"
```

---

## Chunk 4: Contact and Register Pages

### Task 6: Restyle contact page

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Rewrite contact/page.tsx**

Replace the entire file content with:

```tsx
import { PageHeader } from '@/components/page-header'

const contacts = [
  {
    name: 'Gilles Benyon-Bell',
    role: 'Manager',
    email: 'g.bell2010@gmail.com',
    phone: '+44 7462 557960 (WhatsApp)',
  },
  {
    name: 'Josh Floryance',
    role: 'Coach',
    email: null,
    phone: null,
  },
  {
    name: 'Jorge Vega',
    role: 'Coach',
    email: null,
    phone: null,
  },
]

export default function ContactPage() {
  return (
    <main className="bg-brand-dark min-h-screen">
      <PageHeader title="Contact Us" subtitle="Get in touch with the team" />
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
        {contacts.map(c => (
          <div
            key={c.name}
            className="bg-brand-surface border border-brand-border border-l-[3px] border-l-brand-primary rounded p-5"
          >
            <h2 className="text-white font-black text-base">{c.name}</h2>
            <p className="text-brand-cyan font-bold uppercase tracking-widest text-xs mt-1 mb-2">{c.role}</p>
            {c.email && (
              <p className="text-sm">
                <a href={`mailto:${c.email}`} className="text-brand-primary underline">
                  {c.email}
                </a>
              </p>
            )}
            {c.phone && <p className="text-white/50 text-sm mt-1">{c.phone}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/contact`. Confirm: dark background, PageHeader with pink left border, dark staff cards with pink left border, cyan role labels, pink email links.

- [ ] **Step 3: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat: restyle contact page — dark cards, PageHeader, cyan role labels"
```

---

### Task 7: Restyle register page and form

**Files:**
- Modify: `src/app/register/page.tsx`
- Modify: `src/components/register/registration-form.tsx`
- Modify: `src/components/payment/payment-options-panel.tsx`

- [ ] **Step 1: Update register/page.tsx — dark wrapper + step indicator on both steps**

Replace the entire file content with:

```tsx
'use client'
import { useState } from 'react'
import { PageHeader } from '@/components/page-header'
import { RegistrationForm } from '@/components/register/registration-form'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'

type Step = 'register' | 'pay'
type Ids = { playerId: string; parentId: string; parentName: string; playerName: string }

function StepIndicator({ step }: { step: Step }) {
  return (
    <div className="flex">
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'register' ? 'bg-brand-primary text-white' : 'bg-brand-surface text-white/40'}`}>
        1. Player Info
      </div>
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'pay' ? 'bg-brand-primary text-white' : 'bg-brand-surface text-white/40'}`}>
        2. Payment
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState<Step>('register')
  const [ids, setIds] = useState<Ids | null>(null)

  if (step === 'pay' && ids) {
    return (
      <main className="bg-brand-dark min-h-screen">
        <PageHeader title="Register" subtitle="Sign your child up today" />
        <StepIndicator step="pay" />
        <div className="py-8 px-4">
          <PaymentOptionsPanel
            playerId={ids.playerId}
            parentId={ids.parentId}
            parentName={ids.parentName}
            playerName={ids.playerName}
          />
        </div>
      </main>
    )
  }

  return (
    <main className="bg-brand-dark min-h-screen">
      <PageHeader title="Register" subtitle="Sign your child up today" />
      <StepIndicator step="register" />
      <div className="py-8 px-4">
        <RegistrationForm
          onSuccess={(playerId, parentId, parentName, playerName) => {
            setIds({ playerId, parentId, parentName, playerName })
            setStep('pay')
          }}
        />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Update registration-form.tsx — dark fields, cyan labels**

Replace the entire file content with:

```tsx
'use client'
import { useState } from 'react'
import { registerParentAndPlayer } from '@/app/actions/register'

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
    })
    setLoading(false)
    if (result.error) { setError(result.error); return }
    onSuccess(result.playerId!, result.parentId!, fd.get('parentName') as string, fd.get('playerName') as string)
  }

  const labelClass = 'block text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <fieldset className="space-y-4">
        <legend className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-2">Player Details</legend>
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
        <legend className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-2">Parent / Guardian Details</legend>
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

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Registering…' : 'Register & Pay'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Update payment-options-panel.tsx — dark cards**

First, read the file to confirm exact current strings, then make the following replacements in `src/components/payment/payment-options-panel.tsx`:

```bash
# Confirm the file content before editing
cat src/components/payment/payment-options-panel.tsx
```

Apply these changes (use the Edit tool for each):
- `className="border rounded-lg p-4 space-y-3"` → `className="border border-brand-border rounded p-4 space-y-3 bg-brand-surface"` (4 occurrences — one per payment method card)
- `<h3 className="font-semibold">` → `<h3 className="font-bold text-white">` (4 occurrences)
- `className="text-sm text-gray-600"` → `className="text-sm text-white/60"` (all occurrences)
- `className="bg-gray-50 rounded p-3 font-mono text-sm flex items-center justify-between gap-3"` → `className="bg-brand-dark rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-white/80"` (2 occurrences — Monzo and Revolut copy fields)
- `<p>Loading payment options…</p>` → `<p className="text-white/60 py-8 text-center">Loading payment options…</p>`
- `<h2 className="text-xl font-bold">` → `<h2 className="font-heading text-white text-2xl uppercase tracking-wider">`
- All `className="btn-primary text-sm"` on payment link/button elements remain as `.btn-primary` (already correct)
- All `className="btn-secondary text-sm"` on "I've paid" / "I've sent the transfer" / "I'll pay cash" buttons remain as `.btn-secondary` (now cyan outline per updated globals.css — no class change needed, the token update handles it)

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/register`. Confirm: dark background, PageHeader, step indicator (step 1 pink, step 2 dark), cyan labels on fields, dark input backgrounds, pink submit button. Complete step 1 and confirm step 2 payment panel also has dark cards.

- [ ] **Step 5: Commit**

```bash
git add src/app/register/page.tsx src/components/register/registration-form.tsx src/components/payment/payment-options-panel.tsx
git commit -m "feat: restyle register page — dark theme, step indicator, cyan labels, dark payment cards"
```

---

## Chunk 5: Gallery Page

### Task 8: Add filter tabs and restyle gallery

**Files:**
- Modify: `src/app/gallery/page.tsx`
- Modify: `src/components/gallery/gallery-client.tsx`
- Modify: `src/components/gallery/media-tile.tsx`
- Create: `src/__tests__/components/gallery-client.test.tsx`

- [ ] **Step 1: Write failing test for filter tab logic**

Create `src/__tests__/components/gallery-client.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { GalleryClient } from '@/components/gallery/gallery-client'
import type { Media } from '@/lib/supabase/types'

// Mock the lightbox — it's not what we're testing
jest.mock('yet-another-react-lightbox', () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => open ? <div data-testid="lightbox" /> : null,
}))
jest.mock('yet-another-react-lightbox/plugins/video', () => ({ __esModule: true, default: {} }))
jest.mock('yet-another-react-lightbox/styles.css', () => {})

const photo: Media = {
  id: '1', type: 'photo', cloudinary_public_id: 'test/photo1',
  caption: 'A photo', published: true, pinned: false,
  uploaded_at: '2024-01-01', uploaded_by: 'user1',
}
const video: Media = {
  id: '2', type: 'video', cloudinary_public_id: 'test/video1',
  caption: 'A video', published: true, pinned: false,
  uploaded_at: '2024-01-02', uploaded_by: 'user1',
}

describe('GalleryClient filter tabs', () => {
  it('shows all items by default', () => {
    render(<GalleryClient items={[photo, video]} />)
    expect(screen.getByAltText('A photo')).toBeInTheDocument()
    expect(screen.getByAltText('A video')).toBeInTheDocument()
  })

  it('filters to photos only', () => {
    render(<GalleryClient items={[photo, video]} />)
    fireEvent.click(screen.getByRole('button', { name: /photos/i }))
    expect(screen.getByAltText('A photo')).toBeInTheDocument()
    expect(screen.queryByAltText('A video')).not.toBeInTheDocument()
  })

  it('filters to videos only', () => {
    render(<GalleryClient items={[photo, video]} />)
    fireEvent.click(screen.getByRole('button', { name: /videos/i }))
    expect(screen.queryByAltText('A photo')).not.toBeInTheDocument()
    expect(screen.getByAltText('A video')).toBeInTheDocument()
  })

  it('returns to all items when All tab clicked', () => {
    render(<GalleryClient items={[photo, video]} />)
    fireEvent.click(screen.getByRole('button', { name: /photos/i }))
    fireEvent.click(screen.getByRole('button', { name: /all/i }))
    expect(screen.getByAltText('A photo')).toBeInTheDocument()
    expect(screen.getByAltText('A video')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest gallery-client --no-coverage
```
Expected: FAIL — filter buttons not found

- [ ] **Step 3: Update gallery-client.tsx with filter tabs**

Replace the entire file content with:

```tsx
'use client'
import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import { MasonryGrid } from './masonry-grid'
import type { Media } from '@/lib/supabase/types'

type Filter = 'all' | 'photo' | 'video'

function cloudinaryUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto/${publicId}`
}
function cloudinaryVideoUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/video/upload/q_auto/${publicId}.mp4`
}

const tabs: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Photos', value: 'photo' },
  { label: 'Videos', value: 'video' },
]

export function GalleryClient({ items }: { items: Media[] }) {
  const [index, setIndex] = useState(-1)
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)

  const slides = items.map(item =>
    item.type === 'video'
      ? { type: 'video' as const, sources: [{ src: cloudinaryVideoUrl(item.cloudinary_public_id), type: 'video/mp4' }] }
      : { src: cloudinaryUrl(item.cloudinary_public_id), alt: item.caption ?? '' }
  )

  return (
    <>
      <div className="flex gap-2 px-4 py-4">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`rounded text-xs font-bold uppercase tracking-wider px-3 py-1.5 transition ${
              filter === tab.value
                ? 'bg-brand-primary text-white'
                : 'border border-brand-border text-white/50 hover:border-brand-cyan hover:text-brand-cyan'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <MasonryGrid items={filtered} onSelect={(item) => setIndex(items.indexOf(item))} />
      <Lightbox
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        slides={slides}
        plugins={[Video]}
      />
    </>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest gallery-client --no-coverage
```
Expected: PASS — 4 tests

- [ ] **Step 5: Update gallery/page.tsx — dark wrapper + PageHeader**

Replace the entire file content with:

```tsx
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/page-header'
import { GalleryClient } from '@/components/gallery/gallery-client'

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
      <GalleryClient items={media ?? []} />
    </main>
  )
}
```

- [ ] **Step 6: Update media-tile.tsx — dark placeholder, hover tint**

Replace the entire file content with:

```tsx
import type { Media } from '@/lib/supabase/types'

function cloudinaryUrl(publicId: string, width: number) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/w_${width},q_auto,f_auto/${publicId}`
}

function cloudinaryVideoThumb(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/video/upload/w_600,q_auto,f_jpg/${publicId}`
}

type Props = { item: Media; onClick: () => void }

export function MediaTile({ item, onClick }: Props) {
  const isVideo = item.type === 'video'
  const src = isVideo
    ? cloudinaryVideoThumb(item.cloudinary_public_id)
    : cloudinaryUrl(item.cloudinary_public_id, 600)

  return (
    <button
      onClick={onClick}
      className="relative block w-full overflow-hidden group bg-brand-surface transition-transform hover:scale-[1.02]"
    >
      <img
        src={src}
        alt={item.caption ?? ''}
        className="w-full h-auto block"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-brand-primary/0 group-hover:bg-brand-primary/20 transition" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition">
          <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
    </button>
  )
}
```

- [ ] **Step 7: Verify in browser**

Open `http://localhost:3000/gallery`. Confirm: dark background, PageHeader, filter tabs (All/Photos/Videos) with pink active state, dark tile backgrounds, pink tint on hover.

- [ ] **Step 8: Run all tests**

```bash
npx jest --no-coverage
```
Expected: all tests pass

- [ ] **Step 9: Commit**

```bash
git add src/app/gallery/page.tsx src/components/gallery/gallery-client.tsx src/components/gallery/media-tile.tsx src/__tests__/components/gallery-client.test.tsx
git commit -m "feat: restyle gallery — dark theme, filter tabs, PageHeader, hover tint on tiles"
```

---

## Final Step: Deploy

- [ ] **Push to main and verify Vercel deployment**

```bash
git push origin main
```

Open the Vercel dashboard and confirm the build succeeds. Visit the live URL and check each page: home, contact, register, gallery.
