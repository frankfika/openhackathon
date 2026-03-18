# Admin Review Architecture (v2)

## 1. Problem To Fix

Old admin flow mixed three responsibilities:

- Judge account management
- Judge assignment
- Review operations (progress, promotions, reports)

This caused confusion around rounds (`preliminary`, `semi_final`, `final`) and regions, and made judge boundaries unclear across hackathons.

## 2. New Core Principles

1. Judge accounts are global identities, but eligibility is hackathon-scoped.
2. Only judges registered to the current hackathon can be assigned or auto-carried into next rounds.
3. Review operations are split into separate admin pages, not hidden in one tab hub.
4. Round and region are explicit session dimensions, shared across all review pages.

## 3. Data Model

New relation table:

- `HackathonJudge`
  - `hackathonId`
  - `userId`
  - unique `(hackathonId, userId)`

Meaning:

- A judge user can participate in multiple hackathons.
- Each hackathon has its own judge registration list.

## 4. Admin Information Architecture

Split review into explicit routes:

- `${adminBasePath}/reviews` -> review progress
- `${adminBasePath}/assignments` -> assignment management
- `${adminBasePath}/promotions` -> promotions
- `${adminBasePath}/reports` -> scoring reports
- `${adminBasePath}/judges` -> judge registration for current hackathon

Default `adminBasePath` is `/admin`, so examples commonly appear as `/admin/...`.

Legacy `${adminBasePath}/judging?tab=...` keeps redirect compatibility.

### Responsibility Boundaries

- `Site Settings` manages branding/SEO and admin entry path, not judging workflow.
- `Hackathon Settings` manages sessions, criteria, submission schema, and round structure.
- Review execution is isolated to `${adminBasePath}/reviews`, `${adminBasePath}/assignments`, `${adminBasePath}/promotions`, `${adminBasePath}/reports`, `${adminBasePath}/judges`.

## 5. Backend Rules

### Judge registration APIs

- `GET /api/hackathons/:id/judges`
- `POST /api/hackathons/:id/judges` with `judgeIds`
- `DELETE /api/hackathons/:id/judges/:judgeId`

### Assignment constraints

- `POST /api/assignments` now validates:
  - target `judgeId` exists and is role `judge`
  - judge is registered in target session's hackathon

### Promotion constraints

- Auto-creating next-round assignments uses registered judges of the hackathon.
- If explicit `judgeIds` are provided, they must all be registered in that hackathon.

### Dashboard stats

- `totalJudges` is hackathon-scoped when `hackathonId` is provided.

## 6. Operational Workflow

1. Create judge accounts (global pool) or reuse existing ones.
2. Register judges into current hackathon from `${adminBasePath}/judges`.
3. Assign judges in `${adminBasePath}/assignments` (now only registered judges appear).
4. Run reviews in `${adminBasePath}/reviews`.
5. Apply promotions in `${adminBasePath}/promotions` (next-round assignments stay in hackathon scope).
6. Track matrix/report in `${adminBasePath}/reports`.

### SOP by role (Admin side)

1. Prepare sessions in hackathon settings (round type + region).
2. Register judges to the selected hackathon in `${adminBasePath}/judges`.
3. Configure assignments in `${adminBasePath}/assignments`.
4. Judges submit scoring in judge workspace; admins monitor in `${adminBasePath}/reviews`.
5. Apply promotion decisions in `${adminBasePath}/promotions`.
6. Audit progress and export data in `${adminBasePath}/reports`.

This order is intentional: no judge registration -> no assignment -> no valid promotion assignment.

## 7. Region and Round Handling

- Round type and region are session properties.
- All review pages expose session with type and region badges.
- Promotions keep region-based routing for both preliminary -> downstream and semi-final -> final mapping (when region-matched targets exist).
- Final sessions are excluded from promotion operation scope in admin UI to avoid invalid "advance after final" workflows.

This keeps `preliminary`, `semi_final`, `final`, and region logic explicit while avoiding duplicated page implementations.

## 8. UX and Safety Guardrails

### Active hackathon clarity

- Sidebar now includes direct `${adminBasePath}/hackathons` entry for switching.
- Sidebar current-hackathon area shows explicit title and date range, plus a switch shortcut.
- Judge registration and promotions pages show explicit current hackathon context (name/date), instead of only saying "current hackathon".

### URL session context

- `${adminBasePath}/reviews`, `${adminBasePath}/assignments`, `${adminBasePath}/promotions`, `${adminBasePath}/reports` all use `?sessionId=...`.
- Reloading or sharing URL preserves current session scope.
- Legacy `${adminBasePath}/judging?tab=...&sessionId=...` redirects while preserving `sessionId`.

### Promotion reviewer selection safety

- Promotions do not auto-select all judges.
- Admin must explicitly select next-round reviewers only when there are `advanced` decisions.
- Apply actions are disabled when an `advanced` decision exists but no reviewers are selected.
- Advancing is blocked when no downstream session exists for current round.
- Promotions page supports keyword/decision/region filters and filtered-batch decision actions to reduce row-by-row operations.
- Promotions page exposes "auto fill next round" and blocks apply when advanced items are missing next-round targets.
- Bulk apply reports partial success/failure counts instead of showing a false all-success state.

### Judge unregister safety

- Unregister is blocked when assignments still exist in this hackathon.
- API returns explicit error: `Cannot remove judge registration while assignments exist in this hackathon`.
- UI guides admin to `${adminBasePath}/assignments?judgeId=...&sessionId=...` (when available) to clear the blocking assignments first.

### Session timeline safety

- Session management enforces timeline validation in both UI and API.
- `startAt` cannot be later than `endAt`.
- If later-stage rounds exist, each preliminary round must have a downstream semi-final/final with a later `startAt`.
- If final rounds exist, each semi-final round must have a downstream final with a later `startAt`.

## 9. Validation Checklist

- Judge cannot be assigned unless registered to the session's hackathon.
- Cross-hackathon project/session assignment is rejected.
- Promotion assignment uses hackathon-registered judges only.
- Judge unregister does not delete historical scoring/assignment data implicitly.
- Admin pages preserve session context through URL deep links.
- Promotion next-round candidates are computed by session timeline (`startAt`), and invalid round order is now blocked at save time.
