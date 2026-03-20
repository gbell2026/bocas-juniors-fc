# Bocas Juniors FC — MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Bocas Juniors FC MVP — a club website with manual membership payments (PayPal.Me, Monzo, Revolut, and cash), a masonry photo/video gallery (Cloudinary), player registration, and an admin dashboard.

**Architecture:** Next.js 14 App Router with TypeScript; Supabase for auth and database with RLS; manual payment confirmation by admin (no automated payment processing in MVP); Cloudinary for media storage and CDN. All secrets are server-side only — never exposed to the client.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (`@supabase/ssr`), `next-cloudinary`, Jest, React Testing Library

**Spec:** `docs/superpowers/specs/2026-03-20-bocas-juniors-fc-website-design.md`

---

## Chunk 1: Project Foundation

### Task 1: Initialise Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- Create: `jest.config.ts`, `jest.setup.ts`
- Create: `.env.local.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/gillesbell
npx create-next-app@14 bocas-juniors-fc \
  --typescript --tailwind --eslint --app \
  --src-dir --import-alias "@/*" --no-git
cd bocas-juniors-fc
git init && git add -A && git commit -m "chore: scaffold Next.js 14 project"
```

- [ ] **Step 2: Install dependencies**

```bash
npm install \
  @supabase/supabase-js @supabase/ssr \
  next-cloudinary cloudinary \
  react-masonry-css yet-another-react-lightbox

npm install --save-dev \
  jest @types/jest jest-environment-jsdom \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event ts-jest
```

- [ ] **Step 3: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
}

export default createJestConfig(config)
```

Create `jest.setup.ts`:
```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 4: Create env template**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

ADMIN_EMAIL=admin@bocasjuniorsfc.com
```

```bash
cp .env.local.example .env.local
# Fill in .env.local from Supabase and Cloudinary dashboards
```

- [ ] **Step 5: Configure Tailwind brand colours**

Edit `tailwind.config.ts` — add inside `theme.extend.colors`:
```typescript
brand: {
  primary: '#1a5276',   // REPLACE with actual club primary colour
  secondary: '#f39c12', // REPLACE with actual club secondary colour
  accent: '#ffffff',
},
```

> **Action:** Replace placeholder hex values with real brand colours before building UI.

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```
Expected: Dev server running at http://localhost:3000.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: install dependencies and configure jest + tailwind"
```

---

### Task 2: Supabase Client Utilities

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/supabase/types.ts`
- Create: `src/lib/supabase/__tests__/client.test.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Write failing test**

Create `src/lib/supabase/__tests__/client.test.ts`:
```typescript
describe('createBrowserClient', () => {
  it('returns a client without throwing', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
    const { createBrowserClient } = require('../client')
    expect(() => createBrowserClient()).not.toThrow()
  })
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/lib/supabase/__tests__/client.test.ts
```
Expected: FAIL — `Cannot find module '../client'`

- [ ] **Step 3: Create browser client**

Create `src/lib/supabase/client.ts`:
```typescript
import { createBrowserClient as _create } from '@supabase/ssr'
import type { Database } from './types'

export function createBrowserClient() {
  return _create<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

- [ ] **Step 4: Create server clients**

Create `src/lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )
}

// Use ONLY in server actions and API routes — never expose service role key to client
export function createSupabaseServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )
}
```

- [ ] **Step 5: Create types placeholder**

Create `src/lib/supabase/types.ts`:
```typescript
// Generated after running: npx supabase gen types typescript --linked > src/lib/supabase/types.ts
// This file will be overwritten — do not edit manually after schema is applied.

export type PlayerStatus = 'active' | 'inactive' | 'injured' | 'away'
export type PaymentMethod = 'paypal' | 'monzo' | 'revolut' | 'cash'
export type PaymentStatus = 'succeeded' | 'pending' | 'failed'
export type MediaType = 'photo' | 'video'
export type UserRole = 'parent' | 'coach' | 'admin' | 'player'

export type Player = {
  id: string; user_id: string | null; parent_id: string
  name: string; date_of_birth: string; position: string
  status: PlayerStatus; return_date: string | null; created_at: string
}
export type Parent = {
  id: string; user_id: string; name: string
  email: string; phone: string; created_at: string
}
export type Payment = {
  id: string; parent_id: string; player_id: string
  payment_method: PaymentMethod; amount: number; currency: string
  status: PaymentStatus; paid_at: string | null; notes: string | null
}
export type Media = {
  id: string; cloudinary_public_id: string; type: MediaType
  caption: string | null; pinned: boolean
  uploaded_by: string; uploaded_at: string; published: boolean
}
export type UserRoleRow = { user_id: string; role: UserRole }
export type Setting = { key: string; value: string; updated_at: string }

export type Database = {
  public: {
    Tables: {
      players: { Row: Player; Insert: Omit<Player, 'id' | 'created_at'>; Update: Partial<Player> }
      parents: { Row: Parent; Insert: Omit<Parent, 'id' | 'created_at'>; Update: Partial<Parent> }
      payments: { Row: Payment; Insert: Omit<Payment, 'id'>; Update: Partial<Payment> }
      media: { Row: Media; Insert: Omit<Media, 'id'>; Update: Partial<Media> }
      user_roles: { Row: UserRoleRow; Insert: UserRoleRow; Update: Partial<UserRoleRow> }
      settings: { Row: Setting; Insert: Setting; Update: Partial<Setting> }
    }
  }
}
```

- [ ] **Step 6: Create auth middleware**

Create `src/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = ['/profile', '/admin'].some(p =>
    request.nextUrl.pathname.startsWith(p)
  )

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Admin-only guard — must use a raw service role client here.
  // Two reasons: (1) RLS on user_roles has `using (false)` — only service role can read it.
  // (2) `next/headers` is unavailable in middleware, so the shared createSupabaseServiceClient()
  //     utility (which calls cookies() from next/headers) cannot be used here. Do not refactor
  //     this to use that utility — it will break at runtime.
  if (user && request.nextUrl.pathname.startsWith('/admin')) {
    const { createClient } = await import('@supabase/supabase-js')
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data: roleRow } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single()
    if (roleRow?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: ['/profile/:path*', '/admin/:path*'],
}
```

- [ ] **Step 7: Run test — verify PASS**

```bash
npx jest src/lib/supabase/__tests__/client.test.ts
```
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts
git commit -m "feat: Supabase client utilities and auth/admin middleware"
```

---

### Task 3: Database Schema

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`
- Create: `supabase/migrations/002_seed_settings.sql`

> **Prerequisite:** `brew install supabase/tap/supabase` → `supabase login` → `supabase init` → `supabase link --project-ref YOUR_PROJECT_REF`

- [ ] **Step 1: Write schema migration**

Create `supabase/migrations/001_initial_schema.sql`:
```sql
create type player_status as enum ('active', 'inactive', 'injured', 'away');
create type payment_method_type as enum ('paypal', 'monzo', 'revolut', 'cash');
create type payment_status_type as enum ('succeeded', 'pending', 'failed');
create type media_type as enum ('photo', 'video');
create type user_role_type as enum ('parent', 'coach', 'admin', 'player');

create table user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role user_role_type not null
);

create table parents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  parent_id uuid not null references parents(id) on delete cascade,
  name text not null,
  date_of_birth date not null,
  position text not null,
  status player_status not null default 'inactive',
  return_date date,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references parents(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  payment_method payment_method_type not null,
  amount integer not null,
  currency text not null default 'usd',
  status payment_status_type not null default 'pending',
  paid_at timestamptz,
  notes text
);

create table media (
  id uuid primary key default gen_random_uuid(),
  cloudinary_public_id text not null,
  type media_type not null,
  caption text,
  pinned boolean not null default false,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  uploaded_at timestamptz not null default now(),
  published boolean not null default true
);

create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- RLS
alter table user_roles enable row level security;
alter table parents enable row level security;
alter table players enable row level security;
alter table payments enable row level security;
alter table media enable row level security;
alter table settings enable row level security;

-- user_roles: service role only (no user-facing policies)
create policy "no_user_access" on user_roles using (false);

-- parents: own row only
create policy "parent_select_own" on parents for select using (user_id = auth.uid());
create policy "parent_update_own" on parents for update using (user_id = auth.uid());

-- players: parent reads/updates their players
create policy "parent_select_players" on players for select
  using (parent_id in (select id from parents where user_id = auth.uid()));
create policy "parent_update_players" on players for update
  using (parent_id in (select id from parents where user_id = auth.uid()));

-- payments: parent reads own payments
create policy "parent_select_payments" on payments for select
  using (parent_id in (select id from parents where user_id = auth.uid()));

-- media: anyone reads published
create policy "public_select_media" on media for select using (published = true);

-- settings: anyone reads
create policy "public_select_settings" on settings for select using (true);
```

- [ ] **Step 2: Seed settings**

Create `supabase/migrations/002_seed_settings.sql`:
```sql
-- Default membership fee: $25.00 = 2500 cents. Update via Supabase Studio.
-- Update paypal_me_url, monzo_details, revolut_details via Supabase Studio after deploy.
insert into settings (key, value, updated_at)
values
  ('membership_fee_cents', '2500', now()),
  ('paypal_me_url', 'https://paypal.me/bocasjuniorsfc', now()),
  ('monzo_details', 'Sort: 00-00-00 / Acc: 00000000 / Ref: [player name]', now()),
  ('revolut_details', '@bocasjuniorsfc on Revolut', now());
```

- [ ] **Step 3: Apply migrations**

```bash
supabase db push
```
Expected: Both migrations applied. Verify tables exist in Supabase Studio.

- [ ] **Step 4: Generate types**

```bash
npx supabase gen types typescript --linked > src/lib/supabase/types.ts
```
Expected: `types.ts` updated with generated types. Confirm it compiles: `npx tsc --noEmit`

> **Note — Contact page data:** The spec allows contact details to be stored in a `contacts` table. For MVP they are hardcoded in `src/app/contact/page.tsx`. No migration is needed. If you want to make them editable via Supabase Studio later, add a `contacts` table migration at that point.

> **Note — Admin seeding:** After the first admin registers at `/register`, run the SQL snippet in Task 13 Step 7 to grant them the admin role. This must be done before the admin can access `/admin`.

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: database schema, RLS policies, and settings seed"
```

---

## Chunk 2: Authentication

### Task 4: Registration — Server Action

**Files:**
- Create: `src/app/actions/register.ts`
- Create: `src/app/actions/__tests__/register.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/actions/__tests__/register.test.ts`:
```typescript
// Mock Supabase service client
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceClient: jest.fn(),
}))

