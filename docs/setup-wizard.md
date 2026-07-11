# Setup & Dev Onboarding

> Why this doc exists: the project intentionally has no `prisma/seed.ts`.
> If you're a new contributor wondering "where are the default accounts?",
> **start here**.

## 1. Current baseline (do not assume "fresh install")

The dev database (PostgreSQL on `localhost:5432`, db `openhackathon`) **already
contains live demo data** from a previous run:

- **10 users**: 2 admins + 8 judges (see "Existing dev accounts" below)
- **1 hackathon**: `hk-openhack-2026` — "OpenHackathon 2026", status `active`
- **5 projects**, **5 assignments** (3 pending, 2 completed)
- **2 scoring criteria** + **5 AI assessments** + activity log entries

**Do not** blow this away with `prisma migrate reset` unless you have a plan
to re-seed (you don't — see §3). Verify the state with:

```bash
# Quick sanity check
curl -s http://localhost:3001/api/health
# -> {"status":"ok","database":"up",...}

# Or open Prisma Studio (recommended for inspection)
npx prisma studio
# Browse to http://localhost:5555
```

### Existing dev accounts (passwords are not listed here on purpose)

| Role | Email | Login path |
|---|---|---|
| Admin | `admin@openhackathon.com` | `/admin/login` |
| Admin | `ops@openhackathon.com` | `/admin/login` |
| Judge | `judge1@openhackathon.com` | `/judge/login` |
| Judge | `judge2@openhackathon.com` | `/judge/login` |
| Judge | `judge3@openhackathon.com` | `/judge/login` |
| Judge | `alice@techgiants.com` | `/judge/login` |
| Judge | `bob@venturecap.com` | `/judge/login` |
| Judge | `charlie@designstudio.io` | `/judge/login` |
| Judge | `diana@aifund.com` | `/judge/login` |
| Judge | `evan@dev.tools` | `/judge/login` |

Passwords are shared in 1Password / the team channel, **not** in the repo.
All 10 accounts use the same dev password (rotated periodically).

## 2. First-time local setup

```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install
cp .env.example .env        # edit if you need SMTP/AI keys; defaults work for local
docker compose up -d db     # or use a local Postgres on :5432
npx prisma migrate deploy   # apply all 13 migrations
npm run db:seed:dev         # intentional no-op (see §3) — prints a pointer here
npm run dev                 # API on :3001, Vite on :5173
```

Open <http://localhost:5173>. The landing page checks
`GET /api/setup/status`; if any admin exists it loads `Landing` directly,
otherwise it redirects to `/setup` (the Setup Wizard).

**Verify the stack with the existing dev accounts before touching anything.**

### When ports collide (common on Frank's machine)

- `5173` is sometimes held by another `vite` (e.g. `book-author-workbench`).
  Vite auto-bumps; check the actual port in `npm run dev` output.
- `3001` (API) — if taken, edit `PORT=` in `.env` and restart.
- `5432` (Postgres) — if a Homebrew Postgres is already listening, the
  `dev-stack.sh` flow will reuse it (no Docker daemon required).

## 3. Why there is no `prisma/seed.ts`

This is the most-asked question by new contributors. The short answer:

> **`prisma/seed.ts`, `prisma/ensure-dev-users.ts`, and `prisma/dev-users.ts`
> were intentionally removed in commit `35dd59e` (2026-06-20, by
> `frankfika`). The dev DB has carried the same dataset since.**

The longer rationale:

1. **Hygiene.** `prisma/dev-users.ts` contained 64 lines of hardcoded
   passwords (one per dev account). Putting plaintext credentials in a public
   repo, even with a "dev-only" comment, is a code-smell we'd rather not
   re-introduce.
2. **Drift.** Seed scripts and the Setup Wizard (`api/routes/setup.ts` +
   `src/pages/SetupPage.tsx`) drift over time. A second canonical path to
   "create a user" doubles the surface area for auth bugs.
3. **Demo continuity.** The hackathon is shown live to investors. A reset
   that drops demo data is worse than a reset that doesn't exist. The Setup
   Wizard is the *only* supported path, by design.

If you need to reset the DB: **don't**. If you absolutely must, do it via
the API (see §4), not via `prisma migrate reset`.

## 4. Adding a new dev user (no seed script needed)

Two options, both first-class:

### Option A: Use the API as admin (recommended)

```bash
# 1. Login as an existing admin, capture the token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@openhackathon.com","password":"<dev-password>"}' \
  | jq -r .token)

# 2. Create the new judge
curl -X POST http://localhost:3001/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"newjudge@example.com","name":"New Judge","password":"<their-password>","role":"judge"}'

# 3. Register the new judge for the current hackathon via the UI
#    (Admin > Hackathon Settings > Judges), or via:
curl -X POST http://localhost:3001/api/hackathon/judges \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"judgeIds":["<new-user-id>"]}'
```

### Option B: Use Prisma Studio (visual)

```bash
npx prisma studio
# Open http://localhost:5555
# 1. Add a row to `User` (role = "judge", password = bcrypt-hashed, see
#    `api/routes/users.ts` for the hashing pattern)
# 2. Add a row to `HackathonJudge` linking the user to the current hackathon
```

Prisma Studio is great for one-off inspection; the API is better for
repeatable setup. Pick whichever fits the moment.

## 5. Production seeding: out of scope (for now)

Production seeding — i.e. "give a new customer a working OpenHackathon
instance on first boot" — is intentionally not solved by this document.
It is tracked as a separate workstream (the **Hub / License / Onboarding**
flow in `docs/planning/`). Until that ships, **every fresh install is
expected to go through the Setup Wizard at `/setup`**.

If you're hitting this in production: see `api/routes/setup.ts` and
`src/pages/SetupPage.tsx` — they are the canonical entry points. Do not
re-introduce `prisma/seed.ts` without a security review of the password
storage path.
