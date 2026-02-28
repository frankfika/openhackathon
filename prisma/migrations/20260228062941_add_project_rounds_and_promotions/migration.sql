-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "projectRoundId" TEXT;

-- AlterTable
ALTER TABLE "Hackathon" ADD COLUMN     "detailsUrl" TEXT,
ADD COLUMN     "gitbookUrl" TEXT,
ADD COLUMN     "leaderboardData" JSONB,
ADD COLUMN     "leaderboardPublished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prizePool" TEXT,
ADD COLUMN     "rulesUrl" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "status" TEXT;

-- CreateTable
CREATE TABLE "ProjectRound" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sourceRoundId" TEXT,
    "promotionStatus" TEXT NOT NULL DEFAULT 'pending',
    "nextSessionId" TEXT,
    "decisionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectRound_sessionId_idx" ON "ProjectRound"("sessionId");

-- CreateIndex
CREATE INDEX "ProjectRound_projectId_idx" ON "ProjectRound"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRound_nextSessionId_idx" ON "ProjectRound"("nextSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRound_projectId_sessionId_key" ON "ProjectRound"("projectId", "sessionId");

-- CreateIndex
CREATE INDEX "Assignment_projectRoundId_idx" ON "Assignment"("projectRoundId");

-- AddForeignKey
ALTER TABLE "ProjectRound" ADD CONSTRAINT "ProjectRound_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRound" ADD CONSTRAINT "ProjectRound_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRound" ADD CONSTRAINT "ProjectRound_sourceRoundId_fkey" FOREIGN KEY ("sourceRoundId") REFERENCES "ProjectRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRound" ADD CONSTRAINT "ProjectRound_nextSessionId_fkey" FOREIGN KEY ("nextSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRound" ADD CONSTRAINT "ProjectRound_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_projectRoundId_fkey" FOREIGN KEY ("projectRoundId") REFERENCES "ProjectRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