import { registerParentAndPlayer } from '../register'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  auth: { admin: { createUser: jest.fn() } },
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

it('returns error if auth.admin.createUser fails', async () => {
  mockSupabase.auth.admin.createUser.mockResolvedValue({
    data: { user: null }, error: { message: 'Email taken' }
  })
  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
  })
  expect(result.error).toBe('Email taken')
})

it('returns playerId on success', async () => {
  mockSupabase.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: 'user-1' } }, error: null
  })
  // parents and players use .insert().select().single() — mock via single()
  mockSupabase.single
    .mockResolvedValueOnce({ data: { id: 'parent-1' }, error: null }) // parents
    .mockResolvedValueOnce({ data: { id: 'player-1' }, error: null }) // players
  // user_roles uses .insert() directly (no .select().single()) — must resolve as a promise
  mockSupabase.insert
    .mockReturnValueOnce(mockSupabase)  // parents .insert() → chained to .select()
    .mockReturnValueOnce(mockSupabase)  // players .insert() → chained to .select()
    .mockResolvedValueOnce({ error: null }) // user_roles .insert() → awaited directly
  mockSupabase.select.mockReturnThis()
  mockSupabase.from.mockReturnThis()

  const result = await registerParentAndPlayer({
    parentName: 'Jane', email: 'jane@test.com', phone: '555-1234', password: 'pass123',
    playerName: 'Junior', dateOfBirth: '2015-06-01', position: 'Forward',
  })
  expect(result.playerId).toBe('player-1')
  expect(result.parentId).toBe('parent-1')
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/app/actions/__tests__/register.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement server action**

> **Note:** We use `auth.admin.createUser` with `email_confirm: true` (not `auth.signUp`) so registration proceeds without an email verification gate. The trade-off is that Supabase's automatic welcome email is suppressed. **Welcome email is out of scope for MVP.** If needed in Phase 2, integrate [Resend](https://resend.com) (free tier: 3k/month) and call `resend.emails.send()` after the `user_roles` insert succeeds.

Create `src/app/actions/register.ts`:
```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export type RegisterInput = {
  parentName: string; email: string; phone: string; password: string
  playerName: string; dateOfBirth: string; position: string
}

export type RegisterResult =
  | { playerId: string; parentId: string; userId: string; error?: never }
  | { error: string; playerId?: never; parentId?: never; userId?: never }

export async function registerParentAndPlayer(input: RegisterInput): Promise<RegisterResult> {
  const supabase = createSupabaseServiceClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true, // skip email verification gate
  })
  if (authError || !authData.user) return { error: authError?.message ?? 'Registration failed' }
  const userId = authData.user.id

  // 2. Insert parent row
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .insert({ user_id: userId, name: input.parentName, email: input.email, phone: input.phone })
    .select()
    .single()
  if (parentError || !parent) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'Failed to create parent record' }
  }

  // 3. Insert player row
  const { data: player, error: playerError } = await supabase
    .from('players')
    .insert({
      parent_id: parent.id,
      name: input.playerName,
      date_of_birth: input.dateOfBirth,
      position: input.position,
    })
    .select()
    .single()
  if (playerError || !player) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'Failed to create player record' }
  }

  // 4. Assign parent role
  const { error: roleError } = await supabase
    .from('user_roles').insert({ user_id: userId, role: 'parent' })
  if (roleError) {
    await supabase.auth.admin.deleteUser(userId) // rollback
    return { error: 'Failed to assign role' }
  }

  return { playerId: player.id, parentId: parent.id, userId }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx jest src/app/actions/__tests__/register.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/
git commit -m "feat: registration server action with rollback on failure"
```

