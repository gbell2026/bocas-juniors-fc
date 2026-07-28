# Tangerine Toucans Rebrand Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the site from "Bocas Juniors FC" to "Tangerine Toucans" — new name, new light/cream visual theme, new typography, new logo — across every page, replacing the current dark punk-rock theme.

**Architecture:** This is a token-and-copy rebrand, not new functionality. All changes flow from three sources: (1) `tailwind.config.ts`'s `brand.*` colour tokens and font variables, (2) literal "Bocas"/"Bocas Juniors FC" text strings, (3) the new logo files. Every file that references any of these gets updated. No new components, no new routes, no behavior changes — existing tests must keep passing (with fixture updates where they reference old names/colours).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Jest + React Testing Library, Supabase (Postgres), Cloudinary.

**Spec:** `docs/superpowers/specs/2026-07-27-tangerine-toucans-rebrand.md`

---

## Design decisions made during planning

The spec defines the token *values* but not how every existing dark-theme utility class maps onto the new light theme — that mapping is decided here, applied consistently across every task below:

| Old usage | New usage | Reasoning |
|---|---|---|
| `bg-brand-dark` (page/section background, default) | `bg-brand-cream` | New page default per spec |
| `bg-brand-dark` (Nav bar, homepage "Get Involved CTA" band) | `bg-brand-ink` | These two are kept as intentional dark accent bands — matches spec's "dark sections" allowance for `ink`/`charcoal`, and gives the light theme visual rhythm instead of using `ink`/`charcoal` nowhere |
| `bg-brand-surface` (cards/panels) | `bg-brand-tint` | Tint's documented role is "pale orange highlight cards" — direct fit for elevated cards on the cream page |
| `bg-brand-surface` (the Upload modal's floating container specifically — see Chunk 5, Task 23) | `bg-white` | Exception to the row above: a modal floats over a `bg-black/80` backdrop, not the page — pure white reads as "elevated above everything" and distinguishes it from in-page tint cards, which sit directly on the cream background |
| `bg-brand-border` (chip/pill fills, thumbnail placeholders, progress-bar track) | `bg-brand-creamAlt` | Neutral secondary fill, distinct from card tint |
| `bg-brand-dark` (small monospace detail insets — Monzo/Revolut boxes in the Payment panel) | `bg-brand-creamAlt` | Same neutral-fill reasoning as above; this is the one non-page/non-Nav use of the old dark token, confirmed via `grep -rn "bg-brand-dark" src/` to be the only occurrence outside the two rows above |
| `border-brand-border` | `border-brand-line` | Direct token replacement |
| `text-white` (primary text, on cream/tint) | `text-brand-ink` | Direct token replacement |
| `text-white/80`, `/75`, `/70` (secondary text, on cream/tint) | `text-brand-ink/80` etc. | Keep opacity modifier, swap base colour |
| `text-white/60`, `/50` (muted text, on cream/tint) | `text-brand-muted` | Matches token's documented "secondary body on light" role |
| `text-white/40`, `/30` (faint/tertiary text, on cream/tint) | `text-brand-mutedWarm` | Matches "muted labels, sub-copy" role |
| `text-brand-cyan` (uppercase eyebrow labels, active nav link, form legends — **on light backgrounds**) | `text-brand-primaryDeep` | Cyan is retired; tangerineDeep reads clearly as an accent label colour on cream/tint/white |
| `text-brand-cyan` (active nav link, **on the dark Nav bar**) | `text-brand-primary` | Tangerine (bright) pops on ink better than tangerineDeep (muddier on near-black) |
| `border-brand-cyan` / hover accents | `border-brand-primary` / `hover:border-brand-primary` | Same reasoning as above |
| `bg-brand-cyan` (hover fill on `.btn-secondary`) | `bg-brand-primary` | Same |
| Text that sits on the **hero photo's dark gradient scrim** (`page.tsx` hero only) | Stays `text-white` | That text isn't on the cream page background — it's on a photo with a dark overlay for legibility, unrelated to the global theme swap |
| `.input`, `.btn-primary`, `.btn-secondary` (globals.css) | See Chunk 1, Task 5 | Retheme once, globally, rather than per-file |
| `accent-[#FF0055]` (checkbox accent, get-involved-form.tsx) | `accent-[#F26522]` | Hardcoded old hex, swap to tangerine hex |
| WhatsApp button `#25D366`, hero gradient `rgba(8,4,24,...)` scrim | **Unchanged** | Third-party brand colour / local dark-scrim-over-photo technique, not part of our palette |
| `.btn-success` / `.btn-danger` (green-600/red-600) | **Unchanged** | Semantic status colours, not brand tokens — out of scope |

---

## Chunk 1: Foundation — tokens, fonts, base theme, assets

### Task 1: Copy logo assets into the repo

**Files:**
- Create: `public/logo.png`
- Create: `public/logo-white-bg.png`
- Create: `public/logo-white-text.png`
- Create: `public/brand/tangerine-toucans-logo.svg`
- Create: `public/brand/tangerine-toucans-white-text.svg`

- [ ] **Step 1: Copy the raster logos into `public/`**

```bash
cp ~/Downloads/tangerine_toucans_logo_files/tangerine_toucans_logo_transparent.png public/logo.png
cp ~/Downloads/tangerine_toucans_logo_files/tangerine_toucans_logo.png public/logo-white-bg.png
cp ~/Downloads/tangerine_toucans_logo_files/tangerine_toucans_white_text_transparent.png public/logo-white-text.png
```

- [ ] **Step 2: Copy the SVG originals into a new `public/brand/` folder (kept as high-fidelity source, not directly referenced by app code)**

```bash
mkdir -p public/brand
cp ~/Downloads/tangerine_toucans_logo_files/tangerine_toucans_logo.svg public/brand/tangerine-toucans-logo.svg
cp ~/Downloads/tangerine_toucans_logo_files/tangerine_toucans_white_text.svg public/brand/tangerine-toucans-white-text.svg
```

- [ ] **Step 3: Verify the old logo files are no longer referenced anywhere (they'll be replaced, not deleted, in case of rollback)**

Run: `git status`
Expected: `public/logo.png` shows as modified (overwritten in place), new files listed as untracked.

- [ ] **Step 4: Commit**

```bash
git add public/logo.png public/logo-white-bg.png public/logo-white-text.png public/brand/
git commit -m "feat: add Tangerine Toucans logo assets"
```

---

### Task 2: Regenerate the favicon

**Files:**
- Modify: `src/app/favicon.ico`

Next.js's App Router serves `src/app/favicon.ico` automatically if present — no code references it directly, so this is just a file swap. Use an online-free, already-installed tool if available, otherwise ImageMagick:

- [ ] **Step 1: Check if ImageMagick is available**

Run: `which convert || which magick`

- [ ] **Step 2: Generate the .ico from the transparent logo**

If ImageMagick is available:
```bash
convert public/logo.png -define icon:auto-resize=16,32,48 src/app/favicon.ico
```
If not available, install it first (`brew install imagemagick` on macOS) and re-run, or use any other locally available PNG→ICO conversion tool — the requirement is just that `src/app/favicon.ico` ends up containing the new badge at standard favicon sizes (16x16, 32x32, 48x48).

- [ ] **Step 3: Verify the file changed**

Run: `file src/app/favicon.ico`
Expected: shows valid icon data, file size noticeably different from the previous favicon.

- [ ] **Step 4: Commit**

```bash
git add src/app/favicon.ico
git commit -m "feat: regenerate favicon with Tangerine Toucans logo"
```

---

### Task 3: Update Tailwind brand tokens

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Replace the `colors.brand` block**

Replace the entire `brand: { ... }` object with:

```typescript
        brand: {
          primary:     '#F26522',   // Tangerine — CTAs, headings, accents
          primaryDeep: '#B84F1D',   // Tangerine Deep — hover, display numbers, eyebrow labels on light
          accent:      '#FFB627',   // Amber — accent only, small areas
          ink:         '#141311',   // Near-black — dark sections only (nav, homepage CTA band)
          charcoal:    '#211F1C',   // Lifted dark panels (within dark sections)
          cream:       '#FBF7F2',   // Primary page background
          creamAlt:    '#F7F1E9',   // Alternate section banding / neutral fills
          tint:        '#FCEFE4',   // Pale highlight card background
          line:        '#E7DFD5',   // Borders, dividers on light backgrounds
          muted:       '#6E665B',   // Secondary body text on light
          mutedWarm:   '#8A8175',   // Muted labels, sub-copy
          mutedLight:  '#C9BFB2',   // Muted text on dark sections
          white:       '#FFFFFF',
        },
```

- [ ] **Step 2: Replace the `fontFamily` block**

```typescript
      fontFamily: {
        heading: ['var(--font-barlow-condensed)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
```

- [ ] **Step 3: Verify the file is valid TypeScript**

Run: `npx tsc --noEmit tailwind.config.ts`
Expected: no errors (or only errors pre-existing before this change — check with `git stash` + re-run if unsure).

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: replace brand colour tokens with Tangerine Toucans palette"
```

---

### Task 4: Update fonts and metadata in `layout.tsx`

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
import type { Metadata } from 'next'
import { Barlow_Condensed, Inter } from 'next/font/google'
import { Nav } from '@/components/nav'
import './globals.css'

const barlowCondensed = Barlow_Condensed({ subsets: ['latin'], weight: '600', variable: '--font-barlow-condensed' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Tangerine Toucans',
  description: 'Youth football club in Bocas del Toro, Panama',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${barlowCondensed.variable} ${inter.variable} font-body`}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
```

Note: `weight: '600'` for Barlow Condensed — Anton only ships one weight (400, itself already bold-looking), Barlow Condensed ships several; `600` (semibold) is the closest match to Anton's visual weight for headings. Adjust if the rendered result looks too light/heavy once you can see it in the browser.

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: swap to Barlow Condensed/Inter fonts, rename site metadata"
```

---

### Task 5: Retheme `globals.css`

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace the full file content**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: #ffffff;
  --foreground: #171717;
}

