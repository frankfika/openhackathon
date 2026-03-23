-- CreateTable
CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "hackathonId" TEXT,
  "actorId" TEXT,
  "actorRole" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_hackathonId_fkey'
  ) THEN
    ALTER TABLE "ActivityLog"
    ADD CONSTRAINT "ActivityLog_hackathonId_fkey"
    FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "ActivityLog_hackathonId_createdAt_idx" ON "ActivityLog"("hackathonId", "createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_hackathonId_action_idx" ON "ActivityLog"("hackathonId", "action");
CREATE INDEX IF NOT EXISTS "ActivityLog_hackathonId_entityType_idx" ON "ActivityLog"("hackathonId", "entityType");
CREATE INDEX IF NOT EXISTS "ActivityLog_actorId_idx" ON "ActivityLog"("actorId");
CREATE INDEX IF NOT EXISTS "ActivityLog_entityType_entityId_idx" ON "ActivityLog"("entityType", "entityId");
