import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { Prisma, PrismaClient, SiteSetting } from '@prisma/client';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

export const prisma = new PrismaClient();
export const app = express();
const VALID_ASSIGNMENT_STATUSES = new Set(['pending', 'in_progress', 'completed']);
const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';
const DEFAULT_JWT_SECRET = 'openhackathon-change-this-secret';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const JWT_EXPIRES_IN_SECONDS = Number(process.env.JWT_EXPIRES_IN_SECONDS || 60 * 60 * 24 * 7);
const JWT_ISSUER = asString(process.env.JWT_ISSUER) || 'openhackathon';
const JWT_AUDIENCE = asString(process.env.JWT_AUDIENCE) || 'openhackathon-clients';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const TRUST_PROXY = parseTrustProxy(process.env.TRUST_PROXY);
const CORS_ALLOW_ALL = process.env.CORS_ALLOW_ALL === 'true';
const CORS_ORIGINS = (process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';
const API_RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const API_RATE_LIMIT_MAX = readPositiveInteger(process.env.API_RATE_LIMIT_MAX, 1200);
const AUTH_RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000);
const AUTH_RATE_LIMIT_MAX = readPositiveInteger(process.env.AUTH_RATE_LIMIT_MAX, 20);
const SUBMISSION_RATE_LIMIT_WINDOW_MS = readPositiveInteger(process.env.SUBMISSION_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
const SUBMISSION_RATE_LIMIT_MAX = readPositiveInteger(process.env.SUBMISSION_RATE_LIMIT_MAX, 30);
const SUBMISSION_RECEIPT_PREFIX = (process.env.SUBMISSION_RECEIPT_PREFIX || 'SUB').trim().toUpperCase() || 'SUB';
const SUBMISSION_EMAIL_ENABLED = process.env.SUBMISSION_EMAIL_ENABLED === 'true';
const SUBMISSION_EMAIL_HOST = process.env.SMTP_HOST;
const SUBMISSION_EMAIL_PORT = Number(process.env.SMTP_PORT || 587);
const SUBMISSION_EMAIL_SECURE = process.env.SMTP_SECURE === 'true';
const SUBMISSION_EMAIL_USER = process.env.SMTP_USER;
const SUBMISSION_EMAIL_PASS = process.env.SMTP_PASS;
const SUBMISSION_EMAIL_FROM = process.env.SUBMISSION_RECEIPT_FROM || 'OpenHackathon <no-reply@localhost>';
const SUBMISSION_EMAIL_REPLY_TO = process.env.SUBMISSION_RECEIPT_REPLY_TO;
const SUBMISSION_EMAIL_SUBJECT_TEMPLATE = process.env.SUBMISSION_RECEIPT_SUBJECT || '[{{hackathonTitle}}] Submission Receipt {{receiptId}}';
const SUBMISSION_EMAIL_TIMEOUT_MS = Number(process.env.SUBMISSION_EMAIL_TIMEOUT_MS || 10000);
const EMAIL_SETTINGS_SECRET = process.env.EMAIL_SETTINGS_SECRET || JWT_SECRET;
const HACKATHON_DOCS_ROOT = path.resolve(process.cwd(), process.env.HACKATHON_DOCS_DIR || 'content/hackathons');
const SINGLE_HACKATHON_MODE = process.env.SINGLE_HACKATHON_MODE !== 'false';
const HACKATHON_STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  judging: 1,
  upcoming: 2,
  draft: 3,
  completed: 4,
  published: 5,
};
const DEFAULT_HACKATHON_COVER_GRADIENT = 'from-blue-500/20 via-sky-500/10 to-indigo-500/20';

let submissionEmailTransporterCache: { key: string; transporter: nodemailer.Transporter } | null = null;

type UserRole = 'admin' | 'judge';
type AuthUser = {
  id: string;
  role: UserRole;
  email: string;
  name: string;
};

type JwtPayload = {
  sub: string;
  role: UserRole;
  email: string;
  name: string;
  iss?: string;
  aud?: string | string[];
  iat?: number;
  exp?: number;
};

type SubmissionReceiptEmailPayload = {
  to: string;
  receiptId: string;
  hackathonTitle: string;
  projectTitle: string;
  issuedAtIso: string;
};

type SubmissionReceiptEmailResult = {
  sent: boolean;
  reason?: 'disabled' | 'missing_config' | 'send_failed';
  messageId?: string;
};

type SendSubmissionReceiptEmailOptions = {
  ignoreEnabled?: boolean;
};

type ResolvedSubmissionEmailConfig = {
  enabled: boolean;
  host?: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
  replyTo?: string;
  subjectTemplate: string;
  timeoutMs: number;
};

type ScoringCriterionPayload = {
  name: string;
  maxScore: number;
  sortOrder?: number;
};

type AssignmentScorePayload = {
  criterionId: string;
  score: number;
};

type DashboardStats = {
  totalProjects?: number;
  totalJudges?: number;
  totalAssignments?: number;
  completedAssignments?: number;
  pendingReviews?: number;
  completed?: number;
  pending?: number;
};

declare module 'express-serve-static-core' {
  interface Request {
    authUser?: AuthUser;
  }
}

if (IS_PRODUCTION && AUTH_DISABLED) {
  throw new Error('AUTH_DISABLED=true is not allowed in production');
}

if (IS_PRODUCTION && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong value in production');
}

const allowAllCors = CORS_ALLOW_ALL || (!IS_PRODUCTION && CORS_ORIGINS.length === 0);
const corsOptions: cors.CorsOptions = allowAllCors
  ? { origin: true, credentials: true }
  : { origin: CORS_ORIGINS, credentials: true };
const apiRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => AUTH_DISABLED,
});
const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => AUTH_DISABLED,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' },
});
const submissionRateLimiter = rateLimit({
  windowMs: SUBMISSION_RATE_LIMIT_WINDOW_MS,
  max: SUBMISSION_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.submitterEmail);
    return email || ipKeyGenerator(req.ip);
  },
  message: { error: 'Too many submissions. Please try again later.' },
});

app.disable('x-powered-by');
if (TRUST_PROXY !== undefined) {
  app.set('trust proxy', TRUST_PROXY);
}
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use('/api', apiRateLimiter);
app.use('/api/auth/login', authRateLimiter);

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'up',
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'down',
    });
  }
});

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

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeScoringCriteriaPayload(input: unknown[]): { criteria?: ScoringCriterionPayload[]; error?: string } {
  const criteria: ScoringCriterionPayload[] = [];

  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { error: 'scoringCriteria must be an array of objects' };
    }

    const name = asString((item as { name?: unknown }).name);
    const maxScoreValue = Number((item as { maxScore?: unknown }).maxScore);
    const sortOrderInput = (item as { sortOrder?: unknown }).sortOrder;
    const sortOrderValue = sortOrderInput === undefined ? index : Number(sortOrderInput);

    if (!name) {
      return { error: 'Each scoring criterion must include a name' };
    }
    if (!Number.isInteger(maxScoreValue) || maxScoreValue < 0 || maxScoreValue > 100) {
      return { error: 'Each scoring criterion maxScore must be an integer between 0 and 100' };
    }
    if (!Number.isInteger(sortOrderValue) || sortOrderValue < 0) {
      return { error: 'Each scoring criterion sortOrder must be a non-negative integer' };
    }

    criteria.push({
      name,
      maxScore: maxScoreValue,
      sortOrder: sortOrderValue,
    });
  }

  if (criteria.length > 0) {
    const totalScore = criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0);
    if (totalScore !== 100) {
      return { error: 'Scoring criteria total maxScore must equal 100' };
    }
  }

  return { criteria };
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function sanitizeFileStem(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
}

function isMarkdownFileName(value: string): boolean {
  const ext = path.extname(value).toLowerCase();
  return ext === '.md' || ext === '.markdown';
}

function isPDFFileName(value: string): boolean {
  const ext = path.extname(value).toLowerCase();
  return ext === '.pdf';
}

function isDocumentFileName(value: string): boolean {
  return isMarkdownFileName(value) || isPDFFileName(value);
}

function normalizeDocumentFileName(value: string | undefined): string {
  const fileName = path.basename(value?.trim() || 'README.md');
  const parsed = path.parse(fileName);
  const baseName = sanitizeFileStem(parsed.name) || 'README';
  if (isPDFFileName(fileName)) {
    return `${baseName}.pdf`;
  }
  const extension = isMarkdownFileName(fileName) ? parsed.ext.toLowerCase() : '.md';
  return `${baseName}${extension}`
}

function getHackathonDocsDir(hackathonId: string): string {
  return path.join(HACKATHON_DOCS_ROOT, sanitizePathSegment(hackathonId));
}

