-- CreateTable
CREATE TABLE "HackathonJudge" (
    "id" TEXT NOT NULL,
    "hackathonId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HackathonJudge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HackathonJudge_hackathonId_idx" ON "HackathonJudge"("hackathonId");

-- CreateIndex
CREATE INDEX "HackathonJudge_userId_idx" ON "HackathonJudge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HackathonJudge_hackathonId_userId_key" ON "HackathonJudge"("hackathonId", "userId");

-- AddForeignKey
ALTER TABLE "HackathonJudge" ADD CONSTRAINT "HackathonJudge_hackathonId_fkey" FOREIGN KEY ("hackathonId") REFERENCES "Hackathon"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HackathonJudge" ADD CONSTRAINT "HackathonJudge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