---

### Task 5: Registration Page + Login Page

**Files:**
- Create: `src/app/register/page.tsx`
- Create: `src/components/register/registration-form.tsx`
- Create: `src/app/login/page.tsx`
- Create: `src/components/auth/login-form.tsx`

- [ ] **Step 1: Write test for registration form**

Create `src/components/register/__tests__/registration-form.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { RegistrationForm } from '../registration-form'

jest.mock('@/app/actions/register', () => ({
  registerParentAndPlayer: jest.fn().mockResolvedValue({ playerId: 'p1', parentId: 'pa1', userId: 'u1' }),
}))

it('renders all required fields', () => {
  render(<RegistrationForm onSuccess={jest.fn<void, [string, string, string, string]>()} />)
  expect(screen.getByLabelText(/player name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/parent name/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/phone/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/position/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/components/register/__tests__/registration-form.test.tsx
```

- [ ] **Step 3: Create registration form component**

Create `src/components/register/registration-form.tsx`:
```typescript
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
    onSuccess(result.playerId, result.parentId, fd.get('parentName') as string, fd.get('playerName') as string)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
      <h2 className="text-2xl font-bold">Register Your Child</h2>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-brand-primary">Player Details</legend>
        <div>
          <label htmlFor="playerName" className="block text-sm font-medium">Player Name</label>
          <input id="playerName" name="playerName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="dateOfBirth" className="block text-sm font-medium">Date of Birth</label>
          <input id="dateOfBirth" name="dateOfBirth" type="date" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="position" className="block text-sm font-medium">Position</label>
          <select id="position" name="position" required className="input w-full">
            <option value="">Select…</option>
            {['Goalkeeper','Defender','Midfielder','Forward'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold text-brand-primary">Parent / Guardian Details</legend>
        <div>
          <label htmlFor="parentName" className="block text-sm font-medium">Parent Name</label>
          <input id="parentName" name="parentName" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">Phone</label>
          <input id="phone" name="phone" type="tel" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" minLength={8} required className="input w-full" />
        </div>
      </fieldset>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? 'Registering…' : 'Register & Pay'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create register page (with stub payment step)**

> `PaymentForm` does not exist yet — it is created in Task 7. Use a stub `<p>` placeholder so TypeScript compiles now. Task 7 replaces the stub.

Create `src/app/register/page.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { RegistrationForm } from '@/components/register/registration-form'

export default function RegisterPage() {
  const [step, setStep] = useState<'register' | 'pay'>('register')
  const [ids, setIds] = useState<{ playerId: string; parentId: string; parentName: string; playerName: string } | null>(null)

  if (step === 'pay' && ids) {
    // TODO: replaced in Task 7 with <PaymentOptionsPanel playerId={ids.playerId} parentId={ids.parentId} parentName={ids.parentName} playerName={ids.playerName} />
    return <main className="py-12 px-4"><p>Loading payment…</p></main>
  }

  return (
    <main className="py-12 px-4">
      <RegistrationForm
        onSuccess={(playerId, parentId, parentName, playerName) => {
          setIds({ playerId, parentId, parentName, playerName })
          setStep('pay')
        }}
      />
    </main>
  )
}
```

- [ ] **Step 5: Create login page**

Create `src/app/login/page.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const supabase = createBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: fd.get('email') as string,
      password: fd.get('password') as string,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/profile')
  }

  return (
    <main className="py-12 px-4">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
        <h1 className="text-2xl font-bold">Log In</h1>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className="input w-full" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium">Password</label>
          <input id="password" name="password" type="password" required className="input w-full" />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Logging in…' : 'Log In'}
        </button>
        <p className="text-sm text-center">
          Not registered? <a href="/register" className="underline">Register here</a>
        </p>
      </form>
    </main>
  )
}
```

- [ ] **Step 6: Write and run login page test**

Create `src/app/login/__tests__/page.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import LoginPage from '../page'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/lib/supabase/client', () => ({
  createBrowserClient: () => ({
    auth: { signInWithPassword: jest.fn().mockResolvedValue({ error: null }) }
  })
}))

it('renders email, password fields and login button', () => {
  render(<LoginPage />)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
})
```

```bash
npx jest src/components/register/__tests__/registration-form.test.tsx src/app/login/__tests__/page.test.tsx
```
Expected: Both PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/register/ src/app/login/ src/components/register/
git commit -m "feat: registration and login pages"
```

---

## Chunk 3: Payments

### Task 6: Payment Server Actions

**Files:**
- Create: `src/app/actions/payment.ts`
- Create: `src/app/actions/__tests__/payment.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/actions/__tests__/payment.test.ts`:
```typescript
jest.mock('@/lib/supabase/server', () => ({ createSupabaseServiceClient: jest.fn() }))

import { requestPayment, confirmPayment, denyPayment } from '../payment'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  single: jest.fn(),
}

beforeEach(() => {
  (createSupabaseServiceClient as jest.Mock).mockReturnValue(mockSupabase)
  jest.clearAllMocks()
})

it('requestPayment inserts pending payment', async () => {
  mockSupabase.single.mockResolvedValue({ data: { value: '2500' }, error: null })
  mockSupabase.insert.mockResolvedValue({ error: null })
  const result = await requestPayment({
    playerId: 'p1', parentId: 'pa1', method: 'paypal',
    parentName: 'Jane', playerName: 'Junior',
  })
  expect(result.error).toBeUndefined()
})

it('confirmPayment sets status to succeeded and activates player', async () => {
  mockSupabase.single.mockResolvedValue({ data: { player_id: 'player-1' }, error: null })
  await confirmPayment('pay-1')
  expect(mockSupabase.from).toHaveBeenCalledWith('players')
})

it('denyPayment sets status to failed on the correct payment row', async () => {
  await denyPayment('pay-1')
  expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'failed' })
  expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'pay-1')
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/app/actions/__tests__/payment.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement payment actions**

Create `src/app/actions/payment.ts`:
```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PaymentMethod } from '@/lib/supabase/types'

export type RequestPaymentResult = { error?: string }

// Parent-initiated: create a pending payment record for any method
export async function requestPayment({
  playerId, parentId, method, parentName, playerName,
}: {
  playerId: string; parentId: string; method: PaymentMethod
  parentName: string; playerName: string
}): Promise<RequestPaymentResult> {
  const supabase = createSupabaseServiceClient()

  const { data: setting } = await supabase
    .from('settings').select('value').eq('key', 'membership_fee_cents').single()
  const amount = parseInt(setting?.value ?? '2500', 10)

  const { error } = await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: method,
    amount,
    currency: 'usd',
    status: 'pending',
    notes: `${method} payment requested by ${parentName} for ${playerName}`,
  })

  if (error) return { error: 'Failed to create payment request' }

  // MVP: log to console. Phase 2: send email via Resend.
  console.log(`[ADMIN NOTIFY] ${method} payment requested: ${parentName} for ${playerName}`)
  return {}
}