async function listHackathonDocumentFiles(hackathonId: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(getHackathonDocsDir(hackathonId), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && isDocumentFileName(entry.name))
      .map((entry) => entry.name);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function compareDocumentFilePriority(fileA: string, fileB: string): number {
  const priority = (fileName: string) => {
    const lower = fileName.toLowerCase();
    // PDF files have lower priority than markdown files
    const isPdfA = isPDFFileName(fileName);
    const isMdA = isMarkdownFileName(fileName);
    if (lower === 'readme.md' || lower === 'readme.markdown') return 0;
    if (lower === 'index.md' || lower === 'index.markdown') return 1;
    if (isMdA) return 2; // Other markdown files
    if (isPdfA) return 3; // PDF files have lowest priority
    return 4;
  };

  return priority(fileA) - priority(fileB) || fileA.localeCompare(fileB);
}

async function readHackathonMarkdownDoc(hackathonId: string) {
  const files = await listHackathonDocumentFiles(hackathonId);
  if (files.length === 0) return null;

  const fileName = [...files].sort(compareDocumentFilePriority)[0];
  const filePath = path.join(getHackathonDocsDir(hackathonId), fileName);
  const stats = await fs.stat(filePath);

  // For PDF files, return base64 encoded content
  if (isPDFFileName(fileName)) {
    const content = await fs.readFile(filePath);
    return {
      fileName,
      content: content.toString('base64'),
      contentType: 'application/pdf',
      updatedAt: stats.mtime.toISOString(),
    };
  }

  // For markdown files, return text content
  const content = await fs.readFile(filePath, 'utf8');
  return {
    fileName,
    content,
    contentType: 'text/markdown',
    updatedAt: stats.mtime.toISOString(),
  };
}

async function saveHackathonMarkdownDoc(hackathonId: string, fileName: string | undefined, content: string, isBase64: boolean = false) {
  const docsDir = getHackathonDocsDir(hackathonId);
  const normalizedFileName = normalizeDocumentFileName(fileName);
  const existingFiles = await listHackathonDocumentFiles(hackathonId);

  await fs.mkdir(docsDir, { recursive: true });
  await Promise.all(
    existingFiles.map((existingFile) => fs.unlink(path.join(docsDir, existingFile)))
  );

  const filePath = path.join(docsDir, normalizedFileName);

  // For PDF files, write base64 decoded content
  if (isBase64 || isPDFFileName(normalizedFileName)) {
    const buffer = Buffer.from(content, 'base64');
    await fs.writeFile(filePath, buffer);
  } else {
    await fs.writeFile(filePath, content, 'utf8');
  }

  const stats = await fs.stat(filePath);
  return {
    fileName: normalizedFileName,
    content,
    updatedAt: stats.mtime.toISOString(),
  };
}

async function deleteHackathonMarkdownDoc(hackathonId: string) {
  const docsDir = getHackathonDocsDir(hackathonId);
  const files = await listHackathonDocumentFiles(hackathonId);
  if (files.length === 0) return false;

  await Promise.all(files.map((fileName) => fs.unlink(path.join(docsDir, fileName))));

  try {
    await fs.rmdir(docsDir);
  } catch {
    // Ignore non-empty or already removed directories.
  }

  return true;
}

function normalizeEmail(value: unknown): string | undefined {
  const raw = asString(value);
  return raw ? raw.toLowerCase() : undefined;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string): boolean {
  return password.length >= 8 && password.length <= 72;
}

function asUserRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'judge') return value;
  return null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }
  return fallback;
}

function generateSubmissionReceiptId(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const suffix = randomBytes(3).toString('hex').toUpperCase();
  return `${SUBMISSION_RECEIPT_PREFIX}-${yyyy}${mm}${dd}-${suffix}`;
}

function interpolateEmailTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => variables[key] || '');
}

function getEmailSettingsCipherKey() {
  return createHash('sha256').update(EMAIL_SETTINGS_SECRET).digest();
}

function encryptEmailSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEmailSettingsCipherKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptEmailSecret(value: string): string | null {
  try {
    const [version, ivBase64, tagBase64, encryptedBase64] = value.split(':');
    if (version !== 'v1' || !ivBase64 || !tagBase64 || !encryptedBase64) return null;

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(tagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', getEmailSettingsCipherKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

function resolveSubmissionEmailPort(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) return fallback;
  return parsed;
}

function resolveSubmissionEmailTimeout(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

async function getSubmissionEmailConfig(): Promise<ResolvedSubmissionEmailConfig> {
  const settings = await prisma.siteSetting.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      ...DEFAULT_SITE_SETTINGS,
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

function getSubmissionEmailTransporter(config: ResolvedSubmissionEmailConfig): nodemailer.Transporter | null {
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

function formatReceiptIssuedAt(issuedAtIso: string): string {
  const date = new Date(issuedAtIso);
  if (Number.isNaN(date.getTime())) return issuedAtIso;
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

async function sendSubmissionReceiptEmail(
  payload: SubmissionReceiptEmailPayload,
  options?: SendSubmissionReceiptEmailOptions
): Promise<SubmissionReceiptEmailResult> {
  const config = await getSubmissionEmailConfig();
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
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const info = await transporter.sendMail(mailOptions);
      return {
        sent: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error(`[submission-email] Failed to send receipt email (attempt ${attempt}/${maxAttempts}):`, error);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  }

  return {
    sent: false,
    reason: 'send_failed',
  };
}

function signTokenForUser(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
      name: user.name,
    },
    JWT_SECRET,
    {
      expiresIn: Number.isFinite(JWT_EXPIRES_IN_SECONDS) ? JWT_EXPIRES_IN_SECONDS : 60 * 60 * 24 * 7,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
}

function resolveHackathonCoverGradient(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_HACKATHON_COVER_GRADIENT;
  const normalized = value.trim();
  return normalized || DEFAULT_HACKATHON_COVER_GRADIENT;
}

function getAuthUserFromRequest(req: express.Request): AuthUser | null {
  if (AUTH_DISABLED) {
    const testRole = asUserRole(req.header('x-test-role')) || 'admin';
    return {
      id: req.header('x-test-user-id') || 'test-user',
      role: testRole,
      email: req.header('x-test-email') || 'test@example.com',
      name: req.header('x-test-name') || 'Test User',
    };
  }

  const authorization = req.header('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;
    const role = asUserRole(decoded.role);
    if (!role || !decoded.sub || !decoded.email || !decoded.name) {
      return null;
    }
    return {
      id: decoded.sub,
      role,
      email: decoded.email,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

async function getValidatedAuthUserFromRequest(req: express.Request): Promise<AuthUser | null> {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return null;
  }

  if (AUTH_DISABLED) {
    return authUser;
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (!dbUser) {
    return null;
  }

  const role = asUserRole(dbUser.role);
  if (!role) {
    return null;
  }

  return {
    id: dbUser.id,
    role,
    email: dbUser.email,
    name: dbUser.name,
  };
}

async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = await getValidatedAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.authUser = authUser;
  next();
}

async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = await getValidatedAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.authUser = authUser;
  next();
}

function normalizeAdminBasePath(value?: string | null) {
  const fallback = '/admin';
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) return fallback;

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const collapsed = withLeadingSlash.replace(/\/+/g, '/');
  const normalized = collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed;

  return normalized === '/' ? fallback : normalized;
}

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

// ===== Activity Logging =====

type ActivityAction =
  | 'create' | 'update' | 'delete'
  | 'submit' | 'assign' | 'unassign'
  | 'score' | 'update_score' | 'complete_review'
  | 'login' | 'logout' | 'invite'
  | 'bulk_reset';

type ActivityEntityType =
  | 'project' | 'assignment' | 'score' | 'hackathon'
  | 'judge' | 'user' | 'session' | 'setting';

type ActivityLogInput = {
  hackathonId?: string;
  actorId?: string;
  actorRole: 'admin' | 'judge' | 'user' | 'system';
  actorName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
};

async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        hackathonId: input.hackathonId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress,
      },
    });
  } catch (error) {
    // Log to console but don't fail the operation if logging fails
    console.error('Failed to log activity:', error);
  }
}

// Helper to get actor info from request
function getActorInfo(req: express.Request): { actorId: string; actorRole: 'admin' | 'judge'; actorName: string } | null {
  const authUser = req.authUser || getAuthUserFromRequest(req);
  if (!authUser) return null;
  return {
    actorId: authUser.id,
    actorRole: authUser.role,
    actorName: authUser.name,
  };
}

type PrismaLikeClient = PrismaClient | Prisma.TransactionClient;
type HackathonWithRelations = Prisma.HackathonGetPayload<{
  include: { scoringCriteria: true }
}>;

function compareHackathonsByPriority(a: HackathonWithRelations, b: HackathonWithRelations): number {
  const aPriority = HACKATHON_STATUS_PRIORITY[a.status] ?? Number.MAX_SAFE_INTEGER;
  const bPriority = HACKATHON_STATUS_PRIORITY[b.status] ?? Number.MAX_SAFE_INTEGER;
  if (aPriority !== bPriority) return aPriority - bPriority;

  const byStartDate = b.startAt.getTime() - a.startAt.getTime();
  if (byStartDate !== 0) return byStartDate;

  return a.id.localeCompare(b.id);
}

async function listHackathonsWithRelations(client: PrismaLikeClient = prisma): Promise<HackathonWithRelations[]> {
  const hackathons = await client.hackathon.findMany({
    include: { scoringCriteria: true },
  });
  return hackathons.sort(compareHackathonsByPriority);
}

async function getCurrentHackathon(client: PrismaLikeClient = prisma): Promise<HackathonWithRelations | null> {
  const hackathons = await listHackathonsWithRelations(client);
  return hackathons[0] || null;
}

async function getScopedHackathonId(input: unknown): Promise<string | undefined> {
  const requested = asString(input);
  if (requested) return requested;
  if (!SINGLE_HACKATHON_MODE) return undefined;

  const current = await getCurrentHackathon();
  return current?.id;
}

const DEFAULT_SITE_SETTINGS = {
  siteName: 'OpenHackathon',
  adminBasePath: normalizeAdminBasePath(process.env.ADMIN_BASE_PATH || process.env.VITE_ADMIN_BASE_PATH || '/admin'),
  tabTitle: 'OpenHackathon',
  seoTitle: 'OpenHackathon',
  seoDescription: 'OpenHackathon - Open source hackathon management platform',
  faviconUrl: '/favicon.svg',
  showPoweredBy: true,
  poweredByText: 'Powered by OpenHackathon',
  poweredByUrl: 'https://openhackathon.dev',
  submissionSuccessHintText: null as string | null,
  submissionSuccessHintImageUrl: null as string | null,
  submissionEmailEnabled: SUBMISSION_EMAIL_ENABLED,
  smtpHost: null as string | null,
  smtpPort: resolveSubmissionEmailPort(SUBMISSION_EMAIL_PORT, 587),
  smtpSecure: SUBMISSION_EMAIL_SECURE,
  smtpUser: null as string | null,
  submissionEmailFrom: SUBMISSION_EMAIL_FROM,
  submissionEmailReplyTo: null as string | null,
  submissionEmailSubject: SUBMISSION_EMAIL_SUBJECT_TEMPLATE,
  submissionEmailTimeoutMs: resolveSubmissionEmailTimeout(SUBMISSION_EMAIL_TIMEOUT_MS, 10000),
} as const;

function serializeSiteSettings(settings: SiteSetting) {
  const { smtpPassEncrypted, ...rest } = settings;
  return {
    ...rest,
    smtpPasswordConfigured: Boolean(smtpPassEncrypted),
  };
}

function serializePublicSiteSettings(settings: SiteSetting) {
  return {
    id: settings.id,
    key: settings.key,
    siteName: settings.siteName,
    adminBasePath: settings.adminBasePath,
    logoUrl: settings.logoUrl,
    tabTitle: settings.tabTitle,
    seoTitle: settings.seoTitle,
    seoDescription: settings.seoDescription,
    faviconUrl: settings.faviconUrl,
    showPoweredBy: settings.showPoweredBy,
    poweredByText: settings.poweredByText,
    poweredByUrl: settings.poweredByUrl,
    submissionSuccessHintText: settings.submissionSuccessHintText,
    submissionSuccessHintImageUrl: settings.submissionSuccessHintImageUrl,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}

// ===== Site Settings =====

app.get('/api/site-settings', async (_req, res) => {
  const settings = await prisma.siteSetting.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      ...DEFAULT_SITE_SETTINGS,
    },
  });
  res.json(serializePublicSiteSettings(settings));
});

