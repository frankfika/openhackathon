import express from 'express';
import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import {
  SUBMISSION_EMAIL_ENABLED,
  SUBMISSION_EMAIL_FROM,
  SUBMISSION_EMAIL_PORT,
  SUBMISSION_EMAIL_SECURE,
  SUBMISSION_EMAIL_SUBJECT_TEMPLATE,
  SUBMISSION_EMAIL_TIMEOUT_MS,
  IMAGE_UPLOAD_LIMIT,
  UPLOADS_ROOT,
  UPLOAD_IMAGES_DIR,
  ALLOWED_UPLOAD_IMAGE_EXTENSIONS,
  asString,
} from '../config';
import { normalizeEmail, isValidEmail, getErrorMessage, normalizeAdminBasePath } from '../utils/validation';
import { encryptEmailSecret } from '../utils/crypto';
import { resolveSubmissionEmailPort, resolveSubmissionEmailTimeout, sendSubmissionReceiptEmail, getSubmissionEmailConfig } from '../utils/email';
import { getCurrentHackathon, serializeSiteSettings, serializePublicSiteSettings } from '../utils/hackathon';
import { normalizeUploadedImageFileName, resolveUploadedImageExtension } from '../utils/documents';

export function registerSiteSettingsRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin, defaultSiteSettings }: { requireAdmin: RequestHandler; defaultSiteSettings: Record<string, unknown> },
) {
  // GET /api/site-settings - public settings
  app.get('/api/site-settings', async (_req, res) => {
    const settings = await prisma.siteSetting.upsert({
      where: { key: 'default' },
      update: {},
      create: { key: 'default', ...defaultSiteSettings },
    });
    res.json(serializePublicSiteSettings(settings));
  });

  // GET /api/site-settings/admin - admin settings
  app.get('/api/site-settings/admin', requireAdmin, async (_req, res) => {
    const settings = await prisma.siteSetting.upsert({
      where: { key: 'default' },
      update: {},
      create: { key: 'default', ...defaultSiteSettings },
    });
    res.json(serializeSiteSettings(settings));
  });

  // PUT /api/site-settings - update settings
  app.put('/api/site-settings', requireAdmin, async (req, res) => {
    const body = req.body || {};

    const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : undefined;
    const adminBasePath = typeof body.adminBasePath === 'string'
      ? normalizeAdminBasePath(body.adminBasePath)
      : undefined;
    const tabTitle = typeof body.tabTitle === 'string' ? body.tabTitle.trim() : undefined;
    const seoTitle = typeof body.seoTitle === 'string' ? body.seoTitle.trim() : undefined;
    const seoDescription = typeof body.seoDescription === 'string' ? body.seoDescription.trim() : undefined;
    const faviconUrl = typeof body.faviconUrl === 'string' ? body.faviconUrl.trim() : undefined;
    const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : undefined;
    const poweredByText = typeof body.poweredByText === 'string' ? body.poweredByText.trim() : undefined;
    const poweredByUrl = typeof body.poweredByUrl === 'string' ? body.poweredByUrl.trim() : undefined;
    const smtpHost = typeof body.smtpHost === 'string' ? body.smtpHost.trim() : undefined;
    const smtpUser = typeof body.smtpUser === 'string' ? body.smtpUser.trim() : undefined;
    const submissionEmailFrom = typeof body.submissionEmailFrom === 'string' ? body.submissionEmailFrom.trim() : undefined;
    const submissionEmailReplyTo = typeof body.submissionEmailReplyTo === 'string' ? body.submissionEmailReplyTo.trim() : undefined;
    const submissionEmailSubject = typeof body.submissionEmailSubject === 'string' ? body.submissionEmailSubject.trim() : undefined;
    const smtpPassInput = typeof body.smtpPass === 'string' ? body.smtpPass : undefined;

    const smtpPort =
      body.smtpPort !== undefined
        ? resolveSubmissionEmailPort(body.smtpPort, -1)
        : undefined;
    if (smtpPort !== undefined && smtpPort <= 0) {
      return res.status(400).json({ error: 'smtpPort must be an integer between 1 and 65535' });
    }

    const submissionEmailTimeoutMs =
      body.submissionEmailTimeoutMs !== undefined
        ? resolveSubmissionEmailTimeout(body.submissionEmailTimeoutMs, -1)
        : undefined;
    if (submissionEmailTimeoutMs !== undefined && submissionEmailTimeoutMs <= 0) {
      return res.status(400).json({ error: 'submissionEmailTimeoutMs must be a positive integer' });
    }

    if (submissionEmailReplyTo !== undefined && submissionEmailReplyTo && !isValidEmail(submissionEmailReplyTo)) {
      return res.status(400).json({ error: 'submissionEmailReplyTo must be a valid email' });
    }

    let smtpPassEncryptedValue: string | null | undefined;
    if (smtpPassInput !== undefined) {
      const trimmed = smtpPassInput.trim();
      smtpPassEncryptedValue = trimmed ? encryptEmailSecret(trimmed) : null;
    }

    const data: Prisma.SiteSettingUpdateInput = {
      ...(siteName !== undefined ? { siteName: siteName || defaultSiteSettings.siteName } : {}),
      ...(adminBasePath !== undefined ? { adminBasePath } : {}),
      ...(tabTitle !== undefined ? { tabTitle: tabTitle || siteName || defaultSiteSettings.tabTitle } : {}),
      ...(seoTitle !== undefined ? { seoTitle: seoTitle || siteName || defaultSiteSettings.seoTitle } : {}),
      ...(seoDescription !== undefined ? { seoDescription: seoDescription || defaultSiteSettings.seoDescription } : {}),
      ...(faviconUrl !== undefined ? { faviconUrl: faviconUrl || defaultSiteSettings.faviconUrl } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
      ...(body.showPoweredBy !== undefined && typeof body.showPoweredBy === 'boolean'
        ? { showPoweredBy: body.showPoweredBy }
        : {}),
      ...(poweredByText !== undefined ? { poweredByText: poweredByText || defaultSiteSettings.poweredByText } : {}),
      ...(poweredByUrl !== undefined ? { poweredByUrl: poweredByUrl || defaultSiteSettings.poweredByUrl } : {}),
      ...(body.submissionEmailEnabled !== undefined && typeof body.submissionEmailEnabled === 'boolean'
        ? { submissionEmailEnabled: body.submissionEmailEnabled }
        : {}),
      ...(body.smtpHost !== undefined ? { smtpHost: smtpHost || null } : {}),
      ...(smtpPort !== undefined ? { smtpPort } : {}),
      ...(body.smtpSecure !== undefined && typeof body.smtpSecure === 'boolean'
        ? { smtpSecure: body.smtpSecure }
        : {}),
      ...(body.smtpUser !== undefined ? { smtpUser: smtpUser || null } : {}),
      ...(smtpPassEncryptedValue !== undefined ? { smtpPassEncrypted: smtpPassEncryptedValue } : {}),
      ...(body.submissionEmailFrom !== undefined
        ? { submissionEmailFrom: submissionEmailFrom || defaultSiteSettings.submissionEmailFrom }
        : {}),
      ...(body.submissionEmailReplyTo !== undefined ? { submissionEmailReplyTo: submissionEmailReplyTo || null } : {}),
      ...(body.submissionEmailSubject !== undefined
        ? { submissionEmailSubject: submissionEmailSubject || defaultSiteSettings.submissionEmailSubject }
        : {}),
      ...(submissionEmailTimeoutMs !== undefined ? { submissionEmailTimeoutMs } : {}),
    };
    const createData: Prisma.SiteSettingCreateInput = {
      key: 'default',
      siteName: siteName || defaultSiteSettings.siteName as string,
      adminBasePath: adminBasePath || defaultSiteSettings.adminBasePath as string,
      tabTitle: tabTitle || siteName || defaultSiteSettings.tabTitle as string,
      seoTitle: seoTitle || siteName || defaultSiteSettings.seoTitle as string,
      seoDescription: seoDescription || defaultSiteSettings.seoDescription as string,
      faviconUrl: faviconUrl || defaultSiteSettings.faviconUrl as string,
      showPoweredBy: typeof body.showPoweredBy === 'boolean' ? body.showPoweredBy : defaultSiteSettings.showPoweredBy as boolean,
      poweredByText: poweredByText || defaultSiteSettings.poweredByText as string,
      poweredByUrl: poweredByUrl || defaultSiteSettings.poweredByUrl as string,
      submissionEmailEnabled:
        typeof body.submissionEmailEnabled === 'boolean'
          ? body.submissionEmailEnabled
          : defaultSiteSettings.submissionEmailEnabled as boolean,
      smtpHost: body.smtpHost !== undefined ? (smtpHost || null) : defaultSiteSettings.smtpHost as string | null,
      smtpPort: smtpPort !== undefined ? smtpPort : defaultSiteSettings.smtpPort as number,
      smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : defaultSiteSettings.smtpSecure as boolean,
      smtpUser: body.smtpUser !== undefined ? (smtpUser || null) : defaultSiteSettings.smtpUser as string | null,
      ...(smtpPassEncryptedValue !== undefined ? { smtpPassEncrypted: smtpPassEncryptedValue } : {}),
      submissionEmailFrom: submissionEmailFrom || defaultSiteSettings.submissionEmailFrom as string,
      submissionEmailReplyTo:
        body.submissionEmailReplyTo !== undefined
          ? (submissionEmailReplyTo || null)
          : defaultSiteSettings.submissionEmailReplyTo as string | null,
      submissionEmailSubject: submissionEmailSubject || defaultSiteSettings.submissionEmailSubject as string,
      submissionEmailTimeoutMs:
        submissionEmailTimeoutMs !== undefined
          ? submissionEmailTimeoutMs
          : defaultSiteSettings.submissionEmailTimeoutMs as number,
      ...(body.logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
    };

    const settings = await prisma.siteSetting.upsert({
      where: { key: 'default' },
      update: data,
      create: createData,
    });

    res.json(serializeSiteSettings(settings));
  });

  // POST /api/site-settings/email/test - test email
  app.post('/api/site-settings/email/test', requireAdmin, async (req, res) => {
    const to = normalizeEmail(req.body?.to);
    if (!to || !isValidEmail(to)) {
      return res.status(400).json({ error: 'A valid recipient email is required' });
    }

    const currentHackathon = await getCurrentHackathon(prisma);
    const emailResult = await sendSubmissionReceiptEmail(prisma, defaultSiteSettings, {
      to,
      receiptId: `TEST-${randomBytes(3).toString('hex').toUpperCase()}`,
      hackathonTitle: currentHackathon?.title || 'OpenHackathon',
      projectTitle: 'SMTP Configuration Test',
      issuedAtIso: new Date().toISOString(),
    }, { ignoreEnabled: true });

    if (!emailResult.sent) {
      return res.status(400).json({
        sent: false,
        reason: emailResult.reason,
        error: 'Failed to send test email',
        ...(emailResult.errorCode ? { errorCode: emailResult.errorCode } : {}),
        ...(emailResult.errorMessage ? { errorDetail: emailResult.errorMessage } : {}),
      });
    }

    res.json({
      sent: true,
      messageId: emailResult.messageId,
    });
  });

  // POST /api/uploads/images - image upload
  app.post('/api/uploads/images', requireAdmin, express.raw({ type: ['image/*', 'application/octet-stream'], limit: IMAGE_UPLOAD_LIMIT }), async (req, res) => {
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (payload.length === 0) {
      return res.status(400).json({ error: 'Image file content is required' });
    }

    const contentType = req.header('content-type')?.split(';')[0]?.trim().toLowerCase();
    if (contentType && contentType !== 'application/octet-stream' && !contentType.startsWith('image/')) {
      return res.status(400).json({ error: 'Only image content types are allowed' });
    }

    const rawFileName = req.header('x-file-name');
    let decodedFileName = rawFileName || '';
    if (rawFileName) {
      try {
        decodedFileName = decodeURIComponent(rawFileName);
      } catch {
        decodedFileName = rawFileName;
      }
    }

    const normalizedFileName = normalizeUploadedImageFileName(decodedFileName);
    const extension = resolveUploadedImageExtension(normalizedFileName, contentType);
    if (!extension || !ALLOWED_UPLOAD_IMAGE_EXTENSIONS.has(extension)) {
      return res.status(400).json({ error: 'Only PNG/JPG/WebP/GIF/SVG/ICO images are supported' });
    }

    try {
      await fs.mkdir(UPLOAD_IMAGES_DIR, { recursive: true });
      const savedFileName = `${Date.now()}-${randomBytes(4).toString('hex')}${extension}`;
      await fs.writeFile(path.join(UPLOAD_IMAGES_DIR, savedFileName), payload);

      return res.json({
        url: `/uploads/images/${savedFileName}`,
        fileName: savedFileName,
        size: payload.length,
      });
    } catch (error: unknown) {
      return res.status(500).json({ error: getErrorMessage(error, 'Failed to save image') });
    }
  });
}
