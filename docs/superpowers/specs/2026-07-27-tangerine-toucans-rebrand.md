# Tangerine Toucans Rebrand

## Summary

Full club rebrand: "Bocas Juniors FC" becomes "Tangerine Toucans" across all
user-visible copy, with a new light/cream visual theme, new typography, and a
new logo, replacing the current dark punk-rock theme and Bocas Pink/Blue
identity. Bilingual (EN/ES) copy is explicitly **out of scope** for this
project — a follow-on project once this ships.

## Source of truth

The brand pack (`tokens.json`, plus two logo images — transparent and
white-background versions of the same circular toucan/sunset badge with
"TANGERINE TOUCANS" baked into the artwork) was provided directly in
conversation. See token values below; the raw `tokens.json` content is
reproduced in full in the Appendix for reference.

**Open dependency:** the two logo image files were shared as chat attachments,
not as files in the repo. They need to land in the repo (e.g.
`public/logo.png` transparent, `public/logo-white-bg.png`) before
implementation can proceed — either the user adds them directly, or provides
a reachable path/URL.

## 1. Renaming

Replace "Bocas Juniors FC" / "Bocas" with "Tangerine Toucans" in:

- `src/app/layout.tsx` — `metadata.title`, `metadata.description`
- `src/components/nav.tsx` — logo alt text
- `src/app/page.tsx` — hero heading, image alt text, sponsors CTA copy
- `src/app/get-involved/page.tsx` — subtitle copy
- `src/app/actions/get-involved.ts` — Resend `from` display name
- `package.json` — `name` field

Location copy ("Youth Football · Bocas del Toro, Panama") is **not** renamed
— that's the town, unrelated to the club name.

**Explicitly not renamed:** `public/bocas-dance-logo.png` and its alt text
("Bocas Dance Collective") — this is a sponsor's own logo/name, coincidentally
similar, unrelated to the club's branding.

**Test fixtures:** `masonry-grid.test.tsx`, `pending-submissions.test.tsx`,
and `payment-options-panel.test.tsx` all use `bocas`/`bocas-juniors`-based
mock IDs and values. Update these alongside their corresponding source files
so test expectations stay in sync with the rename — no special handling
needed beyond that.

**Cloudinary folder migration:** the upload folder `bocas-juniors`
(`src/app/api/cloudinary/sign/route.ts`) is renamed to `tangerine-toucans`,
with existing media migrated to the new folder via a one-off script against
Cloudinary's admin API. The script must verify asset counts match
before/after and be safely re-runnable (idempotent / resumable) given this
touches live production media. If Cloudinary's API doesn't support an
in-place rename/move for the account's plan, fall back to listing existing
assets and re-uploading them into the new folder, then confirm the app reads
from the new folder before considering old-folder assets safe to ignore.

**Payment account handles — real external dependency, same category as
Cloudinary:** `paypal_me_url` (`https://paypal.me/bocasjuniorsfc`) and
`revolut_details` (`@bocasjuniorsfc on Revolut`) are seeded in
`supabase/migrations/002_seed_settings.sql` and rendered as live payment
links/text in `src/components/payment/payment-options-panel.tsx` (via
`src/app/actions/payment.ts`). These are real external account handles, not
just code strings — renaming them requires actually creating/renaming a
`paypal.me/tangerinetoucans`-style link and Revolut handle under the new
brand name *outside* this codebase first. Since `002_seed_settings.sql`
already ran against the production database, updating it won't affect
existing rows — a **new migration** (`UPDATE settings SET value = ... WHERE
key IN ('paypal_me_url', 'revolut_details')`) is required instead. Treat this
as blocked until the user confirms the new PayPal/Revolut handles exist.
Test fixtures in `payment-options-panel.test.tsx` reference the old handle
and should be updated to match.

## 2. Visual tokens

Replace the `brand.*` block in `tailwind.config.ts` and the font setup in
`src/app/layout.tsx` / `globals.css`:

