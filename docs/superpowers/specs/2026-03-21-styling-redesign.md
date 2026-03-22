# Bocas Juniors FC — Styling Redesign Spec

**Date:** 2026-03-21
**Scope:** Full visual redesign of all public-facing pages (home, register, contact, gallery) and nav. The `/login`, `/profile`, and `/admin` pages are explicitly out of scope for this pass.

---

## Design Direction

Bold, punchy, punk-rock tropical. Dark base with electric accent colours. Anton headings treated as graphic elements. Inspired by Japanese sports poster aesthetics with a Caribbean island energy. No light backgrounds on public-facing pages.

---

## Colour System

### tailwind.config.ts changes

Update the `brand` colour object as follows — this is the full replacement, not a patch:

```ts
brand: {
  primary:  '#FF0055',   // Hot pink — primary buttons, left-border accents
  cyan:     '#00E5FF',   // Electric cyan — active states, labels, outlines, borders
  gold:     '#AC8D4E',   // Sand Gold — nav active underline (unchanged)
  dark:     '#0A0A0A',   // Near-black — page and nav backgrounds
  surface:  '#111111',   // Dark card/section backgrounds
  border:   '#1E1E1E',   // Subtle dividers
  white:    '#FFFFFF',
}
// Note: brand-black is removed — use brand-dark or brand-surface instead.
// Anton is already loaded via next/font/google in src/app/layout.tsx — no changes needed there.

```