app.get('/api/site-settings/admin', requireAdmin, async (_req, res) => {
  const settings = await prisma.siteSetting.upsert({
    where: { key: 'default' },
    update: {},
    create: {
      key: 'default',
      ...DEFAULT_SITE_SETTINGS,
    },
  });
  res.json(serializeSiteSettings(settings));
});

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
  const submissionSuccessHintText =
    typeof body.submissionSuccessHintText === 'string' ? body.submissionSuccessHintText.trim() : undefined;
  const submissionSuccessHintImageUrl =
    typeof body.submissionSuccessHintImageUrl === 'string' ? body.submissionSuccessHintImageUrl.trim() : undefined;
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
    ...(siteName !== undefined ? { siteName: siteName || DEFAULT_SITE_SETTINGS.siteName } : {}),
    ...(adminBasePath !== undefined ? { adminBasePath } : {}),
    ...(tabTitle !== undefined ? { tabTitle: tabTitle || siteName || DEFAULT_SITE_SETTINGS.tabTitle } : {}),
    ...(seoTitle !== undefined ? { seoTitle: seoTitle || siteName || DEFAULT_SITE_SETTINGS.seoTitle } : {}),
    ...(seoDescription !== undefined ? { seoDescription: seoDescription || DEFAULT_SITE_SETTINGS.seoDescription } : {}),
    ...(faviconUrl !== undefined ? { faviconUrl: faviconUrl || DEFAULT_SITE_SETTINGS.faviconUrl } : {}),
    ...(body.logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
    ...(body.showPoweredBy !== undefined && typeof body.showPoweredBy === 'boolean'
      ? { showPoweredBy: body.showPoweredBy }
      : {}),
    ...(poweredByText !== undefined ? { poweredByText: poweredByText || DEFAULT_SITE_SETTINGS.poweredByText } : {}),
    ...(poweredByUrl !== undefined ? { poweredByUrl: poweredByUrl || DEFAULT_SITE_SETTINGS.poweredByUrl } : {}),
    ...(body.submissionSuccessHintText !== undefined
      ? { submissionSuccessHintText: submissionSuccessHintText || null }
      : {}),
    ...(body.submissionSuccessHintImageUrl !== undefined
      ? { submissionSuccessHintImageUrl: submissionSuccessHintImageUrl || null }
      : {}),
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
      ? { submissionEmailFrom: submissionEmailFrom || DEFAULT_SITE_SETTINGS.submissionEmailFrom }
      : {}),
    ...(body.submissionEmailReplyTo !== undefined ? { submissionEmailReplyTo: submissionEmailReplyTo || null } : {}),
    ...(body.submissionEmailSubject !== undefined
      ? { submissionEmailSubject: submissionEmailSubject || DEFAULT_SITE_SETTINGS.submissionEmailSubject }
      : {}),
    ...(submissionEmailTimeoutMs !== undefined ? { submissionEmailTimeoutMs } : {}),
  };
  const createData: Prisma.SiteSettingCreateInput = {
    key: 'default',
    siteName: siteName || DEFAULT_SITE_SETTINGS.siteName,
    adminBasePath: adminBasePath || DEFAULT_SITE_SETTINGS.adminBasePath,
    tabTitle: tabTitle || siteName || DEFAULT_SITE_SETTINGS.tabTitle,
    seoTitle: seoTitle || siteName || DEFAULT_SITE_SETTINGS.seoTitle,
    seoDescription: seoDescription || DEFAULT_SITE_SETTINGS.seoDescription,
    faviconUrl: faviconUrl || DEFAULT_SITE_SETTINGS.faviconUrl,
    showPoweredBy: typeof body.showPoweredBy === 'boolean' ? body.showPoweredBy : DEFAULT_SITE_SETTINGS.showPoweredBy,
    poweredByText: poweredByText || DEFAULT_SITE_SETTINGS.poweredByText,
    poweredByUrl: poweredByUrl || DEFAULT_SITE_SETTINGS.poweredByUrl,
    submissionSuccessHintText:
      body.submissionSuccessHintText !== undefined
        ? (submissionSuccessHintText || null)
        : DEFAULT_SITE_SETTINGS.submissionSuccessHintText,
    submissionSuccessHintImageUrl:
      body.submissionSuccessHintImageUrl !== undefined
        ? (submissionSuccessHintImageUrl || null)
        : DEFAULT_SITE_SETTINGS.submissionSuccessHintImageUrl,
    submissionEmailEnabled:
      typeof body.submissionEmailEnabled === 'boolean'
        ? body.submissionEmailEnabled
        : DEFAULT_SITE_SETTINGS.submissionEmailEnabled,
    smtpHost: body.smtpHost !== undefined ? (smtpHost || null) : DEFAULT_SITE_SETTINGS.smtpHost,
    smtpPort: smtpPort !== undefined ? smtpPort : DEFAULT_SITE_SETTINGS.smtpPort,
    smtpSecure: typeof body.smtpSecure === 'boolean' ? body.smtpSecure : DEFAULT_SITE_SETTINGS.smtpSecure,
    smtpUser: body.smtpUser !== undefined ? (smtpUser || null) : DEFAULT_SITE_SETTINGS.smtpUser,
    ...(smtpPassEncryptedValue !== undefined ? { smtpPassEncrypted: smtpPassEncryptedValue } : {}),
    submissionEmailFrom: submissionEmailFrom || DEFAULT_SITE_SETTINGS.submissionEmailFrom,
    submissionEmailReplyTo:
      body.submissionEmailReplyTo !== undefined
        ? (submissionEmailReplyTo || null)
        : DEFAULT_SITE_SETTINGS.submissionEmailReplyTo,
    submissionEmailSubject: submissionEmailSubject || DEFAULT_SITE_SETTINGS.submissionEmailSubject,
    submissionEmailTimeoutMs:
      submissionEmailTimeoutMs !== undefined
        ? submissionEmailTimeoutMs
        : DEFAULT_SITE_SETTINGS.submissionEmailTimeoutMs,
    ...(body.logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
  };

  const settings = await prisma.siteSetting.upsert({
    where: { key: 'default' },
    update: data,
    create: createData,
  });

  res.json(serializeSiteSettings(settings));
});

app.post('/api/site-settings/email/test', requireAdmin, async (req, res) => {
  const to = normalizeEmail(req.body?.to);
  if (!to || !isValidEmail(to)) {
    return res.status(400).json({ error: 'A valid recipient email is required' });
  }

  const currentHackathon = await getCurrentHackathon();
  const emailResult = await sendSubmissionReceiptEmail({
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
    });
  }

  res.json({
    sent: true,
    messageId: emailResult.messageId,
  });
});

// ===== Hackathons =====

app.get('/api/hackathon', async (_req, res) => {
  const hackathon = await getCurrentHackathon();
  res.json(hackathon);
});

app.get('/api/hackathons', async (_req, res) => {
  const hackathons = await listHackathonsWithRelations();
  if (SINGLE_HACKATHON_MODE) {
    return res.json(hackathons.length > 0 ? [hackathons[0]] : []);
  }
  res.json(hackathons);
});

app.get('/api/hackathons/:id', async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    include: { scoringCriteria: true }
  });
  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }
  res.json(hackathon);
});

app.post('/api/hackathons', requireAdmin, async (req, res) => {
  const {
    title,
    tagline,
    city,
    startAt,
    endAt,
    status,
    coverGradient,
    submissionSchema,
    scoringCriteria,
    prizePool,
    docsUrl,
    judgesPerProject,
  } = req.body;
  const hasScoringCriteriaInput = Array.isArray(scoringCriteria);
  let scoringCriteriaInputs: ScoringCriterionPayload[] = [];
  if (hasScoringCriteriaInput) {
    const normalized = normalizeScoringCriteriaPayload(scoringCriteria as unknown[]);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    scoringCriteriaInputs = normalized.criteria || [];
  }
  if (SINGLE_HACKATHON_MODE) {
    const existingHackathonCount = await prisma.hackathon.count();
    if (existingHackathonCount > 0) {
      return res.status(409).json({
        error: 'Single-hackathon mode is enabled. Update the current hackathon instead of creating a new one.',
      });
    }
  }

  const titleValue = typeof title === 'string' ? title.trim() : '';
  if (!titleValue) {
    return res.status(400).json({ error: 'title is required' });
  }
  const taglineValue = typeof tagline === 'string' ? tagline.trim() : '';
  const statusValue = typeof status === 'string' && status.trim() ? status.trim() : 'draft';
  const coverGradientValue = resolveHackathonCoverGradient(coverGradient);

  const defaultStartAt = new Date();
  const defaultEndAt = new Date(defaultStartAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const hackathonStartAt = startAt ? new Date(startAt) : defaultStartAt;
  const hackathonEndAt = endAt ? new Date(endAt) : defaultEndAt;

  if (Number.isNaN(hackathonStartAt.getTime()) || Number.isNaN(hackathonEndAt.getTime())) {
    return res.status(400).json({ error: 'startAt and endAt must be valid dates' });
  }
  if (hackathonStartAt.getTime() > hackathonEndAt.getTime()) {
    return res.status(400).json({ error: 'startAt must be earlier than or equal to endAt' });
  }

  const hackathon = await prisma.hackathon.create({
    data: {
      title: titleValue,
      tagline: taglineValue,
      city,
      startAt: hackathonStartAt,
      endAt: hackathonEndAt,
      status: statusValue,
      coverGradient: coverGradientValue,
      prizePool: prizePool || null,
      docsUrl: docsUrl || null,
      submissionSchema: submissionSchema || {},
      judgesPerProject: typeof judgesPerProject === 'number' && judgesPerProject > 0 ? judgesPerProject : 2,
      scoringCriteria: hasScoringCriteriaInput ? {
        create: scoringCriteriaInputs.map((c) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder || 0,
        }))
      } : undefined,
    },
    include: { scoringCriteria: true }
  });
  res.json(hackathon);
});

