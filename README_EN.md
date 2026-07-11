<div align="center">

# OpenHackathon
> Open Source Hackathon Management Platform · 开源黑客松全流程管理平台

![OpenHackathon Home](./docs/assets/home.png)

### From hackathon creation to leaderboard publishing — all in one place

![Version](https://img.shields.io/badge/Version-2.2-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-154%20passed-2ea44f?style=flat-square)
![i18n](https://img.shields.io/badge/i18n-English%20%7C%20中文-9cf?style=flat-square)

[Features](#-features) • [Screenshots](#-screenshots) • [Architecture](#-architecture) • [Quick Start](#-quick-start) • [Deployment](#-deployment)

[简体中文](./README.md) | __English__

---
</div>

## 📖 Introduction

OpenHackathon is an end-to-end management platform for hackathon organizers, judges, and participants, covering the complete workflow from event creation, project submission, review assignment, scoring, and leaderboard publishing.

The platform provides three independent entry points:
- **Participants** (public access): browse the event homepage, submit projects, and view leaderboards
- **Admins** (`/admin/login`): manage hackathon settings, projects, judges, assignments, leaderboards, and site settings
- **Judges** (`/judge/login`): view assigned review tasks, submit scores, and leave feedback

The entire site supports **real-time Chinese/English switching**, **light/dark/system theme switching**, **font size and font family adjustments**, and **Web3 wallet login with cross-hackathon points**.

---

## ✨ Features

### 1. Public Event Pages
Participants can browse the current hackathon without logging in:
- Event title, tagline, and status badge (Draft / Upcoming / Active / Judging / Completed)
- City, date range, and prize pool
- Countdown timer and submission CTA
- Responsive light/dark theme support

![Home](./docs/assets/home.png)

### 2. Project Submission & Receipts
- Submission form fields are fully configurable by organizers in the admin panel
- Built-in fields: project name (required), email (required), name (optional)
- Automatic receipt ID generation (e.g. `SUB-20260228-ABC123`)
- SMTP support for sending confirmation emails automatically

![Submit](./docs/assets/submit.png)

### 3. Admin Dashboard
After login, admins enter the dashboard with a sidebar grouped by domain:
- **Hackathon**: Projects / Assignments / Leaderboard
- **Judges**: Judge Management
- **Settings**: Hackathon Settings / Activity Log / Site Settings / AI Features

![Dashboard](./docs/assets/dashboard.png)

### 4. Review Assignment & Scoring
- Random or manual judge-to-project assignment
- Real-time statistics: Total Projects, Average Score, Completion Rate, Judges
- List view and matrix view
- Scoring criteria are customizable by admins, with the total required to equal exactly 100 points

![Assignments](./docs/assets/assignments.png)

### 5. AI Enhancement System (v2.1)
AI-powered capabilities for every role:
- 🤖 **Project Quality Assessment**: AI automatically analyzes projects and generates a 0-100 score with detailed reports
- 🎯 **Judge Assistant**: provides AI suggestions, project summaries, key technical points, and scoring references during review
- 📊 **Scoring Consistency Analysis**: monitors judge score deviations in real time and identifies overly strict or lenient judges
- 🛡️ **Content Moderation**: automatically detects sensitive content and spam
- ✍️ **Smart Content Generation**: one-click README generation, project description optimization, and event marketing copy
- 🔍 **Plagiarism Detection**: intelligently identifies similar projects

Supports multiple AI providers: Claude (Anthropic), OpenAI, DeepSeek, and local Ollama.

![AI Features](./docs/assets/ai-features.png)

### 6. Web3 Multi-Chain Identity & Points
- 🔗 **Wallet Login**: RainbowKit + wagmi-based EVM wallet login via SIWE
- 🏆 **Cross-Hackathon Points**: Web3 users carry global points, participation count, judging count, and award count across events
- 🌐 **Global Leaderboard**: `Global Leaderboard` shows platform-wide user rankings
- 👤 **User Profile Page**: displays wallet address, point history, and participation records
- ⛓️ **Optional On-Chain Attestations**: admins can write key data on-chain as verifiable attestations (optional)

![Global Leaderboard](./docs/assets/leaderboard.png)

### 7. Appearance & Accessibility
- 🌙 Light / Dark / System theme modes
- 🔤 Font size: Small / Normal / Large
- 🖋️ Font family: Geist / System UI
- ♿ Semantic colors, high contrast, and keyboard accessibility

![Site Settings](./docs/assets/site-settings.png)

### 8. White-Label Branding & Site Settings
- Custom site name, logo, favicon, and browser tab title
- SEO title and description
- Footer "Powered By" text and link
- Custom admin entry path (`adminBasePath`)

---

## 🖼️ Screenshots

| Home | Submit | Public Leaderboard |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Submit](./docs/assets/submit.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

| Admin Login | Judge Login | Admin Dashboard |
|---|---|---|
| ![Admin Login](./docs/assets/login.png) | ![Judge Login](./docs/assets/judge-login.png) | ![Dashboard](./docs/assets/dashboard.png) |

| Projects | Assignments | Judges |
|---|---|---|
| ![Projects](./docs/assets/projects.png) | ![Assignments](./docs/assets/assignments.png) | ![Judges](./docs/assets/judges.png) |

| Hackathon Settings | Submission Form | Scoring Criteria |
|---|---|---|
| ![Settings](./docs/assets/settings.png) | ![Submission Form](./docs/assets/submission-form.png) | ![Scoring](./docs/assets/scoring.png) |

| Leaderboard Admin | Activity Log | Site Settings |
|---|---|---|
| ![Leaderboard Admin](./docs/assets/leaderboard-admin.png) | ![Activity](./docs/assets/activity.png) | ![Site Settings](./docs/assets/site-settings.png) |

| AI Features Center | Judge Workspace |
|---|---|
| ![AI Features](./docs/assets/ai-features.png) | ![Judging](./docs/assets/judging.png) |

---

## 🏛️ Architecture

### Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + TailwindCSS + shadcn/ui + React Query + react-i18next |
| Backend | Express.js + Prisma ORM + PostgreSQL |
| Web3 | wagmi + RainbowKit + viem + Solana Wallet Adapter |
| Testing | Vitest (unit + API) + Playwright (E2E) |
| Deployment | GitHub Actions → PM2 + Nginx |

### Backend Modular Architecture
```
api/
├── server.ts          # Express application entry
├── config.ts          # Environment variables and constants
├── middleware.ts      # JWT auth, role checks, rate limiting
├── routes/            # Route modules
│   ├── auth.ts        # Login/register (separate admin + judge flows)
│   ├── hackathons.ts  # Hackathon CRUD
│   ├── projects.ts    # Project submission, editing, deletion
│   ├── assignments.ts # Review assignment
│   ├── scores.ts      # Score submission
│   ├── judges.ts      # Judge management
│   ├── ai.ts          # AI feature APIs
│   ├── web3-auth.ts   # Web3 wallet login
│   ├── identity.ts    # Cross-hackathon identity and points
│   ├── leaderboard.ts # Leaderboard management
│   ├── site-settings.ts # Site settings
│   └── ...
└── services/          # Business services
    ├── ai.ts          # AI service
    ├── identity.ts    # Web3 identity service
    ├── points.ts      # Points service
    └── onchain.ts     # On-chain interactions
```

### Security
| Mechanism | Description |
|---|---|
| JWT Authentication | Separate admin / judge tokens with issuer/audience validation |
| Input Validation | Whitelist validation + length limits + SQL/XSS keyword filtering |
| Rate Limiting | Global 1200/15min + login 20/15min + submission 30/10min |
| CORS | Comma-separated domain whitelist support |
| File Uploads | Type/size whitelist + safe filename filtering |

---

## 🚀 Quick Start

### Requirements
- Node.js 20+
- Docker + Docker Compose

### One-Command Dev Startup
```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
npm install
npm run dev:up
```

This automatically starts PostgreSQL, waits for the database, syncs the Prisma schema, and launches the frontend and backend dev servers.

The first visit will enter the **Setup Wizard** (`/setup`) to create the initial admin account and hackathon.

### Common Commands
```bash
npm run dev:up         # Start dev stack (without seed data)
npm run dev:up:seed    # Start dev stack + seed demo data
npm run dev:down       # Stop database containers
npm run db:reset:seed  # Reset + seed demo data
npm run dev            # Start frontend + backend only (manage DB yourself)
```

### Default Accounts (seed data)
| Role | Email | Password |
|---|---|---|
| Admin | `admin@openhackathon.com` | `password` |
| Judge | `alice@techgiants.com` | `password` |
| Judge | `bob@venturecap.com` | `password` |
| Judge | `charlie@designstudio.io` | `password` |
| Empty judge | `judge1@openhackathon.com` | `password` |

---

## 🧪 Testing

```bash
npm run test:unit      # Unit tests (Vitest)
npm run test:api       # API integration tests
npm run test:storybook # Storybook component tests
npm run test:e2e       # E2E tests (Playwright)
npm run lint           # ESLint
npx tsc --noEmit       # TypeScript type check
```

---

## 🏗️ Deployment

### Live Demo
> **Demo: http://49.234.25.35**

### One-Click Deploy (Ubuntu)
```bash
curl -fsSL https://raw.githubusercontent.com/frankfika/openhackathon/main/scripts/deploy-server.sh | bash
```

### CI/CD Auto Deploy
Pushing to `main` triggers GitHub Actions deployment:
```bash
git push origin main
```

### Docker Compose
```bash
docker compose up -d --build
```

Default ports:
| Service | Port |
|---|---|
| Web | `5173` |
| API | `3001` |
| PostgreSQL | `5432` |
| Adminer | `8080` |

---

## 📸 Screenshot Script

All README screenshots are captured from a real running app:
```bash
npm run dev
node scripts/capture-screenshots.mjs
```

---

## 📝 Changelog

### v2.2 (2026-07)
- 🔒 **Security hardening**: closed 8 password-hash leaks. The public `GET /api/projects/:id` endpoint and 7 admin/judge endpoints previously used Prisma's `include: { judge: true }` / `user: true` which returned the full `User` row, including the bcrypt `password` hash. All of them now use an explicit `select` whitelist (`id, email, name, role, avatarUrl, createdAt`). `auth.ts` and `web3-auth.ts` still use `sanitizeUser` as a second-line defense.
- 🛣️ **Admin route completion**: `/admin/activity` (ActivityLog) and `/admin/account` (Account) had their route shells declared but the `lazy()` imports were never wired in — both now render correctly.
- 🩹 **Status display sync**: the public header status chip and hero badge now both flip to `Completed` once `endAt` is in the past (previously kept showing `ACTIVE` until the admin manually flipped the status field).
- 🩹 **JudgingDetail form init**: the scoring page now waits for both `assignment` and `hackathon` (with `scoringCriteria`) before mounting, so the form never paints with an empty `ScoreDraft` and the score inputs look populated after navigation.
- 🩹 **Judge logout button**: added `type="button"` so it isn't accidentally interpreted as a form submit by any wrapping form.
- 🛠️ **Refactor**: `JudgingDetail` moved initial score backfill from `useEffect` to `useState` lazy initializer, and the effect now only syncs on `assignment?.id` change — eliminates the empty-then-fill flash on first mount.

### v2.1 (2026-06)
- ✨ AI enhancement system: project quality assessment, judge assistant, scoring consistency analysis, content moderation, smart generation, plagiarism detection
- 🔗 Web3 multi-chain identity: wallet login, cross-hackathon points, global leaderboard, optional on-chain attestations
- 🎨 Appearance settings: theme switching, font size / font family adjustments
- 🐛 Fixed dark mode and fixed header overlap issues

### v2.0 (2026-03)
- 🏆 Complete hackathon management workflow
- 🌐 Chinese/English i18n and light/dark themes
- 📊 Review assignment, scoring, and leaderboard management
- 🛡️ JWT auth, rate limiting, and activity logs

---

## 📦 Releases
- Releases: https://github.com/frankfika/openhackathon/releases

## 📄 License
MIT