body {
  color: #141311;
  background: #FBF7F2;
}

h1, h2, h3 {
  font-family: var(--font-barlow-condensed), sans-serif;
  letter-spacing: 0.02em;
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

@layer components {
  .input {
    @apply border border-brand-line bg-white rounded px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-brand-primary;
  }
  .btn-primary {
    @apply bg-brand-primary text-white px-4 py-2 rounded font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition;
    box-shadow: 0 4px 16px rgba(242, 101, 34, 0.4);
  }
  .btn-secondary {
    @apply border-2 border-brand-primary text-brand-primary px-4 py-2 rounded font-bold uppercase tracking-wider hover:bg-brand-primary hover:text-white transition;
  }
  .btn-success {
    @apply bg-green-600 text-white px-3 py-1 rounded font-medium hover:bg-green-700 transition;
  }
  .btn-danger {
    @apply bg-red-600 text-white px-3 py-1 rounded font-medium hover:bg-red-700 transition;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: retheme globals.css to light Tangerine Toucans theme"
```

---

### Task 6: Rename the npm package

**Files:**
- Modify: `package.json:2`
- Modify: `package-lock.json` (regenerated, not hand-edited — see Step 2)

- [ ] **Step 1: Change the `name` field**

```json
  "name": "tangerine-toucans-fc",
```

- [ ] **Step 2: Regenerate the lockfile so it doesn't retain the old package name**

Run: `npm install`
Expected: `package-lock.json` updates its `name` fields (lines 2 and 8) to `tangerine-toucans-fc`; no dependency versions change.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: rename npm package to tangerine-toucans-fc"
```

---

### Task 7: Build check before touching individual pages

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: build succeeds. (Pages will look visually broken until later chunks update their class names — that's expected. This step only confirms the config/font/CSS changes themselves don't break compilation.)

- [ ] **Step 2: Run the existing test suite**

Run: `npx jest`
Expected: same pass/fail status as before this chunk (no new failures introduced by config-only changes — component tests don't assert on colour classes).

---

## Chunk 2: Nav, PageHeader, Home page

### Task 8: Retheme and rename `nav.tsx`

**Files:**
- Modify: `src/components/nav.tsx`

- [ ] **Step 1: Replace the full file content**

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
    <nav className="bg-brand-ink border-b-[3px] border-brand-primary px-4 py-3 flex items-center justify-between">
      <Link href="/">
        <Image src="/logo.png" width={48} height={48} alt="Tangerine Toucans" />
      </Link>
      <div className="flex items-center gap-5 text-xs font-bold uppercase tracking-wider">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={pathname === href ? 'text-brand-primary' : 'text-white/75 hover:text-white transition'}
          >
            {label}
          </Link>
        ))}
        {user ? (
          <>
            <Link
              href="/profile"
              className="bg-brand-charcoal border border-brand-mutedLight/30 text-white px-4 py-1.5 rounded hover:border-brand-primary transition"
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

Note: since the Nav bar stays dark (`bg-brand-ink`), text within it keeps `text-white`/`text-white/60`/`text-white/75` per the design-decisions table — only the page bodies switch to ink-on-cream.

- [ ] **Step 2: Commit**

```bash
git add src/components/nav.tsx
git commit -m "feat: retheme and rename nav to Tangerine Toucans"
```

---

### Task 9: Retheme `page-header.tsx`

**Files:**
- Modify: `src/components/page-header.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-brand-tint border-l-4 border-brand-primary px-6 py-5">
      <h1 className="font-heading text-brand-ink uppercase tracking-wider text-3xl">{title}</h1>
      {subtitle && (
        <p className="text-brand-primaryDeep font-bold uppercase tracking-[0.25em] text-xs mt-1">{subtitle}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/page-header.tsx
git commit -m "feat: retheme PageHeader to light Tangerine Toucans theme"
```

---

### Task 10: Retheme and rename the home page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the full file content**

```tsx
import Image from 'next/image'
import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="bg-brand-cream min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[500px] flex items-center justify-center text-center overflow-hidden">
        <Image
          src="/beach-hero.jpg"
          alt="Tangerine Toucans training on the beach"
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
            alt="Tangerine Toucans"
            className="mb-5 drop-shadow-2xl"
          />
          <h1
            className="font-heading text-white uppercase tracking-widest"
            style={{ fontSize: '4.5rem', lineHeight: 1 }}
          >
            Tangerine Toucans
          </h1>
          <p className="text-brand-primary font-bold uppercase tracking-[0.3em] text-xs mt-3">
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

      {/* Get Involved CTA */}
      <section className="py-14 px-4 bg-brand-ink border-t border-brand-charcoal text-center">
        <h2 className="font-heading text-white text-4xl uppercase tracking-wider mb-3">Get Involved</h2>
        <p className="text-white/60 mb-7 max-w-md mx-auto">
          Want to support the Tangerine Toucans? We&apos;re looking for sponsors, volunteers, and partners to help grow the club.
        </p>
        <Link href="/get-involved" className="btn-primary">Become a Supporter</Link>
        <div className="mt-10 pt-8 border-t border-brand-charcoal">
          <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Proudly supported by</p>
          <Image
            src="/bocas-dance-logo.png"
            alt="Bocas Dance Collective"
            width={160}
            height={86}
            className="h-20 w-auto object-contain mx-auto"
          />
        </div>
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
    </main>
  )
}
```

Note: hero section text stays `text-white`/`text-brand-primary`-on-dark-scrim (it's over the beach photo, not the cream page — see Design decisions table). The "Get Involved CTA" band keeps `bg-brand-ink`/`text-white` as the second intentional dark section. `bocas-dance-logo.png` and its alt text are **unchanged** — sponsor's own branding, not renamed (see spec Section 1).

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: retheme and rename home page to Tangerine Toucans"
```

---

### Task 11: Visual check for Chunk 2

- [ ] **Step 1: Start the dev server and view the home page**

Run: `npm run dev`, open `http://localhost:3000`
Expected: dark nav bar with tangerine accents and the new logo; cream page peeking in behind the hero (visible once you scroll past the photo); dark "Get Involved" band at the bottom with the new club name.

- [ ] **Step 2: Run tests**

Run: `npx jest`
Expected: no new failures (nav/home page have no dedicated unit tests currently — this is a manual visual check).

---

## Chunk 3: Public content pages

### Task 12: Retheme and rename the Contact page

**Files:**
- Modify: `src/app/contact/page.tsx`

- [ ] **Step 1: Replace the full file content**

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
    <main className="bg-brand-cream min-h-screen">
      <PageHeader title="Contact Us" subtitle="Get in touch with the team" />
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-4">
        {contacts.map(c => (
          <div
            key={c.name}
            className="bg-brand-tint border border-brand-line border-l-[3px] border-l-brand-primary rounded p-5"
          >
            <h2 className="text-brand-ink font-black text-base">{c.name}</h2>
            <p className="text-brand-primaryDeep font-bold uppercase tracking-widest text-xs mt-1 mb-2">{c.role}</p>
            {c.email && (
              <p className="text-sm">
                <a href={`mailto:${c.email}`} className="text-brand-primary underline">
                  {c.email}
                </a>
              </p>
            )}
            {c.phone && <p className="text-brand-muted text-sm mt-1">{c.phone}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat: retheme Contact page to light Tangerine Toucans theme"
```

---

### Task 13: Retheme the Gallery page

**Files:**
- Modify: `src/app/gallery/page.tsx`

- [ ] **Step 1: Replace line 15**

Old:
```tsx
    <main className="bg-brand-dark min-h-screen">
```
New:
```tsx
    <main className="bg-brand-cream min-h-screen">
```

- [ ] **Step 2: Commit**

```bash
git add src/app/gallery/page.tsx
git commit -m "feat: retheme Gallery page background"
```

---

### Task 14: Retheme the Register page

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Replace the full file content**

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
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'register' ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'}`}>
        1. Player Info
      </div>
      <div className={`flex-1 py-2 text-center text-xs font-bold uppercase tracking-wider ${step === 'pay' ? 'bg-brand-primary text-white' : 'bg-brand-tint text-brand-mutedWarm'}`}>
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
      <main className="bg-brand-cream min-h-screen">
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
    <main className="bg-brand-cream min-h-screen">
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

- [ ] **Step 2: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: retheme Register page to light Tangerine Toucans theme"
```

---

### Task 15: Retheme and rename the Get Involved page

**Files:**
- Modify: `src/app/get-involved/page.tsx`
- Modify: `src/app/actions/get-involved.ts:36`

- [ ] **Step 1: Replace the full content of `src/app/get-involved/page.tsx`**

```tsx
import { PageHeader } from '@/components/page-header'
import { GetInvolvedForm } from '@/components/get-involved/get-involved-form'

export default function GetInvolvedPage() {
  return (
    <main className="bg-brand-cream min-h-screen">
      <PageHeader
        title="Get Involved"
        subtitle="Support the Tangerine Toucans — on and off the pitch"
      />
      <div className="max-w-xl mx-auto px-4 py-10">
        <GetInvolvedForm />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Replace line 36 in `src/app/actions/get-involved.ts`**

Old:
```ts
      from: 'Bocas Juniors FC <onboarding@resend.dev>',
```
New:
```ts
      from: 'Tangerine Toucans <onboarding@resend.dev>',
```

- [ ] **Step 3: Commit**

```bash
git add src/app/get-involved/page.tsx src/app/actions/get-involved.ts
git commit -m "feat: retheme and rename Get Involved page and email sender"
```

---

### Task 16: Visual + test check for Chunk 3

- [ ] **Step 1: Manually view `/contact`, `/gallery`, `/register`, `/get-involved` in the dev server**

Expected: cream backgrounds, tangerine accents, no leftover dark cards (those come from the components touched in Chunk 4/5 — the page shells themselves should now be light).

- [ ] **Step 2: Run tests**

Run: `npx jest`
Expected: no new failures.

---

## Chunk 4: Form and panel components

### Task 17: Retheme the Registration form

**Files:**
- Modify: `src/components/register/registration-form.tsx`

- [ ] **Step 1: Replace line 30 (label colour) and all `.input`/`.btn-primary` usages stay as-is (globals.css already retheme these)**

Old:
```tsx
  const labelClass = 'block text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1'
```
New:
```tsx
  const labelClass = 'block text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1'
```

- [ ] **Step 2: Replace both `legend` colour classes (lines 35 and 56)**

Old (appears twice, once per fieldset legend):
```tsx
        <legend className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-2">Player Details</legend>
```
```tsx
        <legend className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-2">Parent / Guardian Details</legend>
```
New:
```tsx
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">Player Details</legend>
```
```tsx
        <legend className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-2">Parent / Guardian Details</legend>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/register/registration-form.tsx
git commit -m "feat: retheme Registration form labels"
```

---

### Task 18: Retheme the Get Involved form

**Files:**
- Modify: `src/components/get-involved/get-involved-form.tsx`

- [ ] **Step 1: Replace the success-state text colours (around line 63)**

Old:
```tsx
        <p className="text-white font-bold text-lg mb-2">Thanks for getting in touch!</p>
        <p className="text-white/50 text-sm mb-6">We&apos;ll be in contact soon.</p>
```
New:
```tsx
        <p className="text-brand-ink font-bold text-lg mb-2">Thanks for getting in touch!</p>
        <p className="text-brand-muted text-sm mb-6">We&apos;ll be in contact soon.</p>
```

- [ ] **Step 2: Replace all five `text-brand-cyan` label classes (lines 75, 88, 102, 115, 135 — includes the "Message" field label, easy to miss since it's further down the file)**

Old (repeated 5x with different label text — Name, Email, Business/Organisation, "I'm interested in...", Message):
```tsx
        <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1 block">
```
New:
```tsx
        <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs mb-1 block">
```

- [ ] **Step 3: Replace the checkbox list item text colour (line 120) and accent colour (line 125)**

Old:
```tsx
            <label key={option} className="flex items-center gap-2 text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={interests.includes(option)}
                onChange={() => toggleInterest(option)}
                className="accent-[#FF0055]"
                disabled={status === 'submitting'}
              />
```
New:
```tsx
            <label key={option} className="flex items-center gap-2 text-brand-ink/80 cursor-pointer">
              <input
                type="checkbox"
                checked={interests.includes(option)}
                onChange={() => toggleInterest(option)}
                className="accent-[#F26522]"
                disabled={status === 'submitting'}
              />
```

- [ ] **Step 4: Commit**

```bash
git add src/components/get-involved/get-involved-form.tsx
git commit -m "feat: retheme Get Involved form"
```

---

### Task 19: Retheme the Payment Options panel

**Files:**
- Modify: `src/components/payment/payment-options-panel.tsx`

- [ ] **Step 1: Replace the loading-state text colour (line 22)**

Old:
```tsx
  if (!settings) return <p className="text-white/60 py-8 text-center">Loading payment options…</p>
```
New:
```tsx
  if (!settings) return <p className="text-brand-muted py-8 text-center">Loading payment options…</p>
```

- [ ] **Step 2: Replace the heading and intro text (around line 40)**

Old:
```tsx
      <h2 className="font-heading text-white text-2xl uppercase tracking-wider">Pay Membership Fee — {fee}</h2>
      <p className="text-sm text-white/60">Choose a payment method below. Once you&apos;ve paid, click the confirmation button so the admin can verify your payment.</p>
```
New:
```tsx
      <h2 className="font-heading text-brand-ink text-2xl uppercase tracking-wider">Pay Membership Fee — {fee}</h2>
      <p className="text-sm text-brand-muted">Choose a payment method below. Once you&apos;ve paid, click the confirmation button so the admin can verify your payment.</p>
```

- [ ] **Step 3: Replace all four payment-method card wrappers' classes**

Old (appears 4x — PayPal, Monzo, Revolut, Cash cards):
```tsx
      <div className="border border-brand-border rounded p-4 space-y-3 bg-brand-surface">
```
New:
```tsx
      <div className="border border-brand-line rounded p-4 space-y-3 bg-brand-tint">
```

- [ ] **Step 4: Replace each card's heading and description text colours**

Old (pattern repeated per card, e.g. PayPal card):
```tsx
        <h3 className="font-bold text-white">Pay via PayPal or Credit/Debit Card</h3>
        <p className="text-sm text-white/60">Opens PayPal. You can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments.</p>
```
New:
```tsx
        <h3 className="font-bold text-brand-ink">Pay via PayPal or Credit/Debit Card</h3>
        <p className="text-sm text-brand-muted">Opens PayPal. You can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments.</p>
```
Apply the same `text-white` → `text-brand-ink` swap to the Monzo heading (`<h3 className="font-bold text-white">Pay via Monzo bank transfer</h3>` → `<h3 className="font-bold text-brand-ink">Pay via Monzo bank transfer</h3>`) and the Revolut heading (`<h3 className="font-bold text-white">Pay via Revolut bank transfer</h3>` → `<h3 className="font-bold text-brand-ink">Pay via Revolut bank transfer</h3>`).

For the Cash card, apply both swaps:
Old:
```tsx
        <h3 className="font-bold text-white">Pay by Cash</h3>
        <p className="text-sm text-white/60">Bring cash to the next training session. Click below to notify the admin.</p>
```
New:
```tsx
        <h3 className="font-bold text-brand-ink">Pay by Cash</h3>
        <p className="text-sm text-brand-muted">Bring cash to the next training session. Click below to notify the admin.</p>
```

- [ ] **Step 5: Replace the Monzo/Revolut detail boxes (dark inset with copy button)**

Old (appears 2x — Monzo and Revolut):
```tsx
        <div className="bg-brand-dark rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-white/80">
```
New:
```tsx
        <div className="bg-brand-creamAlt rounded p-3 font-mono text-sm flex items-center justify-between gap-3 text-brand-ink/80">
```

- [ ] **Step 6: Commit**

```bash
git add src/components/payment/payment-options-panel.tsx
git commit -m "feat: retheme Payment Options panel to light Tangerine Toucans theme"
```

Note: `settings.paypalMeUrl` / `settings.revolutDetails` values themselves are **not** touched here — that's Chunk 7 (the actual account handle migration), gated on the new PayPal/Revolut accounts existing.

---

### Task 20: Visual + test check for Chunk 4

- [ ] **Step 1: View `/register` (both steps) and `/get-involved` in the dev server**

Expected: light cream cards with tangerine accents, no dark boxes except the Monzo/Revolut detail strip (now a warm neutral `creamAlt`, not black).

- [ ] **Step 2: Run tests**

Run: `npx jest`
Expected: `payment-options-panel.test.tsx` still passes (it only asserts on the loading state text, not colours) — no new failures.

---

## Chunk 5: Gallery components + Admin list components

### Task 21: Retheme the Gallery client (filter tabs)

**Files:**
- Modify: `src/components/gallery/gallery-client.tsx`

- [ ] **Step 1: Replace the tab button classes (around line 45)**

Old:
```tsx
            className={`rounded text-xs font-bold uppercase tracking-wider px-3 py-1.5 transition ${
              filter === tab.value
                ? 'bg-brand-primary text-white'
                : 'border border-brand-border text-white/50 hover:border-brand-cyan hover:text-brand-cyan'
            }`}
```
New:
```tsx
            className={`rounded text-xs font-bold uppercase tracking-wider px-3 py-1.5 transition ${
              filter === tab.value
                ? 'bg-brand-primary text-white'
                : 'border border-brand-line text-brand-muted hover:border-brand-primary hover:text-brand-primary'
            }`}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gallery/gallery-client.tsx
git commit -m "feat: retheme Gallery filter tabs"
```

---

### Task 22: Retheme the Media tile

**Files:**
- Modify: `src/components/gallery/media-tile.tsx`

- [ ] **Step 1: Replace line 24**

Old:
```tsx
      className="relative block w-full overflow-hidden group bg-brand-surface transition-transform hover:scale-[1.02]"
```
New:
```tsx
      className="relative block w-full overflow-hidden group bg-brand-tint transition-transform hover:scale-[1.02]"
```

Note: the video-thumbnail dark overlay (`bg-black/30`) and play-icon (`text-white`) are unchanged — that's an overlay on the thumbnail image itself, not page background, same reasoning as the hero photo scrim.

- [ ] **Step 2: Commit**

```bash
git add src/components/gallery/media-tile.tsx
git commit -m "feat: retheme Media tile background"
```

---

### Task 23: Retheme the Upload modal

**Files:**
- Modify: `src/components/gallery/upload-modal.tsx`

- [ ] **Step 1: Replace the modal container and header (around lines 148–151)**

Old:
```tsx
      <div className="bg-brand-surface w-full sm:max-w-xl sm:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-brand-border">
          <h2 className="font-heading text-white uppercase tracking-wider text-lg">Submit a Photo/Video</h2>
          <button
            aria-label="close"
            onClick={handleClose}
            className="text-white/50 hover:text-white text-2xl leading-none"
          >
```
New:
```tsx
      <div className="bg-white w-full sm:max-w-xl sm:rounded-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-brand-line">
          <h2 className="font-heading text-brand-ink uppercase tracking-wider text-lg">Submit a Photo/Video</h2>
          <button
            aria-label="close"
            onClick={handleClose}
            className="text-brand-muted hover:text-brand-ink text-2xl leading-none"
          >
```

- [ ] **Step 2: Replace the "complete" phase text (around line 164)**

Old:
```tsx
              <p className="text-white font-bold text-lg mb-2">Thanks for sharing!</p>
              <p className="text-white/50 text-sm mb-6">Your photos will appear once approved.</p>
```
New:
```tsx
              <p className="text-brand-ink font-bold text-lg mb-2">Thanks for sharing!</p>
              <p className="text-brand-muted text-sm mb-6">Your photos will appear once approved.</p>
```

- [ ] **Step 3: Replace the drop zone (around line 172)**

Old:
```tsx
                className={`border-2 border-dashed rounded-lg p-8 text-center text-white/50 hover:border-brand-cyan transition cursor-pointer ${isDragging ? 'border-brand-primary' : 'border-brand-border'}`}
```
New:
```tsx
                className={`border-2 border-dashed rounded-lg p-8 text-center text-brand-muted hover:border-brand-primary transition cursor-pointer ${isDragging ? 'border-brand-primary' : 'border-brand-line'}`}
```

- [ ] **Step 4: Replace the file-preview thumbnail placeholder and progress bar (around lines 204–226)**

Old:
```tsx
                        <div className="aspect-square bg-brand-border rounded overflow-hidden">
                          {entry.preview
                            ? <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-white/30 text-2xl">▶</div>
                          }
                        </div>
```
New:
```tsx
                        <div className="aspect-square bg-brand-creamAlt rounded overflow-hidden">
                          {entry.preview
                            ? <img src={entry.preview} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-brand-mutedWarm text-2xl">▶</div>
                          }
                        </div>
```
Old:
```tsx
                        {/* Progress bar */}
                        {entry.status === 'uploading' && (
                          <div className="mt-1 bg-brand-border rounded-full h-1">
```
New:
```tsx
                        {/* Progress bar */}
                        {entry.status === 'uploading' && (
                          <div className="mt-1 bg-brand-creamAlt rounded-full h-1">
```

- [ ] **Step 5: Replace the "Uploaded"/error status text and the name-field label (around lines 228, 246)**

Old:
```tsx
                        {entry.status === 'done' && (
                          <p className="text-brand-cyan text-[10px] mt-1 text-center">✓ Uploaded</p>
                        )}
```
New:
```tsx
                        {entry.status === 'done' && (
                          <p className="text-brand-primaryDeep text-[10px] mt-1 text-center">✓ Uploaded</p>
                        )}
```
Old:
```tsx
                    <label className="text-brand-cyan font-bold uppercase tracking-wider text-xs block mb-1">
```
New:
```tsx
                    <label className="text-brand-primaryDeep font-bold uppercase tracking-wider text-xs block mb-1">
```

Note: `bg-black/80` (modal backdrop) and `bg-black/60` (remove-file × button) are unchanged — those are overlay scrims, not theme surfaces.

- [ ] **Step 6: Commit**

```bash
git add src/components/gallery/upload-modal.tsx
git commit -m "feat: retheme Upload modal to light Tangerine Toucans theme"
```

---

### Task 24: Retheme the admin Get Involved submissions list

**Files:**
- Modify: `src/components/admin/get-involved-submissions.tsx`
- Test: `src/components/gallery/__tests__/masonry-grid.test.tsx` (unrelated component, but shares the mechanical ID rename — see Task 26)

- [ ] **Step 1: Replace the card wrapper and text colours (around lines 40–59)**

Old:
```tsx
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
```
New:
```tsx
            className={`bg-brand-tint border border-brand-line rounded p-4 ${item.handled ? 'opacity-40' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-brand-ink font-bold text-sm">{item.name}</p>
                <a href={`mailto:${item.email}`} className="text-brand-primaryDeep text-xs">{item.email}</a>
                {item.organisation && (
                  <p className="text-brand-muted text-xs mt-0.5">
                    <span className="text-brand-mutedWarm">Org:</span> {item.organisation}
                  </p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.interests.map(interest => (
                    <span key={interest} className="bg-brand-creamAlt text-brand-muted rounded px-2 py-0.5 text-xs">
                      {interest}
                    </span>
                  ))}
                </div>
                {item.message && <p className="text-brand-muted text-xs mt-2">{item.message}</p>}
                <p className="text-brand-mutedWarm text-xs mt-1">{formatDate(item.submitted_at)}</p>
              </div>
              <div className="flex-shrink-0">
                {item.handled ? (
                  <span className="text-brand-mutedWarm text-xs font-bold uppercase">Handled</span>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/get-involved-submissions.tsx
git commit -m "feat: retheme admin Get Involved submissions list"
```

---

### Task 25: Retheme the admin Pending submissions list

**Files:**
- Modify: `src/components/admin/pending-submissions.tsx`

- [ ] **Step 1: Replace the card wrapper, thumbnail, and text colours (around lines 57–75)**

Old:
```tsx
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
```
New:
```tsx
            className="flex gap-4 items-start bg-brand-tint border border-brand-line rounded p-3"
          >
            {/* Thumbnail */}
            <div className="w-16 h-16 rounded bg-brand-creamAlt overflow-hidden flex-shrink-0 flex items-center justify-center">
              {item.type === 'photo' ? (
                <img
                  src={`https://res.cloudinary.com/${cloud}/image/upload/w_120,h_120,c_fill,q_auto,f_auto/${item.cloudinary_public_id}`}
                  alt={item.caption ?? ''}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-brand-mutedWarm text-2xl">▶</span>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-brand-ink font-bold text-sm">{item.submitter_name ?? 'Anonymous'}</p>
              {item.caption && <p className="text-brand-muted text-xs mt-0.5">{item.caption}</p>}
              <p className="text-brand-mutedWarm text-xs mt-0.5">{formatDate(item.uploaded_at)}</p>
            </div>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/pending-submissions.tsx
git commit -m "feat: retheme admin Pending submissions list"
```

---

### Task 26: Update test fixtures with old Bocas-based IDs (mechanical rename, unrelated to theme)

**Files:**
- Modify: `src/components/gallery/__tests__/masonry-grid.test.tsx:6`
- Modify: `src/__tests__/components/pending-submissions.test.tsx:13,61`

- [ ] **Step 1: Update the Cloudinary public ID fixture in `masonry-grid.test.tsx`**

Old:
```tsx
const photos: Media[] = [
  { id: '1', cloudinary_public_id: 'bocas/photo1', type: 'photo',
```
New:
```tsx
const photos: Media[] = [
  { id: '1', cloudinary_public_id: 'tangerine-toucans/photo1', type: 'photo',
```

- [ ] **Step 2: Update the Cloudinary public ID fixture in `pending-submissions.test.tsx` (two occurrences: the fixture object and the assertion)**

Old (line 13):
```tsx
  cloudinary_public_id: 'bocas-juniors/test-photo',
```
New:
```tsx
  cloudinary_public_id: 'tangerine-toucans/test-photo',
```
Old (line 61):
```tsx
      expect(actions.rejectSubmission).toHaveBeenCalledWith('1', 'bocas-juniors/test-photo', 'image')
```
New:
```tsx
      expect(actions.rejectSubmission).toHaveBeenCalledWith('1', 'tangerine-toucans/test-photo', 'image')
```

- [ ] **Step 3: Run both test files**

Run: `npx jest masonry-grid pending-submissions`
Expected: `PASS` for both suites.

- [ ] **Step 4: Commit**

```bash
git add src/components/gallery/__tests__/masonry-grid.test.tsx src/__tests__/components/pending-submissions.test.tsx
git commit -m "test: update fixture IDs to tangerine-toucans naming"
```

---

### Task 27: Visual + test check for Chunk 5

- [ ] **Step 1: View `/gallery` and `/admin` (log in first) in the dev server**

Expected: light cream/tint cards throughout, filter tabs and upload modal match the new theme.

- [ ] **Step 2: Run the full test suite**

Run: `npx jest`
Expected: all 17 suites pass (same suite count as before this chunk — no test files added or removed, only fixture values updated).

---

## Chunk 6: Admin / Login / Profile parity pass

These three pages were left on the original light Tailwind-default styling during the prior dark-theme redesign (no `brand-*` classes at all) — they're already visually close to the new cream/light theme. This pass brings them to full brand parity: heading font, brand-coloured accents, consistent page background.

### Task 28: Brand the Admin dashboard page

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace the `<main>` wrapper and heading (lines 24–29)**

Old:
```tsx
    <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>
```
New:
```tsx
    <main className="bg-brand-cream min-h-screen max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>
```

- [ ] **Step 2: Replace the two section headings (lines 37, 44)**

Old:
```tsx
        <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
```
```tsx
        <h2 className="text-lg font-semibold mb-3">Upload Media</h2>
```
New:
```tsx
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Players ({players.length})</h2>
```
```tsx
        <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Upload Media</h2>
```

- [ ] **Step 3: Apply the same heading treatment inside `get-involved-submissions.tsx` and `pending-submissions.tsx`**

In both `src/components/admin/get-involved-submissions.tsx` and `src/components/admin/pending-submissions.tsx`, their `<h2 className="text-lg font-semibold mb-3">...</h2>` headings ("Get Involved Submissions (...)" and "Pending Submissions (...)") get the same swap:

Old pattern:
```tsx
      <h2 className="text-lg font-semibold mb-3">
```
New pattern:
```tsx
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx src/components/admin/get-involved-submissions.tsx src/components/admin/pending-submissions.tsx
git commit -m "feat: apply Tangerine Toucans heading style across admin dashboard"
```

---

### Task 29: Brand the Login page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Replace the `<main>` wrapper and heading (lines 27, 29)**

Old:
```tsx
    <main className="py-12 px-4">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <h1 className="text-2xl font-bold">Log In</h1>
```
New:
```tsx
    <main className="bg-brand-cream min-h-screen py-12 px-4">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">Log In</h1>
```

- [ ] **Step 2: Run the login page's existing test to confirm nothing broke**

Run: `npx jest login`
Expected: `PASS` — check `src/app/login/__tests__/page.test.tsx` first to confirm it doesn't assert on the removed classes (it tests form behavior, not styling, per the existing test suite patterns seen elsewhere in this repo).

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: apply Tangerine Toucans styling to Login page"
```

---

### Task 30: Brand the Profile page

**Files:**
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Replace the `<main>` wrapper and heading (lines 21–22)**

Old:
```tsx
    <main className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-bold">My Profile</h1>
```
New:
```tsx
    <main className="bg-brand-cream min-h-screen max-w-2xl mx-auto py-8 px-4 space-y-8">
      <h1 className="font-heading text-2xl uppercase tracking-wide text-brand-ink">My Profile</h1>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "feat: apply Tangerine Toucans styling to Profile page"
```

---

### Task 31: Visual + test check for Chunk 6

- [ ] **Step 1: View `/login`, `/profile`, `/admin` in the dev server**

Expected: cream backgrounds, condensed uppercase headings matching the rest of the site, no leftover generic `font-bold` headings.

- [ ] **Step 2: Run the full test suite**

Run: `npx jest`
Expected: all suites still pass.

---

## Chunk 7: Payment account handles + Cloudinary folder migration

### ⚠️ Blocking dependency

Before starting this chunk, **confirm with the user** that:
1. A new PayPal.me link exists for the Tangerine Toucans (e.g. `paypal.me/tangerinetoucans` — exact slug depends on availability, confirm the real one).
2. A new Revolut handle/account exists under the Tangerine Toucans name (e.g. `@tangerinetoucans` — confirm the real one).

Do not fabricate placeholder values and ship them — the spec explicitly flags these as real external accounts (see spec Section 1, "Payment account handles"). If not yet confirmed, stop here and surface this back to the user; do not proceed to Task 32.

### Task 32: Migrate payment handles in the database

**Files:**
- Create: `supabase/migrations/005_update_payment_handles.sql`
- Modify: `src/components/payment/__tests__/payment-options-panel.test.tsx:6,8`

- [ ] **Step 1: Write the migration** (replace `<NEW_PAYPAL_URL>` / `<NEW_REVOLUT_HANDLE>` with the confirmed real values before running)

```sql
update settings set value = '<NEW_PAYPAL_URL>', updated_at = now() where key = 'paypal_me_url';
update settings set value = '<NEW_REVOLUT_HANDLE> on Revolut', updated_at = now() where key = 'revolut_details';
```

- [ ] **Step 2: Apply the migration** (adjust to however this project applies migrations — check for a Supabase CLI setup or apply directly via Supabase Studio's SQL editor, matching how `002_seed_settings.sql`'s trailing comment already implies manual application is the norm for this table)

- [ ] **Step 3: Update the test fixture to match**

Old (`payment-options-panel.test.tsx` lines 6, 8):
```tsx
    paypalMeUrl: 'https://paypal.me/bocasjuniorsfc',
    monzoDetails: 'Sort: 04-00-04 / Acc: 12345678',
    revolutDetails: '@bocasjuniorsfc',
```
New (use the same real values from Step 1):
```tsx
    paypalMeUrl: '<NEW_PAYPAL_URL>',
    monzoDetails: 'Sort: 04-00-04 / Acc: 12345678',
    revolutDetails: '<NEW_REVOLUT_HANDLE>',
```

- [ ] **Step 4: Run the test**

Run: `npx jest payment-options-panel`
Expected: `PASS`.

- [ ] **Step 5: Verify in the running app**

View `/register` (payment step) or `/profile` in the dev server — confirm the PayPal link and Revolut handle shown match the new values.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/005_update_payment_handles.sql src/components/payment/__tests__/payment-options-panel.test.tsx
git commit -m "feat: migrate payment account handles to Tangerine Toucans"
```

---

### Task 33: Migrate the Cloudinary upload folder

**Files:**
- Create: `scripts/migrate-cloudinary-folder.ts` (one-off, not part of the app — safe to delete after running, but commit it for the record)
- Modify: `src/app/api/cloudinary/sign/route.ts:26,34`

- [ ] **Step 1: Write the migration script**

```typescript
// One-off script: move all assets from the 'bocas-juniors' Cloudinary folder
// to 'tangerine-toucans'. Safe to re-run — skips assets already in the target folder.
// Writes the pre-migration resource list to disk so the move is auditable/reversible
// (rename each entry back to its original public_id if something goes wrong).
import { v2 as cloudinary } from 'cloudinary'
import { writeFileSync } from 'fs'

const OLD_FOLDER = 'bocas-juniors'
const NEW_FOLDER = 'tangerine-toucans'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Cloudinary paginates at 500 results max per call — must follow next_cursor
// until exhausted, or a folder with >500 assets silently only gets partially counted.
async function listAllResources(prefix: string) {
  const all: { public_id: string; resource_type: string }[] = []
  let cursor: string | undefined
  do {
    const page = await cloudinary.api.resources({
      type: 'upload', prefix, max_results: 500, next_cursor: cursor,
    })
    all.push(...page.resources)
    cursor = page.next_cursor
  } while (cursor)
  return all
}

async function main() {
  const before = await listAllResources(OLD_FOLDER)
  console.log(`Found ${before.resources?.length ?? before.length} assets in '${OLD_FOLDER}'`)
  writeFileSync('cloudinary-migration-before.json', JSON.stringify(before, null, 2))
  console.log(`Wrote pre-migration list to cloudinary-migration-before.json (needed to roll back)`)

  let moved = 0
  let skipped = 0
  for (const resource of before) {
    const newPublicId = resource.public_id.replace(`${OLD_FOLDER}/`, `${NEW_FOLDER}/`)
    try {
      await cloudinary.uploader.rename(resource.public_id, newPublicId, { resource_type: resource.resource_type })
      moved++
    } catch (e: any) {
      if (e?.error?.message?.includes('already exists')) {
        skipped++
      } else {
        console.error(`Failed to move ${resource.public_id}:`, e)
      }
    }
  }
  console.log(`Moved ${moved}, skipped ${skipped} (already migrated)`)

  const after = await listAllResources(NEW_FOLDER)
  console.log(`'${NEW_FOLDER}' now contains ${after.length} assets`)

  if (after.length < before.length) {
    console.error(`WARNING: count mismatch — before had ${before.length}, after has ${after.length}. Do NOT proceed to Step 4 (do not point the app at the new folder) until this is resolved.`)
    process.exitCode = 1
  }
}

main()
```

- [ ] **Step 2: Run the script**

Run: `npx tsx scripts/migrate-cloudinary-folder.ts` (ts-node 10.9.2 is incompatible with Node 22's module loader — `npx tsx` runs the same script without needing any project changes)
Expected: logs the count found in `bocas-juniors`, then the count in `tangerine-toucans` after migration, with the two matching, and no WARNING line. If Cloudinary's `rename` API isn't available on this account's plan, the script will fail on the first `rename` call — in that case, fall back to downloading + re-uploading each resource under the new public ID instead (same before/after count verification applies, same pre-migration list saved for rollback).

- [ ] **Step 3: Verify the counts match — hard gate before Step 4**

Check the script's final log line — it should NOT print the WARNING, and `process.exitCode` should be `0` (check with `echo $?` right after running). **If the count mismatches, stop here.** Do not proceed to Step 4 — leave `src/app/api/cloudinary/sign/route.ts` pointed at `bocas-juniors` so uploads/reads keep working against the folder that's confirmed complete, and investigate the mismatch (check Cloudinary's dashboard directly, re-run the script — it's idempotent — or manually rename the missing assets via the Cloudinary console using the `cloudinary-migration-before.json` list as the source of truth for what should exist). Only move to Step 4 once counts match exactly.

- [ ] **Step 4: Update the app to read from the new folder**

Old (`src/app/api/cloudinary/sign/route.ts` lines 26, 34):
```ts
  const paramsToSign = { timestamp, folder: 'bocas-juniors' }
```
```ts
    folder: 'bocas-juniors',
```
New:
```ts
  const paramsToSign = { timestamp, folder: 'tangerine-toucans' }
```
```ts
    folder: 'tangerine-toucans',
```

- [ ] **Step 5: Manually verify a new upload works end-to-end**

In the dev server, log in as admin, use the Upload Media panel to upload a test image, then confirm in Cloudinary's media library that it landed in `tangerine-toucans/`.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-cloudinary-folder.ts src/app/api/cloudinary/sign/route.ts
git commit -m "feat: migrate Cloudinary upload folder to tangerine-toucans"
```

---

## Chunk 8: Final verification

### Task 34: Repo-wide sweep for leftover old branding

- [ ] **Step 1: Confirm no unintended "Bocas" references remain**

Run: `grep -rn "Bocas Juniors\|bocas-juniors" --include="*.ts" --include="*.tsx" src/ supabase/ package.json package-lock.json`
Expected: zero results, or only the intentionally-kept ones if any were missed by earlier tasks — cross-check any hits against spec Section 1's explicit exclusions (`bocas-dance-logo.png`, "Bocas del Toro" location text, Cloudinary folder already handled in Chunk 7). `package-lock.json` is included here as a backstop in case Task 6's `npm install` step was skipped.

Also check `supabase/config.toml`'s `project_id = "bocas-juniors-fc"` — this is a local Supabase CLI project identifier, not user-facing copy, and isn't in the spec's renaming scope. Confirm with the user whether it should be renamed too (it's a low-risk rename since it's purely local tooling config) or left as-is; don't change it silently either way.

- [ ] **Step 2: Confirm no leftover old hex colours**

Run: `grep -rn "#FF0055\|#00E5FF\|#0A0A0A\|#111111\|#1E1E1E\|#AC8D4E\|rgba(255, *0, *85" --include="*.ts" --include="*.tsx" --include="*.css" src/ tailwind.config.ts`
Expected: zero results. This includes the old `brand.gold` hex (`#AC8D4E`, retired in favour of `brand.accent` `#FFB627` per spec Section 2) and the old hot-pink `box-shadow` RGB literal from `globals.css`'s `.btn-primary`, in addition to the four dark-theme hex values — and now scans `tailwind.config.ts` directly, since that's where the entire old `brand.*` block lived and where a partial edit would most plausibly leave a leftover value.

- [ ] **Step 3: Confirm no leftover `brand-dark`, `brand-surface`, `brand-border`, `brand-cyan` class references**

Run: `grep -rln "brand-dark\|brand-surface\|brand-border\|brand-cyan" --include="*.tsx" --include="*.css" src/`
Expected: zero results — every file from the spec's 15-file list plus `globals.css` should have been updated by Chunks 1–6.

- [ ] **Step 4: Confirm no leftover old font names or CSS variables**

Run: `grep -rn "Anton\|Montserrat\|font-anton\|font-montserrat" --include="*.ts" --include="*.tsx" --include="*.css" src/`
Expected: zero results — `src/app/layout.tsx` (the `next/font/google` import and variable names) and `src/app/globals.css` (the hardcoded `h1, h2, h3` font-family rule) both referenced the old font names directly, not just via the `font-heading`/`font-body` Tailwind classes, and must have been updated in Chunk 1.

- [ ] **Step 5: Full test suite**

Run: `npx jest`
Expected: all suites pass.

- [ ] **Step 6: Full build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Final manual walkthrough**

Click through every page in the dev server (`/`, `/contact`, `/gallery`, `/register`, `/get-involved`, `/login`, `/profile`, `/admin`) and confirm: consistent cream/tangerine theme, new logo everywhere, "Tangerine Toucans" name throughout, Barlow Condensed headings and Inter body text rendering (not falling back to a system sans-serif), no leftover dark-theme cards or "Bocas" text.

- [ ] **Step 8: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: final verification pass for Tangerine Toucans rebrand"
```

---

## Chunk 9: Follow-up — content sub-components on /admin and /profile

Found during the final holistic branch review (not by any per-task review): Chunk 6's Tasks 28-30 only rethemed the `/admin` and `/profile` page *shells* (the `<main>` wrapper and top-level headings) — they never mention the actual content components rendered inside those pages. Four of those components are still on plain default Tailwind gray, sitting directly on the new cream page background next to `bg-brand-tint` cards elsewhere on the same page:

- `src/components/profile/player-info.tsx` — `bg-gray-50` card, plain `text-lg font-semibold` heading
- `src/components/profile/payment-history.tsx` — `bg-gray-100` table header, plain heading, `text-gray-500` empty-state text
- `src/components/admin/players-table.tsx` — `bg-gray-100` table header
- `src/components/admin/media-uploader.tsx` — `border-gray-300` dropzone, `text-gray-600` instructional text

`src/components/admin/pending-payments.tsx`'s `bg-yellow-50`/`border-yellow-200`/`text-yellow-800` is deliberately **left unchanged** — it's a semantic warning callout, same category as the already-unchanged `.btn-success`/`.btn-danger`, not a generic content container.

### Task 35: Retheme the remaining admin/profile content components

**Files:**
- Modify: `src/components/profile/player-info.tsx`
- Modify: `src/components/profile/payment-history.tsx`
- Modify: `src/components/admin/players-table.tsx`
- Modify: `src/components/admin/media-uploader.tsx`

- [ ] **Step 1: `player-info.tsx`**

Old:
```tsx
    <section className="bg-gray-50 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Player Details</h2>
```
New:
```tsx
    <section className="bg-brand-tint rounded-lg p-4">
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-2">Player Details</h2>
```

- [ ] **Step 2: `payment-history.tsx`**

Old:
```tsx
  if (payments.length === 0) return <p className="text-gray-500">No payments yet.</p>
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Payment History</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
```
New:
```tsx
  if (payments.length === 0) return <p className="text-brand-muted">No payments yet.</p>
  return (
    <section>
      <h2 className="font-heading text-lg uppercase tracking-wide text-brand-ink mb-3">Payment History</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-brand-creamAlt">
```

- [ ] **Step 3: `players-table.tsx`**

Old:
```tsx
        <thead className="bg-gray-100">
```
New:
```tsx
        <thead className="bg-brand-creamAlt">
```

- [ ] **Step 4: `media-uploader.tsx`**

Old:
```tsx
      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
```
```tsx
      <p className="text-gray-600 mb-3">Drag and drop photos/videos, or click to select</p>
```
New:
```tsx
      className="border-2 border-dashed border-brand-line rounded-lg p-6 text-center"
```
```tsx
      <p className="text-brand-muted mb-3">Drag and drop photos/videos, or click to select</p>
```

- [ ] **Step 5: Run tests and build**

Run: `npx jest && npm run build`
Expected: all suites pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/components/profile/player-info.tsx src/components/profile/payment-history.tsx src/components/admin/players-table.tsx src/components/admin/media-uploader.tsx
git commit -m "feat: retheme remaining admin/profile content components"
```
