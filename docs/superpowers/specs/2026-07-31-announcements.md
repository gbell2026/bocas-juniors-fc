# Announcements — Design Spec

**Date:** 2026-07-31
**Status:** Approved

## Background

The club wants a way to post news/announcements (e.g. "Training moved to Saturday") that any site visitor can read, with logged-in parents able to leave comments underneath.

## Scope

- New public **"Announcements"** nav tab at `/announcements`, listing announcements newest-first
- Admin (existing `/admin` role-gated area) creates, edits, and deletes announcements — title + body text only, no image
- Logged-in users (in practice, parents — this site has no other public-facing account type) can post a comment on any announcement
- Admin can delete any comment (basic moderation)

**Out of scope:** image attachments on announcements, comment editing (comments are post-once, delete-only), comment replies/threading, email notifications when a new announcement is posted, pagination (fine at this site's scale — same as other admin-managed lists on this site).

## Data model

Two new tables, following this codebase's existing conventions (UUID primary keys, `created_at` timestamps, RLS enabled with a deny-all policy since all access goes through `'use server'` actions using the service-role client — same pattern as the League feature):

- **`announcements`** — `title` (text), `body` (text), `created_at`
- **`announcement_comments`** — `announcement_id` (FK → `announcements`, cascade delete), `user_id` (FK → `auth.users`), `author_name` (text, denormalized from the commenter's parent record at post time so the comment list doesn't need a join back to `parents` on every read), `body` (text), `created_at`

**`author_name` fallback:** every authenticated non-admin account has a `parents` row created at registration (see `register.ts`), so this lookup should always succeed for the intended audience. If it ever doesn't (e.g. an admin account with no parent record posts a comment), fall back to `"A club member"` rather than failing the comment — this is a display nicety, not a security boundary, so it should degrade gracefully.

## Access control

- Public read of announcements and comments: via `'use server'` actions using the service-role client (no RLS-based anon access, consistent with the League feature's reasoning — deny-all + service-role covers it without needing extra RLS policies).
- Posting a comment: requires an authenticated session. This is a new pattern for this codebase's server actions — every existing `'use server'` action so far uses only the service-role client (which has no concept of "who's calling"). The comment-posting action needs to use **two Supabase clients**: first `createSupabaseServerClient()` (session/cookie-aware, already used in server *components* like `profile/page.tsx` but not yet inside a `'use server'` action) to call `.auth.getUser()` and get the caller's real `user_id` — never trust a client-supplied one — then `createSupabaseServiceClient()` for the actual `parents` lookup and the insert, matching how every other write in this codebase is performed. If `.auth.getUser()` returns no user, reject with an error before touching the database.
- Creating/editing/deleting announcements, and deleting any comment: lives under `/admin`, which is already role-gated to `admin` at the middleware level — no additional access-control work needed here.

## Pages & components

- `src/app/announcements/page.tsx` — public page, lists announcements newest-first, each with its comments and a comment form (shown only if logged in; a "Log in to comment" prompt otherwise)
- Admin section on `/admin` — create-announcement form + list of existing announcements with Edit/Delete, matching the style of the existing `LeagueDivisions` admin component (inline edit, no image upload)
- New nav link: `{ href: '/announcements', label: 'Announcements' }`

## Out of scope (explicitly)

- Rich text / images in announcements
- Comment editing or threaded replies
- Any notification (email/push) when a new announcement is posted
- Moderation beyond "admin can delete a comment" (no reporting, no auto-moderation)
