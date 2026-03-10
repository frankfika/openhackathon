import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

export const prisma = new PrismaClient();
export const app = express();
const VALID_ASSIGNMENT_STATUSES = new Set(['pending', 'in_progress', 'completed']);
const VALID_PROMOTION_STATUSES = new Set(['pending', 'advanced', 'eliminated']);
const VALID_SESSION_TYPES = new Set(['preliminary', 'semi_final', 'final']);
const VALID_SESSION_STATUSES = new Set(['draft', 'active', 'judging', 'completed']);
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

let submissionEmailTransporter: nodemailer.Transporter | null = null;

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

type HackathonSessionPayload = {
  id?: string;
  name: string;
  type: 'preliminary' | 'semi_final' | 'final';
  region?: string;
  status?: 'draft' | 'active' | 'judging' | 'completed';
  startAt: string;
  endAt: string;
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

function getSubmissionEmailTransporter(): nodemailer.Transporter | null {
  if (!SUBMISSION_EMAIL_HOST || !Number.isFinite(SUBMISSION_EMAIL_PORT) || SUBMISSION_EMAIL_PORT <= 0) {
    return null;
  }

  if (submissionEmailTransporter) {
    return submissionEmailTransporter;
  }

  submissionEmailTransporter = nodemailer.createTransport({
    host: SUBMISSION_EMAIL_HOST,
    port: SUBMISSION_EMAIL_PORT,
    secure: SUBMISSION_EMAIL_SECURE,
    auth: SUBMISSION_EMAIL_USER
      ? {
          user: SUBMISSION_EMAIL_USER,
          pass: SUBMISSION_EMAIL_PASS,
        }
      : undefined,
    connectionTimeout: SUBMISSION_EMAIL_TIMEOUT_MS,
    greetingTimeout: SUBMISSION_EMAIL_TIMEOUT_MS,
    socketTimeout: SUBMISSION_EMAIL_TIMEOUT_MS,
  });

  return submissionEmailTransporter;
}

function formatReceiptIssuedAt(issuedAtIso: string): string {
  const date = new Date(issuedAtIso);
  if (Number.isNaN(date.getTime())) return issuedAtIso;
  return date.toISOString().replace('T', ' ').replace('Z', ' UTC');
}

async function sendSubmissionReceiptEmail(payload: SubmissionReceiptEmailPayload): Promise<SubmissionReceiptEmailResult> {
  if (!SUBMISSION_EMAIL_ENABLED) {
    return { sent: false, reason: 'disabled' };
  }

  const transporter = getSubmissionEmailTransporter();
  if (!transporter) {
    console.warn('[submission-email] SMTP is enabled but config is incomplete');
    return { sent: false, reason: 'missing_config' };
  }

  const issuedAtText = formatReceiptIssuedAt(payload.issuedAtIso);
  const subject = interpolateEmailTemplate(SUBMISSION_EMAIL_SUBJECT_TEMPLATE, {
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

  try {
    const info = await transporter.sendMail({
      from: SUBMISSION_EMAIL_FROM,
      to: payload.to,
      ...(SUBMISSION_EMAIL_REPLY_TO ? { replyTo: SUBMISSION_EMAIL_REPLY_TO } : {}),
      subject: subject || `[${payload.hackathonTitle}] Submission Receipt ${payload.receiptId}`,
      text: textBody,
      html: htmlBody,
    });

    return {
      sent: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('[submission-email] Failed to send receipt email:', error);
    return {
      sent: false,
      reason: 'send_failed',
    };
  }
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

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.authUser = authUser;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authUser = getAuthUserFromRequest(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (authUser.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  req.authUser = authUser;
  next();
}

const DEFAULT_SITE_SETTINGS = {
  siteName: 'OpenHackathon',
  tabTitle: 'OpenHackathon',
  seoTitle: 'OpenHackathon',
  seoDescription: 'OpenHackathon - Open source hackathon management platform',
  faviconUrl: '/favicon.svg',
  showPoweredBy: true,
  poweredByText: 'Powered by OpenHackathon',
  poweredByUrl: 'https://openhackathon.dev',
} as const;

async function ensureProjectRound(projectId: string, sessionId: string) {
  return prisma.projectRound.upsert({
    where: {
      projectId_sessionId: {
        projectId,
        sessionId,
      },
    },
    update: {},
    create: {
      projectId,
      sessionId,
      promotionStatus: 'pending',
    },
  });
}

async function applyPromotionDecision(params: {
  projectRoundId: string;
  decision: string;
  nextSessionId?: string;
  note?: string;
  decidedById?: string;
  judgeIds?: string[];
}) {
  const {
    projectRoundId,
    decision,
    nextSessionId,
    note,
    decidedById,
    judgeIds = [],
  } = params;

  if (!VALID_PROMOTION_STATUSES.has(decision)) {
    throw new Error('Invalid promotion decision');
  }

  const round = await prisma.projectRound.findUnique({
    where: { id: projectRoundId },
    include: {
      session: true,
      project: {
        select: {
          id: true,
          hackathonId: true,
        },
      },
    },
  });

  if (!round) {
    throw new Error('Project round not found');
  }

  if (decision === 'advanced' && !nextSessionId) {
    throw new Error('nextSessionId is required when decision is advanced');
  }

  const resolvedJudgeIds = judgeIds.length > 0
    ? judgeIds
    : (await prisma.user.findMany({
      where: { role: 'judge' },
      select: { id: true },
    })).map((judge) => judge.id);

  const updatedRound = await prisma.$transaction(async (tx) => {
    let resolvedNextSessionId: string | null = null;

    if (decision === 'advanced' && nextSessionId) {
      const nextSession = await tx.session.findUnique({
        where: { id: nextSessionId },
        select: { id: true, hackathonId: true },
      });

      if (!nextSession) {
        throw new Error('Next session not found');
      }

      if (nextSession.hackathonId !== round.session.hackathonId) {
        throw new Error('Next session must belong to the same hackathon');
      }

      resolvedNextSessionId = nextSession.id;

      const nextRound = await tx.projectRound.upsert({
        where: {
          projectId_sessionId: {
            projectId: round.projectId,
            sessionId: nextSession.id,
          },
        },
        update: {
          sourceRoundId: round.id,
        },
        create: {
          projectId: round.projectId,
          sessionId: nextSession.id,
          sourceRoundId: round.id,
          promotionStatus: 'pending',
        },
        select: { id: true },
      });

      for (const judgeId of resolvedJudgeIds) {
        await tx.assignment.upsert({
          where: {
            sessionId_projectId_judgeId: {
              sessionId: nextSession.id,
              projectId: round.projectId,
              judgeId,
            },
          },
          update: {
            projectRoundId: nextRound.id,
            isLocked: false,
          },
          create: {
            sessionId: nextSession.id,
            projectId: round.projectId,
            projectRoundId: nextRound.id,
            judgeId,
            status: 'pending',
          },
        });
      }
    }

    await tx.assignment.updateMany({
      where: {
        OR: [
          { projectRoundId: round.id },
          { sessionId: round.sessionId, projectId: round.projectId },
        ],
      },
      data: { isLocked: decision !== 'pending' },
    });

    await tx.projectRound.update({
      where: { id: round.id },
      data: {
        promotionStatus: decision,
        nextSessionId: resolvedNextSessionId,
        decisionNote: note ?? null,
        decidedById: decidedById ?? null,
        decidedAt: new Date(),
      },
    });

    return tx.projectRound.findUnique({
      where: { id: round.id },
      include: {
        project: true,
        session: true,
        nextSession: true,
        sourceRound: {
          include: {
            session: true,
          },
        },
        assignments: {
          include: {
            judge: {
              select: { id: true, name: true, email: true },
            },
            scores: true,
          },
        },
      },
    });
  });

  return updatedRound;
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
  res.json(settings);
});

app.put('/api/site-settings', requireAdmin, async (req, res) => {
  const body = req.body || {};

  const siteName = typeof body.siteName === 'string' ? body.siteName.trim() : undefined;
  const tabTitle = typeof body.tabTitle === 'string' ? body.tabTitle.trim() : undefined;
  const seoTitle = typeof body.seoTitle === 'string' ? body.seoTitle.trim() : undefined;
  const seoDescription = typeof body.seoDescription === 'string' ? body.seoDescription.trim() : undefined;
  const faviconUrl = typeof body.faviconUrl === 'string' ? body.faviconUrl.trim() : undefined;
  const logoUrl = typeof body.logoUrl === 'string' ? body.logoUrl.trim() : undefined;
  const poweredByText = typeof body.poweredByText === 'string' ? body.poweredByText.trim() : undefined;
  const poweredByUrl = typeof body.poweredByUrl === 'string' ? body.poweredByUrl.trim() : undefined;

  const data: Prisma.SiteSettingUpdateInput = {
    ...(siteName !== undefined ? { siteName: siteName || DEFAULT_SITE_SETTINGS.siteName } : {}),
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
  };
  const createData: Prisma.SiteSettingCreateInput = {
    key: 'default',
    siteName: siteName || DEFAULT_SITE_SETTINGS.siteName,
    tabTitle: tabTitle || siteName || DEFAULT_SITE_SETTINGS.tabTitle,
    seoTitle: seoTitle || siteName || DEFAULT_SITE_SETTINGS.seoTitle,
    seoDescription: seoDescription || DEFAULT_SITE_SETTINGS.seoDescription,
    faviconUrl: faviconUrl || DEFAULT_SITE_SETTINGS.faviconUrl,
    showPoweredBy: typeof body.showPoweredBy === 'boolean' ? body.showPoweredBy : DEFAULT_SITE_SETTINGS.showPoweredBy,
    poweredByText: poweredByText || DEFAULT_SITE_SETTINGS.poweredByText,
    poweredByUrl: poweredByUrl || DEFAULT_SITE_SETTINGS.poweredByUrl,
    ...(body.logoUrl !== undefined ? { logoUrl: logoUrl || null } : {}),
  };

  const settings = await prisma.siteSetting.upsert({
    where: { key: 'default' },
    update: data,
    create: createData,
  });

  res.json(settings);
});

// ===== Hackathons =====

app.get('/api/hackathons', async (req, res) => {
  const hackathons = await prisma.hackathon.findMany({
    include: { sessions: true, scoringCriteria: true }
  });
  res.json(hackathons);
});

app.get('/api/hackathons/:id', async (req, res) => {
  const hackathon = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    include: { sessions: true, scoringCriteria: true }
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
    sessions,
    scoringCriteria,
    prizePool,
    gitbookUrl,
    rulesUrl,
    detailsUrl,
  } = req.body;
  const hasSessionsInput = Array.isArray(sessions);
  const sessionInputs: HackathonSessionPayload[] = hasSessionsInput ? sessions as HackathonSessionPayload[] : [];
  const hasScoringCriteriaInput = Array.isArray(scoringCriteria);
  const scoringCriteriaInputs: ScoringCriterionPayload[] = hasScoringCriteriaInput
    ? scoringCriteria as ScoringCriterionPayload[]
    : [];

  const hackathon = await prisma.hackathon.create({
    data: {
      title,
      tagline,
      city,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      status,
      coverGradient,
      prizePool: prizePool || null,
      gitbookUrl: gitbookUrl || null,
      rulesUrl: rulesUrl || null,
      detailsUrl: detailsUrl || null,
      submissionSchema: submissionSchema || {},
      sessions: hasSessionsInput ? {
        create: sessionInputs.map((s) => ({
          name: s.name,
          type: s.type,
          region: s.region || null,
          status: s.status || 'draft',
          startAt: new Date(s.startAt),
          endAt: new Date(s.endAt),
        }))
      } : undefined,
      scoringCriteria: hasScoringCriteriaInput ? {
        create: scoringCriteriaInputs.map((c) => ({
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder || 0,
        }))
      } : undefined,
    },
    include: { sessions: true, scoringCriteria: true }
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
    sessions,
    scoringCriteria,
    prizePool,
    gitbookUrl,
    rulesUrl,
    detailsUrl,
  } = req.body;
  const hasSessionsInput = Array.isArray(sessions);
  const sessionInputs: HackathonSessionPayload[] = hasSessionsInput ? sessions as HackathonSessionPayload[] : [];
  const hasScoringCriteriaInput = Array.isArray(scoringCriteria);
  const scoringCriteriaInputs: ScoringCriterionPayload[] = hasScoringCriteriaInput
    ? scoringCriteria as ScoringCriterionPayload[]
    : [];

  // Update hackathon basic info
  await prisma.hackathon.update({
    where: { id: req.params.id },
    data: {
      title,
      tagline,
      city,
      startAt: startAt ? new Date(startAt) : undefined,
      endAt: endAt ? new Date(endAt) : undefined,
      status,
      coverGradient,
      prizePool: prizePool !== undefined ? (prizePool || null) : undefined,
      gitbookUrl: gitbookUrl !== undefined ? (gitbookUrl || null) : undefined,
      rulesUrl: rulesUrl !== undefined ? (rulesUrl || null) : undefined,
      detailsUrl: detailsUrl !== undefined ? (detailsUrl || null) : undefined,
      submissionSchema: submissionSchema !== undefined ? submissionSchema : undefined,
    }
  });

  // Update scoring criteria if provided
  if (hasScoringCriteriaInput) {
    await prisma.scoringCriterion.deleteMany({ where: { hackathonId: req.params.id } });
    if (scoringCriteriaInputs.length > 0) {
      await prisma.scoringCriterion.createMany({
        data: scoringCriteriaInputs.map((c) => ({
          hackathonId: req.params.id,
          name: c.name,
          maxScore: c.maxScore,
          sortOrder: c.sortOrder || 0,
        }))
      });
    }
  }

  // Update sessions if provided
  if (hasSessionsInput) {
    for (const session of sessionInputs) {
      if (session.id) {
        await prisma.session.update({
          where: { id: session.id },
          data: {
            name: session.name,
            type: session.type,
            region: session.region !== undefined ? (session.region || null) : undefined,
            status: session.status,
            startAt: new Date(session.startAt),
            endAt: new Date(session.endAt),
          }
        });
      } else {
        await prisma.session.create({
          data: {
            hackathonId: req.params.id,
            name: session.name,
            type: session.type,
            region: session.region || null,
            status: session.status || 'draft',
            startAt: new Date(session.startAt),
            endAt: new Date(session.endAt),
          }
        });
      }
    }
  }

  const updated = await prisma.hackathon.findUnique({
    where: { id: req.params.id },
    include: { sessions: true, scoringCriteria: true }
  });
  res.json(updated);
});

// ===== Projects =====

app.get('/api/projects', async (req, res) => {
  const { hackathonId, sessionId } = req.query;
  const sessionIdValue = asString(sessionId);
  const projects = await prisma.project.findMany({
    where: {
      ...(hackathonId ? { hackathonId: String(hackathonId) } : {}),
      ...(sessionIdValue
        ? {
            OR: [
              { sessionId: sessionIdValue },
              { projectRounds: { some: { sessionId: sessionIdValue } } },
            ],
          }
        : {}),
    },
    include: {
      user: true,
      assignments: {
        ...(sessionIdValue ? { where: { sessionId: sessionIdValue } } : {}),
        include: { judge: true, scores: true }
      },
      hackathon: true,
      session: true,
      projectRounds: {
        include: {
          session: true,
          nextSession: true,
        },
        orderBy: { createdAt: 'asc' },
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
        include: { judge: true, scores: true, projectRound: { include: { session: true } } }
      },
      hackathon: { include: { scoringCriteria: true } },
      session: true,
      projectRounds: {
        include: {
          session: true,
          nextSession: true,
          assignments: {
            include: {
              judge: true,
              scores: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    }
  });
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  res.json(project);
});

app.post('/api/projects', submissionRateLimiter, async (req, res) => {
  const { hackathonId, sessionId, title, oneLiner, description, tags, demoUrl, repoUrl, submitterEmail, submitterName, submissionData } = req.body;

  const hackathonIdValue = asString(hackathonId);
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
    include: { sessions: true },
  });

  if (!relatedHackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const requestedSessionId = asString(sessionId);
  const selectedSession = requestedSessionId
    ? relatedHackathon.sessions.find((item) => item.id === requestedSessionId)
    : relatedHackathon.sessions.find((item) => item.status === 'active') || relatedHackathon.sessions[0];

  if (requestedSessionId && !selectedSession) {
    return res.status(400).json({ error: 'sessionId does not belong to the target hackathon' });
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
      sessionId: selectedSession?.id,
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
      session: true,
    }
  });

  if (project.sessionId) {
    await ensureProjectRound(project.id, project.sessionId);
  }

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
        session: true,
      },
    });
  } catch (error) {
    console.error('[submission-email] Failed to persist receipt delivery status:', error);
  }

  res.json({
    ...projectWithReceipt,
    receipt: receiptWithDelivery,
  });
});

app.put('/api/projects/:id', requireAdmin, async (req, res) => {
  try {
    const { title, oneLiner, description, tags, demoUrl, repoUrl, submissionData, status, sessionId } = req.body;
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
        ...(sessionId !== undefined ? { sessionId } : {}),
      }
    });

    if (project.sessionId) {
      await ensureProjectRound(project.id, project.sessionId);
    }

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
  const { sessionId, projectId, judgeId, status, projectRoundId, hackathonId } = req.query;
  const viewer = req.authUser!;
  const effectiveJudgeId = viewer.role === 'judge' ? viewer.id : (judgeId ? String(judgeId) : undefined);
  const assignments = await prisma.assignment.findMany({
    where: {
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(effectiveJudgeId ? { judgeId: effectiveJudgeId } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(projectRoundId ? { projectRoundId: String(projectRoundId) } : {}),
      ...(hackathonId ? { session: { hackathonId: String(hackathonId) } } : {}),
    },
    include: {
      project: true,
      judge: true,
      session: true,
      projectRound: {
        include: {
          session: true,
          nextSession: true,
        },
      },
      scores: true,
    }
  });
  res.json(assignments);
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
  if (viewer.role === 'judge' && existing.judgeId !== viewer.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (existing.isLocked) {
    return res.status(409).json({ error: 'Assignment is locked for a finalized round' });
  }

  const updated = await prisma.assignment.update({
    where: { id: req.params.id },
    data: { status: String(status) },
    include: {
      project: true,
      judge: true,
      session: true,
      projectRound: true,
      scores: true,
    }
  });

  res.json(updated);
});

app.post('/api/assignments', requireAdmin, async (req, res) => {
  const { assignments } = req.body; // Array of { sessionId, projectId, judgeId, projectRoundId? }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ error: 'Assignments payload must be a non-empty array' });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows = [];

      for (const rawAssignment of assignments) {
        const judgeId = asString(rawAssignment?.judgeId);
        const projectRoundId = asString(rawAssignment?.projectRoundId);
        let sessionId = asString(rawAssignment?.sessionId);
        let projectId = asString(rawAssignment?.projectId);

        if (!judgeId) {
          throw new Error('Each assignment must contain judgeId');
        }

        let resolvedRound: { id: string; sessionId: string; projectId: string } | null = null;
        if (projectRoundId) {
          const round = await tx.projectRound.findUnique({
            where: { id: projectRoundId },
            select: { id: true, sessionId: true, projectId: true },
          });
          if (!round) {
            throw new Error(`Project round ${projectRoundId} not found`);
          }
          resolvedRound = round;
          sessionId = round.sessionId;
          projectId = round.projectId;
        }

        if (!sessionId || !projectId) {
          throw new Error('Each assignment must contain sessionId and projectId, or a valid projectRoundId');
        }

        if (!resolvedRound) {
          resolvedRound = await tx.projectRound.upsert({
            where: {
              projectId_sessionId: {
                projectId,
                sessionId,
              },
            },
            update: {},
            create: {
              projectId,
              sessionId,
              promotionStatus: 'pending',
            },
            select: {
              id: true,
              sessionId: true,
              projectId: true,
            },
          });
        }

        const assignment = await tx.assignment.upsert({
          where: {
            sessionId_projectId_judgeId: {
              sessionId,
              projectId,
              judgeId,
            },
          },
          update: {
            projectRoundId: resolvedRound.id,
          },
          create: {
            sessionId,
            projectId,
            projectRoundId: resolvedRound.id,
            judgeId,
            status: 'pending',
          },
          include: {
            project: true,
            judge: true,
            session: true,
            projectRound: true,
            scores: true,
          },
        });
        rows.push(assignment);
      }

      return rows;
    });

    res.json(created);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error, 'Failed to create assignments') });
  }
});

