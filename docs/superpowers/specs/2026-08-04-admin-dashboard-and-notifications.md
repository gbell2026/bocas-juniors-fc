# Admin Dashboard Redesign & Payment/Registration Notifications — Design Spec

**Date:** 2026-08-04
**Status:** Approved

## Background

Two related problems surfaced from a real incident: a parent self-reported a payment via the site, but the club never actually received the money and didn't find out until later.

Root cause investigation found:
1. **No admin notification exists.** When a parent registers, or self-reports a payment ("I've paid" / "I've sent the transfer" / "I'll pay cash"), nothing alerts the admin — `requestPayment` only does `console.log(...)`, which nobody sees. The admin has to remember to check `/admin` proactively.
2. **The `/admin` dashboard is hard to work from.** Everything (revenue, pending payments, players, gallery submissions, get-involved inquiries, league management, announcements, staff, media upload) is stacked on one long scrolling page. Two sections (Gallery submissions, Get Involved submissions) render as stacked cards rather than scannable table rows, making them slow to work through when there are several at once.

The admin's own words: "the main issue here is the reg fee" — email notifications are the priority fix; the dashboard redesign fixes the underlying "hard to manage" complaint that let a pending payment go unnoticed.

**Explicitly not the fix:** rewording the parent-facing "✓ Transfer confirmed" copy. The admin is fine with the current display — they just need to actually find out when something happens so they can verify it themselves.

## Scope

### 1. Email notifications (new)

Two new admin-notification emails, reusing the exact pattern already live in `submitGetInvolved` (`src/app/actions/get-involved.ts`): lazy-imported `resend` package, `RESEND_API_KEY` env var, hardcoded recipient `g.bell2010@googlemail.com`, wrapped in try/catch so an email failure never breaks the underlying action.

- **New registration** — sent from `registerParentAndPlayer` (`src/app/actions/register.ts`) immediately before it returns success. Includes: player name, DOB, position, payment plan chosen; parent name, email, phone.
- **Payment self-reported** — sent from `requestPayment` (`src/app/actions/payment.ts`), replacing the existing `console.log`. Includes: player name, parent name, payment method, amount due, installment label. Points the admin to `/admin` to confirm or deny.

Both fire only after the underlying DB write succeeds — a failed registration or failed payment-request insert must not send a "confirming" email for something that didn't happen.

### 2. Admin dashboard redesign

Restructure `/admin` from one long scrolling page into five tabs, reusing the tab UI pattern already established on the public League page (`src/app/league/page.tsx` — a row of buttons, active tab highlighted, content swapped below):

- **Overview** — Total Revenue header, Pending Payments (kept highly visible so it's never buried — this was the component most relevant to the incident that started this work).
- **Players & Payments** — the existing Players table (already a proper `<table>`, unchanged).
- **Submissions** — Gallery ("Pending Submissions") and Get Involved submissions, **both converted from stacked cards to scannable `<table>` rows** (see below).
- **League** — League Pending Queue, League Divisions, League Fixtures Admin (unchanged internals, just relocated under this tab).
- **Content** — Announcements Admin, Staff Admin, Media Upload (unchanged internals, just relocated under this tab).

`/admin`'s server-side data fetching (auth check + the `Promise.all` of every admin data source) stays exactly as-is — this is a presentation-layer change, not a data-layer change. The page becomes a thin server component that fetches data and passes it all to a new client component that owns the tab state and renders the right section.

### 3. Table-ify the two card-list sections

**Get Involved Submissions** (`src/components/admin/get-involved-submissions.tsx`): convert to a `<table>` with columns Name, Email, Organisation, Interests, Message, Date, Status/Action — matching the Players table's `<table>` styling (`bg-brand-creamAlt` header row, `border-t` row dividers). Long message text truncates with the full text available via a `title` attribute (no modal/expand — keep it simple, matching this codebase's existing preference for no unnecessary interaction layers). "Mark as Handled" becomes a per-row action button; handled rows get the existing dimmed (`opacity-40`) treatment applied to the row instead of a card.

**Pending Submissions / Gallery** (`src/components/admin/pending-submissions.tsx`): convert to a `<table>` with columns Thumbnail, Submitter, Caption, Date, Actions (Approve/Reject side by side). Thumbnail stays the existing small Cloudinary-transformed image / video-icon placeholder, just inside a table cell instead of a card.

Both keep their existing server actions, error handling, and optimistic local-state update behavior (approve/reject/mark-handled removing or updating the row in place) — only the markup changes from card-div to table-row.

## Out of scope (explicitly)

- Search/filtering across any table (not a stated pain point this round)
- Real-time/push updates (email notification is the mechanism, not a live-updating dashboard)
- Changing the parent-facing payment self-report copy or flow
- Any change to how a payment gets marked `succeeded` (still solely an admin `Confirm` action)
- Mobile-specific redesign beyond what already exists (tabs reuse the League page's existing responsive pattern)
