-- AlterTable
ALTER TABLE "Hackathon"
ADD COLUMN IF NOT EXISTS "docsUrl" TEXT,
ADD COLUMN IF NOT EXISTS "judgesPerProject" INTEGER NOT NULL DEFAULT 2;

-- Backfill docsUrl from legacy columns when available
UPDATE "Hackathon"
SET "docsUrl" = COALESCE("docsUrl", "detailsUrl", "gitbookUrl", "rulesUrl")
WHERE "docsUrl" IS NULL;