app.delete('/api/assignments/:id', requireAdmin, async (req, res) => {
  try {
    await prisma.assignment.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// ===== Project Rounds & Promotions =====

app.get('/api/project-rounds', requireAdmin, async (req, res) => {
  const { hackathonId, sessionId, projectId, promotionStatus } = req.query;

  const rounds = await prisma.projectRound.findMany({
    where: {
      ...(hackathonId ? { project: { hackathonId: String(hackathonId) } } : {}),
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
      ...(projectId ? { projectId: String(projectId) } : {}),
      ...(promotionStatus ? { promotionStatus: String(promotionStatus) } : {}),
    },
    include: {
      project: true,
      session: true,
      nextSession: true,
      sourceRound: {
        include: {
          session: true,
        },
      },
      assignments: {
        include: {
          judge: {
            select: { id: true, name: true, email: true },
          },
          scores: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'asc' },
    ],
  });

  const assignmentsForRounds = rounds.length > 0
    ? await prisma.assignment.findMany({
      where: {
        OR: rounds.map((round) => ({
          sessionId: round.sessionId,
          projectId: round.projectId,
        })),
      },
      include: {
        judge: {
          select: { id: true, name: true, email: true },
        },
        scores: true,
      },
    })
    : [];

  const assignmentsByRoundKey = new Map<string, typeof assignmentsForRounds>();
  for (const assignment of assignmentsForRounds) {
    const key = `${assignment.sessionId}:${assignment.projectId}`;
    const existing = assignmentsByRoundKey.get(key) || [];
    existing.push(assignment);
    assignmentsByRoundKey.set(key, existing);
  }

  const result = rounds.map((round) => {
    const roundAssignments = assignmentsByRoundKey.get(`${round.sessionId}:${round.projectId}`) || round.assignments;
    const completedAssignments = roundAssignments.filter((assignment) => assignment.status === 'completed');
    const pendingAssignments = roundAssignments.filter((assignment) => assignment.status === 'pending');
    const inProgressAssignments = roundAssignments.filter((assignment) => assignment.status === 'in_progress');
    const totalCompletedScore = completedAssignments.reduce((sum, assignment) => sum + (assignment.totalScore || 0), 0);

    return {
      id: round.id,
      projectId: round.projectId,
      sessionId: round.sessionId,
      promotionStatus: round.promotionStatus,
      nextSessionId: round.nextSessionId,
      decisionNote: round.decisionNote,
      decidedById: round.decidedById,
      decidedAt: round.decidedAt,
      createdAt: round.createdAt,
      updatedAt: round.updatedAt,
      sourceRoundId: round.sourceRoundId,
      sourceSessionId: round.sourceRound?.sessionId || null,
      sourceSessionName: round.sourceRound?.session?.name || null,
      project: round.project,
      session: round.session,
      nextSession: round.nextSession,
      averageScore: completedAssignments.length > 0
        ? Math.round((totalCompletedScore / completedAssignments.length) * 100) / 100
        : 0,
      totalAssignments: roundAssignments.length,
      completedAssignments: completedAssignments.length,
      pendingAssignments: pendingAssignments.length,
      inProgressAssignments: inProgressAssignments.length,
      assignments: roundAssignments,
    };
  });

  res.json(result);
});

app.post('/api/project-rounds/initialize', requireAdmin, async (req, res) => {
  const sessionId = asString(req.body?.sessionId);
  const sourceSessionId = asString(req.body?.sourceSessionId);
  const requestedProjectIds = Array.isArray(req.body?.projectIds)
    ? req.body.projectIds.map((id: unknown) => asString(id)).filter(Boolean) as string[]
    : [];

  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  const targetSession = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, hackathonId: true },
  });

  if (!targetSession) {
    return res.status(404).json({ error: 'Session not found' });
  }

  let projectIds: string[] = [];
  const sourceRoundMap = new Map<string, string>();

  if (requestedProjectIds.length > 0) {
    const projects = await prisma.project.findMany({
      where: {
        id: { in: requestedProjectIds },
        hackathonId: targetSession.hackathonId,
      },
      select: { id: true },
    });
    projectIds = projects.map((project) => project.id);
  } else if (sourceSessionId) {
    const sourceRounds = await prisma.projectRound.findMany({
      where: {
        sessionId: sourceSessionId,
        promotionStatus: 'advanced',
      },
      select: {
        id: true,
        projectId: true,
        nextSessionId: true,
      },
    });

    const filtered = sourceRounds.filter((round) => {
      if (!round.nextSessionId) return true;
      return round.nextSessionId === sessionId;
    });

    projectIds = filtered.map((round) => round.projectId);
    for (const round of filtered) {
      sourceRoundMap.set(round.projectId, round.id);
    }
  } else {
    const projects = await prisma.project.findMany({
      where: {
        hackathonId: targetSession.hackathonId,
        status: 'submitted',
      },
      select: { id: true },
    });
    projectIds = projects.map((project) => project.id);
  }

  const uniqueProjectIds = Array.from(new Set(projectIds));

  const rounds = await prisma.$transaction(async (tx) => {
    const createdRounds = [];
    for (const projectId of uniqueProjectIds) {
      const sourceRoundId = sourceRoundMap.get(projectId) || null;
      const round = await tx.projectRound.upsert({
        where: {
          projectId_sessionId: {
            projectId,
            sessionId,
          },
        },
        update: {
          ...(sourceRoundId ? { sourceRoundId } : {}),
        },
        create: {
          projectId,
          sessionId,
          promotionStatus: 'pending',
          ...(sourceRoundId ? { sourceRoundId } : {}),
        },
      });
      createdRounds.push(round);
    }
    return createdRounds;
  });

  res.json({
    sessionId,
    initializedCount: rounds.length,
    rounds,
  });
});

app.put('/api/project-rounds/:id/promotion', requireAdmin, async (req, res) => {
  const decision = asString(req.body?.decision);

  if (!decision || !VALID_PROMOTION_STATUSES.has(decision)) {
    return res.status(400).json({ error: 'decision must be one of pending, advanced, eliminated' });
  }

  const nextSessionId = asString(req.body?.nextSessionId);
  const note = asString(req.body?.note);
  const decidedById = asString(req.body?.decidedById);
  const judgeIds = Array.isArray(req.body?.judgeIds)
    ? req.body.judgeIds.map((id: unknown) => asString(id)).filter(Boolean) as string[]
    : [];

  try {
    const updatedRound = await applyPromotionDecision({
      projectRoundId: req.params.id,
      decision,
      nextSessionId,
      note,
      decidedById,
      judgeIds,
    });

    res.json(updatedRound);
  } catch (error: unknown) {
    const message = getErrorMessage(error, 'Failed to apply promotion decision');
    if (
      message.includes('Invalid promotion decision')
      || message.includes('required')
      || message.includes('not found')
      || message.includes('same hackathon')
    ) {
      return res.status(400).json({ error: message });
    }
    res.status(500).json({ error: message });
  }
});

app.post('/api/project-rounds/promotions/bulk', requireAdmin, async (req, res) => {
  const decisions = Array.isArray(req.body?.decisions) ? req.body.decisions : [];
  const defaultNextSessionId = asString(req.body?.nextSessionId);
  const defaultDecidedById = asString(req.body?.decidedById);
  const judgeIds = Array.isArray(req.body?.judgeIds)
    ? req.body.judgeIds.map((id: unknown) => asString(id)).filter(Boolean) as string[]
    : [];

  if (decisions.length === 0) {
    return res.status(400).json({ error: 'decisions is required' });
  }

  const results = [];
  for (const item of decisions) {
    const projectRoundId = asString(item?.projectRoundId);
    const decision = asString(item?.decision);

    if (!projectRoundId || !decision) {
      continue;
    }

    const itemNextSessionId = asString(item?.nextSessionId) || defaultNextSessionId;
    const itemNote = asString(item?.note);
    const itemDecidedById = asString(item?.decidedById) || defaultDecidedById;

    try {
      const updatedRound = await applyPromotionDecision({
        projectRoundId,
        decision,
        nextSessionId: itemNextSessionId,
        note: itemNote,
        decidedById: itemDecidedById,
        judgeIds,
      });
      results.push({
        projectRoundId,
        success: true,
        round: updatedRound,
      });
    } catch (error: unknown) {
      results.push({
        projectRoundId,
        success: false,
        error: getErrorMessage(error, 'Failed to apply promotion decision'),
      });
    }
  }

  res.json(results);
});

// ===== Scores =====

app.post('/api/assignments/:id/scores', requireAuth, async (req, res) => {
  const { scores, comment, status } = req.body; // scores: [{ criterionId, score }]
  const assignmentId = req.params.id;

  const existing = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  const viewer = req.authUser!;
  if (viewer.role === 'judge' && existing.judgeId !== viewer.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (existing.isLocked) {
    return res.status(409).json({ error: 'Assignment is locked for a finalized round' });
  }

  if (!Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'Scores payload is required' });
  }
  const parsedScores = scores
    .map((row: unknown): AssignmentScorePayload | null => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
      const criterionId = asString((row as { criterionId?: unknown }).criterionId);
      const scoreValue = Number((row as { score?: unknown }).score);
      if (!criterionId || !Number.isFinite(scoreValue)) {
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

  // Calculate total score
  const totalScore = parsedScores.reduce((sum, scoreItem) => sum + scoreItem.score, 0);

  // Delete existing scores for this assignment
  await prisma.score.deleteMany({
    where: { assignmentId }
  });

  // Create new scores
  await prisma.score.createMany({
    data: parsedScores.map((scoreItem) => ({
      assignmentId,
      criterionId: scoreItem.criterionId,
      score: scoreItem.score,
    }))
  });

  // Update assignment
  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: status || 'completed',
      comment,
      totalScore,
    },
    include: {
      project: true,
      judge: true,
      session: true,
      projectRound: true,
      scores: true,
    }
  });

  res.json(assignment);
});

