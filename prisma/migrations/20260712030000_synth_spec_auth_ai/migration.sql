-- ============================================================================
-- synth-design-spec combined migration
--   Block 1 P0-4: UserRole enum
--   Block 2 P0-1: Web3Nonce table (DB-backed SIWE nonce store)
--   Block 2 P0-3: (address, chainId) unique on WalletAddress
--   Block 3:      AIGenerationLog + AIBatchTask + Hackathon description / news
--
-- Notes for the operator:
--   * The User.role change is the only step that can lose data. We first
--     normalise any unexpected role values to 'user' (the spec §appendix B
--     fallback), then ALTER the column to a typed enum.
--   * WalletAddress_address_chainId_key replaces the old
--     WalletAddress_address_chain_key. Existing rows that collide on the
--     new (address, chainId) key are kept — the unique index is created
--     WITHOUT this safety net; if you have duplicates, normalise them
--     before applying. (NULL chainId values do not collide under
--     PostgreSQL's unique semantics, so Solana rows are safe.)
--   * The Hackathon / SiteSetting columns referenced at the top of the
--     auto-generated diff (docsSourceType, licenseKey, DocsSourceType)
--     are dropped because they are not in the current Prisma schema.
--     They were applied in a separate migration that is not tracked in
--     this checkout; if your environment needs to keep them, edit this
--     file before running `prisma migrate deploy`.
-- ============================================================================

-- 1) Normalise User.role before the enum conversion (defensive — the
--    current dataset only contains 'admin' and 'judge' but we want to
--    be safe in case the live DB has stray values).
UPDATE "User"
SET    "role" = 'user'
WHERE  "role" NOT IN ('admin', 'judge');

-- 2) Create the UserRole enum type.
CREATE TYPE "UserRole" AS ENUM ('admin', 'judge', 'user');

-- 3) Drop the old WalletAddress unique (address, chain) — replaced by
--    (address, chainId). Any (address, chainId) duplicates must be
--    resolved before the new unique index is created; the next
--    statement will fail if duplicates exist.
DROP INDEX IF EXISTS "WalletAddress_address_chain_key";

-- 4) Drop columns / types from prior untracked migrations so the
--    schema and DB stay in sync.
ALTER TABLE "Hackathon"  DROP COLUMN IF EXISTS "docsSourceType";
ALTER TABLE "SiteSetting" DROP COLUMN IF EXISTS "licenseKey";
DROP TYPE IF EXISTS "DocsSourceType";

-- 5) Convert User.role from TEXT to the UserRole enum, preserving the
--    existing values.
ALTER TABLE "User"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "UserRole" USING "role"::"UserRole",
  ALTER COLUMN "role" SET DEFAULT 'user',
  ALTER COLUMN "role" SET NOT NULL;

-- 6) Hackathon: AI-generated content fields (Block 3 §3.1.2).
ALTER TABLE "Hackathon"
  ADD COLUMN "description"   TEXT,
  ADD COLUMN "descriptionZh" TEXT,
  ADD COLUMN "descriptionEn" TEXT,
  ADD COLUMN "newsZh"        TEXT,
  ADD COLUMN "newsEn"        TEXT,
  ADD COLUMN "theme"         TEXT,
  ADD COLUMN "tracks"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 7) Web3Nonce: DB-backed nonce store (Block 2 P0-1).
CREATE TABLE "Web3Nonce" (
  "id"        TEXT NOT NULL,
  "address"   TEXT NOT NULL,
  "chain"     TEXT NOT NULL,
  "chainId"   INTEGER,
  "purpose"   TEXT NOT NULL,
  "nonce"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Web3Nonce_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Web3Nonce_nonce_key" ON "Web3Nonce"("nonce");
CREATE INDEX "Web3Nonce_address_chain_chainId_purpose_idx"
  ON "Web3Nonce"("address", "chain", "chainId", "purpose");
CREATE INDEX "Web3Nonce_expiresAt_idx" ON "Web3Nonce"("expiresAt");

-- 8) AIGenerationLog: per-call audit log for AI doc generation
--    (Block 3 §3.5.3).
CREATE TABLE "AIGenerationLog" (
  "id"          TEXT NOT NULL,
  "actorId"     TEXT NOT NULL,
  "hackathonId" TEXT,
  "type"        TEXT NOT NULL,
  "language"    TEXT NOT NULL,
  "promptHash"  TEXT NOT NULL,
  "model"       TEXT NOT NULL,
  "tokensIn"    INTEGER NOT NULL,
  "tokensOut"   INTEGER NOT NULL,
  "latencyMs"   INTEGER NOT NULL,
  "status"      TEXT NOT NULL,
  "errorCode"   TEXT,
  "costUsd"     DOUBLE PRECISION,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIGenerationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIGenerationLog_hackathonId_type_idx"
  ON "AIGenerationLog"("hackathonId", "type");
CREATE INDEX "AIGenerationLog_actorId_createdAt_idx"
  ON "AIGenerationLog"("actorId", "createdAt");
CREATE INDEX "AIGenerationLog_createdAt_idx"
  ON "AIGenerationLog"("createdAt");

-- 9) AIBatchTask: long-running AI batch task tracker (Block 3 §3.5.3).
CREATE TABLE "AIBatchTask" (
  "id"          TEXT NOT NULL,
  "actorId"     TEXT NOT NULL,
  "hackathonId" TEXT,
  "kind"        TEXT NOT NULL,
  "status"      TEXT NOT NULL,
  "total"       INTEGER NOT NULL,
  "completed"   INTEGER NOT NULL DEFAULT 0,
  "failed"      INTEGER NOT NULL DEFAULT 0,
  "metadata"    JSONB,
  "errorCode"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AIBatchTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AIBatchTask_actorId_createdAt_idx"
  ON "AIBatchTask"("actorId", "createdAt");
CREATE INDEX "AIBatchTask_status_idx" ON "AIBatchTask"("status");

-- 10) WalletAddress: (address, chainId) unique (Block 2 P0-3).
--     NULLs do not collide under Postgres semantics, so Solana rows
--     (chainId IS NULL) are not affected.
CREATE UNIQUE INDEX "WalletAddress_address_chainId_key"
  ON "WalletAddress"("address", "chainId");

-- 11) Foreign key for AIGenerationLog -> Hackathon.
ALTER TABLE "AIGenerationLog"
  ADD CONSTRAINT "AIGenerationLog_hackathonId_fkey"
  FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
