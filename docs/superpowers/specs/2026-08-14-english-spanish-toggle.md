# Bocas Juniors FC — English/Spanish Toggle Spec

**Date:** 2026-08-14
**Scope:** Add an EN/ES language toggle covering all static UI text on the public-facing site (nav, buttons, headings, form labels, static marketing copy). Admin-entered dynamic content (announcements, staff bios, get-involved copy) is not translated — it displays in whatever language it was entered. The admin panel (`/admin`) stays English-only. No URL restructuring — one URL per page, language selection persisted via cookie.

---

## Overview

A lightweight, hand-rolled i18n layer — no new dependency (`next-intl` etc. would require restructuring every route under a `[locale]` segment, which is out of scope). A `locale` cookie (`en` | `es`, default `en`) is the source of truth. Translation dictionaries are plain TypeScript objects, one file per language, with the Spanish dictionary type-checked against the English one via `satisfies typeof en` — this makes a missing or mistyped translation key a compile error, not a runtime gap. Text is accessed via direct property access (`t.nav.home`), not magic string keys, so typos are caught by TypeScript and editors get autocomplete.

Server components read the cookie directly; client components read from a small context seeded server-side (avoids a flash of the wrong language on load). The toggle button lives in the nav, writes the cookie, and calls `router.refresh()` so server-rendered text updates without a full page reload.

Public-facing server actions that currently return hardcoded English error/success strings are changed to return string-literal **codes** instead, translated client-side — keeps the data layer language-agnostic.

I will draft the Spanish translations. **A native/fluent Spanish speaker should review them before this goes live** — this is not a substitute for that review, especially for a real club-facing site.

---

## Locale Infrastructure

**File:** `src/lib/i18n/locale.ts` ← new

```ts
export type Locale = 'en' | 'es'
export const DEFAULT_LOCALE: Locale = 'en'

export function parseLocale(value: string | undefined): Locale {
  return value === 'es' ? 'es' : DEFAULT_LOCALE
}
```

**File:** `src/lib/i18n/get-locale.ts` ← new (server-only — imports `next/headers`)

```ts
import { cookies } from 'next/headers'
import { parseLocale, type Locale } from './locale'

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return parseLocale(cookieStore.get('locale')?.value)
}
```

`parseLocale`'s cookie-parsing/default behavior is the one piece of real logic here — this is what gets a unit test (see Testing section). It's split into its own file from `get-locale.ts` specifically so it can be tested without needing to mock `next/headers`.

**Cookie name:** `locale`. **Written client-side** (not via a server action — this is a non-sensitive UI preference, a plain cookie write is fine):
```ts
document.cookie = `locale=${value}; path=/; max-age=31536000; samesite=lax`
```

---

## Translation Dictionaries

**File:** `src/lib/i18n/en.ts` ← new
**File:** `src/lib/i18n/es.ts` ← new

One namespace per page/shared-component, e.g.:

```ts
// en.ts
export const en = {
  nav: { home: 'Home', team: 'Team', league: 'League', gallery: 'Gallery', announcements: 'Announcements', getInvolved: 'Get Involved', contact: 'Contact', register: 'Register', login: 'Log In', profile: 'My Profile', logout: 'Log Out' },
  common: { submit: 'Submit', cancel: 'Cancel', save: 'Save', loading: 'Loading…', close: 'Close' },
  home: { /* hero, sponsors section, CTA copy */ },
  team: { title: 'Our Team', subtitle: 'Coaches & Admin Staff', empty: 'No staff members listed yet.', readMore: 'Read more', showLess: 'Show less', background: 'Background', qualifications: 'Qualifications', philosophy: 'Coaching Philosophy', favouriteTeam: 'Favourite Team', funFact: 'Fun Fact' },
  contact: { /* ... */ },
  getInvolved: { /* form labels, CTA copy — not the admin-entered sponsor content itself */ },
  gallery: { submitPhoto: 'Submit a Photo/Video', /* ... */ },
  announcements: { /* page chrome only — announcement bodies are admin content, not translated */ },
  league: { /* standings/fixtures page chrome */ },
  register: { /* registration form labels, validation copy, plan descriptions */ },
  login: { /* ... */ },
  profile: { /* ... */ },
} as const

// es.ts
export const es = {
  nav: { home: 'Inicio', team: 'Equipo', ... },
  ...
} satisfies typeof en
```

`as const` on `en` gives literal string types (not just `string`), so `satisfies typeof en` on `es` genuinely checks key structure, not just "any strings present."

---

## Locale Context (client)

**File:** `src/lib/i18n/locale-context.tsx` ← new