// Admin: confirm a pending payment (any method)
export async function confirmPayment(paymentId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('payments')
    .update({ status: 'succeeded', paid_at: new Date().toISOString() })
    .eq('id', paymentId)
  const { data: payment } = await supabase
    .from('payments').select('player_id').eq('id', paymentId).single()
  if (payment) {
    await supabase.from('players').update({ status: 'active' }).eq('id', payment.player_id)
  }
  return {}
}

// Admin: deny a pending payment (any method)
export async function denyPayment(paymentId: string) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('payments')
    .update({ status: 'failed' })
    .eq('id', paymentId)
  return {}
}

// Admin: directly mark a player as paid with cash (no prior pending record needed)
export async function adminMarkCashPaid({
  playerId, parentId, adminNotes,
}: { playerId: string; parentId: string; adminNotes?: string }) {
  const supabase = createSupabaseServiceClient()
  const { data: setting } = await supabase
    .from('settings').select('value').eq('key', 'membership_fee_cents').single()
  const amount = parseInt(setting?.value ?? '2500', 10)

  await supabase.from('payments').insert({
    parent_id: parentId,
    player_id: playerId,
    payment_method: 'cash',
    amount,
    currency: 'usd',
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    notes: adminNotes ?? 'Cash paid directly — marked by admin',
  })
  await supabase.from('players').update({ status: 'active' }).eq('id', playerId)
  return {}
}

// Server action called by PaymentOptionsPanel to fetch settings for display
export async function getPaymentSettings() {
  const supabase = createSupabaseServiceClient()
  const { data: settings } = await supabase.from('settings').select('*')
  const map = Object.fromEntries((settings ?? []).map(s => [s.key, s.value]))
  return {
    feeCents: parseInt(map.membership_fee_cents ?? '2500', 10),
    paypalMeUrl: map.paypal_me_url ?? '',
    monzoDetails: map.monzo_details ?? '',
    revolutDetails: map.revolut_details ?? '',
  }
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx jest src/app/actions/__tests__/payment.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/payment.ts src/app/actions/__tests__/payment.test.ts
git commit -m "feat: payment server actions (request, confirm, deny, admin mark, settings)"
```

---

### Task 7: Payment Options Panel Component

**Files:**
- Create: `src/components/payment/payment-options-panel.tsx`
- Create: `src/components/payment/__tests__/payment-options-panel.test.tsx`
- Modify: `src/app/register/page.tsx` (replace stub with real `PaymentOptionsPanel`)

> **Note:** The PaymentOptionsPanel is used in two places — the register flow (Task 5) and the profile page (Task 8). The register page currently has a `<p>Loading payment…</p>` stub. After creating the component in Step 3, update `src/app/register/page.tsx` as shown in Step 0.

- [ ] **Step 0: Note — replaces stub in register page**

After creating `payment-options-panel.tsx` in Step 3, update `src/app/register/page.tsx`:
- Add import: `import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'`
- Replace `<main className="py-12 px-4"><p>Loading payment…</p></main>` with:
```typescript
<main className="py-12 px-4">
  <PaymentOptionsPanel
    playerId={ids.playerId}
    parentId={ids.parentId}
    parentName={ids.parentName}
    playerName={ids.playerName}
  />
</main>
```

- [ ] **Step 1: Write failing test**

Create `src/components/payment/__tests__/payment-options-panel.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'

jest.mock('@/app/actions/payment', () => ({
  getPaymentSettings: jest.fn().mockResolvedValue({
    feeCents: 2500,
    paypalMeUrl: 'https://paypal.me/bocasjuniorsfc',
    monzoDetails: 'Sort: 04-00-04 / Acc: 12345678',
    revolutDetails: '@bocasjuniorsfc',
  }),
  requestPayment: jest.fn().mockResolvedValue({}),
}))

import { PaymentOptionsPanel } from '../payment-options-panel'

it('renders all four payment method buttons', async () => {
  render(
    <PaymentOptionsPanel
      playerId="p1" parentId="pa1"
      parentName="Jane" playerName="Junior"
    />
  )
  // Loading state initially
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/components/payment/__tests__/payment-options-panel.test.tsx
```

- [ ] **Step 3: Create payment options panel component**

Create `src/components/payment/payment-options-panel.tsx`:
```typescript
'use client'
import { useEffect, useState } from 'react'
import { getPaymentSettings, requestPayment } from '@/app/actions/payment'
import type { PaymentMethod } from '@/lib/supabase/types'

type Settings = Awaited<ReturnType<typeof getPaymentSettings>>
type Props = { playerId: string; parentId: string; parentName: string; playerName: string }
type MethodState = 'idle' | 'awaiting_confirm' | 'loading' | 'sent' | 'error'

export function PaymentOptionsPanel({ playerId, parentId, parentName, playerName }: Props) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [monzoCopied, setMonzoCopied] = useState(false)
  const [revolutCopied, setRevolutCopied] = useState(false)
  const [methodState, setMethodState] = useState<Record<PaymentMethod, MethodState>>({
    paypal: 'idle', monzo: 'idle', revolut: 'idle', cash: 'idle',
  })

  useEffect(() => {
    getPaymentSettings().then(setSettings)
  }, [])

  if (!settings) return <p>Loading payment options…</p>

  const fee = `$${(settings.feeCents / 100).toFixed(2)}`

  async function handleConfirm(method: PaymentMethod) {
    setMethodState(s => ({ ...s, [method]: 'loading' }))
    const result = await requestPayment({ playerId, parentId, method, parentName, playerName })
    setMethodState(s => ({ ...s, [method]: result.error ? 'error' : 'sent' }))
  }

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    setTimeout(() => setter(false), 2000)
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-6">
      <h2 className="text-xl font-bold">Pay Membership Fee — {fee}</h2>
      <p className="text-gray-600 text-sm">Choose a payment method below. Once you've paid, click the confirmation button so the admin can verify your payment.</p>

      {/* PayPal / Card */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay via PayPal or Credit/Debit Card</h3>
        <p className="text-sm text-gray-600">Opens PayPal. You can pay with PayPal balance, bank account, or credit/debit card — no PayPal account required for card payments.</p>
        {methodState.paypal === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Payment request sent — admin will confirm shortly.</p>
        ) : methodState.paypal === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <div className="flex gap-3 flex-wrap">
            <a
              href={settings.paypalMeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
              onClick={() => setMethodState(s => ({ ...s, paypal: 'awaiting_confirm' }))}
            >
              Pay {fee} via PayPal / Card ↗
            </a>
            {methodState.paypal === 'awaiting_confirm' && (
              <button
                onClick={() => handleConfirm('paypal')}
                disabled={methodState.paypal === 'loading' as any}
                className="btn-secondary text-sm"
              >
                I've paid
              </button>
            )}
          </div>
        )}
      </div>

      {/* Monzo */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay via Monzo bank transfer</h3>
        <div className="bg-gray-50 rounded p-3 font-mono text-sm flex items-center justify-between gap-3">
          <span>{settings.monzoDetails}</span>
          <button
            onClick={() => copyToClipboard(settings.monzoDetails, setMonzoCopied)}
            className="text-brand-primary text-xs shrink-0"
          >
            {monzoCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {methodState.monzo === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Transfer confirmed — admin will verify shortly.</p>
        ) : methodState.monzo === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('monzo')}
            disabled={methodState.monzo === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.monzo === 'loading' ? 'Sending…' : "I've sent the transfer"}
          </button>
        )}
      </div>

      {/* Revolut */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay via Revolut bank transfer</h3>
        <div className="bg-gray-50 rounded p-3 font-mono text-sm flex items-center justify-between gap-3">
          <span>{settings.revolutDetails}</span>
          <button
            onClick={() => copyToClipboard(settings.revolutDetails, setRevolutCopied)}
            className="text-brand-primary text-xs shrink-0"
          >
            {revolutCopied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        {methodState.revolut === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Transfer confirmed — admin will verify shortly.</p>
        ) : methodState.revolut === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('revolut')}
            disabled={methodState.revolut === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.revolut === 'loading' ? 'Sending…' : "I've sent the transfer"}
          </button>
        )}
      </div>

      {/* Cash */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="font-semibold">Pay by Cash</h3>
        <p className="text-sm text-gray-600">Bring cash to the next training session. Click below to notify the admin.</p>
        {methodState.cash === 'sent' ? (
          <p className="text-green-600 text-sm font-medium">✓ Admin notified — bring {fee} cash to training.</p>
        ) : methodState.cash === 'error' ? (
          <p className="text-red-600 text-sm">Something went wrong. Please try again.</p>
        ) : (
          <button
            onClick={() => handleConfirm('cash')}
            disabled={methodState.cash === 'loading'}
            className="btn-secondary text-sm"
          >
            {methodState.cash === 'loading' ? 'Sending…' : "I'll pay cash at training"}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx jest src/components/payment/__tests__/payment-options-panel.test.tsx
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/payment/ src/app/register/page.tsx
git commit -m "feat: payment options panel (PayPal/Card, Monzo, Revolut, Cash)"
```

---

### Task 8: Profile Page

**Files:**
- Create: `src/app/profile/page.tsx`
- Create: `src/components/profile/payment-history.tsx`
- Create: `src/components/profile/player-info.tsx`

- [ ] **Step 1: Create profile page (server component)**

Create `src/app/profile/page.tsx`:
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentHistory } from '@/components/profile/payment-history'
import { PlayerInfo } from '@/components/profile/player-info'
import { PaymentOptionsPanel } from '@/components/payment/payment-options-panel'

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: parent } = await supabase
    .from('parents').select('*, players(*)').eq('user_id', user.id).single()

  const { data: payments } = await supabase
    .from('payments').select('*').eq('parent_id', parent?.id ?? '').order('paid_at', { ascending: false })

  const player = parent?.players?.[0]

  return (
    <main className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <h1 className="text-2xl font-bold">My Profile</h1>
      {player && <PlayerInfo player={player} />}
      <PaymentOptionsPanel
        playerId={player?.id ?? ''}
        parentId={parent?.id ?? ''}
        parentName={parent?.name ?? ''}
        playerName={player?.name ?? ''}
      />
      <PaymentHistory payments={payments ?? []} />
    </main>
  )
}
```

- [ ] **Step 2: Create payment history component**

Create `src/components/profile/payment-history.tsx`:
```typescript
import type { Payment } from '@/lib/supabase/types'

