# OpenHackathon

A white-label hackathon website platform. Deploy it and it becomes **your own hackathon official site**. Admins manage multiple hackathons in the backend and choose which one to display on the public-facing frontend. Visitors always see only the currently active hackathon.

## Features

- **White-label branding** — Organizer name, logo, and primary color are fully configurable via environment variables. No "OpenHackathon" branding on the public site (only a small "Powered by" badge).
- **Single-hackathon public frontend** — The landing page renders the active hackathon directly (event info, countdown, registration). No multi-event marketplace.
- **Multi-hackathon admin backend** — Admins can create, manage, and switch between multiple hackathons in the dashboard.
- **Role-based access** — Three roles: `admin`, `judge`, `user` (hacker). Each sees a tailored dashboard.
- **Project submission** — Dynamic form builder driven by per-hackathon `submissionSchema`. Duplicate project name detection.
- **Judging flow** — Assign projects to judges, score, AI-assisted code analysis panel.
- **Leaderboard** — Public and dashboard leaderboards scoped to the active hackathon.
- **Docs page** — Embeds external documentation (e.g. GitBook) via iframe.
- **i18n** — Internationalization via `react-i18next` (English + Chinese).
- **Dark mode** — Theme toggle included.
- **HTTPS dev server** — Auto-detects local mkcert certificates for HTTPS in development.

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.example .env

# Start dev server (frontend + backend)
pnpm dev
```

This starts both the Vite frontend (port 5173) and the Express API (port 3001) concurrently.

Open http://localhost:5173 (or https://localhost:5173 if mkcert certificates are present).

### HTTPS Setup (optional)

To enable HTTPS locally (required for embedding some external docs via iframe):

```bash
# Install mkcert
brew install mkcert
mkcert -install

# Generate certificates in the project root
mkcert localhost
```

The dev server auto-detects `localhost+1.pem` and `localhost+1-key.pem` and enables HTTPS.

## White-Label Configuration

All branding is controlled via environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_ORGANIZER_NAME` | `Acme Corp` | Organizer name shown in header and footer |
| `VITE_ORGANIZER_LOGO` | _(empty)_ | URL to logo image. If set, replaces the text name |
| `VITE_PRIMARY_COLOR` | `#4F46E5` | Primary brand color |
| `VITE_SHOW_POWERED_BY` | `true` | Show "Powered by OpenHackathon" badge. Set to `false` to hide |

After changing `.env`, restart the dev server for changes to take effect.

## Architecture

```
src/
├── lib/
│   ├── site-config.ts          # White-label config (reads VITE_* env vars)
│   ├── active-hackathon.tsx    # ActiveHackathon context & useActiveHackathon hook
│   ├── auth.tsx                # Auth context (role-based login)
│   ├── api.ts                  # Axios API client (backend communication)
│   └── mock-data.ts            # Mock data (hackathons, projects, users, etc.)
├── pages/
│   ├── Landing.tsx             # Public homepage (hero, countdown, CTA)
│   ├── Docs.tsx                # Documentation page (GitBook iframe embed)
│   ├── Projects.tsx            # Project gallery (scoped to active hackathon)
│   ├── Leaderboard.tsx         # Public leaderboard (scoped to active hackathon)
│   ├── SubmitProject.tsx       # Project submission form
│   ├── Dashboard.tsx           # Role-based dashboard router
│   ├── Hackathons.tsx          # Admin hackathon management list
│   ├── HackathonSettings.tsx   # Admin hackathon settings
│   └── JudgingDetail.tsx       # Judge scoring view
├── components/
│   ├── Layout.tsx              # Public layout (header nav + footer + outlet)
│   ├── DashboardLayout.tsx     # Dashboard sidebar (white-label, admin-only switcher)
│   ├── HackathonSwitcher.tsx   # Admin hackathon picker (updates active hackathon)
│   ├── PoweredByBadge.tsx      # "Powered by OpenHackathon" floating badge
│   └── dashboard/
│       ├── AdminDashboard.tsx  # Admin stats & management (scoped to active hackathon)
│       ├── HackerDashboard.tsx # Hacker view (single active hackathon + my projects)
│       └── JudgeDashboard.tsx  # Judge queue & AI copilot
├── App.tsx                     # Routes & providers
api/
└── server.ts                   # Express API server (Prisma ORM)
prisma/
└── schema.prisma               # Database schema
```

### How "Active Hackathon" Works

1. `ActiveHackathonProvider` wraps the entire app (in `App.tsx`).
2. On first load, defaults to the first hackathon with `status === 'active'`.
3. The selected hackathon ID is persisted in `localStorage`.
4. **Admins** switch the active hackathon via `HackathonSwitcher` in the dashboard sidebar.
5. **Public pages** (`/`, `/docs`, `/projects`, `/leaderboard`) always display data for the active hackathon.
6. **Dashboard pages** also scope their data to the active hackathon.

### Public Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Active hackathon homepage |
| `/docs` | Docs | Documentation (GitBook embed) |
| `/projects` | Projects | Project gallery for active hackathon |
| `/leaderboard` | Leaderboard | Rankings for active hackathon |
| `/login` | Login | Role-based login |
| `/register` | Register | Registration |

### Dashboard Routes (authenticated)

| Route | Page | Roles |
|-------|------|-------|
| `/dashboard` | Dashboard | all |
| `/dashboard/hackathons` | Hackathon list | admin |
| `/dashboard/hackathons/:id/settings` | Hackathon settings | admin |
| `/dashboard/projects` | Projects | all |
| `/dashboard/projects/submit` | Submit project | all |
| `/dashboard/judging` | Judging queue | admin, judge |
| `/dashboard/judging/:id` | Score a project | admin, judge |
| `/dashboard/leaderboard` | Leaderboard | all |
| `/dashboard/settings` | User settings | all |

### API Endpoints

The Express backend (`api/server.ts`) provides:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/hackathons` | List all hackathons |
| POST | `/api/hackathons` | Create a hackathon |
| PUT | `/api/hackathons/:id` | Update a hackathon |
| GET | `/api/projects` | List projects (optional `?hackathonId=` filter) |
| POST | `/api/projects` | Create a project |
| GET | `/api/assignments` | List judging assignments |

In development, the Vite dev server proxies `/api` requests to the backend (port 3001).

## Demo Accounts

The app uses mock authentication. On the login page, select a role to log in:

| Role | Name | What you see |
|------|------|-------------|
| Admin | Sarah Admin | Full dashboard with hackathon switcher, all management tools |
| Judge | Alice Chen | Judging queue, AI copilot, scoring interface |
| Hacker | Dave Builder | Current hackathon info, my projects, submit form |

## Deployment (Docker)

The project is fully containerized.

### Prerequisites
- Docker & Docker Compose
- Git

### Start

```bash
git clone https://github.com/frankfika/openhackathon.git
cd openhackathon
docker-compose up -d --build
```

Services:

| Service | Port | Description |
|---------|------|-------------|
| Web | 5173 | React frontend (Vite) |
| API | 3001 | Node.js/Express API |
| DB | 5432 | PostgreSQL |
| Adminer | 8080 | Database UI |

### Database Migration

```bash
docker-compose exec api sh
npx prisma migrate dev --name init
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- React Router
- react-i18next
- react-hook-form + Zod
- Framer Motion
- Express + Prisma (API + database)
- Docker Compose

## License

MIT
