# Admin Review Architecture (Current)

## 1. Scope

Current admin review flow in this repository is **single-hackathon-first** and centered on three pages:

- `${adminBasePath}/projects`
- `${adminBasePath}/assignments`
- `${adminBasePath}/leaderboard`

`adminBasePath` defaults to `/admin` and can be changed in Site Settings.

## 2. Core Principles

1. One active hackathon drives all admin and judge operations.
2. Judge accounts are global identities, but judge participation is hackathon-scoped (`HackathonJudge`).
3. Assignment and judging operate on explicit records (`Assignment`, `Score`) with audit logs.
4. Leaderboard visibility is controlled by publish state (`leaderboardPublished`).

## 3. Information Architecture

### Active admin routes

- `${adminBasePath}`: dashboard
- `${adminBasePath}/projects`: submission list and project detail
- `${adminBasePath}/assignments`: assignment management and progress
- `${adminBasePath}/judges`: judge registration/management
- `${adminBasePath}/leaderboard`: ranking management and publish
- `${adminBasePath}/hackathons/:id/settings`: hackathon settings
- `${adminBasePath}/activity`: activity logs
- `${adminBasePath}/settings`: site settings

### Legacy compatibility redirects

To avoid breaking old links, these routes redirect to assignment management:

- `${adminBasePath}/reviews`
- `${adminBasePath}/reports`
- `${adminBasePath}/judging`

## 4. Backend Rules

### Judge registration APIs

- `GET /api/hackathons/:id/judges`
- `POST /api/hackathons/:id/judges` with `judgeIds`
- `DELETE /api/hackathons/:id/judges/:judgeId`

### Assignment rules

- `POST /api/assignments` validates judge identity and hackathon scope.
- `DELETE /api/assignments/bulk` only removes pending assignments for a hackathon.
- Every assignment mutation writes `ActivityLog`.

### Leaderboard rules

- Public leaderboard data comes from `GET /api/leaderboard`.
- Unpublished leaderboard returns an empty list.
- Published leaderboard returns curated entries when configured, otherwise score-based ranking.

## 5. Recommended Admin SOP

1. Configure hackathon profile, submission schema, and scoring criteria.
2. Register judges in `${adminBasePath}/judges`.
3. Generate/adjust assignments in `${adminBasePath}/assignments`.
4. Judges submit scores in judge workspace.
5. Review progress and quality in `${adminBasePath}/assignments` + `${adminBasePath}/activity`.
6. Finalize and publish rankings in `${adminBasePath}/leaderboard`.

## 6. Validation Checklist

- Judge cannot score unassigned projects.
- Assignment and scoring operations are hackathon-scoped.
- Leaderboard remains hidden until published.
- Activity logs capture assignment, score, and bulk-reset operations.
- Admin navigation links resolve to real, non-stale routes.
