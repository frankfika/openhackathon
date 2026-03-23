-- AlterTable
ALTER TABLE "Hackathon"
ADD COLUMN IF NOT EXISTS "submissionSuccessHintText" TEXT,
ADD COLUMN IF NOT EXISTS "submissionSuccessHintImageUrl" TEXT;

-- Backfill from legacy site-level configuration
WITH "default_site_setting" AS (
  SELECT
    "submissionSuccessHintText",
    "submissionSuccessHintImageUrl"
  FROM "SiteSetting"
  WHERE "key" = 'default'
  LIMIT 1
)
UPDATE "Hackathon" AS h
SET
  "submissionSuccessHintText" = COALESCE(h."submissionSuccessHintText", d."submissionSuccessHintText"),
  "submissionSuccessHintImageUrl" = COALESCE(h."submissionSuccessHintImageUrl", d."submissionSuccessHintImageUrl")
FROM "default_site_setting" AS d
WHERE h."submissionSuccessHintText" IS NULL
   OR h."submissionSuccessHintImageUrl" IS NULL;

-- Drop legacy site-level fields
ALTER TABLE "SiteSetting"
DROP COLUMN IF EXISTS "submissionSuccessHintText",
DROP COLUMN IF EXISTS "submissionSuccessHintImageUrl";
