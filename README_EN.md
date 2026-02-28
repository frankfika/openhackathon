<div align="center">

# OpenHackathon
> Open Source Hackathon Management Platform · 开源黑客松管理平台

![OpenHackathon Home](./docs/assets/home.png)

![Version](https://img.shields.io/badge/Version-1.1.0-blue?style=flat-square)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20PostgreSQL-1f6feb?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

[Capabilities](#-capabilities) • [Screenshots](#-screenshots) • [Quick Start](#-quick-start) • [Deployment](#-deployment) • [Release](#-release)

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

## 🖼️ Screenshots
| Home | Projects | Leaderboard |
|---|---|---|
| ![Home](./docs/assets/home.png) | ![Projects](./docs/assets/projects.png) | ![Leaderboard](./docs/assets/leaderboard.png) |

| Judging | Settings | Promotions |
|---|---|---|
| ![Judging](./docs/assets/judging.png) | ![Settings](./docs/assets/settings.png) | ![Promotions](./docs/assets/promotions.png) |

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