app.put('/api/hackathons/:id', requireAdmin, async (req, res) => {
  const {
    title,
    tagline,
    city,
    startAt,
    endAt,
    status,
    coverGradient,
    submissionSchema,
    scoringCriteria,
    prizePool,
    docsUrl,
    judgesPerProject,
  } = req.body;
  const hasScoringCriteriaInput = Array.isArray(scoringCriteria);
  let scoringCriteriaInputs: ScoringCriterionPayload[] = [];
  if (hasScoringCriteriaInput) {
    const normalized = normalizeScoringCriteriaPayload(scoringCriteria as unknown[]);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }
    scoringCriteriaInputs = normalized.criteria || [];
  }
  if (SINGLE_HACKATHON_MODE) {
    const currentHackathon = await getCurrentHackathon();
    if (currentHackathon && currentHackathon.id !== req.params.id) {
      return res.status(409).json({
        error: 'Single-hackathon mode is enabled. Only the current hackathon can be updated.',
      });
    }
  }
  const existingHackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  });

  if (!existingHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  // Allow status transition (e.g. draft → active), but block all other field edits once active+
  const LOCKED_STATUSES = new Set(['active', 'judging', 'completed']);
  const isLocked = LOCKED_STATUSES.has(existingHackathon.status);
  const isStatusChangeOnly = status && Object.keys(req.body).filter(k => req.body[k] !== undefined).length === 1;

  if (isLocked && !isStatusChangeOnly) {
    return res.status(403).json({ error: 'Cannot update settings after hackathon has started' });
  }

  const nextStartAt = startAt !== undefined ? new Date(startAt) : existingHackathon.startAt;
  const nextEndAt = endAt !== undefined ? new Date(endAt) : existingHackathon.endAt;
  if (Number.isNaN(nextStartAt.getTime()) || Number.isNaN(nextEndAt.getTime())) {
    return res.status(400).json({ error: 'startAt and endAt must be valid dates' });
  }
  if (nextStartAt.getTime() > nextEndAt.getTime()) {
    return res.status(400).json({ error: 'startAt must be earlier than or equal to endAt' });
  }

  // Use a transaction to update hackathon and scoring criteria atomically,
  // then return the result in a single round trip.
  const updated = await prisma.$transaction(async (tx) => {
    await tx.hackathon.update({
      where: { id: req.params.id },
      data: {
        title,
        tagline,
        city,
        startAt: startAt ? new Date(startAt) : undefined,
        endAt: endAt ? new Date(endAt) : undefined,
        status,
        coverGradient: coverGradient !== undefined ? resolveHackathonCoverGradient(coverGradient) : undefined,
        prizePool: prizePool !== undefined ? (prizePool || null) : undefined,
        docsUrl: docsUrl !== undefined ? (docsUrl || null) : undefined,
        submissionSchema: submissionSchema !== undefined ? submissionSchema : undefined,
        judgesPerProject: typeof judgesPerProject === 'number' && judgesPerProject > 0 ? judgesPerProject : undefined,
      },
    });

    if (hasScoringCriteriaInput) {
      await tx.scoringCriterion.deleteMany({ where: { hackathonId: req.params.id } });
      if (scoringCriteriaInputs.length > 0) {
        await tx.scoringCriterion.createMany({
          data: scoringCriteriaInputs.map((c) => ({
            hackathonId: req.params.id,
            name: c.name,
            maxScore: c.maxScore,
            sortOrder: c.sortOrder || 0,
          })),
        });
      }
    }

    return tx.hackathon.findUnique({
      where: { id: req.params.id },
      include: { scoringCriteria: true },
    });
  });

  res.json(updated);
});

app.get('/api/hackathon/markdown-doc', async (_req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const doc = await readHackathonMarkdownDoc(currentHackathon.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(doc);
});

app.put('/api/hackathon/markdown-doc', requireAdmin, async (req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  const fileName = asString(req.body?.fileName);
  const isBase64 = req.body?.isBase64 === true;

  if (!content.trim()) {
    return res.status(400).json({ error: 'Document content is required' });
  }

  try {
    const doc = await saveHackathonMarkdownDoc(currentHackathon.id, fileName, content, isBase64);
    res.json(doc);
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to save document') });
  }
});

app.delete('/api/hackathon/markdown-doc', requireAdmin, async (_req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  try {
    const deleted = await deleteHackathonMarkdownDoc(currentHackathon.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to delete document') });
  }
});

app.get('/api/hackathons/:id/markdown-doc', async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const doc = await readHackathonMarkdownDoc(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(doc);
});

app.put('/api/hackathons/:id/markdown-doc', requireAdmin, async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const content = typeof req.body?.content === 'string' ? req.body.content : '';
  const fileName = asString(req.body?.fileName);
  const isBase64 = req.body?.isBase64 === true;

  if (!content.trim()) {
    return res.status(400).json({ error: 'Document content is required' });
  }

  try {
    const doc = await saveHackathonMarkdownDoc(req.params.id, fileName, content, isBase64);
    res.json(doc);
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to save document') });
  }
});

app.delete('/api/hackathons/:id/markdown-doc', requireAdmin, async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: { id: true },
  });

  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  try {
    const deleted = await deleteHackathonMarkdownDoc(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ error: getErrorMessage(error, 'Failed to delete document') });
  }
});

// ===== Projects =====

app.get('/api/projects', async (req, res) => {
  const { hackathonId, lite, page, pageSize, search } = req.query;
  const hackathonIdValue = await getScopedHackathonId(hackathonId);

  const pageNum = page ? Math.max(1, parseInt(String(page), 10)) : null;
  const pageSizeNum = pageSize ? Math.min(200, Math.max(1, parseInt(String(pageSize), 10))) : null;
  const searchStr = search ? String(search).trim() : null;

  const where = {
    ...(hackathonIdValue ? { hackathonId: hackathonIdValue } : {}),
    ...(searchStr ? {
      OR: [
        { title: { contains: searchStr, mode: 'insensitive' as const } },
        { oneLiner: { contains: searchStr, mode: 'insensitive' as const } },
        { submitterName: { contains: searchStr, mode: 'insensitive' as const } },
        { submitterEmail: { contains: searchStr, mode: 'insensitive' as const } },
        { tags: { has: searchStr } },
      ],
    } : {}),
  };

  // Paginated response
  if (pageNum !== null && pageSizeNum !== null) {
    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip: (pageNum - 1) * pageSizeNum,
        take: pageSizeNum,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          assignments: {
            select: {
              id: true,
              projectId: true,
              judgeId: true,
              status: true,
              totalScore: true,
              judge: { select: { id: true, name: true } },
            }
          },
        },
      }),
    ]);
    return res.json({ data: projects, total, page: pageNum, pageSize: pageSizeNum });
  }

  // Legacy: return plain array (used by AssignmentManager lite=true, leaderboard picker, etc.)
  const projects = await prisma.project.findMany({
    where,
    include: lite ? undefined : {
      user: true,
      assignments: {
        select: {
          id: true,
          projectId: true,
          judgeId: true,
          status: true,
          totalScore: true,
          judge: { select: { id: true, name: true } },
        }
      },
    }
  });
  res.json(projects);
});

app.get('/api/projects/:id', async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      user: true,
      assignments: {
        include: { judge: true, scores: true }
      },
      hackathon: { include: { scoringCriteria: true } },
    }
  });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

app.post('/api/projects', submissionRateLimiter, async (req, res) => {
  const { hackathonId, title, oneLiner, description, tags, demoUrl, repoUrl, submitterEmail, submitterName, submissionData } = req.body;

  const hackathonIdValue = await getScopedHackathonId(hackathonId);
  const submitterEmailValue = normalizeEmail(submitterEmail);
  const submitterNameValue = asString(submitterName);

  if (!hackathonIdValue) {
    return res.status(400).json({ error: 'hackathonId is required' });
  }

  if (!submitterEmailValue) {
    return res.status(400).json({ error: 'submitterEmail is required' });
  }

  if (!isValidEmail(submitterEmailValue)) {
    return res.status(400).json({ error: 'submitterEmail must be a valid email' });
  }

  const relatedHackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonIdValue },
  });

  if (!relatedHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const receipt = {
    id: generateSubmissionReceiptId(),
    email: submitterEmailValue,
    issuedAt: new Date().toISOString(),
  };

  const incomingSubmissionData =
    submissionData && typeof submissionData === 'object' && !Array.isArray(submissionData)
      ? (submissionData as Record<string, unknown>)
      : {};

  const titleValue = asString(title) || `Submission ${receipt.id}`;
  const oneLinerValue = asString(oneLiner) || 'Contact-only submission';
  const descriptionValue = asString(description);
  const demoUrlValue = asString(demoUrl);
  const repoUrlValue = asString(repoUrl);
  const tagsValue = Array.isArray(tags)
    ? tags.filter((tag: unknown): tag is string => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
    : [];

  const project = await prisma.project.create({
    data: {
      hackathonId: hackathonIdValue,
      title: titleValue,
      oneLiner: oneLinerValue,
      description: descriptionValue,
      tags: tagsValue,
      demoUrl: demoUrlValue,
      repoUrl: repoUrlValue,
      submitterEmail: submitterEmailValue,
      submitterName: submitterNameValue,
      status: 'submitted',
      submissionData: ({
        ...incomingSubmissionData,
        _receipt: receipt,
      } as Prisma.InputJsonValue),
    },
    include: {
      hackathon: { include: { scoringCriteria: true } },
    }
  });

  const emailResult = await sendSubmissionReceiptEmail({
    to: submitterEmailValue,
    receiptId: receipt.id,
    hackathonTitle: relatedHackathon.title,
    projectTitle: titleValue,
    issuedAtIso: receipt.issuedAt,
  });

  const receiptWithDelivery = {
    ...receipt,
    emailSent: emailResult.sent,
    emailMessageId: emailResult.messageId,
    emailFailureReason: emailResult.reason,
    emailLastAttemptAt: new Date().toISOString(),
  };

  let projectWithReceipt = project;
  try {
    projectWithReceipt = await prisma.project.update({
      where: { id: project.id },
      data: {
        submissionData: ({
          ...incomingSubmissionData,
          _receipt: receiptWithDelivery,
        } as Prisma.InputJsonValue),
      },
      include: {
        hackathon: { include: { scoringCriteria: true } },
      },
    });
  } catch (error) {
    console.error('[submission-email] Failed to persist receipt delivery status:', error);
  }

  // Log project submission
  await logActivity({
    hackathonId: hackathonIdValue,
    actorRole: 'user',
    actorName: submitterNameValue || submitterEmailValue,
    action: 'submit',
    entityType: 'project',
    entityId: project.id,
    metadata: {
      title: titleValue,
      submitterEmail: submitterEmailValue,
      receiptId: receipt.id,
    },
    ipAddress: req.ip,
  });

  res.json({
    ...projectWithReceipt,
    receipt: receiptWithDelivery,
  });
});