| Old token | Old value | New token | New value | Role |
|---|---|---|---|---|
| `brand.primary` | `#FF0055` | `brand.primary` (tangerine) | `#F26522` | CTAs, headings, accents |
| — | — | `brand.primaryDeep` (tangerineDeep) | `#B84F1D` | hover, display numbers |
| `brand.gold` | `#AC8D4E` | `brand.accent` (amber) | `#FFB627` | accent only, small areas |
| `brand.dark` | `#0A0A0A` | `brand.ink` | `#141311` | dark sections only (no longer page default) |
| `brand.surface` | `#111111` | `brand.charcoal` | `#211F1C` | lifted dark panels |
| — | — | `brand.cream` | `#FBF7F2` | **new page background default** |
| — | — | `brand.creamAlt` | `#F7F1E9` | alternate section banding |
| — | — | `brand.tint` | `#FCEFE4` | pale highlight cards |
| `brand.cyan` | `#00E5FF` | *(retired — no equivalent in new pack)* | | |
| `brand.border` | `#1E1E1E` | `brand.line` | `#E7DFD5` | borders/dividers on light bg |

Text tokens added: muted (`#6E665B`), mutedWarm (`#8A8175`), mutedLight
(`#C9BFB2`, for the remaining dark sections).

Fonts: `font-heading` Anton → **Barlow Condensed**; `font-body` Montserrat →
**Inter**. The CSS variable names change along with the fonts —
`--font-anton` → `--font-barlow-condensed`, `--font-montserrat` →
`--font-inter` — updated everywhere they're set up
(`src/app/layout.tsx`'s `next/font/google` calls) and everywhere they're
referenced directly (see `globals.css` below), not just in the Tailwind
`font-heading`/`font-body` class mapping.

These become Tailwind config values directly (matching the existing
convention already used in this codebase for `--font-anton` etc.) rather than
introducing a separate `tokens.css`/CSS-custom-property layer — the brand
pack's "keep 3 files in sync" note describes the source design system used
across the club's other materials, not a requirement to mirror that file
structure inside this app.

**`src/app/globals.css` also needs updating** — it's not just
`tailwind.config.ts` and `layout.tsx`:
- `body { color: #ffffff; background: #0A0A0A; }` is the old dark-theme
  default and must change to the new light theme (cream background, dark
  text) — currently the exact opposite of the new default.
- `h1, h2, h3 { font-family: var(--font-anton), sans-serif; ... }` hardcodes
  the old font variable name directly (not via the `font-heading` Tailwind
  class) and must be updated to the new variable name.
- The `@layer components` block's `.input` and `.btn-primary` classes
  reference `brand-border` and `brand-surface`, which are being repurposed
  for dark-section-only use (see table above) — check these against the new
  light-theme default rather than assuming they still apply the same way.
- `.btn-secondary` uses `border-brand-cyan` / `text-brand-cyan` /
  `hover:bg-brand-cyan` — `brand.cyan` is retired with no replacement in the
  new pack (see table above), so this class needs a new treatment (e.g. an
  outlined tangerine or ink style) or it silently renders unstyled
  (an unknown Tailwind class compiles to nothing, not a build error).
- `.btn-primary`'s inline `box-shadow: 0 4px 16px rgba(255, 0, 85, 0.4)` is
  the old hot-pink RGB value hardcoded outside Tailwind and needs updating to
  the new tangerine RGB, or removing if the new brand doesn't call for a
  glow shadow.

## 3. Logo & favicon

- `public/logo.png` → transparent toucan badge
- New `public/logo-white-bg.png` → white-background version, for contexts
  needing a light backdrop (e.g. social/OG previews)
- `src/app/favicon.ico` regenerated from the transparent badge

No separate small-size icon crop for now (per prior decision) — the full
badge is used at all sizes, including favicon and nav. Revisit with a
dedicated icon-only mark later if it reads poorly at small sizes.

## 4. Pages in scope

All pages get both the rename and the new theme, including `/login`,
`/profile`, and `/admin` — explicitly reversing their earlier exclusion from
the prior dark-theme redesign.

## 5. Voice / copy tone

English only for this pass. Copy shifts to match the brand pack's voice:
warm, direct, plain-spoken, short declarative sentences, no jargon/hype/
exclamation-heavy phrasing, no corporate or childish tone. Apply this filter
to existing headings/CTAs (e.g. the sponsors CTA on the homepage) without
adding new sections or features — this is a tone pass on existing copy, not
new copywriting.

## Out of scope

- English/Spanish bilingual toggle — real i18n (routing, translated content
  for every page including admin/emails, language switcher UI) is large
  enough to be its own project; follows this one.
- A simplified icon-only logo mark for favicon/small nav.

## Appendix: raw brand pack (`tokens.json`)

```json
{
  "$meta": {
    "brand": "Tangerine Toucans",
    "description": "Design tokens. Source of truth alongside BRAND.md and tokens.css. Keep all three in sync.",
    "version": "1.0.0"
  },
  "color": {
    "core": {
      "tangerine":      { "value": "#F26522", "role": "primary; CTAs, headings, accents" },
      "tangerineDeep":  { "value": "#B84F1D", "role": "hover, display numbers, secondary emphasis" },
      "amber":          { "value": "#FFB627", "role": "accent only; small areas, eyebrows on dark" },
      "ink":            { "value": "#141311", "role": "near-black; dark sections, primary text" },
      "charcoal":       { "value": "#211F1C", "role": "lifted dark panels" }
    },
    "surface": {
      "cream":     { "value": "#FBF7F2", "role": "primary page background" },
      "creamAlt":  { "value": "#F7F1E9", "role": "alternate section banding" },
      "tint":      { "value": "#FCEFE4", "role": "pale orange highlight cards" },
      "white":     { "value": "#FFFFFF", "role": "text on dark, QR plates, card fills" }
    },
    "text": {
      "muted":      { "value": "#6E665B", "role": "secondary body on light" },
      "mutedWarm":  { "value": "#8A8175", "role": "muted labels, sub-copy" },
      "mutedLight": { "value": "#C9BFB2", "role": "muted text on dark" },
      "line":       { "value": "#E7DFD5", "role": "borders, dividers" }
    },
    "semantic": {
      "onOrangeSub": { "value": "#7A2E0E", "role": "dark sub-label inside orange blocks only" },
      "success":     { "value": "#2E8B57", "role": "status/done indicators only" },
      "successBg":   { "value": "#E6F2EB", "role": "background for success state" }
    }
  },
  "typography": {
    "family": {
      "display": { "value": "\"Barlow Condensed\", \"Arial Narrow\", sans-serif", "role": "headlines, hero, big numbers" },
      "body":    { "value": "\"Inter\", system-ui, -apple-system, \"Segoe UI\", sans-serif", "role": "body, UI" },
      "print":   { "value": "Arial, Helvetica, sans-serif", "role": "use to match print/PDF files exactly" }
    },
    "size": {
      "display": { "value": "2.75rem", "px": 44 },
      "h1":      { "value": "2rem",     "px": 32 },
      "h2":      { "value": "1.375rem", "px": 22 },
      "h3":      { "value": "1.0625rem","px": 17 },
      "eyebrow": { "value": "0.75rem",  "px": 12 },
      "body":    { "value": "1rem",     "px": 16 },
      "small":   { "value": "0.875rem", "px": 14 }
    },
    "weight": {
      "regular": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.02,
      "snug": 1.15,
      "body": 1.5
    },
    "tracking": {
      "headline": "-0.01em",
      "eyebrow": "0.12em"
    }
  },
  "spacing": {
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "6": "1.5rem",
    "8": "2rem",
    "12": "3rem"
  },
  "radius": {
    "sm": "5px",
    "md": "8px",
    "lg": "12px"
  },
  "shadow": {
    "card": "0 1px 2px rgba(20, 19, 17, 0.04), 0 4px 16px rgba(20, 19, 17, 0.06)"
  },
  "layout": {
    "contentMax": "760px",
    "pageBackground": "#FBF7F2"
  },
  "voice": {
    "summary": "Warm, direct, plain-spoken. Short declarative sentences. Talk to parents and players like a real club would.",
    "cta": ["Want in?", "Ready to sign up?", "¿Te apuntas?"],
    "bilingual": "English + Panamanian Spanish. Keep 'Tangerine Toucans' untranslated. Use local terms: cédula, árbitro, partido, eliminatorias.",
    "avoid": ["jargon", "hype", "exclamation-heavy copy", "corporate tone", "childish tone"]
  }
}
```
