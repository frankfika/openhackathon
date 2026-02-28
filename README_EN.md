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
- PostgreSQL 15+

### Local Development
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install

# Initialize database
npx prisma db push
npm run db:seed

# Start frontend + backend
npm run dev
```

Default seed accounts:
- Admin: `admin@openhackathon.com` / `password`
- Judge: `alice@techgiants.com` / `password`

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