app.put('/api/projects/:id', requireAdmin, async (req, res) => {
  try {
    const { title, oneLiner, description, tags, demoUrl, repoUrl, submissionData, status } = req.body;
    const existingProject = await prisma.project.findUnique({
      where: { id: req.params.id },
      select: { submissionData: true },
    });
    const existingSubmissionData =
      existingProject?.submissionData &&
      typeof existingProject.submissionData === 'object' &&
      !Array.isArray(existingProject.submissionData)
        ? (existingProject.submissionData as Record<string, unknown>)
        : {};
    const existingReceipt =
      existingSubmissionData._receipt &&
      typeof existingSubmissionData._receipt === 'object' &&
      !Array.isArray(existingSubmissionData._receipt)
        ? (existingSubmissionData._receipt as Record<string, unknown>)
        : undefined;
    const incomingSubmissionData =
      submissionData && typeof submissionData === 'object' && !Array.isArray(submissionData)
        ? (submissionData as Record<string, unknown>)
        : {};

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        title,
        oneLiner,
        description,
        tags: tags || [],
        demoUrl,
        repoUrl,
        submissionData: ({
          ...incomingSubmissionData,
          ...(existingReceipt ? { _receipt: existingReceipt } : {}),
        } as Prisma.InputJsonValue),
        status,
      }
    });

    res.json(project);
  } catch {
    res.status(500).json({ error: 'Failed to update project' });
  }
});

app.delete('/api/projects/:id', requireAdmin, async (req, res) => {
  try {
    const projectId = req.params.id;
    // Delete assignments first
    await prisma.assignment.deleteMany({
      where: { projectId }
    });

    await prisma.project.delete({
      where: { id: projectId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

app.post('/api/projects/:id/receipt/resend', requireAdmin, async (req, res) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      hackathon: true,
    },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const existingSubmissionData =
    project.submissionData &&
    typeof project.submissionData === 'object' &&
    !Array.isArray(project.submissionData)
      ? (project.submissionData as Record<string, unknown>)
      : {};
  const existingReceipt =
    existingSubmissionData._receipt &&
    typeof existingSubmissionData._receipt === 'object' &&
    !Array.isArray(existingSubmissionData._receipt)
      ? (existingSubmissionData._receipt as Record<string, unknown>)
      : {};

  const receiptId = asString(existingReceipt.id) || generateSubmissionReceiptId();
  const receiptIssuedAt = asString(existingReceipt.issuedAt) || new Date().toISOString();
  const receiptEmail = project.submitterEmail;

  const emailResult = await sendSubmissionReceiptEmail({
    to: receiptEmail,
    receiptId,
    hackathonTitle: project.hackathon.title,
    projectTitle: project.title,
    issuedAtIso: receiptIssuedAt,
  });

  const receipt = {
    id: receiptId,
    email: receiptEmail,
    issuedAt: receiptIssuedAt,
    emailSent: emailResult.sent,
    emailMessageId: emailResult.messageId,
    emailFailureReason: emailResult.reason,
    emailLastAttemptAt: new Date().toISOString(),
  };

  await prisma.project.update({
    where: { id: project.id },
    data: {
      submissionData: ({
        ...existingSubmissionData,
        _receipt: receipt,
      } as Prisma.InputJsonValue),
    },
  });

  res.json({
    projectId: project.id,
    receipt,
  });
});

// ===== Assignments =====

app.get('/api/assignments', requireAuth, async (req, res) => {
  const { projectId, judgeId, status, hackathonId, lite } = req.query;
  const hackathonIdValue = await getScopedHackathonId(hackathonId);
  const viewer = req.authUser!;
  const effectiveJudgeId = viewer.role === 'judge' ? viewer.id : (judgeId ? String(judgeId) : undefined);
  const assignments = await prisma.assignment.findMany({
    where: {
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(effectiveJudgeId ? { judgeId: effectiveJudgeId } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {}),
    },
    include: lite ? undefined : {
      project: true,
      judge: true,
      scores: true,
    }
  });
  res.json(assignments);
});

app.get('/api/assignments/:id', requireAuth, async (req, res) => {
  const assignment = await prisma.assignment.findUnique({
    where: { id: req.params.id },
    include: {
      project: true,
      judge: true,
      scores: true,
    },
  });
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  res.json(assignment);
});

app.put('/api/assignments/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;

  if (!status || !VALID_ASSIGNMENT_STATUSES.has(String(status))) {
    return res.status(400).json({ error: 'Invalid assignment status' });
  }

  const existing = await prisma.assignment.findUnique({
    where: { id: req.params.id }
  });

  if (!existing) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  const viewer = req.authUser!;
  if (viewer.role !== 'judge' || existing.judgeId !== viewer.id) {
    return res.status(403).json({ error: 'Only the assigned judge can update assignment status' });
  }

  const updated = await prisma.assignment.update({
    where: { id: req.params.id },
    data: { status: String(status) },
    include: {
      project: true,
      judge: true,
      scores: true,
    }
  });

  res.json(updated);
});

app.post('/api/assignments', requireAdmin, async (req, res) => {
  const { assignments } = req.body; // Array of { projectId, judgeId }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: 'Assignments payload must be a non-empty array' });
  }

  try {
    // Parse and validate input shape first (no DB calls)
    const parsed: { judgeId: string; projectId: string }[] = [];
    for (const rawAssignment of assignments) {
      const judgeId = asString(rawAssignment?.judgeId);
      const projectId = asString(rawAssignment?.projectId);
      if (!judgeId) throw new Error('Each assignment must contain judgeId');
      if (!projectId) throw new Error('Each assignment must contain projectId');
      parsed.push({ judgeId, projectId });
    }

    const uniqueJudgeIds = dedupeIds(parsed.map((a) => a.judgeId));
    const uniqueProjectIds = dedupeIds(parsed.map((a) => a.projectId));

    const created = await prisma.$transaction(async (tx) => {
      // Batch-validate judges and projects in two queries instead of N*3
      const [judges, projects] = await Promise.all([
        tx.user.findMany({
          where: { id: { in: uniqueJudgeIds }, role: 'judge' },
          select: { id: true, name: true },
        }),
        tx.project.findMany({
          where: { id: { in: uniqueProjectIds } },
          select: { id: true, hackathonId: true, title: true },
        }),
      ]);

      const judgeMap = new Map(judges.map((j) => [j.id, j]));
      const projectMap = new Map(projects.map((p) => [p.id, p]));

      for (const judgeId of uniqueJudgeIds) {
        if (!judgeMap.has(judgeId)) throw new Error(`Judge ${judgeId} not found`);
      }
      for (const projectId of uniqueProjectIds) {
        if (!projectMap.has(projectId)) throw new Error(`Project ${projectId} not found`);
      }

      // Batch-validate hackathon memberships
      const membershipKeys = new Set<string>();
      for (const { judgeId, projectId } of parsed) {
        const project = projectMap.get(projectId)!;
        membershipKeys.add(`${project.hackathonId}:${judgeId}`);
      }
      const hackathonIds = [...new Set([...membershipKeys].map((k) => k.split(':')[0]))];
      const memberships = await tx.hackathonJudge.findMany({
        where: {
          hackathonId: { in: hackathonIds },
          userId: { in: uniqueJudgeIds },
        },
        select: { hackathonId: true, userId: true },
      });
      const membershipSet = new Set(memberships.map((m) => `${m.hackathonId}:${m.userId}`));

      for (const key of membershipKeys) {
        if (!membershipSet.has(key)) {
          const [, judgeId] = key.split(':');
          throw new Error(`Judge ${judgeId} is not registered for this hackathon`);
        }
      }

      // Upsert assignments (still sequential due to unique constraint handling)
      const rows = [];
      for (const { judgeId, projectId } of parsed) {
        const assignment = await tx.assignment.upsert({
          where: { projectId_judgeId: { projectId, judgeId } },
          update: {},
          create: { projectId, judgeId, status: 'pending' },
          include: { project: true, judge: true, scores: true },
        });
        rows.push(assignment);
      }

      return rows;
    });

    // Log assignment creation
    const actor = getActorInfo(req);
    for (const assignment of created) {
      await logActivity({
        hackathonId: assignment.project.hackathonId,
        actorId: actor?.actorId,
        actorRole: actor?.actorRole ?? 'system',
        actorName: actor?.actorName ?? 'System',
        action: 'assign',
        entityType: 'assignment',
        entityId: assignment.id,
        metadata: {
          projectId: assignment.projectId,
          projectTitle: assignment.project.title,
          judgeId: assignment.judgeId,
          judgeName: assignment.judge.name,
        },
        ipAddress: req.ip,
      });
    }

    res.json(created);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error, 'Failed to create assignments') });
  }
});

// Bulk-delete pending assignments for a hackathon
app.delete('/api/assignments/bulk', requireAdmin, async (req, res) => {
  try {
    const { hackathonId } = req.body;
    if (!hackathonId) {
      return res.status(400).json({ error: 'hackathonId is required' });
    }

    const result = await prisma.assignment.deleteMany({
      where: {
        status: 'pending',
        project: { hackathonId },
      },
    });

    const actor = getActorInfo(req);
    await logActivity({
      hackathonId,
      actorId: actor?.actorId,
      actorRole: actor?.actorRole ?? 'system',
      actorName: actor?.actorName ?? 'System',
      action: 'bulk_reset',
      entityType: 'assignment',
      entityId: hackathonId,
      metadata: { deleted: result.count },
      ipAddress: req.ip,
    });

    res.json({ deleted: result.count });
  } catch {
    res.status(500).json({ error: 'Failed to reset assignments' });
  }
});

