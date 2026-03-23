<div align="center">

# OpenHackathon
> Open Source Hackathon Management Platform · 开源黑客松管理平台

![OpenHackathon Home](./docs/assets/home.png)

![Version](https://img.shields.io/badge/Version-1.1.0-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

[Capabilities](#-capabilities) • [Screenshots](#-screenshots) • [UX Baseline](#-ux-baseline) • [Quick Start](#-quick-start) • [Deployment](#-deployment) • [Release](#-release)

[简体中文](./README.md) | __English__

---
</div>

## 📖 Introduction
OpenHackathon is an end-to-end platform for hackathon organizers, judges, and participants:
- Organizers manage events, rounds, scoring criteria, assignments, promotions, and leaderboards.
- Judges review assigned projects, submit scores, and leave feedback in one workspace.
- Participants submit projects publicly and track results on the leaderboard.

## ✨ Capabilities
### 1. Event and Round Management
- Supports multiple hackathons and multi-round workflows (preliminary / semifinal / final).
- Configurable scoring criteria, submission schema, and event statuses.

![Dashboard](./docs/assets/dashboard.png)

### 2. Branding and SEO White-Label
- Editable site name, logo, tab title, SEO title/description, and favicon in admin settings.
- Default brand is `OpenHackathon`, with runtime customization support.

![Settings](./docs/assets/settings.png)

### 3. Judging and Scoring Workflow
- Assignment management, score submission, comments, and status transitions.
- Reports aggregate progress and scores by project and by judge.

![Features](./docs/assets/features.png)

### 4. Promotion and Multi-Round Evaluation
- Promotion decisions: `advanced` / `eliminated` / `pending`.
- Promoted projects can flow into next-round assignments automatically.

![Promotions](./docs/assets/promotions.png)

### 4.1 Admin Review Operations Architecture (v2)
- Admin review operations are fully split into dedicated pages: `${adminBasePath}/reviews`, `${adminBasePath}/assignments`, `${adminBasePath}/promotions`, `${adminBasePath}/reports`, `${adminBasePath}/judges` (default `adminBasePath=/admin`).
- `adminBasePath` is configurable in Site Settings. It controls the admin entry path only and does not change judging business rules.
- Judge identity is global, but eligibility is hackathon-scoped. Only judges registered to the current hackathon can be assigned or auto-carried to next-round assignments.
- Admin sidebar now includes a dedicated `Hackathons` entry and shows explicit current hackathon name + date range, with a direct switch action to avoid ambiguous "current hackathon" context.
- Preliminary / semi-final / final and region are consistently modeled as session dimensions, with shared `sessionId` URL context across review pages.
- A project can be reviewed by multiple judges (uniqueness only prevents duplicate assignment of the same judge to the same project in the same session).
- Session timelines are strongly validated in both UI and API: start date cannot be after end date, and downstream rounds cannot start earlier than upstream rounds.
- Promotions prefer region-matched downstream routing by default (for both preliminary and semi-final flows), while still allowing per-project override.
- Promotions do not auto-select all judges; reviewer selection is required only when there are `advanced` decisions, preventing accidental mass assignment.
- Promotions now include keyword/decision/region filters, filtered-batch decision actions, and "auto fill next round", and block apply when advanced items miss a next-round target.
- Final sessions are excluded from promotion-operation scope in UI, avoiding invalid "advance after final" paths.
- Full product rules are documented in [Admin Review Architecture v2](./docs/admin-review-architecture.md).

### 5. Unified Event Details Entry (No Rules/Docs Duplication)
- Public navigation now uses one `Event Details` entry instead of separate duplicated `Rules` and `Docs`.
- Source fallback priority: `gitbookUrl` → `rulesUrl` → `detailsUrl`.
- Admin hackathon settings support all three links for incremental content rollout.

### 6. Public Submission Receipt and Email Notification
- `/submit` now requires only contact email; backend generates a receipt ID automatically (for example `SUB-20260228-ABC123`).
- Backend can send receipt emails via SMTP and persists delivery status (`emailSent`, failure reason, last attempt timestamp).
- Admin can manually resend a receipt via `POST /api/projects/:id/receipt/resend`.

## 📧 Submission Receipt Email Setup
Configure these variables in `.env` (full template in `.env.example`):

```bash
SUBMISSION_RECEIPT_PREFIX=SUB
SUBMISSION_EMAIL_ENABLED=true
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SUBMISSION_RECEIPT_FROM="OpenHackathon <no-reply@example.com>"
SUBMISSION_RECEIPT_REPLY_TO=ops@example.com
SUBMISSION_RECEIPT_SUBJECT="[{{hackathonTitle}}] Submission Receipt {{receiptId}}"
SUBMISSION_EMAIL_TIMEOUT_MS=10000
```

Notes:
- When `SUBMISSION_EMAIL_ENABLED=false`, receipt IDs are still generated and persisted, while email sending is skipped (`emailFailureReason=disabled`).
- `SUBMISSION_RECEIPT_SUBJECT` supports `{{hackathonTitle}}`, `{{receiptId}}`, and `{{projectTitle}}`.
- If SMTP is temporarily unavailable, use the resend endpoint to re-deliver receipt emails.

## 🖼️ Screenshots
| Home | Projects | Leaderboard |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Projects](./docs/assets/projects.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

| Judging | Settings | Promotions |
|---|---|---|
| ![Judging](./docs/assets/judging.png) | ![Settings](./docs/assets/settings.png) | ![Promotions](./docs/assets/promotions.png) |

## 🎨 UX Baseline
- Homepage visual structure is aligned with `docs/assets/home.png` as the reference baseline.
- Admin and judge workspaces share one premium glass-style component system (buttons, cards, inputs, tables, dialogs, tabs).
- Key management pages (projects, reports, promotions, settings) follow the same hierarchy: overview section + panel section + table section.

## 🚀 Quick Start
### Requirements
- Node.js 20+ (recommended)
- Docker + Docker Compose

### One-Command Dev Startup
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install
npm run dev:up
```

This command now handles the full local dev bootstrap:
- Loads `.env`, or falls back to `.env.example` if `.env` is missing
- Starts PostgreSQL with `docker compose`
- Waits for the database to become ready and runs `npx prisma db push`
- Does not create default admin accounts; first-run admin creation is handled by Setup Wizard
- Launches the existing frontend and API dev processes via `npm run dev`

Common commands:
```bash
# Initialize demo data (this wipes current data before reseeding)
npm run dev:up:seed

# Ensure built-in development accounts only (without full seed)
./dev-stack.sh up --dev-users

# Stop the Docker database container
npm run dev:down
```

### Local Development
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install

# Manual mode: use this if you manage PostgreSQL yourself
npx prisma db push
npm run db:seed

# Reset to initial state (no default admin, Setup Wizard will create first admin)
npm run db:reset

# Reset and reseed demo data (includes default admin accounts)
npm run db:reset:seed

# Start frontend + backend
npm run dev
```

Default seed accounts:
- Admin: `admin@openhackathon.com` / `password`
- Backup admin: `ops@openhackathon.com` / `password`
- Judge: `alice@techgiants.com` / `password`
- Empty judge account: `judge1@openhackathon.com` / `password`
- Empty judge account: `judge2@openhackathon.com` / `password`
- Empty judge account: `judge3@openhackathon.com` / `password`

### 🌱 Seed Data Guide
The full demo seed (`npm run dev:up:seed` / `npm run db:seed`) creates:
- `10` built-in accounts
- `7` hackathons
- `32` projects
- `44` review assignments

Diversity:
- Covers `active`, `upcoming`, `draft`, `judging`, and `completed` event states.
- Includes AI, FinTech, Climate, Web3, EdTech, Health, and CyberSecurity themes.
- Mixes single-round and multi-round setups, completed/in-progress/pending reviews, and submissions with repo links, demo links, or text-heavy payloads.
- Intentionally includes both data-rich hackathons and almost-empty hackathons so empty states, reports, filters, and onboarding flows can all be tested.

Suggested usage:
- Full admin workspace: `admin@openhackathon.com`
- Full judge workspace: `alice@techgiants.com`, `bob@venturecap.com`, `charlie@designstudio.io`, `diana@aifund.com`, `evan@dev.tools`
- Empty judge states: `judge1@openhackathon.com`, `judge2@openhackathon.com`, `judge3@openhackathon.com`
- Clean admin identity: `ops@openhackathon.com`
- Setup Wizard testing: the wizard is driven by hackathon configuration, not by whether the account is empty. Use any admin account, then either create a new hackathon or switch to a sparse event such as `Green Earth Hackathon` or `EdTech Remote Jam`, which only have `0-1` round configured.

### 🧪 Scenario Matrix
| Scenario | Recommended account | Recommended hackathon | Why |
|---|---|---|---|
| Full admin dashboard | `admin@openhackathon.com` | `Global AI Challenge 2026` | This is the default `active` event and has the richest mix of projects, assignments, scores, and reports. |
| Judge workspace with active tasks | `alice@techgiants.com` | `Global AI Challenge 2026` | Includes `completed`, `in_progress`, and `pending` assignments in one place. |
| Judge empty state | `judge1@openhackathon.com` | Any | This account has no assignments, so it is ideal for empty-list and empty-panel validation. |
| Completed-event and historical data | `admin@openhackathon.com` | `Web3 World Championship` | Best for validating completed-event behavior and finished review data. |
| In-progress judging views | `admin@openhackathon.com` | `EdTech Remote Jam` or `CyberSec Challenge 2026` | Both include live review activity and mixed judging progress. |
| Fresh admin onboarding | `ops@openhackathon.com` | A newly created hackathon | Best way to validate first-run admin flows and sparse states. |
| Setup Wizard prompt | `ops@openhackathon.com` | A newly created hackathon or `Green Earth Hackathon` | `Green Earth Hackathon` has only `1` session, which matches the wizard suggestion rule. |
| Single-session configuration | `admin@openhackathon.com` | `EdTech Remote Jam` | Useful for testing wizard behavior when a hackathon already has one round configured. |
| Multi-round configuration | `admin@openhackathon.com` | `Global AI Challenge 2026` / `CyberSec Challenge 2026` | Good coverage for two-round structures, scoring setup, and populated workflows. |
| No-project / no-assignment state | `ops@openhackathon.com` | `FinTech Asia Summit` / `Health Innovation Summit` | These have baseline event configuration but no projects or assignments, which is useful for empty-state validation. |

Notes:
- `npm run dev:up:seed` and `npm run db:seed` both delete current application data before reseeding demo content.
- `npm run dev:up` does not auto-create built-in accounts. Use `./dev-stack.sh up --dev-users` if needed.
- `Ctrl+C` stops the frontend and API processes; use `npm run dev:down` to stop the Docker database container.
- If port `3001` or `5173` is already in use, the script fails fast and prints the process holding that port.

### Testing
```bash
npm run test:unit
npm run test:api
npm run test:e2e
```

## 🏗️ Deployment
### Docker Compose
```bash
docker compose up -d --build
```

Keep this flow if you want web, API, and database all inside containers; for normal local development, prefer `npm run dev:up`.

Default ports:
- Web: `5173`
- API: `3001`
- PostgreSQL: `5432`
- Adminer: `8080`

## 🧰 Screenshot Script
README screenshots are captured from a real running app (not mocked):
```bash
BASE_URL=http://localhost:5173 node scripts/capture-screenshots.mjs
```

## 📦 Release
- Releases: https://github.com/frankfika/openhackathon/releases
- Use semantic version tags (`vX.Y.Z`) with release notes.

## 📄 License
MIT