// ===== Dashboard Stats =====

app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  const { hackathonId, userId, role } = req.query;
  const viewer = req.authUser!;
  const effectiveRole = viewer.role === 'judge' ? 'judge' : (role ? String(role) : 'admin');
  const effectiveUserId = viewer.role === 'judge' ? viewer.id : (userId ? String(userId) : undefined);

  const stats: DashboardStats = {};

  if (effectiveRole === 'admin') {
    const totalProjects = await prisma.project.count({
      where: hackathonId ? { hackathonId: String(hackathonId) } : {}
    });
    const totalJudges = await prisma.user.count({ where: { role: 'judge' } });
    const totalAssignments = await prisma.assignment.count({
      where: hackathonId
        ? { session: { hackathonId: String(hackathonId) } }
        : {}
    });
    const completedAssignments = await prisma.assignment.count({
      where: {
        status: 'completed',
        ...(hackathonId ? { session: { hackathonId: String(hackathonId) } } : {})
      }
    });

    stats.totalProjects = totalProjects;
    stats.totalJudges = totalJudges;
    stats.totalAssignments = totalAssignments;
    stats.completedAssignments = completedAssignments;
    stats.pendingReviews = totalAssignments - completedAssignments;
  } else if (effectiveRole === 'judge') {
    const myAssignments = await prisma.assignment.count({
      where: { judgeId: String(effectiveUserId) }
    });
    const completed = await prisma.assignment.count({
      where: { judgeId: String(effectiveUserId), status: 'completed' }
    });
    const pending = await prisma.assignment.count({
      where: { judgeId: String(effectiveUserId), status: 'pending' }
    });

    stats.totalAssignments = myAssignments;
    stats.completed = completed;
    stats.pending = pending;
  }

  res.json(stats);
});