app.delete('/api/assignments/:id', requireAdmin, async (req, res) => {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.id },
      include: { scores: { select: { id: true }, take: 1 }, project: true, judge: true },
    });
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const hasScores = assignment.status === 'completed' || assignment.scores.length > 0;
    if (hasScores && req.query.force !== 'true') {
      return res.status(409).json({
        error: 'Assignment already scored',
        code: 'ALREADY_SCORED',
      });
    }

    await prisma.assignment.delete({
      where: { id: req.params.id }
    });

    // Log assignment deletion
    const actor = getActorInfo(req);
    await logActivity({
      hackathonId: assignment.project.hackathonId,
      actorId: actor?.actorId,
      actorRole: actor?.actorRole ?? 'system',
      actorName: actor?.actorName ?? 'System',
      action: 'unassign',
      entityType: 'assignment',
      entityId: req.params.id,
      metadata: {
        projectId: assignment.projectId,
        projectTitle: assignment.project.title,
        judgeId: assignment.judgeId,
        judgeName: assignment.judge.name,
      },
      ipAddress: req.ip,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// ===== Scores =====

app.post('/api/assignments/:id/scores', requireAuth, async (req, res) => {
  const { scores, comment, status } = req.body; // scores: [{ criterionId, score }]
  const assignmentId = req.params.id;

  const existing = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: {
      project: { select: { hackathonId: true } },
    },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  const viewer = req.authUser!;
  if (viewer.role !== 'judge' || existing.judgeId !== viewer.id) {
    return res.status(403).json({ error: 'Only the assigned judge can submit scores' });
  }

  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'Scores payload is required' });
  }
  const parsedScores = scores
    .map((row: unknown): AssignmentScorePayload | null => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const criterionId = asString((row as { criterionId?: unknown }).criterionId);
      const scoreValue = Number((row as { score?: unknown }).score);
      if (!criterionId || !Number.isInteger(scoreValue)) {
        return null;
      }
      return {
        criterionId,
        score: scoreValue,
      };
    })
    .filter((row): row is AssignmentScorePayload => row !== null);
  if (parsedScores.length !== scores.length) {
    return res.status(400).json({ error: 'Scores payload contains invalid entries' });
  }

  const scoringCriteria = await prisma.scoringCriterion.findMany({
    where: { hackathonId: existing.project.hackathonId },
    select: { id: true, maxScore: true },
  });
  if (scoringCriteria.length === 0) {
    return res.status(400).json({ error: 'No scoring criteria configured for this hackathon' });
  }

  const criterionMaxMap = new Map(scoringCriteria.map((criterion) => [criterion.id, criterion.maxScore]));
  const seenCriteria = new Set<string>();

  for (const scoreItem of parsedScores) {
    const criterionMax = criterionMaxMap.get(scoreItem.criterionId);
    if (criterionMax === undefined) {
      return res.status(400).json({ error: `Unknown criterionId: ${scoreItem.criterionId}` });
    }
    if (seenCriteria.has(scoreItem.criterionId)) {
      return res.status(400).json({ error: 'Scores payload contains duplicate criterion entries' });
    }
    if (scoreItem.score < 0 || scoreItem.score > criterionMax) {
      return res.status(400).json({ error: `Score for criterion ${scoreItem.criterionId} must be between 0 and ${criterionMax}` });
    }
    seenCriteria.add(scoreItem.criterionId);
  }

  if (seenCriteria.size !== scoringCriteria.length) {
    return res.status(400).json({ error: 'Scores payload must include every scoring criterion exactly once' });
  }

  const totalScore = parsedScores.reduce((sum, scoreItem) => sum + scoreItem.score, 0);

  // Atomically replace scores and update assignment in a single transaction
  const assignment = await prisma.$transaction(async (tx) => {
    await tx.score.deleteMany({ where: { assignmentId } });
    await tx.score.createMany({
      data: parsedScores.map((scoreItem) => ({
        assignmentId,
        criterionId: scoreItem.criterionId,
        score: scoreItem.score,
      })),
    });
    return tx.assignment.update({
      where: { id: assignmentId },
      data: { status: status || 'completed', comment, totalScore },
      include: { project: true, judge: true, scores: true },
    });
  });

  // Log score submission
  const action = existing.status === 'completed' ? 'update_score' : 'score';
  await logActivity({
    hackathonId: assignment.project.hackathonId,
    actorId: viewer.id,
    actorRole: viewer.role,
    actorName: viewer.name,
    action,
    entityType: 'score',
    entityId: assignmentId,
    metadata: {
      projectId: assignment.projectId,
      projectTitle: assignment.project.title,
      judgeId: assignment.judgeId,
      judgeName: assignment.judge.name,
      totalScore,
      scores: parsedScores,
    },
    ipAddress: req.ip,
  });

  res.json(assignment);
});

// ===== Dashboard Stats =====

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  const { hackathonId, userId, role } = req.query;
  const hackathonIdValue = await getScopedHackathonId(hackathonId);
  const viewer = req.authUser!;
  const effectiveRole = viewer.role === 'judge' ? 'judge' : (role ? String(role) : 'admin');
  const effectiveUserId = viewer.role === 'judge' ? viewer.id : (userId ? String(userId) : undefined);

  const stats: DashboardStats = {};

  if (effectiveRole === 'admin') {
    const hackathonFilter = hackathonIdValue ? { hackathonId: hackathonIdValue } : {};
    const assignmentHackathonFilter = hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {};

    // Run independent COUNT queries in parallel to reduce total latency
    const [totalProjects, totalJudges, totalAssignments, completedAssignments] = await Promise.all([
      prisma.project.count({ where: hackathonFilter }),
      hackathonIdValue
        ? prisma.hackathonJudge.count({ where: { hackathonId: hackathonIdValue } })
        : prisma.user.count({ where: { role: 'judge' } }),
      prisma.assignment.count({ where: assignmentHackathonFilter }),
      prisma.assignment.count({ where: { status: 'completed', ...assignmentHackathonFilter } }),
    ]);

    stats.totalProjects = totalProjects;
    stats.totalJudges = totalJudges;
    stats.totalAssignments = totalAssignments;
    stats.completedAssignments = completedAssignments;
    stats.pendingReviews = totalAssignments - completedAssignments;
  } else if (effectiveRole === 'judge') {
    const baseWhere = {
      judgeId: String(effectiveUserId),
      ...(hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {}),
    };

    // Run independent COUNT queries in parallel
    const [myAssignments, completed, pending] = await Promise.all([
      prisma.assignment.count({ where: baseWhere }),
      prisma.assignment.count({ where: { ...baseWhere, status: 'completed' } }),
      prisma.assignment.count({ where: { ...baseWhere, status: 'pending' } }),
    ]);

    stats.totalAssignments = myAssignments;
    stats.completed = completed;
    stats.pending = pending;
  }

  res.json(stats);
});

// ===== Leaderboard =====

// Get auto-calculated leaderboard (scores-based)
app.get('/api/leaderboard', async (req, res) => {
  const { hackathonId } = req.query;
  const hackathonIdValue = await getScopedHackathonId(hackathonId);

  const hackathon = hackathonIdValue ? await prisma.hackathon.findUnique({
    where: { id: hackathonIdValue },
    select: { leaderboardData: true, leaderboardPublished: true }
  }) : null;

  // Fetch scoring criteria once for maxPossible calculation
  const hackathonFull = hackathonIdValue ? await prisma.hackathon.findUnique({
    where: { id: hackathonIdValue },
    select: { scoringCriteria: true },
  }) : null;
  const maxPossible = hackathonFull?.scoringCriteria?.reduce((sum, c) => sum + c.maxScore, 0) ?? 0;

  // If published, return curated leaderboard
  if (hackathon?.leaderboardPublished && hackathon?.leaderboardData) {
    const entries = hackathon.leaderboardData as { projectId: string; rank: number; award: string }[];
    const projectIds = entries.map(e => e.projectId);
    const projects = await prisma.project.findMany({
      where: { id: { in: projectIds } },
      include: {
        assignments: {
          where: { status: 'completed' },
          select: { totalScore: true },
        },
      },
    });

    type CuratedLeaderboardItem = {
      id: string;
      title: string;
      oneLiner: string;
      tags: string[];
      avgScore: number;
      maxPossible: number;
      judgeCount: number;
      submitterName: string | null;
      submissionData: Record<string, unknown> | null;
      rank: number;
      award: string;
    };

    const projectMap = new Map(projects.map(p => [p.id, p]));
    const result = entries.map((entry): CuratedLeaderboardItem | null => {
      const p = projectMap.get(entry.projectId);
      if (!p) return null;
      const scores = p.assignments.map(a => a.totalScore || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
        avgScore: Math.round(avgScore * 100) / 100, maxPossible,
        judgeCount: scores.length, submitterName: p.submitterName,
        submissionData: (p.submissionData as Record<string, unknown>) || null,
        rank: entry.rank, award: entry.award,
      };
    }).filter((item): item is CuratedLeaderboardItem => item !== null);

    result.sort((a, b) => a.rank - b.rank);
    return res.json(result);
  }

  // Otherwise return scores-based ranking
  const projects = await prisma.project.findMany({
    where: {
      ...(hackathonIdValue ? { hackathonId: hackathonIdValue } : {}),
    },
    include: {
      assignments: {
        where: { status: 'completed' },
        select: { totalScore: true },
      },
    },
  });

  const leaderboard = projects.map(p => {
    const scores = p.assignments.map(a => a.totalScore || 0);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;

    return {
      id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
      avgScore: Math.round(avgScore * 100) / 100, maxPossible,
      judgeCount: scores.length, submitterName: p.submitterName,
      submissionData: (p.submissionData as Record<string, unknown>) || null,
    };
  });

  leaderboard.sort((a, b) => b.avgScore - a.avgScore);
  res.json(leaderboard);
});

app.put('/api/hackathon/leaderboard', requireAdmin, async (req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const { entries, published } = req.body;
  const hackathon = await prisma.hackathon.update({
    where: { id: currentHackathon.id },
    data: {
      leaderboardData: entries,
      leaderboardPublished: published,
    }
  });
  res.json(hackathon);
});

app.get('/api/hackathon/leaderboard', requireAdmin, async (_req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: currentHackathon.id },
    select: { leaderboardData: true, leaderboardPublished: true }
  });
  res.json(hackathon);
});

