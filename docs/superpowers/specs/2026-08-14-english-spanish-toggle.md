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
  team: { title: 'Our Team', subtitle: 'Coaches & Admin Staff', empty: 'No staff members listed yet.', readMore: 'Read more', showLess: 'Show less', background: 'Background', qualifications: 'Qualifications', philosophy: 'Coaching Philosophy', favouriteTeam: 'Favourite Team', funFact: 'Fun Fact' }, // readMore/showLess are the text only — staff-card.tsx appends the ▼/▲ glyph itself, see Pages In Scope note
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

Roughly half of the in-scope pages are already `'use client'` — verified against current source, not assumed:

- **Server components:** `src/app/page.tsx` (homepage), `src/app/contact/page.tsx`, `src/app/get-involved/page.tsx`, `src/app/gallery/page.tsx`, `src/app/profile/page.tsx`
- **Client components:** `src/app/announcements/page.tsx`, `src/app/league/page.tsx`, `src/app/register/page.tsx`, `src/app/login/page.tsx`, `src/app/team/page.tsx`, plus `nav.tsx` and all form components

**Server components:** call `getLocale()` then look up the dictionary directly:
```tsx
const locale = await getLocale()
const t = locale === 'es' ? es : en
```

**Client components:** `const { t } = useLocale()`.

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

Public-facing server actions that currently return hardcoded English strings, or pass through raw Supabase/DB error text, get changed to return codes. **Admin-only actions (`league-admin.ts`, `admin.ts`, `staff.ts`, etc.) are unchanged** — admin stays English-only, no code-ification needed there.

**In scope:**
- `src/app/actions/register.ts` — currently returns curated strings for known validation failures (fine, becomes codes) *and* `authError?.message ?? 'Registration failed'` for auth errors (passes through raw Supabase text — becomes a generic `auth_error` code instead, see below).
- `src/app/actions/get-involved.ts` — currently returns `dbError.message` directly on failure (raw DB text passed straight to the user) — becomes a generic `submission_failed` code instead.
- `src/app/actions/media-submissions.ts` (`submitMediaRecord`) — same raw-passthrough issue as get-involved. Becomes `submission_failed` on DB failure.
- `src/components/gallery/upload-modal.tsx` — two distinct error paths here:
  - The Cloudinary upload path itself (not a server action) currently sets hardcoded strings `'Upload failed'` / `'Network error'` directly in component state. These become translated inline via `t.gallery.uploadFailed` / `t.gallery.networkError` rather than the error-code+lookup pattern, since there's no server action boundary to cross here — the component already knows which failure occurred.
  - The `dbError` returned by `submitMediaRecord` (now a `submission_failed` code, per above) must be run through the same `errorMessages[locale][code] ?? code` lookup as `register.ts`/`get-involved.ts` consumers before being assigned to `entry.error` — currently `entry.error` would otherwise display the literal string `"submission_failed"` to the user instead of a translated message.

**Known-cause validation errors keep specific codes** (e.g. `email_required`); **errors from an external system (DB, auth provider) collapse to one generic code per action** rather than trying to translate arbitrary upstream error text:

```ts
// before (register.ts)
return { error: authError?.message ?? 'Registration failed' }
// after
return { error: 'auth_error' }

// before (get-involved.ts / media-submissions.ts)
return { error: dbError.message }
// after
return { error: 'submission_failed' }
```

**File:** `src/lib/i18n/error-messages.ts` ← new
```ts
export const errorMessages = {
  en: { email_required: 'Email is required', auth_error: 'Something went wrong signing you up. Please try again.', submission_failed: 'Something went wrong. Please try again.', ... },
  es: { email_required: 'El correo electrónico es obligatorio', auth_error: 'Ocurrió un error al registrarte. Inténtalo de nuevo.', submission_failed: 'Algo salió mal. Inténtalo de nuevo.', ... },
} as const
```

The calling client component looks up `errorMessages[locale][code] ?? code` (falls back to the raw code if somehow untranslated, rather than crashing — this one spot keeps a runtime fallback since, unlike the dictionaries, these codes aren't guaranteed exhaustive by `satisfies` across several independently-maintained action files and a messages file).

**`/login` is a special case, not covered by the above.** `src/app/login/page.tsx` calls `supabase.auth.signInWithPassword()` directly from the client (no server action to codify) and renders `error.message` verbatim (e.g. "Invalid login credentials"). Fix: catch the error client-side and map the handful of known Supabase auth-error message strings to translation keys (e.g. match `'Invalid login credentials'` → `t.login.invalidCredentials`), falling back to a generic `t.login.error` for anything unrecognized. This is a string-match against Supabase's current error text, which is not a stable contract — the fallback message is what keeps this from breaking if that wording changes upstream.

---

## Date/Time Formatting

`src/components/upcoming-schedule.tsx`, `src/components/announcements/announcement-card.tsx`, and `src/components/league/fixtures-list.tsx` all hardcode `Intl.DateTimeFormat('en-GB', …)`. In scope: pass the current locale through and use `Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-GB', …)` so dates render with Spanish weekday/month names when toggled. Mechanical change once `locale` is available in each component: `announcement-card.tsx` and `fixtures-list.tsx` are rendered within already-client pages per Usage Patterns above, so they can call `useLocale()` directly; `upcoming-schedule.tsx` is rendered by `src/app/page.tsx`, a server component — its parent calls `getLocale()` once and passes `locale` down as a prop instead. Grep for other `Intl.DateTimeFormat`/`toLocaleDateString` call sites during implementation in case there are more beyond these three.

---

## Pages/Components In Scope

Extraction happens page-by-page during implementation, not enumerated exhaustively here. In scope:

- `src/components/nav.tsx` (including the mobile menu *and* the registration-fee-outstanding banner — a distinct dynamic UI element, not just the static links)
- `src/components/page-header.tsx`
- `src/app/page.tsx` (homepage) + `src/components/upcoming-schedule.tsx` ("Practice"/"Match" labels, plus date formatting per above)
- `src/app/contact/page.tsx`
- `src/app/get-involved/page.tsx` + `src/components/get-involved/get-involved-form.tsx` (form chrome, including the static `INTEREST_OPTIONS` checkbox labels — these are predefined UI options, not admin-entered content, so in scope; the admin-entered sponsor copy itself is not)
- `src/app/gallery/page.tsx` + gallery components incl. `upload-modal.tsx` (chrome + upload error messages per Error Codes section — captions/submitter names are user content, not translated)
- `src/app/announcements/page.tsx` + `src/components/announcements/announcement-card.tsx` (page chrome + date formatting — announcement bodies are admin content, not translated)
- `src/app/league/page.tsx` + league display components incl. `fixtures-list.tsx` (chrome + date formatting — club/team/division names are proper nouns, not translated)
- `src/app/register/page.tsx` + `src/components/register/registration-form.tsx` + `src/components/payment/*` (this is the largest single surface — full registration flow, plan descriptions, validation messages)
- `src/app/team/page.tsx` + `src/components/team/staff-card.tsx` (chrome only — bios themselves are admin content; note the actual strings are `"Read more ▼"` / `"Show less ▲"` — the arrow glyph stays outside the translated string, e.g. `` `${t.team.readMore} ▼` ``, not baked into the dictionary value)
- `src/app/login/page.tsx` (see the `/login` special case under Error Codes)
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