```tsx
'use client'
import { createContext, useContext, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Locale } from './locale'
import { en } from './en'
import { es } from './es'

const dictionaries = { en, es }
const LocaleContext = createContext<{ locale: Locale; t: typeof en; setLocale: (l: Locale) => void } | null>(null)

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale)
  const router = useRouter()

  function setLocale(next: Locale) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`
    setLocaleState(next)
    router.refresh()
  }

  return (
    <LocaleContext.Provider value={{ locale, t: dictionaries[locale], setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider')
  return ctx
}
```

---

## Root Layout Wiring

**File:** `src/app/layout.tsx` — becomes `async`, reads locale, wraps children:

```tsx
import { getLocale } from '@/lib/i18n/get-locale'
import { LocaleProvider } from '@/lib/i18n/locale-context'
import { en } from '@/lib/i18n/en'
import { es } from '@/lib/i18n/es'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale}>
      <body className={`${barlowCondensed.variable} ${inter.variable} font-body`}>
        <LocaleProvider initialLocale={locale}>
          <Nav />
          {children}
        </LocaleProvider>
      </body>
    </html>
  )
}
```

`<html lang={locale}>` updates too — small accessibility/SEO correctness win that falls out of this for free.

---

## Usage Patterns

**Server components** (most pages): call `getLocale()` then look up the dictionary directly:
```tsx
const locale = await getLocale()
const t = locale === 'es' ? es : en
```

**Client components** (nav, forms, `/team` which is already client-fetched): `const { t } = useLocale()`.

---

## Language Toggle Component

**File:** `src/components/language-toggle.tsx` ← new

Two small pill buttons, "EN" / "ES", in the nav bar. Active language visually distinguished (e.g. `bg-brand-primary text-white` vs `text-brand-muted`); `aria-pressed` reflects state for accessibility.

```tsx
'use client'
import { useLocale } from '@/lib/i18n/locale-context'

export function LanguageToggle() {
  const { locale, setLocale } = useLocale()
  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      <button aria-pressed={locale === 'en'} onClick={() => setLocale('en')} className={/* active/inactive styles */}>EN</button>
      <button aria-pressed={locale === 'es'} onClick={() => setLocale('es')} className={/* active/inactive styles */}>ES</button>
    </div>
  )
}
```

Placed in `src/components/nav.tsx`, alongside the existing nav links (desktop layout) and inside the mobile hamburger menu.

---

## Public Form Error Codes

Public-facing server actions that currently return hardcoded English strings get changed to return codes. Scope: `src/app/actions/register.ts` (or wherever registration form validation lives), `src/components/get-involved/get-involved-form.tsx`'s backing action, `src/app/contact` if it has a backing action. **Admin-only actions (`league-admin.ts`, `admin.ts`, `staff.ts`, etc.) are unchanged** — admin stays English-only, no code-ification needed there.

Pattern:
```ts
// before
return { error: 'Email is required' }
// after
return { error: 'email_required' }
```

**File:** `src/lib/i18n/error-messages.ts` ← new
```ts
export const errorMessages = {
  en: { email_required: 'Email is required', ... },
  es: { email_required: 'El correo electrónico es obligatorio', ... },
} as const
```

The calling client component looks up `errorMessages[locale][code] ?? code` (falls back to the raw code if somehow untranslated, rather than crashing — this one spot keeps a runtime fallback since, unlike the dictionaries, these codes aren't guaranteed exhaustive by `satisfies` across two independently-maintained action files and a messages file).

---

## Pages/Components In Scope

Extraction happens page-by-page during implementation, not enumerated exhaustively here. In scope:

- `src/components/nav.tsx` (including mobile menu)
- `src/components/page-header.tsx`
- `src/app/page.tsx` (homepage)
- `src/app/contact/page.tsx`
- `src/app/get-involved/page.tsx` + `src/components/get-involved/get-involved-form.tsx` (form chrome, not admin-entered sponsor copy)
- `src/app/gallery/page.tsx` + gallery components (chrome only — captions/submitter names are user content, not translated)
- `src/app/announcements/page.tsx` + `src/components/announcements/announcement-card.tsx` (page chrome only — announcement bodies are admin content)
- `src/app/league/page.tsx` + league display components (chrome only — club/team/division names are proper nouns, not translated)
- `src/app/register/page.tsx` + `src/components/register/registration-form.tsx` + `src/components/payment/*` (this is the largest single surface — full registration flow, plan descriptions, validation messages)
- `src/app/team/page.tsx` + `src/components/team/staff-card.tsx` (chrome only — bios themselves are admin content)
- `src/app/login/page.tsx`
- `src/app/profile/page.tsx` + `src/components/profile/*`

**Explicitly excluded:** everything under `src/app/admin/`, `src/components/admin/`, admin-only server actions.

---

## Testing

Following this repo's existing convention (business logic gets unit tests; presentational component wiring generally doesn't — see `staff-admin.tsx`, `manage-league-clubs.tsx` as precedent):

- `src/lib/i18n/__tests__/locale.test.ts` — tests `parseLocale`'s default/fallback behavior (undefined, garbage value, `'es'`, `'en'`).
- No dedicated test for dictionary shape parity — `satisfies typeof en` makes this a compile-time guarantee already.
- No dedicated component tests for `LanguageToggle`, `LocaleProvider`, or individual translated pages.

---

## Out of Scope

- Translating admin-entered dynamic content (announcements, staff bios, get-involved sponsor copy, league/club/team names)
- Translating the admin panel
- URL-based locale routing (e.g. `/es/team`)
- Automatic browser-language detection on first visit (always defaults to English until toggled)
- Languages beyond English/Spanish
- Native-speaker review of the drafted Spanish translations (must happen before production use, but is a manual follow-up step, not part of this implementation)