// Save curated leaderboard
app.put('/api/hackathons/:id/leaderboard', requireAdmin, async (req, res) => {
  const { entries, published } = req.body;
  const hackathon = await prisma.hackathon.update({
    where: { id: req.params.id },
    data: {
      leaderboardData: entries,
      leaderboardPublished: published,
    }
  });
  res.json(hackathon);
});

// Get curated leaderboard data (admin)
app.get('/api/hackathons/:id/leaderboard', requireAdmin, async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    select: { leaderboardData: true, leaderboardPublished: true }
  });
  res.json(hackathon);
});

// ===== Scoring Report =====

app.get('/api/reports/projects', requireAdmin, async (req, res) => {
  const { hackathonId } = req.query;
  const hackathonIdValue = await getScopedHackathonId(hackathonId);

  const projects = await prisma.project.findMany({
    where: {
      ...(hackathonIdValue ? { hackathonId: hackathonIdValue } : {}),
    },
    include: {
      assignments: {
        include: {
          judge: {
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
          },
          scores: true,
        }
      }
    }
  });

  const report = projects.map((project) => {
    const statusCount = { pending: 0, in_progress: 0, completed: 0 };
    let totalCompletedScore = 0;

    for (const assignment of project.assignments) {
      if (assignment.status === 'pending') statusCount.pending += 1;
      if (assignment.status === 'in_progress') statusCount.in_progress += 1;
      if (assignment.status === 'completed') {
        statusCount.completed += 1;
        totalCompletedScore += assignment.totalScore || 0;
      }
    }

    const avgScore = statusCount.completed > 0
      ? Math.round((totalCompletedScore / statusCount.completed) * 100) / 100
      : 0;

    return {
      projectId: project.id,
      projectTitle: project.title,
      submitterName: project.submitterName,
      submitterEmail: project.submitterEmail,
      averageScore: avgScore,
      totalAssignments: project.assignments.length,
      completedAssignments: statusCount.completed,
      pendingAssignments: statusCount.pending,
      inProgressAssignments: statusCount.in_progress,
      judges: project.assignments.map((assignment) => ({
        assignmentId: assignment.id,
        judgeId: assignment.judgeId,
        judgeName: assignment.judge.name,
        judgeEmail: assignment.judge.email,
        status: assignment.status,
        totalScore: assignment.totalScore,
        comment: assignment.comment,
        scores: assignment.scores,
        scoredAt: assignment.updatedAt,
      })),
    };
  });

  report.sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return a.projectTitle.localeCompare(b.projectTitle);
  });

  res.json(report);
});

app.get('/api/reports/scoring', requireAdmin, async (req, res) => {
  const { hackathonId } = req.query;
  const hackathonIdValue = await getScopedHackathonId(hackathonId);

  const assignments = await prisma.assignment.findMany({
    where: {
      status: 'completed',
      ...(hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {}),
    },
    include: {
      project: true,
      judge: true,
      scores: true,
    }
  });

  const report = assignments.map(a => ({
    assignmentId: a.id,
    projectId: a.projectId,
    projectTitle: a.project.title,
    judgeId: a.judgeId,
    judgeName: a.judge.name,
    totalScore: a.totalScore,
    comment: a.comment,
    scores: a.scores,
    createdAt: a.createdAt,
  }));

  res.json(report);
});

// ===== Hackathon Judges =====

