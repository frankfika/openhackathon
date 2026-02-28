# Full-Spectrum Test Plan: OpenHackathon

## Project Overview

- **Stack**: React 18 + Express.js + PostgreSQL (Prisma ORM) + TypeScript
- **Frontend**: Vite, TanStack Query, Zustand, React Router, Radix UI, Tailwind CSS
- **Backend**: Express.js REST API on port 3001, Prisma ORM, bcryptjs
- **Database**: PostgreSQL 15 via Docker
- **Existing Tests**: 6 Playwright E2E test files (no unit/integration tests)
- **CI/CD**: None

---

## Phase 1: Install Testing Infrastructure

### 1.1 Install Vitest + Testing Library for unit/integration tests

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install -D jsdom supertest @types/supertest msw
```

### 1.2 Create `vitest.config.ts` for frontend unit tests
### 1.3 Create `vitest.config.api.ts` for backend API tests
### 1.4 Add test scripts to `package.json`

```json
{
  "test": "vitest run",
  "test:unit": "vitest run --config vitest.config.ts",
  "test:api": "vitest run --config vitest.config.api.ts",
  "test:coverage": "vitest run --coverage",
  "test:all": "npm run test:unit && npm run test:api && npm run test:e2e"
}
```

---

## Phase 2: Frontend Unit Tests (Vitest + Testing Library)

### 2.1 Component Tests (`src/__tests__/components/`)

| Test File | What it Tests |
|-----------|---------------|
| `HackathonCard.test.tsx` | Renders hackathon info, status badges, date formatting, link navigation |
| `RoleBadge.test.tsx` | Correct badge color/text for admin/judge/participant roles |
| `SubmissionForm.test.tsx` | Form validation (Zod), required fields, file attachment handling |
| `ScoreCard.test.tsx` | Score display, criteria rendering, judge name display |
| `Navigation.test.tsx` | Role-based menu items, active route highlighting |

### 2.2 Hook Tests (`src/__tests__/hooks/`)

| Test File | What it Tests |
|-----------|---------------|
| `useAuth.test.ts` | Login/logout state, role detection, token management |
| `useHackathons.test.ts` | TanStack Query integration, loading/error/success states |
| `useSubmissions.test.ts` | CRUD operations, optimistic updates, cache invalidation |

### 2.3 Utility / Store Tests (`src/__tests__/`)

| Test File | What it Tests |
|-----------|---------------|
| `authStore.test.ts` | Zustand store: login, logout, role persistence |
| `apiClient.test.ts` | Base URL config, auth header injection, error handling |
| `validators.test.ts` | Zod schemas: hackathon, submission, scoring validation |

---

## Phase 3: Backend API Tests (Vitest + Supertest)

### 3.1 API Endpoint Tests (`api/__tests__/`)

| Test File | Endpoints Covered |
|-----------|-------------------|
| `hackathons.test.ts` | `GET/POST/PUT/DELETE /api/hackathons` — CRUD, filtering, status transitions |
| `submissions.test.ts` | `GET/POST/PUT /api/submissions` — create, update, list by hackathon |
| `scoring.test.ts` | `POST /api/scores`, `GET /api/hackathons/:id/scores` — judge scoring, aggregate scores |
| `auth.test.ts` | `POST /api/auth/login`, `/api/auth/register` — credential validation, bcrypt, session |
| `judges.test.ts` | `POST/DELETE /api/judges` — assign/remove judges, role validation |
| `teams.test.ts` | `GET/POST /api/teams` — team creation, member management |

### 3.2 Security Tests (in each API test)

- **SQL Injection**: Malicious input in query params and body fields
- **Auth bypass**: Requests without token, expired token, wrong role
- **IDOR**: Access resources belonging to other users/hackathons
- **Input validation**: Oversized payloads, missing required fields, wrong types
- **CORS**: Verify CORS headers in responses

### 3.3 Middleware Tests (`api/__tests__/middleware/`)

| Test File | What it Tests |
|-----------|---------------|
| `auth-middleware.test.ts` | Token validation, role extraction, 401/403 responses |
| `error-handler.test.ts` | Error formatting, Prisma error mapping, 500 fallback |

---

## Phase 4: Database Tests

### 4.1 Prisma Schema Validation (`prisma/__tests__/`)

| Test File | What it Tests |
|-----------|---------------|
| `schema.test.ts` | Validate schema compiles, migrations apply cleanly |
| `seed.test.ts` | Seed data creates expected records, no constraint violations |
| `relations.test.ts` | Foreign key cascades, unique constraints, enum values |

### 4.2 Data Integrity

- Hackathon status transitions (draft → active → judging → completed)
- Submission uniqueness per team per hackathon
- Score constraints (0-100 range, one score per judge per submission per criterion)
- Cascade deletes (delete hackathon → related submissions/scores cleaned up)

---

## Phase 5: E2E Tests (Playwright — Enhance Existing)

### 5.1 Existing Tests Audit

Review and fix existing 6 test files:
- `smoke.spec.ts` — verify all assertions still pass
- `auth.spec.ts` — add edge cases (wrong password, locked account)
- `admin-flow.spec.ts` — verify complete admin workflow
- `judge-flow.spec.ts` — verify complete judge workflow
- `public-pages.spec.ts` — verify all public routes

### 5.2 New E2E Tests

| Test File | Scenario |
|-----------|----------|
| `submission-flow.spec.ts` | Full participant flow: register → join hackathon → submit → view score |
| `scoring-flow.spec.ts` | Judge: view submissions → score each → verify leaderboard |
| `responsive.spec.ts` | Mobile viewport tests for key pages |
| `i18n.spec.ts` | Language switching (zh/en), content verification |

---

## Phase 6: Performance & Load Tests

### 6.1 Lighthouse / Web Vitals

- Run Lighthouse CI on key pages (home, hackathon list, submission form)
- Check LCP < 2.5s, FID < 100ms, CLS < 0.1

### 6.2 API Load Test (simple script)

- `GET /api/hackathons` under 50 concurrent requests
- `POST /api/submissions` under 20 concurrent requests
- Verify response times < 500ms at p95

---

## Phase 7: Code Quality Audit

### 7.1 Static Analysis

- Run `npx tsc --noEmit` — verify zero type errors
- Run `npx eslint .` — verify zero lint errors
- Check for `any` type usage, unused imports, dead exports

### 7.2 Security Audit

- `npm audit` — check for known vulnerabilities
- Review `bcryptjs` salt rounds (should be ≥ 10)
- Verify no secrets in committed code (API keys, passwords)
- Check `.env` is in `.gitignore`

### 7.3 File Hygiene

- **Dead files**: Unused components, orphaned routes, stale configs
- **Naming conventions**: Consistent file naming (PascalCase components, camelCase utils)
- **Hardcoded values**: Magic numbers, hardcoded URLs, inline styles
- **Bundle analysis**: Check for oversized dependencies

### 7.4 Architecture Quality

- **Coupling**: Check component-to-API coupling (should go through hooks/services)
- **Separation of concerns**: API logic in `api/`, UI in `src/`, no cross-contamination
- **Error boundaries**: Verify React error boundaries exist
- **Type safety**: Shared types between frontend and backend

---

## Phase 8: Docker & Infrastructure

### 8.1 Docker Tests

- `docker compose build` succeeds without errors
- `docker compose up` starts all 3 services (db, api, web)
- Health checks pass for all containers
- Volume persistence works across restarts

### 8.2 Build Tests

- `npm run build` succeeds with zero warnings
- Built output size is reasonable (< 2MB gzipped)
- All environment variables are properly handled

---

## Implementation Order

1. **Phase 1** — Install testing infrastructure (Vitest, Testing Library, Supertest)
2. **Phase 7** — Code quality audit (quick wins, finds issues early)
3. **Phase 3** — Backend API tests (critical business logic)
4. **Phase 2** — Frontend unit tests (component + hook coverage)
5. **Phase 4** — Database tests (data integrity)
6. **Phase 5** — E2E test enhancement (fill gaps in existing tests)
7. **Phase 6** — Performance tests
8. **Phase 8** — Docker/infra tests

## Expected Deliverables

- `vitest.config.ts` + `vitest.config.api.ts` — test configs
- `src/__tests__/` — ~10 frontend unit test files
- `api/__tests__/` — ~8 backend API test files
- `prisma/__tests__/` — ~3 database test files
- `e2e/` — 4 new + 5 enhanced E2E test files
- Updated `package.json` with test scripts
- Code quality report with findings and fixes