// ===== Leaderboard =====

// Get auto-calculated leaderboard (scores-based)
app.get('/api/leaderboard', async (req, res) => {
  const { hackathonId, sessionId } = req.query;

  const hackathon = hackathonId ? await prisma.hackathon.findUnique({
    where: { id: String(hackathonId) },
    select: { leaderboardData: true, leaderboardPublished: true }
  }) : null;

  // If published, return curated leaderboard
  if (hackathon?.leaderboardPublished && hackathon?.leaderboardData) {
    const entries = hackathon.leaderboardData as { projectId: string; rank: number; award: string }[];
    const projectIds = entries.map(e => e.projectId);
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        ...(sessionId
          ? {
              OR: [
                { sessionId: String(sessionId) },
                { projectRounds: { some: { sessionId: String(sessionId) } } },
              ],
            }
          : {}),
      },
      include: {
        assignments: {
          where: {
            status: 'completed',
            ...(sessionId ? { sessionId: String(sessionId) } : {}),
          },
          select: { totalScore: true },
        },
        hackathon: { include: { scoringCriteria: true } },
      }
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
      rank: number;
      award: string;
    };

    const result = entries.map((entry): CuratedLeaderboardItem | null => {
      const p = projects.find(p => p.id === entry.projectId);
      if (!p) return null;
      const scores = p.assignments.map(a => a.totalScore || 0);
      const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const maxPossible = p.hackathon.scoringCriteria.reduce((sum, c) => sum + c.maxScore, 0);
      return {
        id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
        avgScore: Math.round(avgScore * 100) / 100, maxPossible,
        judgeCount: scores.length, submitterName: p.submitterName,
        rank: entry.rank, award: entry.award,
      };
    }).filter((item): item is CuratedLeaderboardItem => item !== null);

    result.sort((a, b) => a.rank - b.rank);
    return res.json(result);
  }

  // Otherwise return scores-based ranking
  const projects = await prisma.project.findMany({
    where: {
      ...(hackathonId ? { hackathonId: String(hackathonId) } : {}),
      ...(sessionId
        ? {
            OR: [
              { sessionId: String(sessionId) },
              { projectRounds: { some: { sessionId: String(sessionId) } } },
            ],
          }
        : {}),
    },
    include: {
      assignments: {
        where: {
          status: 'completed',
          ...(sessionId ? { sessionId: String(sessionId) } : {}),
        },
        select: { totalScore: true }
      },
      hackathon: { include: { scoringCriteria: true } },
    }
  });

  const leaderboard = projects.map(p => {
    const scores = p.assignments.map(a => a.totalScore || 0);
    const avgScore = scores.length > 0
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : 0;
    const maxPossible = p.hackathon.scoringCriteria.reduce((sum, c) => sum + c.maxScore, 0);

    return {
      id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
      avgScore: Math.round(avgScore * 100) / 100, maxPossible,
      judgeCount: scores.length, submitterName: p.submitterName,
    };
  });

  leaderboard.sort((a, b) => b.avgScore - a.avgScore);
  res.json(leaderboard);
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