Tokens removed: `brand-secondary` (#30407E) and `brand-teal` (#579BA6).

**Before removing these tokens from the config, do a full codebase search for `brand-secondary` and `brand-teal` and replace all usages.** Known occurrences:
- `nav.tsx` — `bg-brand-secondary` (replace with `bg-brand-dark`)
- `page.tsx` — `bg-brand-secondary` on CTA button (replace per new design below)
- Any other occurrences found in the search must also be replaced

### globals.css changes

- Remove the `@media (prefers-color-scheme: dark)` block entirely — the site is always dark
- Set `body` background to `bg-brand-dark` (`#0A0A0A`) and text to white
- Update component classes:
  - `.btn-primary` → `bg-brand-primary text-white px-4 py-2 rounded font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 transition shadow-[0_4px_16px_rgba(255,0,85,0.4)]`
  - `.btn-secondary` → `border-2 border-brand-cyan text-brand-cyan px-4 py-2 rounded font-bold uppercase tracking-wider hover:bg-brand-cyan hover:text-black transition`
  - `.input` focus ring → `focus:ring-brand-primary focus:border-brand-primary`
  - Add `.page-header` (see PageHeader component section)

---

## Assets

- `public/logo.png` — Club badge (transparent background). ✅ Already in place.
- `public/beach-hero.jpg` — Training ground beach photo. ✅ Already in place.

---

## Nav

**File:** `src/components/nav.tsx`

- Background: `bg-brand-dark`
- Bottom border: `border-b-[3px] border-brand-cyan`
- Left: `<Image src="/logo.png" width={48} height={48} alt="Bocas Juniors FC">` — replaces the text wordmark entirely
- Remove `<Link href="/">Bocas Juniors FC</Link>` text wordmark
- Nav links (right side):
  - Default: `text-white/75 text-xs font-bold uppercase tracking-wider`
  - Active (current pathname): `text-brand-cyan` — colour change only, no underline
- Log In link: replace `hover:underline` style with `bg-brand-primary text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded`
- **Authenticated state** (My Profile + Log Out):
  - "My Profile" → same pill style as Log In but `bg-brand-surface border border-brand-border`
  - "Log Out" → plain text `text-white/60 text-xs font-bold uppercase tracking-wider hover:text-white`

---

## Home Page

**File:** `src/app/page.tsx`

### Hero Section

Replace the existing `<section className="bg-brand-primary ...">` with:

```tsx
<section className="relative min-h-[500px] flex items-center justify-center text-center overflow-hidden">
  <Image
    src="/beach-hero.jpg"
    alt="Bocas Juniors FC training on the beach"
    fill
    className="object-cover"
    style={{ objectPosition: 'center 35%' }}
    priority
  />
  {/* Dark gradient overlay */}
  <div className="absolute inset-0" style={{
    background: 'linear-gradient(to bottom, rgba(8,4,24,0.38) 0%, rgba(8,4,24,0.52) 50%, rgba(8,4,24,0.82) 100%)'
  }} />
  {/* Content */}
  <div className="relative flex flex-col items-center px-6 py-16">
    <Image src="/logo.png" width={120} height={120} alt="Bocas Juniors FC" className="mb-5 drop-shadow-2xl" />
    <h1 className="font-heading text-white uppercase tracking-widest" style={{ fontSize: '4.5rem', lineHeight: 1 }}>
      Bocas Juniors FC
    </h1>
    <p className="text-brand-cyan font-bold uppercase tracking-[0.3em] text-xs mt-3">
      Youth Football · Bocas del Toro, Panama
    </p>
    <div className="flex gap-4 mt-7 flex-wrap justify-center">
      <Link href="/register" className="btn-primary">Register Your Child</Link>
      <Link href="/gallery" className="btn-secondary">View Gallery</Link>
    </div>
  </div>
</section>
```

### CTA Section

Replace `<section className="py-12 px-4 bg-gray-50 ...">` with:

- Background: `bg-brand-surface`
- Top border: `border-t-[3px] border-brand-cyan`
- Heading: Anton, white, uppercase
- Body text: `text-white/60`
- Button: `btn-primary`

---

## PageHeader Component (new)

**File:** `src/components/page-header.tsx`

```tsx
export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="bg-brand-surface border-l-4 border-brand-primary px-6 py-5">
      <h1 className="font-heading text-white uppercase tracking-wider text-3xl">{title}</h1>
      {subtitle && <p className="text-brand-cyan font-bold uppercase tracking-[0.25em] text-xs mt-1">{subtitle}</p>}
    </div>
  )
}
```

Use this component at the top of the content area on: **Contact**, **Register**, and **Gallery** pages.

---

## Contact Page

**File:** `src/app/contact/page.tsx`

- Wrap page in `bg-brand-dark min-h-screen`
- Add `<PageHeader title="Contact Us" subtitle="Get in touch with the team" />`
- Staff cards:
  - Background: `bg-brand-surface`
  - Border: `border border-brand-border border-l-[3px] border-l-brand-primary rounded`
  - Name: `text-white font-black text-base`
  - Role: `text-brand-cyan font-bold uppercase tracking-widest text-xs mt-1 mb-2`
  - Email link: `text-brand-primary underline`
  - Phone/other: `text-white/50 text-sm`

---

## Register Page

**File:** `src/app/register/page.tsx`
**File:** `src/components/register/registration-form.tsx`
**File:** `src/components/payment/payment-options-panel.tsx`

- Both step 1 and step 2 `<main>` elements must have `bg-brand-dark min-h-screen` — there are two conditional renders in `register/page.tsx`, apply the dark wrapper to both
- Add `<PageHeader title="Register" subtitle="Sign your child up today" />` on the register step
- **Step indicator** (two segments, full width, no gap):
  - Active step: `bg-brand-primary text-white`
  - Inactive step: `bg-brand-surface text-white/40`
  - Font: `font-bold uppercase tracking-wider text-xs py-2 text-center flex-1`
- **Form fields** in `registration-form.tsx`:
  - Labels: `text-brand-cyan font-bold uppercase tracking-wider text-xs mb-1`
  - Inputs: `.input` class (updated in globals.css) — dark background, brand-border border, white text
  - Fieldset legends: `text-brand-cyan` (replace any existing `text-brand-primary` on legends)
- Submit button: `.btn-primary w-full` with pink glow shadow

### PaymentOptionsPanel (step 2)

- Payment method cards: replace `bg-gray-50` with `bg-brand-surface`, replace `border rounded-lg` with `border border-brand-border rounded`
- Card headings: `text-white font-bold`
- Body copy: `text-white/60`
- "I've paid" / confirmation buttons: `.btn-primary` (hot pink)
- Any secondary/cancel actions: `.btn-secondary` (cyan outline)

---

## Gallery Page

**File:** `src/app/gallery/page.tsx`
**File:** `src/components/gallery/gallery-client.tsx`
**File:** `src/components/gallery/media-tile.tsx`

- Wrap page in `bg-brand-dark min-h-screen`
- Remove the existing `<h1>` from `gallery/page.tsx` and replace it with `<PageHeader title="Gallery" subtitle="Photos & videos from the pitch" />`
- **Filter tabs** (add to `gallery-client.tsx`, filter the displayed media client-side by type):
  - State: `'all' | 'photo' | 'video'`
  - Tabs: "All" / "Photos" / "Videos"
  - Active: `bg-brand-primary text-white`
  - Inactive: `border border-brand-border text-white/50 hover:border-brand-cyan hover:text-brand-cyan`
  - Style: `rounded text-xs font-bold uppercase tracking-wider px-3 py-1.5`
- **Masonry tiles** (`media-tile.tsx`):
  - Background placeholder: `bg-brand-surface`
  - On hover: add `after:` overlay with `bg-brand-primary/20` + `scale-[1.02]` on the tile

---

## Files Touched (complete list)

- `tailwind.config.ts`
- `src/app/globals.css`
- `src/components/nav.tsx`
- `src/app/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/register/page.tsx`
- `src/components/register/registration-form.tsx`
- `src/components/payment/payment-options-panel.tsx`
- `src/app/gallery/page.tsx`
- `src/components/gallery/gallery-client.tsx`
- `src/components/gallery/media-tile.tsx`
- `src/components/page-header.tsx` ← new file