app.get('/api/hackathon/judges', requireAdmin, async (_req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const memberships = await prisma.hackathonJudge.findMany({
    where: { hackathonId: currentHackathon.id },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(memberships.map((membership) => membership.user));
});

app.post('/api/hackathon/judges', requireAdmin, async (req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const judgeIds = Array.isArray(req.body?.judgeIds)
    ? req.body.judgeIds.map((id: unknown) => asString(id)).filter(Boolean) as string[]
    : [];
  if (judgeIds.length === 0) {
    return res.status(400).json({ error: 'judgeIds is required' });
  }

  const uniqueJudgeIds = dedupeIds(judgeIds);

  try {
    const users = await prisma.$transaction(async (tx) => {
      const existingUsers = await tx.user.findMany({
        where: {
          id: { in: uniqueJudgeIds },
          role: 'judge',
        },
        select: { id: true },
      });

      if (existingUsers.length !== uniqueJudgeIds.length) {
        throw new Error('Some judge IDs are invalid');
      }

      for (const judgeId of uniqueJudgeIds) {
        await tx.hackathonJudge.upsert({
          where: {
            hackathonId_userId: {
              hackathonId: currentHackathon.id,
              userId: judgeId,
            },
          },
          update: {},
          create: {
            hackathonId: currentHackathon.id,
            userId: judgeId,
          },
        });
      }

      return tx.hackathonJudge.findMany({
        where: { hackathonId: currentHackathon.id },
        include: {
          user: {
            select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    // Log judge registration
    const actor = getActorInfo(req);
    for (const judgeId of uniqueJudgeIds) {
      const judge = users.find((u) => u.userId === judgeId)?.user;
      if (judge) {
        await logActivity({
          hackathonId: currentHackathon.id,
          actorId: actor?.actorId,
          actorRole: actor?.actorRole ?? 'system',
          actorName: actor?.actorName ?? 'System',
          action: 'invite',
          entityType: 'judge',
          entityId: judgeId,
          metadata: {
            judgeName: judge.name,
            judgeEmail: judge.email,
          },
          ipAddress: req.ip,
        });
      }
    }

    res.json(users.map((membership) => membership.user));
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error, 'Failed to register judges') });
  }
});

app.delete('/api/hackathon/judges/:judgeId', requireAdmin, async (req, res) => {
  const currentHackathon = await getCurrentHackathon();
  if (!currentHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const judgeId = req.params.judgeId;
  const existingMembership = await prisma.hackathonJudge.findUnique({
    where: {
      hackathonId_userId: {
        hackathonId: currentHackathon.id,
        userId: judgeId,
      },
    },
  });

  if (!existingMembership) {
    return res.status(404).json({ error: 'Judge is not registered for this hackathon' });
  }

  const blockingAssignments = await prisma.assignment.count({
    where: {
      judgeId,
      project: { hackathonId: currentHackathon.id },
    },
  });

  if (blockingAssignments > 0) {
    return res.status(409).json({
      error: 'Cannot remove judge registration while assignments exist in this hackathon',
      blockingAssignments,
    });
  }

  await prisma.hackathonJudge.delete({
    where: {
      hackathonId_userId: {
        hackathonId: currentHackathon.id,
        userId: judgeId,
      },
    },
  });

  // Log judge removal
  const actor = getActorInfo(req);
  await logActivity({
    hackathonId: currentHackathon.id,
    actorId: actor?.actorId,
    actorRole: actor?.actorRole ?? 'system',
    actorName: actor?.actorName ?? 'System',
    action: 'delete',
    entityType: 'judge',
    entityId: judgeId,
    metadata: {},
    ipAddress: req.ip,
  });

  res.json({ success: true });
});

app.get('/api/hackathons/:id/judges', requireAdmin, async (req, res) => {
  const hackathonId = req.params.id;
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true },
  });
  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const memberships = await prisma.hackathonJudge.findMany({
    where: { hackathonId },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(memberships.map((membership) => membership.user));
});

app.post('/api/hackathons/:id/judges', requireAdmin, async (req, res) => {
  const hackathonId = req.params.id;
  const incomingJudgeIds = Array.isArray(req.body?.judgeIds)
    ? req.body.judgeIds.map((value: unknown) => asString(value)).filter(Boolean) as string[]
    : [];
  const judgeIds = dedupeIds(incomingJudgeIds);

  if (judgeIds.length === 0) {
    return res.status(400).json({ error: 'judgeIds is required' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const hackathon = await tx.hackathon.findUnique({
        where: { id: hackathonId },
        select: { id: true },
      });
      if (!hackathon) {
        throw new Error('Hackathon not found');
      }

      const judges = await tx.user.findMany({
        where: {
          id: { in: judgeIds },
          role: 'judge',
        },
        select: { id: true },
      });
      if (judges.length !== judgeIds.length) {
        throw new Error('Some judges were not found');
      }

      for (const judgeId of judgeIds) {
        await tx.hackathonJudge.upsert({
          where: {
            hackathonId_userId: {
              hackathonId,
              userId: judgeId,
            },
          },
          update: {},
          create: {
            hackathonId,
            userId: judgeId,
          },
        });
      }
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to register judges');
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }

  const memberships = await prisma.hackathonJudge.findMany({
    where: { hackathonId },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json(memberships.map((membership) => membership.user));
});

app.delete('/api/hackathons/:id/judges/:judgeId', requireAdmin, async (req, res) => {
  const hackathonId = req.params.id;
  const judgeId = req.params.judgeId;

  try {
    await prisma.$transaction(async (tx) => {
      const membership = await tx.hackathonJudge.findUnique({
        where: {
          hackathonId_userId: {
            hackathonId,
            userId: judgeId,
          },
        },
      });
      if (!membership) {
        throw new Error('Judge registration not found');
      }

      const blockingAssignment = await tx.assignment.findFirst({
        where: {
          judgeId,
          project: { hackathonId },
        },
        select: {
          id: true,
        },
      });
      if (blockingAssignment) {
        const blockedError = new Error('Cannot remove judge registration while assignments exist in this hackathon') as Error & {
          code?: string;
        };
        blockedError.code = 'JUDGE_REGISTRATION_BLOCKED_BY_ASSIGNMENTS';
        throw blockedError;
      }
      await tx.hackathonJudge.delete({
        where: {
          hackathonId_userId: {
            hackathonId,
            userId: judgeId,
          },
        },
      });
    });
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to remove judge registration');
    const typedError = error as { code?: string } | null;
    if (typedError?.code === 'JUDGE_REGISTRATION_BLOCKED_BY_ASSIGNMENTS') {
      return res.status(400).json({
        error: message,
        code: typedError.code,
      });
    }
    if (message.includes('not found')) {
      return res.status(404).json({ error: message });
    }
    return res.status(400).json({ error: message });
  }

  res.json({ success: true });
});

// ===== Users =====

app.get('/api/users', requireAdmin, async (req, res) => {
  const { role } = req.query;
  const users = await prisma.user.findMany({
    where: role ? { role: String(role) } : {},
    select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
  });
  res.json(users);
});

app.post('/api/users', requireAdmin, async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    const emailValue = normalizeEmail(email);
    const nameValue = asString(name);
    const passwordValue = asString(password);
    const roleValue = role === undefined ? 'judge' : asUserRole(role);

    if (!emailValue || !nameValue || !passwordValue) {
      return res.status(400).json({ error: 'Email, name, and password are required' });
    }
    if (!isValidEmail(emailValue)) {
      return res.status(400).json({ error: 'Email must be a valid email' });
    }
    if (!isValidPassword(passwordValue)) {
      return res.status(400).json({ error: 'Password must be between 8 and 72 characters' });
    }
    if (!roleValue) {
      return res.status(400).json({ error: 'role must be admin or judge' });
    }
    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: emailValue } });
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }
    const hashedPassword = await bcrypt.hash(passwordValue, 10);
    const user = await prisma.user.create({
      data: {
        email: emailValue,
        name: nameValue,
        password: hashedPassword,
        role: roleValue,
      },
      select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
    });
    res.json(user);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  try {
    // Delete all related records in a transaction: scores → assignments → hackathon memberships → user
    await prisma.$transaction(async (tx) => {
      await tx.score.deleteMany({
        where: { assignment: { judgeId: req.params.id } },
      });
      await tx.assignment.deleteMany({
        where: { judgeId: req.params.id },
      });
      await tx.hackathonJudge.deleteMany({
        where: { userId: req.params.id },
      });
      await tx.user.delete({
        where: { id: req.params.id },
      });
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ===== Setup (first-time initialization) =====

/** Check if the system needs initial setup (no admin user exists) */
app.get('/api/setup/status', async (_req, res) => {
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  res.json({ needsSetup: adminCount === 0 });
});

/** First-time setup: create admin account + first hackathon */
app.post('/api/setup', async (req, res) => {
  // Only allow if no admin exists yet
  const adminCount = await prisma.user.count({ where: { role: 'admin' } });
  if (adminCount > 0) {
    return res.status(403).json({ error: 'System is already initialized' });
  }

  const { admin, hackathon } = req.body;
  if (!admin?.email || !admin?.name || !admin?.password) {
    return res.status(400).json({ error: 'Admin email, name, and password are required' });
  }
  if (!hackathon?.title) {
    return res.status(400).json({ error: 'Hackathon title is required' });
  }

  const emailValue = normalizeEmail(admin.email);
  if (!emailValue || !isValidEmail(emailValue)) {
    return res.status(400).json({ error: 'Invalid admin email' });
  }
  if (!isValidPassword(admin.password)) {
    return res.status(400).json({ error: 'Password must be between 8 and 72 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(admin.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const adminUser = await tx.user.create({
        data: {
          email: emailValue,
          name: admin.name,
          password: hashedPassword,
          role: 'admin',
        },
      });

      const newHackathon = await tx.hackathon.create({
        data: {
          title: hackathon.title,
          tagline: hackathon.tagline || '',
          coverGradient: resolveHackathonCoverGradient(hackathon.coverGradient),
          city: hackathon.city || null,
          startAt: hackathon.startAt ? new Date(hackathon.startAt) : new Date(),
          endAt: hackathon.endAt ? new Date(hackathon.endAt) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          status: 'draft',
        },
      });

      return { admin: adminUser, hackathon: newHackathon };
    });

    const authUser: AuthUser = {
      id: result.admin.id,
      role: 'admin',
      email: result.admin.email,
      name: result.admin.name,
    };
    const token = signTokenForUser(authUser);
    const adminWithoutPassword = { ...result.admin } as Record<string, unknown>;
    delete adminWithoutPassword.password;

    res.json({ admin: { ...adminWithoutPassword, token }, hackathon: result.hackathon });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Setup failed' });
  }
});

// ===== System Reset =====

app.post('/api/admin/reset', requireAdmin, async (req, res) => {
  try {
    const { mode, confirm } = req.body;
    if (!confirm) {
      return res.status(400).json({ error: 'Confirmation required. Set confirm: true to proceed.' });
    }
    if (mode !== 'hackathon' && mode !== 'factory') {
      return res.status(400).json({ error: 'Invalid mode. Use "hackathon" or "factory".' });
    }

    const adminUser = req.authUser;
    if (!adminUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (mode === 'hackathon') {
      // Delete hackathon data, keep user accounts
      await prisma.$transaction(async (tx) => {
        await tx.score.deleteMany({});
        await tx.assignment.deleteMany({});
        await tx.hackathonJudge.deleteMany({});
        await tx.project.deleteMany({});
        await tx.scoringCriterion.deleteMany({});
        await tx.activityLog.deleteMany({});
        await tx.hackathon.deleteMany({});
      });

      // Log the reset action
      await prisma.activityLog.create({
        data: {
          action: 'system_reset',
          entityType: 'system',
          entityId: 'system',
          actorId: adminUser.id,
          actorRole: 'admin',
          actorName: adminUser.name || adminUser.email,
          metadata: { mode: 'hackathon' },
        },
      });

      return res.json({ success: true, mode: 'hackathon' });
    }

    // Factory reset — delete everything
    await prisma.$transaction(async (tx) => {
      await tx.score.deleteMany({});
      await tx.assignment.deleteMany({});
      await tx.hackathonJudge.deleteMany({});
      await tx.project.deleteMany({});
      await tx.scoringCriterion.deleteMany({});
      await tx.activityLog.deleteMany({});
      await tx.hackathon.deleteMany({});
      await tx.siteSetting.deleteMany({});
      await tx.user.deleteMany({});
    });

    return res.json({ success: true, mode: 'factory' });
  } catch (error) {
    console.error('System reset error:', error);
    res.status(500).json({ error: 'System reset failed' });
  }
});

// ===== Auth =====

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const emailValue = normalizeEmail(email);
    const passwordValue = asString(password);
    if (!emailValue || !passwordValue) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!isValidEmail(emailValue)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = await prisma.user.findUnique({ where: { email: emailValue } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(passwordValue, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const role = asUserRole(user.role);
    if (!role) {
      return res.status(500).json({ error: 'Invalid user role' });
    }

    const authUser: AuthUser = {
      id: user.id,
      role,
      email: user.email,
      name: user.name,
    };

    const token = signTokenForUser(authUser);

    // Return user without password, plus token for authenticated requests
    const userWithoutPassword = { ...user };
    delete (userWithoutPassword as { password?: string }).password;
    res.json({ ...userWithoutPassword, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// ===== Activity Logs =====

// Get activity logs for current hackathon (admin only)
app.get('/api/hackathon/activity-logs', requireAdmin, async (req, res) => {
  try {
    const hackathonId = await getScopedHackathonId(req.query.hackathonId);
    if (!hackathonId) {
      return res.status(400).json({ error: 'Hackathon ID required' });
    }

    const { limit = '50', offset = '0', action, entityType, actorId } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200);
    const offsetNum = parseInt(offset as string, 10) || 0;

    const where: Prisma.ActivityLogWhereInput = { hackathonId };
    if (action) where.action = action as string;
    if (entityType) where.entityType = entityType as string;
    if (actorId) where.actorId = actorId as string;

    // Include stats on first page to avoid a separate round trip
    const includeStats = offsetNum === 0 && !action && !entityType && !actorId;
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const [logs, total, ...statsResults] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip: offsetNum,
      }),
      prisma.activityLog.count({ where }),
      ...(includeStats ? [
        prisma.activityLog.count({ where: { hackathonId, createdAt: { gte: since } } }),
        prisma.activityLog.groupBy({ by: ['actorRole'], where: { hackathonId }, _count: { actorRole: true } }),
        prisma.activityLog.groupBy({ by: ['entityType'], where: { hackathonId }, _count: { entityType: true } }),
      ] : []),
    ]);

    const result: Record<string, unknown> = { logs, total, limit: limitNum, offset: offsetNum };
    if (includeStats) {
      const [recentActions, byRoleRaw, byEntityRaw] = statsResults;
      result.stats = {
        totalActions: total,
        recentActions: recentActions as number,
        byRole: (byRoleRaw as { actorRole: string; _count: { actorRole: number } }[])
          .reduce((acc: Record<string, number>, r) => ({ ...acc, [r.actorRole]: r._count.actorRole }), {}),
        byEntity: (byEntityRaw as { entityType: string; _count: { entityType: number } }[])
          .reduce((acc: Record<string, number>, e) => ({ ...acc, [e.entityType]: e._count.entityType }), {}),
      };
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get activity logs for specific entity (admin only)
app.get('/api/hackathon/activity-logs/:entityType/:entityId', requireAdmin, async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const hackathonId = await getScopedHackathonId(req.query.hackathonId);

    const where: Prisma.ActivityLogWhereInput = { entityType, entityId };
    if (hackathonId) where.hackathonId = hackathonId;

    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching entity activity logs:', error);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// Get activity stats summary (admin only)
app.get('/api/hackathon/activity-stats', requireAdmin, async (req, res) => {
  try {
    const hackathonId = await getScopedHackathonId(req.query.hackathonId);
    if (!hackathonId) {
      return res.status(400).json({ error: 'Hackathon ID required' });
    }

    const since = new Date();
    since.setDate(since.getDate() - 7); // Last 7 days

    const [totalActions, recentActions, byRole, byEntity] = await Promise.all([
      prisma.activityLog.count({ where: { hackathonId } }),
      prisma.activityLog.count({ where: { hackathonId, createdAt: { gte: since } } }),
      prisma.activityLog.groupBy({
        by: ['actorRole'],
        where: { hackathonId },
        _count: { actorRole: true },
      }),
      prisma.activityLog.groupBy({
        by: ['entityType'],
        where: { hackathonId },
        _count: { entityType: true },
      }),
    ]);

    res.json({
      totalActions,
      recentActions,
      byRole: byRole.reduce((acc, r) => ({ ...acc, [r.actorRole]: r._count.actorRole }), {}),
      byEntity: byEntity.reduce((acc, e) => ({ ...acc, [e.entityType]: e._count.entityType }), {}),
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({ error: 'Failed to fetch activity stats' });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// In production, serve Vite-built static files and SPA fallback
if (IS_PRODUCTION) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[api-error]', error);
  if (res.headersSent) {
    return next(error);
  }
  res.status(500).json({ error: 'Internal server error' });
});