export function PaymentHistory({ payments }: { payments: Payment[] }) {
  if (payments.length === 0) return <p className="text-gray-500">No payments yet.</p>
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Payment History</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Amount</th>
            <th className="text-left p-2">Method</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
              <td className="p-2">${(p.amount / 100).toFixed(2)}</td>
              <td className="p-2 capitalize">{p.payment_method}</td>
              <td className="p-2 capitalize">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
```

- [ ] **Step 3: Create player info component**

Create `src/components/profile/player-info.tsx`:
```typescript
import type { Player } from '@/lib/supabase/types'

export function PlayerInfo({ player }: { player: Player }) {
  return (
    <section className="bg-gray-50 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Player Details</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="font-medium">Name</dt><dd>{player.name}</dd>
        <dt className="font-medium">Position</dt><dd>{player.position}</dd>
        <dt className="font-medium">Date of Birth</dt><dd>{player.date_of_birth}</dd>
        <dt className="font-medium">Status</dt>
        <dd className="capitalize">
          {player.status}
          {player.return_date && ` (returns ${player.return_date})`}
        </dd>
      </dl>
    </section>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/ src/components/profile/
git commit -m "feat: profile page with player info, payment options panel, and payment history"
```

---

## Chunk 4: Gallery

### Task 9: Cloudinary Sign API Route

**Files:**
- Create: `src/app/api/cloudinary/sign/route.ts`
- Create: `src/app/api/cloudinary/sign/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/cloudinary/sign/__tests__/route.test.ts`:
```typescript
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(),
  createSupabaseServiceClient: jest.fn(),
}))
jest.mock('cloudinary', () => ({
  v2: { utils: { api_sign_request: jest.fn().mockReturnValue('mock-sig') } }
}))

import { POST } from '../route'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

it('returns 403 if user is not admin', async () => {
  (createSupabaseServerClient as jest.Mock).mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  })
  ;(createSupabaseServiceClient as jest.Mock).mockReturnValue({
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { role: 'parent' }, error: null }),
  })
  const req = new Request('http://localhost/api/cloudinary/sign', { method: 'POST', body: '{}' })
  const res = await POST(req)
  expect(res.status).toBe(403)
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/app/api/cloudinary/sign/__tests__/route.test.ts
```

- [ ] **Step 3: Implement sign route**

Create `src/app/api/cloudinary/sign/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(req: NextRequest) {
  // Verify session with user client
  const supabaseUser = await createSupabaseServerClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS on user_roles uses (false) — only service role can read it
  const supabaseService = createSupabaseServiceClient()
  const { data: roleRow } = await supabaseService
    .from('user_roles').select('role').eq('user_id', user.id).single()
  if (roleRow?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const timestamp = Math.round(Date.now() / 1000)
  const paramsToSign = { timestamp, folder: 'bocas-juniors' }
  const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET!)

  return NextResponse.json({
    signature,
    timestamp,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    folder: 'bocas-juniors',
  })
}
```

- [ ] **Step 4: Run — verify PASS**

```bash
npx jest src/app/api/cloudinary/sign/__tests__/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cloudinary/
git commit -m "feat: Cloudinary signed upload API route with admin auth guard"
```

---

### Task 10: Gallery Page — Masonry Grid + Lightbox

**Files:**
- Create: `src/app/gallery/page.tsx`
- Create: `src/components/gallery/masonry-grid.tsx`
- Create: `src/components/gallery/media-tile.tsx`
- Create: `src/components/gallery/gallery-client.tsx`

- [ ] **Step 1: Write test for masonry grid**

Create `src/components/gallery/__tests__/masonry-grid.test.tsx`:
```typescript
import { render, screen } from '@testing-library/react'
import { MasonryGrid } from '../masonry-grid'
import type { Media } from '@/lib/supabase/types'

