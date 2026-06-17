-- CreateTable
CREATE TABLE "AIAssessment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIAssessment_projectId_type_idx" ON "AIAssessment"("projectId", "type");

-- CreateIndex
CREATE INDEX "AIAssessment_createdAt_idx" ON "AIAssessment"("createdAt");
