import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import type { PrismaClient } from '@prisma/client';
import {
  SUBMISSION_EMAIL_ENABLED,
  SUBMISSION_EMAIL_HOST,
  SUBMISSION_EMAIL_PORT,
  SUBMISSION_EMAIL_SECURE,
  SUBMISSION_EMAIL_USER,
  SUBMISSION_EMAIL_PASS,
  SUBMISSION_EMAIL_FROM,
  SUBMISSION_EMAIL_REPLY_TO,
  SUBMISSION_EMAIL_SUBJECT_TEMPLATE,
  SUBMISSION_EMAIL_TIMEOUT_MS,
  SUBMISSION_RECEIPT_PREFIX,
  asString,
} from '../config';
import { decryptEmailSecret } from './crypto';
import { formatReceiptIssuedAt } from './formatting';
import type {
  ResolvedSubmissionEmailConfig,
  SubmissionReceiptEmailPayload,
  SubmissionReceiptEmailResult,
  SendSubmissionReceiptEmailOptions,
} from '../types';

let submissionEmailTransporterCache: { key: string; transporter: nodemailer.Transporter } | null = null;

export function interpolateEmailTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] || '');
}

export function resolveSubmissionEmailPort(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}

export function resolveSubmissionEmailTimeout(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export function generateSubmissionReceiptId(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${SUBMISSION_RECEIPT_PREFIX}-${yyyy}${mm}${dd}-${suffix}`;
}

export async function getSubmissionEmailConfig(prisma: PrismaClient, defaultSiteSettings: Record<string, unknown>): Promise<ResolvedSubmissionEmailConfig> {
  const settings = await prisma.siteSetting.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      ...defaultSiteSettings,
    },
  });

  const decryptedPass = settings.smtpPassEncrypted ? decryptEmailSecret(settings.smtpPassEncrypted) : null;
  const fromDbHost = asString(settings.smtpHost);
  const fromDbUser = asString(settings.smtpUser);
  const fromDbFrom = asString(settings.submissionEmailFrom);
  const fromDbReplyTo = asString(settings.submissionEmailReplyTo);
  const fromDbSubject = asString(settings.submissionEmailSubject);

  return {
    enabled: settings.submissionEmailEnabled ?? SUBMISSION_EMAIL_ENABLED,
    host: fromDbHost || SUBMISSION_EMAIL_HOST || undefined,
    port: resolveSubmissionEmailPort(settings.smtpPort, resolveSubmissionEmailPort(SUBMISSION_EMAIL_PORT, 587)),
    secure: settings.smtpSecure ?? SUBMISSION_EMAIL_SECURE,
    user: fromDbUser || SUBMISSION_EMAIL_USER || undefined,
    pass: decryptedPass || SUBMISSION_EMAIL_PASS || undefined,
    from: fromDbFrom || SUBMISSION_EMAIL_FROM,
    replyTo: fromDbReplyTo || SUBMISSION_EMAIL_REPLY_TO || undefined,
    subjectTemplate: fromDbSubject || SUBMISSION_EMAIL_SUBJECT_TEMPLATE,
    timeoutMs: resolveSubmissionEmailTimeout(settings.submissionEmailTimeoutMs, resolveSubmissionEmailTimeout(SUBMISSION_EMAIL_TIMEOUT_MS, 10000)),
  };
}

export function getSubmissionEmailTransporter(config: ResolvedSubmissionEmailConfig): nodemailer.Transporter | null {
  if (!config.host || !Number.isFinite(config.port) || config.port <= 0) {
    return null;
  }

  const cacheKey = [
    config.host,
    config.port,
    config.secure ? '1' : '0',
    config.user || '',
    config.pass || '',
    config.timeoutMs,
  ].join('|');

  if (submissionEmailTransporterCache?.key === cacheKey) {
    return submissionEmailTransporterCache.transporter;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? {
          user: config.user,
          pass: config.pass,
        }
      : undefined,
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
  });

  submissionEmailTransporterCache = { key: cacheKey, transporter };
  return transporter;
}

export async function sendSubmissionReceiptEmail(
  prisma: PrismaClient,
  defaultSiteSettings: Record<string, unknown>,
  payload: SubmissionReceiptEmailPayload,
  options?: SendSubmissionReceiptEmailOptions
): Promise<SubmissionReceiptEmailResult> {
  const config = await getSubmissionEmailConfig(prisma, defaultSiteSettings);
  if (!config.enabled && !options?.ignoreEnabled) {
    return { sent: false, reason: 'disabled' };
  }

  const transporter = getSubmissionEmailTransporter(config);
  if (!transporter) {
    console.warn('[submission-email] SMTP is enabled but config is incomplete');
    return { sent: false, reason: 'missing_config' };
  }

  const issuedAtText = formatReceiptIssuedAt(payload.issuedAtIso);
  const subject = interpolateEmailTemplate(config.subjectTemplate, {
    receiptId: payload.receiptId,
    hackathonTitle: payload.hackathonTitle,
    projectTitle: payload.projectTitle,
  }).trim();

  const textBody = [
    `Thank you for your submission to ${payload.hackathonTitle}.`,
    '',
    `Receipt ID: ${payload.receiptId}`,
    `Contact Email: ${payload.to}`,
    `Issued At: ${issuedAtText}`,
    `Project: ${payload.projectTitle}`,
    '',
    'Please keep this receipt for future communication.',
  ].join('\n');

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
      <p>Thank you for your submission to <strong>${payload.hackathonTitle}</strong>.</p>
      <p><strong>Receipt ID:</strong> ${payload.receiptId}<br/>
      <strong>Contact Email:</strong> ${payload.to}<br/>
      <strong>Issued At:</strong> ${issuedAtText}<br/>
      <strong>Project:</strong> ${payload.projectTitle}</p>
      <p>Please keep this receipt for future communication.</p>
    </div>
  `;

  const mailOptions = {
    from: config.from,
    to: payload.to,
    ...(config.replyTo ? { replyTo: config.replyTo } : {}),
    subject: subject || `[${payload.hackathonTitle}] Submission Receipt ${payload.receiptId}`,
    text: textBody,
    html: htmlBody,
  };

  const maxAttempts = 2;
  let lastErrorCode: string | undefined;
  let lastErrorMessage: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return {
        sent: true,
        messageId: info.messageId,
      };
    } catch (error) {
      const smtpError = error as {
        code?: string;
        responseCode?: number;
        command?: string;
        message?: string;
        response?: string;
      };
      lastErrorCode = [
        smtpError.code,
        smtpError.responseCode ? String(smtpError.responseCode) : undefined,
        smtpError.command,
      ].filter(Boolean).join(' ');
      lastErrorMessage = smtpError.response || smtpError.message;
      console.error(`[submission-email] Failed to send receipt email (attempt ${attempt}/${maxAttempts}):`, error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  return {
    sent: false,
    reason: 'send_failed',
    ...(lastErrorCode ? { errorCode: lastErrorCode } : {}),
    ...(lastErrorMessage ? { errorMessage: lastErrorMessage } : {}),
  };
}