const photos: Media[] = [
  { id: '1', cloudinary_public_id: 'bocas/photo1', type: 'photo',
    caption: 'Training day', pinned: false, uploaded_by: 'u1',
    uploaded_at: '2026-03-01T00:00:00Z', published: true },
]

it('renders media items', () => {
  render(<MasonryGrid items={photos} onSelect={jest.fn()} />)
  expect(screen.getByAltText('Training day')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run — verify FAIL**

```bash
npx jest src/components/gallery/__tests__/masonry-grid.test.tsx
```

- [ ] **Step 3: Create masonry grid component**

Create `src/components/gallery/masonry-grid.tsx`:
```typescript
'use client'
import Masonry from 'react-masonry-css'
import { MediaTile } from './media-tile'
import type { Media } from '@/lib/supabase/types'

const breakpoints = { default: 3, 1024: 2, 640: 1 }

type Props = { items: Media[]; onSelect: (item: Media) => void }

export function MasonryGrid({ items, onSelect }: Props) {
  const sorted = [...items].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  })

  return (
    <Masonry
      breakpointCols={breakpoints}
      className="flex gap-[2px]"
      columnClassName="flex flex-col gap-[2px]"
    >
      {sorted.map(item => (
        <MediaTile key={item.id} item={item} onClick={() => onSelect(item)} />
      ))}
    </Masonry>
  )
}
```

- [ ] **Step 4: Create media tile component**

Create `src/components/gallery/media-tile.tsx`:
```typescript
import Image from 'next/image'
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
  const src = isVideo ? cloudinaryVideoThumb(item.cloudinary_public_id) : cloudinaryUrl(item.cloudinary_public_id, 600)

  return (
    <button onClick={onClick} className="relative block w-full overflow-hidden group">
      <img
        src={src}
        alt={item.caption ?? ''}
        className="w-full h-auto block"
        loading="lazy"
      />
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

- [ ] **Step 5: Create gallery client (lightbox integration)**

Create `src/components/gallery/gallery-client.tsx`:
```typescript
'use client'
import { useState } from 'react'
import Lightbox from 'yet-another-react-lightbox'
import Video from 'yet-another-react-lightbox/plugins/video'
import 'yet-another-react-lightbox/styles.css'
import { MasonryGrid } from './masonry-grid'
import type { Media } from '@/lib/supabase/types'

function cloudinaryUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/image/upload/q_auto,f_auto/${publicId}`
}
function cloudinaryVideoUrl(publicId: string) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  return `https://res.cloudinary.com/${cloud}/video/upload/q_auto/${publicId}.mp4`
}

export function GalleryClient({ items }: { items: Media[] }) {
  const [index, setIndex] = useState(-1)

  const slides = items.map(item =>
    item.type === 'video'
      ? { type: 'video' as const, sources: [{ src: cloudinaryVideoUrl(item.cloudinary_public_id), type: 'video/mp4' }] }
      : { src: cloudinaryUrl(item.cloudinary_public_id), alt: item.caption ?? '' }
  )

  return (
    <>
      <MasonryGrid items={items} onSelect={(item) => setIndex(items.indexOf(item))} />
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

- [ ] **Step 6: Create gallery page**

Create `src/app/gallery/page.tsx`:
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
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
    <main>
      <h1 className="text-2xl font-bold px-4 py-6">Gallery</h1>
      <GalleryClient items={media ?? []} />
    </main>
  )
}
```

- [ ] **Step 7: Run — verify PASS**

```bash
npx jest src/components/gallery/__tests__/masonry-grid.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add src/app/gallery/ src/components/gallery/
git commit -m "feat: gallery page with masonry grid and lightbox"
```

---

## Chunk 5: Admin Dashboard + Pages + Deploy

### Task 11: Admin Dashboard

**Files:**
- Create: `src/app/admin/page.tsx`
- Create: `src/components/admin/players-table.tsx`
- Create: `src/components/admin/pending-payments.tsx`
- Create: `src/components/admin/media-uploader.tsx`
- Create: `src/app/actions/admin.ts`

- [ ] **Step 1: Create admin server actions**

Create `src/app/actions/admin.ts`:
```typescript
'use server'
import { createSupabaseServiceClient } from '@/lib/supabase/server'
import type { PlayerStatus } from '@/lib/supabase/types'

export async function updatePlayerStatus(
  playerId: string,
  status: PlayerStatus,
  returnDate?: string
) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('players')
    .update({ status, return_date: returnDate ?? null })
    .eq('id', playerId)
}

export async function saveMediaRecord({
  cloudinaryPublicId, type, caption, uploadedBy
}: { cloudinaryPublicId: string; type: 'photo' | 'video'; caption?: string; uploadedBy: string }) {
  const supabase = createSupabaseServiceClient()
  await supabase.from('media').insert({
    cloudinary_public_id: cloudinaryPublicId,
    type,
    caption: caption ?? null,
    uploaded_by: uploadedBy,
    published: true,
  })
}

export async function getPendingPayments() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('payments')
    .select('*, players(name), parents(name)')
    .eq('status', 'pending')
    .order('paid_at', { ascending: true })
  return data ?? []
}

export async function getAllPlayers() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('players')
    .select('*, parents(name, email), payments(paid_at, status)')
    .order('name')
  // Attach last succeeded payment date to each player
  return (data ?? []).map(p => ({
    ...p,
    lastPaidAt: (p.payments as any[])
      ?.filter((pay: any) => pay.status === 'succeeded')
      .map((pay: any) => pay.paid_at)
      .sort()
      .at(-1) ?? null,
  }))
}

export async function getTotalRevenue() {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('payments')
    .select('amount')
    .eq('status', 'succeeded')
  return (data ?? []).reduce((sum, p) => sum + p.amount, 0)
}
```

- [ ] **Step 2: Create players table component**

Create `src/components/admin/players-table.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { updatePlayerStatus } from '@/app/actions/admin'
import { adminMarkCashPaid } from '@/app/actions/payment'
import type { Player } from '@/lib/supabase/types'

type PlayerWithParent = Player & {
  parents: { name: string; email: string }
  lastPaidAt: string | null
}

