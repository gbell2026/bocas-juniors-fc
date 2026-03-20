# Bocas Juniors FC — Website Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Project:** bocas-juniors-fc

---

## Overview

A custom-built club website for Bocas Juniors FC, a youth football (soccer) club on a tropical island. The site serves parents, players, coaches, and administrators. The MVP focuses on two core needs: collecting membership payments and showcasing a photo/video gallery.

---

## Services & Costs (Register Before Building)

| Service | Purpose | Free Tier | Paid (if needed) |
|---|---|---|---|
| **Vercel** | Hosting the website | Free for personal/hobby projects | ~$20/mo for teams |
| **Supabase** | Database + user accounts | Free up to 500MB, 50k monthly active users | $25/mo (Pro) |
| **Cloudinary** | Photo + video storage & CDN | Free up to 25GB storage, 25GB bandwidth/mo | $89/mo (Plus) — unlikely to be needed at first |
| **Domain name** | e.g. bocasjuniorsfc.com | N/A | ~$12–15/year (Namecheap or Cloudflare) |
| **PayPal** | PayPal.Me link for payments | Free personal account | No fees to set up; PayPal charges the sender ~3.4% + fixed fee |
| **Monzo / Revolut** | Bank transfer payment option | Free accounts | No fees for receiving transfers |

**Estimated startup cost:** ~$12–15/year (domain only)
**Transaction cost:** ~3.4% for PayPal payments; free for Monzo/Revolut transfers; free for cash
**Scaling cost:** Free tiers should comfortably cover the club's needs for the first 1–2 years.
**Future:** Stripe can be added in Phase 2 once the club is formally registered, enabling automated payment confirmation and card processing fees of 2.9% + $0.30.