// ===== Session CRUD =====

app.post('/api/hackathons/:hackathonId/sessions', requireAdmin, async (req, res) => {
  const { hackathonId } = req.params;
  const { name, type, region, status, startAt, endAt } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!type || !VALID_SESSION_TYPES.has(type)) {
    return res.status(400).json({ error: 'type must be one of: preliminary, semi_final, final' });
  }
  if (status !== undefined && !VALID_SESSION_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be one of: draft, active, judging, completed' });
  }
  if (!startAt || !endAt) {
    return res.status(400).json({ error: 'startAt and endAt are required' });
  }

  const hackathon = await prisma.hackathon.findUnique({ where: { id: hackathonId }, select: { id: true } });
  if (!hackathon) {
    return res.status(404).json({ error: 'Hackathon not found' });
  }

  const session = await prisma.session.create({
    data: {
      hackathonId,
      name: name.trim(),
      type,
      region: (typeof region === 'string' && region.trim()) ? region.trim() : null,
      status: status || 'draft',
      startAt: new Date(startAt),
      endAt: new Date(endAt),
    },
  });
  res.json(session);
});

app.put('/api/hackathons/:hackathonId/sessions/:sessionId', requireAdmin, async (req, res) => {
  const { hackathonId, sessionId } = req.params;
  const { name, type, region, status, startAt, endAt } = req.body;

  const existing = await prisma.session.findUnique({ where: { id: sessionId }, select: { id: true, hackathonId: true } });
  if (!existing || existing.hackathonId !== hackathonId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (type !== undefined && !VALID_SESSION_TYPES.has(type)) {
    return res.status(400).json({ error: 'type must be one of: preliminary, semi_final, final' });
  }
  if (status !== undefined && !VALID_SESSION_STATUSES.has(status)) {
    return res.status(400).json({ error: 'status must be one of: draft, active, judging, completed' });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = String(name).trim();
  if (type !== undefined) updateData.type = type;
  if (region !== undefined) updateData.region = (typeof region === 'string' && region.trim()) ? region.trim() : null;
  if (status !== undefined) updateData.status = status;
  if (startAt !== undefined) updateData.startAt = new Date(startAt);
  if (endAt !== undefined) updateData.endAt = new Date(endAt);

  const session = await prisma.session.update({ where: { id: sessionId }, data: updateData });
  res.json(session);
});

app.delete('/api/hackathons/:hackathonId/sessions/:sessionId', requireAdmin, async (req, res) => {
  const { hackathonId, sessionId } = req.params;

  const existing = await prisma.session.findUnique({ where: { id: sessionId }, select: { id: true, hackathonId: true } });
  if (!existing || existing.hackathonId !== hackathonId) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const [projectCount, assignmentCount, projectRoundCount] = await Promise.all([
    prisma.project.count({ where: { sessionId } }),
    prisma.assignment.count({ where: { sessionId } }),
    prisma.projectRound.count({ where: { sessionId } }),
  ]);

  if (projectCount > 0 || assignmentCount > 0 || projectRoundCount > 0) {
    return res.status(409).json({
      error: 'Cannot delete session with existing projects, assignments, or project rounds',
      details: { projectCount, assignmentCount, projectRoundCount },
    });
  }

  await prisma.session.delete({ where: { id: sessionId } });
  res.json({ success: true });
});

// ===== Scoring Report =====

app.get('/api/reports/projects', requireAdmin, async (req, res) => {
  const { hackathonId, sessionId } = req.query;

  const rounds = await prisma.projectRound.findMany({
    where: {
      ...(hackathonId ? { project: { hackathonId: String(hackathonId) } } : {}),
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
    },
    include: {
      project: true,
      session: true,
      nextSession: true,
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

  const assignmentsForRounds = rounds.length > 0
    ? await prisma.assignment.findMany({
      where: {
        OR: rounds.map((round) => ({
          sessionId: round.sessionId,
          projectId: round.projectId,
        })),
      },
      include: {
        judge: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
        scores: true,
      },
    })
    : [];

  const assignmentsByRoundKey = new Map<string, typeof assignmentsForRounds>();
  for (const assignment of assignmentsForRounds) {
    const key = `${assignment.sessionId}:${assignment.projectId}`;
    const existing = assignmentsByRoundKey.get(key) || [];
    existing.push(assignment);
    assignmentsByRoundKey.set(key, existing);
  }

  let report = rounds.map((round) => {
    const roundAssignments = assignmentsByRoundKey.get(`${round.sessionId}:${round.projectId}`) || round.assignments;
    const statusCount = { pending: 0, in_progress: 0, completed: 0 };
    let totalCompletedScore = 0;

    for (const assignment of roundAssignments) {
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
      projectRoundId: round.id,
      projectId: round.projectId,
      projectTitle: round.project.title,
      submitterName: round.project.submitterName,
      submitterEmail: round.project.submitterEmail,
      sessionId: round.sessionId,
      sessionName: round.session?.name || null,
      promotionStatus: round.promotionStatus,
      nextSessionId: round.nextSessionId,
      nextSessionName: round.nextSession?.name || null,
      averageScore: avgScore,
      totalAssignments: roundAssignments.length,
      completedAssignments: statusCount.completed,
      pendingAssignments: statusCount.pending,
      inProgressAssignments: statusCount.in_progress,
      judges: roundAssignments.map((assignment) => ({
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

  // Backward-compatible fallback for legacy data without projectRound rows.
  if (report.length === 0) {
    const projects = await prisma.project.findMany({
      where: {
        ...(hackathonId ? { hackathonId: String(hackathonId) } : {}),
        ...(sessionId ? { sessionId: String(sessionId) } : {}),
      },
      include: {
        session: true,
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

    report = projects.map((project) => {
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
        projectRoundId: null,
        projectId: project.id,
        projectTitle: project.title,
        submitterName: project.submitterName,
        submitterEmail: project.submitterEmail,
        sessionId: project.sessionId,
        sessionName: project.session?.name || null,
        promotionStatus: 'pending',
        nextSessionId: null,
        nextSessionName: null,
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
  }

  report.sort((a, b) => {
    if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
    return a.projectTitle.localeCompare(b.projectTitle);
  });

  res.json(report);
});

app.get('/api/reports/scoring', requireAdmin, async (req, res) => {
  const { hackathonId, sessionId } = req.query;

  const assignments = await prisma.assignment.findMany({
    where: {
      status: 'completed',
      ...(hackathonId ? { session: { hackathonId: String(hackathonId) } } : {}),
      ...(sessionId ? { sessionId: String(sessionId) } : {}),
    },
    include: {
      project: true,
      judge: true,
      scores: true,
      session: true,
      projectRound: true,
    }
  });

  const report = assignments.map(a => ({
    assignmentId: a.id,
    projectId: a.projectId,
    projectRoundId: a.projectRoundId,
    projectTitle: a.project.title,
    judgeId: a.judgeId,
    judgeName: a.judge.name,
    sessionName: a.session.name,
    totalScore: a.totalScore,
    comment: a.comment,
    scores: a.scores,
    createdAt: a.createdAt,
  }));

  res.json(report);
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
    const hashedPassword = bcrypt.hashSync(passwordValue, 10);
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
    // Delete scores, then assignments, then user
    await prisma.score.deleteMany({
      where: { assignment: { judgeId: req.params.id } }
    });
    await prisma.assignment.deleteMany({
      where: { judgeId: req.params.id }
    });
    await prisma.user.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
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

    const valid = bcrypt.compareSync(passwordValue, user.password);
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
