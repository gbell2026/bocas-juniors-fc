# Handover — Tangerine Toucans FC website

Written 2026-10-12 to move this project from the VS Code extension into the Claude Code CLI. This file loads automatically at the start of every Claude Code session in this repo — read it before doing anything else.

## Project

- Youth football club site, originally built as "Bocas Juniors FC" and later rebranded to **Tangerine Toucans FC**. The repo directory is still named `bocas-juniors-fc` — that's just a leftover, not worth renaming.
- Stack: Next.js 14 (App Router) + TypeScript + Tailwind, Supabase (Postgres/PostgREST, RLS "deny-all, service-role only" on admin tables), Cloudinary for images, Resend for email.
- GitHub: `github.com/gbell2026/bocas-juniors-fc.git`, branch `main`. Commits go straight to `main` — no PR workflow in use.
- The club also runs/hosts a separate youth league, **"Liga Isleñitos de Bocas"**, with its own brand identity (navy/turquoise/gold/pink — see below) distinct from the club's own tangerine/cream brand. Keep the two separate: club pages (home, roster, announcements, gallery) stay orange/cream; league-facing pages/components use the `league.*` palette.

## Environment gotchas

### GitHub push 403
Has recurred more than once: `gh` has multiple authenticated accounts on this machine and the wrong one can be active. If `git push` gets a 403 for `gbell2026/bocas-juniors-fc.git`:
```bash
gh auth switch --hostname github.com --user gbell2026
gh auth setup-git
git push
```

### Supabase
- Project ref `eczbchgybcjnthqjbeis`. CLI is linked and logged in already.
- Migrations in `supabase/migrations/`, numbered sequentially (up to 024 as of this handover). `supabase migration list` / `supabase db push` / `supabase migration repair <N> --status applied|reverted --linked`.
- **Always verify a migration "repair" against the real live schema** with an explicit test write before trusting it — a wrongly-repaired migration history once caused a real production bug (an admin "Save All" silently failing on every row because a column everyone assumed existed, didn't).
- For one-off production data fixes or investigations that aren't a schema change, the established pattern in this project: write a `.mjs` script using `@supabase/supabase-js`, manually parse `.env.local` for `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (no dotenv needed), copy it into the **repo root** as a dotfile (e.g. `.fix-something.mjs` — has to be in repo root so `node_modules` resolves), run with `node .fix-something.mjs`, then `rm -f` it immediately. Never leave these committed or lying around.

## Architecture patterns worth knowing

### Admin dashboard: never reload-and-lose-edits
Every admin mutation updates local React state in place — never `window.location.reload()` or a blanket refetch after a save. This was a deliberate fix for a major UX complaint (editing several fixtures, saving one, losing the others). `src/components/admin/league-fixtures-admin.tsx` is the reference implementation: per-row draft/dirty-tracking, one "Save All Changes (N)" bulk button (no per-row Save), a `beforeunload` warning while anything is dirty, and a `bulkUpdateFixtures` server action that applies each row independently so one bad row doesn't block the rest of the batch.

### League standings & points adjustments
- `computeStandings` (`src/lib/league/standings.ts`) is a pure function: 3/1/0 points, plus an `adjustments: {teamId, points}[]` param folded into a separate `adjustmentPoints` field.
- **Important quirk**: it only skips a fixture for points purposes when `home_score`/`away_score` is `null` — it does **not** check `cancelled`. A cancelled fixture that still carries a score counts fully toward points/standings. Don't assume "cancelled" means "voided."
- `league_points_adjustments` table holds admin-entered disciplinary adjustments, shown on the public standings table as colored footnote markers below the table (never a hover tooltip — explicitly requested, since hover doesn't work on touch devices). **Zero-point adjustments are allowed and intentional** — they exist purely to carry an explanatory footnote when the real penalty is already baked into the fixture's scoreline, with nothing further to deduct.
- The "other team wins 3-0 by default" rule: when a result is voided (e.g. a team fielded an ineligible player), the opponent gets a straight 3-0 scoreline (overwriting the real one) — that's the whole penalty; don't also add a separate points deduction on top unless explicitly told to. **Get explicit confirmation on exactly which fixture this applies to before touching any score** — misapplying this to the wrong match has been a real, repeated mistake on this project. Always ask before changing a score or deleting a fixture row.

### Round-robin fixture generation
- `src/lib/league/round-robin.ts` — `generateRoundRobin(teamIds, startDate, endDate)` produces a double round-robin (every pair plays twice, home and away once each), one round per week on Sundays, validated at generation time to fit before `endDate`.
- Each `league_divisions` row has its own independent `season_start_date`/`season_end_date`.
- There's no "replay"/"postponed"/"walkover" scaffolding in the schema — `cancelled` is just a display flag. A makeup fixture for a cancelled match has to be added manually as a brand-new `league_fixtures` row. That means a replayed pair will show **3** rows total (the original cancelled one stays in place as the historical record) — expected and fine, not a bug, if you ever audit pair-counts expecting exactly 2.
- `divisionPillClass` (`src/lib/league/fixture-calendar.ts`) is the single shared source for the U10/U14 colored pills, used by both the `/league` page and the homepage's "League Schedule" card. The `league.*` Tailwind palette (navy/panel/turquoise/gold/pink/muted) lives in `tailwind.config.ts` — that's the one place to change a league color.

## Open item — needs a decision before touching it

**U14 Real Barriada FC vs Loma Espina — not a duplicate.** The pair has 3 fixture rows: 11 Sep and 13 Sep (both Loma Espina at home, both 1–3) and 1 Nov. The handover originally assumed 11/13 Sep was one match entered twice; **the user confirmed (2026-10-31) these were two real games played two days apart.** Both results are genuine and correctly counted in the standings — do not delete or clear either. Still open: a double round-robin should have only 2 meetings, so the 1 Nov fixture would be a third. Ask the user whether 1 Nov should stand, before touching it. Also unconfirmed: whether one of the September games should actually be recorded with Real Barriada FC at home (doesn't affect points).

## Verification

- `npx jest` — full suite, 399 tests, all passing as of this handover.
- `npx tsc --noEmit` — clean except 3 known pre-existing failures in `gallery-client.test.tsx` / `masonry-grid.test.tsx` (missing `submitter_name` in test fixtures) — unrelated to recent work, safe to ignore unless asked to fix them specifically.
- `npm run build` — production build check.

## Where things are

- `src/app/actions/league.ts` / `league-admin.ts` — league server actions (standings, fixtures, divisions, points adjustments).
- `src/lib/league/` — pure league logic (`standings.ts`, `round-robin.ts`, `fixture-calendar.ts`, `align-team-order.ts`), all unit-tested.
- `src/components/league/` — public league UI (fixture calendar, standings table, register-team form).
- `src/components/admin/league-*` — admin league UI.
- `src/components/flyer/kickoff-flyer.tsx` — match-day flyer; uses its own hardcoded league hex colors, not yet migrated to the `league.*` Tailwind tokens (out of scope unless asked).
- `src/lib/i18n/en.ts` / `es.ts` — static UI translations. Admin-authored freeform text (announcement bodies, points-adjustment reasons) is deliberately **not** translated — matches existing precedent, already decided, don't relitigate without reason.
