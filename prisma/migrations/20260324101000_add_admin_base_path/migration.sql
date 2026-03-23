-- AlterTable
ALTER TABLE "SiteSetting"
ADD COLUMN IF NOT EXISTS "adminBasePath" TEXT NOT NULL DEFAULT '/admin';