export function PlayersTable({ players }: { players: PlayerWithParent[] }) {
  const [updating, setUpdating] = useState<string | null>(null)
  // Track edited status and return date per player before committing
  const [edits, setEdits] = useState<Record<string, { status: string; returnDate: string }>>({})

  function getEdit(p: Player) {
    return edits[p.id] ?? { status: p.status, returnDate: p.return_date ?? '' }
  }

  async function handleStatusSave(p: PlayerWithParent) {
    const { status, returnDate } = getEdit(p)
    setUpdating(p.id)
    await updatePlayerStatus(p.id, status as any, returnDate || undefined)
    setUpdating(null)
    window.location.reload()
  }

  async function handleMarkCashPaid(p: PlayerWithParent) {
    setUpdating(p.id)
    await adminMarkCashPaid({ playerId: p.id, parentId: p.parent_id, adminNotes: 'Marked paid at training' })
    setUpdating(null)
    window.location.reload()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-100">
          <tr>
            {['Player', 'Position', 'DOB', 'Parent', 'Status', 'Return Date', 'Last Paid', 'Actions'].map(h => (
              <th key={h} className="text-left p-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(p => {
            const edit = getEdit(p)
            const needsReturnDate = edit.status === 'injured' || edit.status === 'away'
            return (
              <tr key={p.id} className="border-t align-top">
                <td className="p-3 font-medium">{p.name}</td>
                <td className="p-3">{p.position}</td>
                <td className="p-3">{p.date_of_birth}</td>
                <td className="p-3">{p.parents?.name}</td>
                <td className="p-3">
                  <select
                    value={edit.status}
                    disabled={updating === p.id}
                    onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, status: e.target.value } }))}
                    className="border rounded p-1 text-sm"
                  >
                    {['active', 'inactive', 'injured', 'away'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  {needsReturnDate ? (
                    <input
                      type="date"
                      value={edit.returnDate}
                      onChange={e => setEdits(prev => ({ ...prev, [p.id]: { ...edit, returnDate: e.target.value } }))}
                      className="border rounded p-1 text-sm"
                    />
                  ) : (p.return_date ?? '—')}
                </td>
                <td className="p-3">{p.lastPaidAt ? new Date(p.lastPaidAt).toLocaleDateString() : '—'}</td>
                <td className="p-3 space-y-1">
                  <button
                    onClick={() => handleStatusSave(p)}
                    disabled={updating === p.id}
                    className="btn-primary text-xs block w-full"
                  >Save Status</button>
                  <button
                    onClick={() => handleMarkCashPaid(p)}
                    disabled={updating === p.id}
                    className="btn-secondary text-xs block w-full"
                  >Mark Cash Paid</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Create pending payments component**

Create `src/components/admin/pending-payments.tsx`:
```typescript
'use client'
import { confirmPayment, denyPayment } from '@/app/actions/payment'

type PendingPayment = {
  id: string; amount: number; payment_method: string; notes: string | null
  players: { name: string } | null
  parents: { name: string } | null
}

const methodLabel: Record<string, string> = {
  paypal: 'PayPal/Card',
  monzo: 'Monzo',
  revolut: 'Revolut',
  cash: 'Cash',
}

export function PendingPayments({ payments }: { payments: PendingPayment[] }) {
  if (payments.length === 0) return null

  async function handleConfirm(id: string) {
    await confirmPayment(id)
    window.location.reload()
  }

  async function handleDeny(id: string) {
    await denyPayment(id)
    window.location.reload()
  }

  return (
    <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
      <h2 className="font-bold text-yellow-800 mb-3">
        ⚠️ Pending Payments ({payments.length})
      </h2>
      <div className="space-y-2">
        {payments.map(p => (
          <div key={p.id} className="flex items-center justify-between bg-white rounded p-3 border">
            <div>
              <span className="font-medium">{p.players?.name}</span>
              <span className="text-gray-500 mx-2">—</span>
              <span>Parent: {p.parents?.name}</span>
              <span className="text-gray-500 mx-2">·</span>
              <span className="text-sm font-medium">{methodLabel[p.payment_method] ?? p.payment_method}</span>
              <span className="text-gray-500 ml-2">${(p.amount / 100).toFixed(2)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleConfirm(p.id)} className="btn-success text-sm">Confirm</button>
              <button onClick={() => handleDeny(p.id)} className="btn-danger text-sm">Deny</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Create media uploader component**

Create `src/components/admin/media-uploader.tsx`:
```typescript
'use client'
import { useRef, useState } from 'react'
import { saveMediaRecord } from '@/app/actions/admin'

export function MediaUploader({ uploadedBy }: { uploadedBy: string }) {
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    setMessage(null)

    // Get signed upload parameters from our API route
    const signRes = await fetch('/api/cloudinary/sign', { method: 'POST', body: '{}' })
    if (!signRes.ok) { setMessage('Upload auth failed'); setUploading(false); return }
    const { signature, timestamp, cloudName, apiKey, folder } = await signRes.json()

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith('video/')
      const fd = new FormData()
      fd.append('file', file)
      fd.append('signature', signature)
      fd.append('timestamp', timestamp)
      fd.append('api_key', apiKey)
      fd.append('folder', folder)

      const resourceType = isVideo ? 'video' : 'image'
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
        { method: 'POST', body: fd }
      )
      const data = await res.json()
      if (data.public_id) {
        await saveMediaRecord({
          cloudinaryPublicId: data.public_id,
          type: isVideo ? 'video' : 'photo',
          uploadedBy,
        })
      }
    }

    setUploading(false)
    setMessage('Upload complete!')
    window.location.reload()
  }

  return (
    <section
      className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
    >
      <p className="text-gray-600 mb-3">Drag and drop photos/videos, or click to select</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="btn-primary"
      >
        {uploading ? 'Uploading…' : 'Select Files'}
      </button>
      {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
    </section>
  )
}
```

- [ ] **Step 5: Create admin dashboard page**

Create `src/app/admin/page.tsx`:
```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PlayersTable } from '@/components/admin/players-table'
import { PendingPayments } from '@/components/admin/pending-payments'
import { MediaUploader } from '@/components/admin/media-uploader'
import { getPendingPayments, getAllPlayers, getTotalRevenue } from '@/app/actions/admin'

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [players, pendingPayments, totalRevenueCents] = await Promise.all([
    getAllPlayers(),
    getPendingPayments(),
    getTotalRevenue(),
  ])

  return (
    <main className="max-w-5xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-lg font-semibold text-brand-primary">
          Total Revenue: ${(totalRevenueCents / 100).toFixed(2)}
        </p>
      </div>

      <PendingPayments payments={pendingPayments as any} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Players ({players.length})</h2>
        <PlayersTable players={players as any} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Upload Media</h2>
        <MediaUploader uploadedBy={user.id} />
      </section>
    </main>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/ src/components/admin/ src/app/actions/admin.ts
git commit -m "feat: admin dashboard with player management, payment confirmations, and media upload"
```

---

### Task 12: Home Page + Contact Page + Navigation

**Files:**
- Create: `src/app/page.tsx`
- Create: `src/app/contact/page.tsx`
- Create: `src/components/nav.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create navigation component**

Create `src/components/nav.tsx`:
```typescript
'use client'
import Link from 'next/link'
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
  const [user, setUser] = useState<any>(null)

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
    <nav className="bg-brand-primary text-white px-4 py-3 flex items-center justify-between">
      <Link href="/" className="font-bold text-lg">Bocas Juniors FC</Link>
      <div className="flex items-center gap-4 text-sm">
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`hover:underline ${pathname === href ? 'font-semibold' : ''}`}
          >
            {label}
          </Link>
        ))}
        {user ? (
          <>
            <Link href="/profile" className="hover:underline">My Profile</Link>
            <button onClick={handleLogout} className="hover:underline">Log Out</button>
          </>
        ) : (
          <Link href="/login" className="hover:underline">Log In</Link>
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Update root layout**

Edit `src/app/layout.tsx` — add `<Nav />` above `{children}`:
```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Nav } from '@/components/nav'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bocas Juniors FC',
  description: 'Youth football club in Bocas del Toro, Panama',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Nav />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Create home page**