**Action items before development:**
1. Register a domain (recommended: Namecheap or Cloudflare)
2. Create a PayPal account (personal or business) and set up a PayPal.Me link (e.g. paypal.me/bocasjuniorsfc)
3. Have your Monzo account details ready (sort code, account number, or Monzo.me link)
4. Have your Revolut account details ready (Revtag or Revolut.me link)
5. Create a Cloudinary account at cloudinary.com
6. Create a Supabase account at supabase.com
7. Create a Vercel account at vercel.com (can sign in with GitHub)
8. Create a GitHub account (if you don't have one) — used to deploy to Vercel

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (React, App Router) |
| Auth + Database | Supabase |
| Payments | Manual confirmation — PayPal.Me link, Monzo, Revolut, and cash |
| Media storage | Cloudinary |
| Hosting | Vercel |
| Language | TypeScript |
| Styling | Tailwind CSS (club brand colours as theme tokens) |

---

## User Roles

| Role | Description |
|---|---|
| **Public** | Anyone — can view Home, Gallery, and Register |
| **Parent** | Registered and logged in — manages their child's profile, pays fees |
| **Coach** | Club staff — same as parent access plus Phase 2 admin features |
| **Admin** | Full access — dashboard, member management, media uploads |

> **MVP note:** Players do not have their own login in MVP. The parent creates the account and manages the player's profile on the player's behalf. A dedicated Player login (with their own role) is a Phase 2 feature.

Roles are stored in a `user_roles` table keyed to Supabase `auth.users.id`. The first admin user is seeded via a SQL migration run once during initial deployment (see Deployment section). Subsequent Admin and Coach roles are assigned manually in Supabase Studio — no UI required for MVP.

---

## Pages

### MVP

#### Home (`/`)
- Hero banner with club logo, kit colours, and a tagline
- Sponsor logos section
- Latest news/announcements snippet (static text for MVP, editable in Phase 2)
- Links to Gallery and Register

#### Gallery (`/gallery`)
- Masonry grid layout — photos and videos mixed
- 2px gap between tiles
- Portrait and landscape images at their natural ratios
- Videos show a play icon overlay; clicking opens a lightbox player
- Admin uploads via browser; Cloudinary handles storage, resizing, and CDN delivery
- Publicly visible — no login required

#### Register (`/register`)
- Form fields: player name, date of birth, position, parent name, parent email, parent phone number, password (set on this form — no separate email step)
- On submit: Supabase creates the account; a welcome email is sent but **email verification is not required before proceeding**
- After account creation: parent is shown the **Payment Options** screen (see payment flow below)

#### Login (`/login`)
- Email + password via Supabase Auth
- Redirect to `/profile` after login

#### My Profile (`/profile`) — login required
- Player info (editable by player/parent)
- Payment history (list of past payments from the `payments` table)
- **Payment options panel** — shows all four methods with current fee amount and payment details
- "Leave Bocas Juniors" option — sets player status to inactive

#### Contact (`/contact`)
- Contact details for coaches and admins: name, role, email, phone number
- Publicly visible — no login required
- Content is static for MVP (hardcoded or from a `contacts` table in Supabase, editable via Supabase Studio)

#### Admin Dashboard (`/admin`) — admin role required
- Pending payment requests flagged at the top — admin clicks Confirm or Deny per request (applies to all payment methods)
- Table of all registered players with columns: Name, Age, Position, Parent, Status (Active / Inactive / Injured / Away), Return Date, Last Payment Date
- Set player status per row: active / inactive / injured (+ return date) / away (+ return date)
- Manual "Mark as Paid" button per player (for any payment confirmed out-of-band)
- Drag-and-drop uploader for photos/videos to Cloudinary
- Total revenue summary (sum of all succeeded payments)

---

### Phase 2 (post-MVP)

| Page | Description |
|---|---|
| `/schedule` | Embedded Heja widget — no rebuild of scheduling logic needed |
| `/about` | Club story, coaches, kit showcase, history |
| `/announcements` | Coach posts news; members receive email notification |
| `/messages` | Simple parent ↔ coach messaging thread |
| Parent upload | Parents upload photos from their own devices; admin approves before publishing to gallery |
| Stripe integration | Automated payment confirmation, card processing — once club is formally registered |

### Phase 3

| Page | Description |
|---|---|
| `/shop` | Club merchandise store |

---

## Payment Options

Parents can pay using any of four methods. All methods result in a **pending payment record** that the admin manually confirms. There is no automated payment confirmation in MVP.

| Method | Label shown to parent | How it works |
|---|---|---|
| **PayPal / Card** | "Pay via PayPal or Credit/Debit Card" | Opens PayPal.Me link in new tab. Parent completes payment on PayPal (can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments). Returns to site and clicks "I've paid". |
| **Monzo** | "Pay via Monzo bank transfer" | Shows Monzo payment details (sort code, account number, or Monzo.me link) with a copy button. Parent clicks "I've sent the transfer". |
| **Revolut** | "Pay via Revolut bank transfer" | Shows Revolut details (Revtag or Revolut.me link) with a copy button. Parent clicks "I've sent the transfer". |
| **Cash** | "Pay by Cash" | Parent notifies admin they will pay cash. Admin confirms when cash is received. |

In all four cases:
1. Parent confirms intent by clicking the relevant button
2. A `payments` row is created with `status: pending` and the appropriate `payment_method`
3. Admin is notified (console log for MVP; email integration in Phase 2)
4. Admin views the request on `/admin` and clicks Confirm or Deny
5. On Confirm: player status set to `active`, payment status set to `succeeded`
6. On Deny: payment status set to `failed`

Admin can also directly mark a player as paid (e.g. cash handed in at training) without a parent request — this creates a `succeeded` payment immediately.

> **PayPal label note:** The button must clearly say "PayPal or Credit/Debit Card" — not just "PayPal" — so parents without a PayPal account understand they can still pay by card.

---

## Registration & Payment Flow

```
Parent visits /register
  → Fills in: player name, DOB, position, parent name, email, phone, password
  → Client submits form to server action
  → Server calls Supabase auth.admin.createUser (email + password) — no verification gate
  → Server inserts a `parents` row using the returned auth.users.id
  → Server inserts a `players` row with parent_id referencing the new parents row
  → Server inserts a `user_roles` row with role: parent
  → If any insert fails: rollback and show error — parent must retry
  → Payment options screen shown immediately
  → Current membership fee shown (fetched from settings table — key: membership_fee_cents)
  → Parent selects a payment method and confirms intent
  → A payments row is created with status: pending and the chosen payment_method
  → Admin notified (console log MVP)

Later — parent logs in any time
  → Goes to /profile
  → Payment options panel shows current fee and all four methods
  → Same flow as above

If admin marks payment directly (cash handed in at training)
  → Admin goes to /admin
  → Clicks "Mark as Paid" next to the player
  → Server inserts a payments row with payment_method: cash, status: succeeded, paid_at: now
  → Player status set to active immediately

Player status in MVP
  → active: has at least one succeeded payment (any method)
  → inactive: newly registered but not yet paid, manually deactivated by admin, or parent clicks "Leave Bocas Juniors"
  → injured: set by admin with an estimated return date (stored on the player row)
  → away: set by admin or parent with a date of return (stored on the player row)
  → (overdue is a Phase 2 concept if recurring billing is ever introduced)
```

> **Fee period note (MVP limitation):** The `payments` table does not track which season or period a payment covers. Season/period tracking is a Phase 2 addition. For MVP, the admin uses payment dates to determine whether a family is current.

---

## Membership Fee & Payment Details Configuration

All payment details are stored in the `settings` table (key/value) in Supabase so the admin can update them via Supabase Studio without a code deploy.

| Key | Example value | Description |
|---|---|---|
| `membership_fee_cents` | `2500` | Current fee in cents (e.g. 2500 = $25.00) |
| `paypal_me_url` | `https://paypal.me/bocasjuniorsfc` | Full PayPal.Me URL |
| `monzo_details` | `Sort: 04-00-04 / Acc: 12345678 / Ref: [player name]` | Displayed to parent on payment screen |
| `revolut_details` | `@bocasjuniorsfc on Revolut` | Displayed to parent on payment screen |

---

## Gallery — Technical Details

- **Storage:** Cloudinary — all photos and videos uploaded here
- **Upload flow (admin):** Browser drag-and-drop uploader on `/admin` → browser calls `POST /api/cloudinary/sign` (a Next.js API route) to get a short-lived signature using the Cloudinary API secret (server-side only, never exposed to browser) → browser uploads directly to Cloudinary using the signed parameters
- **Delivery:** Cloudinary CDN URL — fast delivery worldwide. The `cloudinary_public_id` in the `media` table is used to construct the URL at render time; the full URL is not stored separately.
- **Resizing:** Cloudinary auto-generates responsive sizes (thumbnail, medium, full)
- **Video:** Cloudinary stores and streams video; lightbox player on click
- **Layout:** CSS columns (masonry) with 2px gap, 3 columns on desktop, 2 on tablet, 1 on mobile
- **Lightbox:** Opens on image/video click — shows full size, arrow navigation, keyboard navigation

---

## Data Model (Supabase)

### `user_roles`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK → auth.users, PK |
| role | enum | parent / coach / admin / player (reserved for Phase 2 Player login — unused in MVP) |

### `players`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users (nullable — player may not have own login in MVP) |
| parent_id | uuid | FK → parents — one parent can have multiple players |
| name | text | |
| date_of_birth | date | |
| position | text | |
| status | enum | active / inactive / injured / away |
| return_date | date | Nullable — set when status is injured or away |
| created_at | timestamp | |

### `parents`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → auth.users |
| name | text | |
| email | text | |
| phone | text | |
| created_at | timestamp | |

### `payments`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| parent_id | uuid | FK → parents |
| player_id | uuid | FK → players |
| payment_method | enum | paypal / monzo / revolut / cash |
| amount | integer | In cents |
| currency | text | Default: usd |
| status | enum | succeeded / pending / failed |
| paid_at | timestamp | Set to server timestamp when admin confirms; null until then |
| notes | text | Optional — e.g. "Marked directly by admin at training" |

### `media`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| cloudinary_public_id | text | Reference for Cloudinary |
| type | enum | photo / video |
| caption | text | Optional |
| pinned | boolean | Default false — pinned items shown first in gallery |
| uploaded_by | uuid | FK → auth.users |
| uploaded_at | timestamp | |
| published | boolean | Default true for MVP; false = pending approval (Phase 2) |

### `settings`
| Column | Type | Notes |
|---|---|---|
| key | text | PK |
| value | text | Stored as string, parsed at runtime |
| updated_at | timestamp | |

---

## Branding

- Club already has: logo, brand colours, kit design, sponsors
- Brand colours configured as Tailwind CSS theme tokens before build begins
- Sponsor logos uploaded to Cloudinary and displayed on the home page
- Kit colours used for hero section and accent colours throughout

---

## Security — Supabase Row-Level Security (RLS)

RLS is enabled on all Supabase tables. Key policies:

| Table | Policy |
|---|---|
| `parents` | Parent can read/update only their own row (`user_id = auth.uid()`) |
| `players` | Parent can read/update only players linked to their `parents.id` |
| `payments` | Parent can read only their own payments; cannot insert or update directly |
| `media` | Public read on published rows; only admin can insert/update/delete |
| `user_roles` | No user can read or write their own role; admin only (enforced via service role key in server actions) |
| `settings` | Public read; no user write (updated only via Supabase Studio or service role) |

All writes that require elevated permissions (admin actions, Cloudinary signing) use the Supabase **service role key** in server-side Next.js API routes — never in client-side code.

---

## API Routes (Next.js)

| Route | Method | Purpose |
|---|---|---|
| `/api/cloudinary/sign` | POST | Signs Cloudinary upload requests server-side. Validates the caller's Supabase session and confirms `admin` role via `user_roles` before issuing the signature; returns 403 if not admin. |

---

## Deployment

1. Code lives in a GitHub repository
2. Vercel connects to GitHub — every push to `main` triggers an automatic deploy
3. Environment variables (Supabase URL, Cloudinary credentials) stored in Vercel dashboard — never in code
4. Domain registered separately and pointed to Vercel via DNS
5. **First admin account:** After initial deploy, the admin registers at `/register`, then run the seed SQL in Supabase Studio to grant them the `admin` role (see Task 15 in the implementation plan)
6. **Payment details:** After deploy, update `paypal_me_url`, `monzo_details`, and `revolut_details` in the `settings` table via Supabase Studio

---

## Out of Scope (MVP)

- Automated payment confirmation (requires Stripe — Phase 2 once club is registered)
- Scheduling (Heja stays as-is until Phase 2)
- Merchandise shop
- Parent photo uploads (admin-only for MVP)
- Announcements system
- Parent ↔ coach messaging
- Overdue/recurring payment tracking
- Push notifications / email notifications (console log only in MVP)
- Mobile app
