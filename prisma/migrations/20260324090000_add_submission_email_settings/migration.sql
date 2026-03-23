-- AlterTable
ALTER TABLE "SiteSetting"
ADD COLUMN     "submissionEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpHost" TEXT,
ADD COLUMN     "smtpPort" INTEGER NOT NULL DEFAULT 587,
ADD COLUMN     "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpUser" TEXT,
ADD COLUMN     "smtpPassEncrypted" TEXT,
ADD COLUMN     "submissionEmailFrom" TEXT NOT NULL DEFAULT 'OpenHackathon <no-reply@localhost>',
ADD COLUMN     "submissionEmailReplyTo" TEXT,
ADD COLUMN     "submissionEmailSubject" TEXT NOT NULL DEFAULT '[{{hackathonTitle}}] Submission Receipt {{receiptId}}',
ADD COLUMN     "submissionEmailTimeoutMs" INTEGER NOT NULL DEFAULT 10000;