Create `src/app/page.tsx`:
```typescript
import Image from 'next/image'
import Link from 'next/link'

// Replace SPONSOR_1 etc. with actual Cloudinary public IDs after uploading sponsor logos
const sponsors: string[] = [] // e.g. ['bocas-juniors/sponsor-1', 'bocas-juniors/sponsor-2']

export default function HomePage() {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  return (
    <main>
      {/* Hero */}
      <section className="bg-brand-primary text-white py-20 px-4 text-center">
        {/* Replace with actual logo: <Image src="/logo.png" alt="Bocas Juniors FC" width={120} height={120} className="mx-auto mb-4" /> */}
        <h1 className="text-4xl font-bold mb-4">Bocas Juniors FC</h1>
        <p className="text-xl mb-8 opacity-90">Youth football on the island</p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/register" className="bg-brand-secondary text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90">
            Register Your Child
          </Link>
          <Link href="/gallery" className="bg-white text-brand-primary px-6 py-3 rounded-lg font-semibold hover:opacity-90">
            View Gallery
          </Link>
        </div>
      </section>

      {/* Sponsors */}
      {sponsors.length > 0 && (
        <section className="py-12 px-4 text-center">
          <h2 className="text-lg font-semibold text-gray-500 mb-6 uppercase tracking-wide">Our Sponsors</h2>
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
      <section className="py-12 px-4 bg-gray-50 text-center">
        <h2 className="text-2xl font-bold mb-4">Ready to join?</h2>
        <p className="text-gray-600 mb-6">Register your child and pay the membership fee online.</p>
        <Link href="/register" className="btn-primary">Register Now</Link>
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Create contact page**

Create `src/app/contact/page.tsx`:
```typescript
// Contact details — update these directly in this file or move to Supabase Studio (settings table)
const contacts = [
  { name: 'Head Coach', role: 'Head Coach', email: 'coach@bocasjuniorsfc.com', phone: '+507 555 0001' },
  { name: 'Club Admin', role: 'Administrator', email: 'admin@bocasjuniorsfc.com', phone: '+507 555 0002' },
]

export default function ContactPage() {
  return (
    <main className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Contact Us</h1>
      <div className="space-y-4">
        {contacts.map(c => (
          <div key={c.email} className="bg-gray-50 rounded-lg p-5">
            <h2 className="font-semibold text-lg">{c.name}</h2>
            <p className="text-gray-500 text-sm mb-3">{c.role}</p>
            <p><a href={`mailto:${c.email}`} className="text-brand-primary underline">{c.email}</a></p>
            <p>{c.phone}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Add shared CSS classes to globals.css**

Edit `src/app/globals.css` — append:
```css
@layer components {
  .input {
    @apply border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary;
  }
  .btn-primary {
    @apply bg-brand-primary text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition;
  }
  .btn-secondary {
    @apply bg-gray-100 text-gray-800 px-4 py-2 rounded-lg font-semibold hover:bg-gray-200 transition;
  }
  .btn-success {
    @apply bg-green-600 text-white px-3 py-1 rounded font-medium hover:bg-green-700 transition;
  }
  .btn-danger {
    @apply bg-red-600 text-white px-3 py-1 rounded font-medium hover:bg-red-700 transition;
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/app/ src/components/nav.tsx
git commit -m "feat: home page, contact page, and navigation"
```

---

### Task 13: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
# Create repo at github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/bocas-juniors-fc.git
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**

1. Go to vercel.com → New Project → Import from GitHub
2. Select `bocas-juniors-fc`
3. Framework: Next.js (auto-detected)

- [ ] **Step 3: Add environment variables in Vercel**

In Vercel project settings → Environment Variables, add all keys from `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
ADMIN_EMAIL
```

- [ ] **Step 4: Deploy**

Click Deploy. Vercel builds and deploys automatically.

Expected: Deployment succeeds, site is live at `https://bocas-juniors-fc.vercel.app`

- [ ] **Step 5: Connect your domain**

In Vercel → Settings → Domains:
1. Add your domain (e.g. `bocasjuniorsfc.com`)
2. Follow Vercel's DNS instructions to point your domain registrar's nameservers to Vercel

- [ ] **Step 6: Populate payment details in Supabase Studio**

In Supabase Studio → Table Editor → `settings`, update these rows:
- `paypal_me_url` → your actual PayPal.Me link (e.g. `https://paypal.me/bocasjuniorsfc`)
- `monzo_details` → your sort code, account number, and reference instruction
- `revolut_details` → your Revtag or Revolut.me link

- [ ] **Step 7: Seed the first admin user**

After the admin registers at `/register`, run in Supabase Studio SQL editor:
```sql
insert into user_roles (user_id, role)
select id, 'admin'
from auth.users
where email = 'your-admin-email@example.com'
on conflict (user_id) do update set role = 'admin';
```

- [ ] **Step 8: Run full test suite**

```bash
npx jest
```
Expected: All tests PASS.

- [ ] **Step 9: Smoke test live site**

- [ ] Home page loads with brand colours
- [ ] Gallery page loads (empty until first upload)
- [ ] Register → fill form → payment options panel appears with all four methods
- [ ] Click "I've paid" on PayPal method → pending payment row appears in Supabase Studio
- [ ] Log in as admin → `/admin` shows pending payment → click Confirm → player status becomes `active`
- [ ] Log in → profile shows payment history
- [ ] Admin dashboard accessible with admin account
- [ ] Upload a photo via admin → appears in gallery
- [ ] Contact page shows coach details

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore: deployment configuration and smoke test checklist"
```

---

## Post-MVP Notes

**Update contact details:** Edit `src/app/contact/page.tsx` directly, or refactor to read from a `contacts` table in Supabase (recommended once you want to manage it without a code change).

**Add real brand colours:** Update hex values in `tailwind.config.ts`.

**Add sponsor logos:** Upload to Cloudinary, then add the public IDs to the `sponsors` array in `src/app/page.tsx`.

**Add your logo:** Place `logo.png` in `/public/` and uncomment the `<Image>` tag in `src/app/page.tsx`.

**Email notifications for payment requests:** The `requestPayment` action currently logs to console. Integrate [Resend](https://resend.com) (free tier: 3k emails/month) by adding `npm install resend` and replacing the `console.log` in `src/app/actions/payment.ts` with a `resend.emails.send()` call.

**Stripe (Phase 2):** Once the club is formally registered, add Stripe for automated payment confirmation. Start a new brainstorm cycle — no webhook setup required for MVP.

**Phase 2 triggers:** The spec lists schedule, announcements, messaging, and parent uploads as Phase 2. Start each as a new brainstorm → spec → plan cycle.
