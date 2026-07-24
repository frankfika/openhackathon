-- 2026-07-24 — P0 indexes from performance-audit-2026-07-24.md
-- 4 models had no @@index at all: Hackathon, Project, Assignment, SiteSetting
-- (SiteSetting.key is @unique so no extra index needed.)
-- All indexes are created with CONCURRENTLY so they do not lock the table
-- during creation; this matters in production.
--
-- To deploy:
--   1. Review this file
--   2. Apply with `npx prisma migrate deploy` (Prisma runs CONCURRENTLY for us
--      when the SQL is hand-written and prefixed accordingly). If your migration
--      runner does not support CONCURRENTLY in a transaction, split into
--      multiple statements and run each outside a transaction.

-- Hackathon: status filter + startAt ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Hackathon_status_idx" ON "Hackathon"("status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Hackathon_startAt_idx" ON "Hackathon"("startAt");

-- Project: hackathonId for leaderboard / AI plagiarism scan, userId for "my projects", composite for filtered scans
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_hackathonId_idx" ON "Project"("hackathonId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_hackathonId_status_idx" ON "Project"("hackathonId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");

-- Assignment: judgeId for the judge's work list, status for "completed only" filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Assignment_judgeId_idx" ON "Assignment"("judgeId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Assignment_status_idx" ON "Assignment"("status");
