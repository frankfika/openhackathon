-- CreateTable
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "siteName" TEXT NOT NULL DEFAULT 'OpenHackathon',
    "logoUrl" TEXT,
    "tabTitle" TEXT NOT NULL DEFAULT 'OpenHackathon',
    "seoTitle" TEXT NOT NULL DEFAULT 'OpenHackathon',
    "seoDescription" TEXT NOT NULL DEFAULT 'OpenHackathon - Open source hackathon management platform',
    "faviconUrl" TEXT NOT NULL DEFAULT '/favicon.svg',
    "showPoweredBy" BOOLEAN NOT NULL DEFAULT true,
    "poweredByText" TEXT NOT NULL DEFAULT 'Powered by OpenHackathon',
    "poweredByUrl" TEXT NOT NULL DEFAULT 'https://openhackathon.dev',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");
