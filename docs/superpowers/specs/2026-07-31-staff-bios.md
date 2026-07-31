# Staff Bios ("Our Team") — Design Spec

**Date:** 2026-07-31
**Status:** Approved

## Background

The club wants a public page introducing its coaches and admin staff, so visitors and parents can see who's running the club.

## Scope

- New public **"Our Team"** nav tab at `/team`, listing all staff entries in the order they were added
- Each entry: name, role/title, bio text, photo
- Admin (existing `/admin` role-gated area) adds, edits, and deletes staff entries

**Out of scope:** manual reordering (order-added is the display order — an admin who wants a different order deletes and re-adds), multiple photos per person, any public-facing "contact this person" feature, structured fields beyond name/role/bio/photo.

## Data model

One new table, following this codebase's existing conventions:

- **`staff_members`** — `name` (text), `role_title` (text), `bio` (text), `photo_cloudinary_public_id` (text, nullable — stored as a Cloudinary public ID matching the existing `media.cloudinary_public_id` / League club badge convention, not a full URL), `created_at`

RLS enabled with a deny-all policy — all access via `'use server'` actions using the service-role client, consistent with the League feature and the Announcements spec.

## Access control

- Public read: via a service-role server action (no anon RLS access needed).
- Create/edit/delete: lives under `/admin`, already role-gated to `admin` at the middleware level.

## Photo upload

Reuses the same unsigned-Cloudinary-preset pattern already established for League club badges (`register-team-form.tsx`'s `uploadBadge`): admin uploads directly to Cloudinary client-side using `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, gets back a `public_id`, which is what gets stored — never a full URL. Photo is optional (a placeholder shows if absent, matching the League standings table's badge-fallback pattern).

## Pages & components

- `src/app/team/page.tsx` — public page, grid/list of staff cards (photo, name, role, bio)
- Admin section on `/admin` — add-staff form (name, role, bio, optional photo upload) + list of existing entries with Edit/Delete
- New nav link: `{ href: '/team', label: 'Our Team' }`

## Out of scope (explicitly)

- Manual/drag-and-drop reordering
- Multiple photos or photo galleries per staff member
- Any staff-facing login or self-service bio editing (admin manages all entries centrally, consistent with how League club/team data is admin-approved rather than self-managed)
