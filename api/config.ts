import path from 'path';

// ===== Helper functions used during config initialization =====

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function parseTrustProxy(value: string | undefined): boolean | number | string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const lowered = trimmed.toLowerCase();
  if (lowered === 'true') return true;
  if (lowered === 'false') return false;

  const parsedNumber = Number(trimmed);
  if (Number.isInteger(parsedNumber) && parsedNumber >= 0) {
    return parsedNumber;
  }

  return trimmed;
}

export function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// ===== Constants =====

export const VALID_ASSIGNMENT_STATUSES = new Set(['pending', 'in_progress', 'completed']);
export const VALID_HACKATHON_STATUSES = new Set(['draft', 'upcoming', 'active', 'judging', 'completed']);
export const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';
export const DEFAULT_JWT_SECRET = 'openhackathon-change-this-secret';
export const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
export const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 7);
export const JWT_ISSUER = asString(process.env.JWT_ISSUER) || 'openhackathon';
export const JWT_AUDIENCE = asString(process.env.JWT_AUDIENCE) || 'openhackathon-clients';
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
export const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);
export const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true';
export const CORS_ORIGINS = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
export const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';
export const MARKDOWN_DOC_BODY_LIMIT = process.env.MARKDOWN_DOC_BODY_LIMIT || '25mb';
export const API_RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
export const API_RATE_LIMIT_MAX = readPositiveInteger(process.env.API_RATE_LIMIT_MAX, 1200);
export const AUTH_RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
export const AUTH_RATE_LIMIT_MAX = readPositiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 20);
export const SUBMISSION_RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.SUBMISSION_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
export const SUBMISSION_RATE_LIMIT_MAX = readPositiveInteger(process.env.SUBMISSION_RATE_LIMIT_MAX, 30);
export const SUBMISSION_RECEIPT_PREFIX = (process.env.SUBMISSION_RECEIPT_PREFIX || 'SUB').trim().toUpperCase() || 'SUB';
export const SUBMISSION_EMAIL_ENABLED = process.env.SUBMISSION_EMAIL_ENABLED === 'true';
export const SUBMISSION_EMAIL_HOST = process.env.SMTP_HOST;
export const SUBMISSION_EMAIL_PORT = Number(process.env.SMTP_PORT || 587);
export const SUBMISSION_EMAIL_SECURE = process.env.SMTP_SECURE === 'true';
export const SUBMISSION_EMAIL_USER = process.env.SMTP_USER;
export const SUBMISSION_EMAIL_PASS = process.env.SMTP_PASS;
export const SUBMISSION_EMAIL_FROM = process.env.SUBMISSION_RECEIPT_FROM || 'OpenHackathon <no-reply@localhost>';
export const SUBMISSION_EMAIL_REPLY_TO = process.env.SUBMISSION_RECEIPT_REPLY_TO;
export const SUBMISSION_EMAIL_SUBJECT_TEMPLATE = process.env.SUBMISSION_RECEIPT_SUBJECT || '[{{hackathonTitle}}] Submission Receipt {{receiptId}}';
export const SUBMISSION_EMAIL_TIMEOUT_MS = Number(process.env.SUBMISSION_EMAIL_TIMEOUT_MS || 10000);
export const EMAIL_SETTINGS_SECRET = process.env.EMAIL_SETTINGS_SECRET || JWT_SECRET;
export const HACKATHON_DOCS_ROOT = path.resolve(process.cwd(), process.env.HACKATHON_DOCS_DIR || 'content/hackathons');
export const UPLOADS_ROOT = path.resolve(process.cwd(), process.env.UPLOADS_DIR || 'content/uploads');
export const UPLOAD_IMAGES_DIR = path.join(UPLOADS_ROOT, 'images');
export const IMAGE_UPLOAD_LIMIT = process.env.IMAGE_UPLOAD_LIMIT || '5mb';
export const SINGLE_HACKATHON_MODE = process.env.SINGLE_HACKATHON_MODE !== 'false';
export const HACKATHON_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  judging: 1,
  upcoming: 2,
  draft: 3,
  completed: 4,
  published: 5,
};
export const DEFAULT_HACKATHON_COVER_GRADIENT = 'from-blue-500/20 via-sky-500/10 to-indigo-500/20';
export const DEFAULT_LEGACY_SESSION_NAME = 'Main Round';
export const DEFAULT_LEGACY_SESSION_TYPE = 'preliminary';
export const ALLOWED_UPLOAD_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico']);
export const MIME_TO_IMAGE_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};
