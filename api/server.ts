import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import {
  IS_PRODUCTION,
  AUTH_DISABLED,
  ALLOW_TEST_AUTH_HEADER,
  DEFAULT_JWT_SECRET,
  JWT_SECRET,
  CORS_ALLOW_ALL,
  CORS_ORIGINS,
  JSON_BODY_LIMIT,
  TRUST_PROXY,
  UPLOADS_ROOT,
  SUBMISSION_EMAIL_ENABLED,
  SUBMISSION_EMAIL_FROM,
  SUBMISSION_EMAIL_PORT,
  SUBMISSION_EMAIL_SECURE,
  SUBMISSION_EMAIL_SUBJECT_TEMPLATE,
  SUBMISSION_EMAIL_TIMEOUT_MS,
} from './config';
import { normalizeAdminBasePath } from './utils/validation';
import { resolveSubmissionEmailPort, resolveSubmissionEmailTimeout } from './utils/email';
import { createAuthMiddleware, apiRateLimiter, authRateLimiter, submissionRateLimiter, aiRateLimiter } from './middleware';

// Import route registration functions
import { registerHealthRoutes } from './routes/health';
import { registerAuthRoutes } from './routes/auth';
import { registerWeb3AuthRoutes } from './routes/web3-auth';
import { registerIdentityRoutes } from './routes/identity';
import { registerSetupRoutes } from './routes/setup';
import { registerSiteSettingsRoutes } from './routes/site-settings';
import { registerHackathonRoutes } from './routes/hackathons';
import { registerProjectRoutes } from './routes/projects';
import { registerAssignmentRoutes } from './routes/assignments';
import { registerScoreRoutes } from './routes/scores';
import { registerDashboardRoutes } from './routes/dashboard';
import { registerLeaderboardRoutes } from './routes/leaderboard';
import { registerReportRoutes } from './routes/reports';
import { registerJudgeRoutes } from './routes/judges';
import { registerUserRoutes } from './routes/users';
import { registerActivityLogRoutes } from './routes/activity-logs';
import { registerSystemResetRoutes } from './routes/system-reset';
import { registerAIRoutes } from './routes/ai';

// Import types to ensure Express augmentation is loaded
import './types';

// ===== Initialization =====

export const prisma = new PrismaClient();
export const app = express();

if (IS_PRODUCTION && AUTH_DISABLED) {
  throw new Error('AUTH_DISABLED=true is not allowed in production');
}

if (IS_PRODUCTION && JWT_SECRET === DEFAULT_JWT_SECRET) {
  throw new Error('JWT_SECRET must be set to a strong value in production (generate one with `openssl rand -hex 32`)');
}

// SECURITY: AUTH_DISABLED without ALLOW_TEST_AUTH_HEADER is a configuration mistake.
// In any environment, refuse to start so this is caught at boot, not at first request.
if (AUTH_DISABLED && !ALLOW_TEST_AUTH_HEADER) {
  throw new Error(
    '[SECURITY] AUTH_DISABLED=true requires ALLOW_TEST_AUTH_HEADER=1 (only set this in CI/e2e). ' +
      'Refusing to start with x-test-* trust enabled without explicit opt-in.',
  );
}

// SECURITY: refuse to run with the bundled default JWT secret outside dev —
// even though the prod check above catches NODE_ENV=production, defend in depth.
if (!IS_PRODUCTION && JWT_SECRET === DEFAULT_JWT_SECRET && process.env.NODE_ENV !== 'test') {
  // eslint-disable-next-line no-console
  console.warn('[SECURITY] JWT_SECRET is using the bundled default. Set JWT_SECRET before deploying.');
}

// ===== Default site settings =====

if (IS_PRODUCTION && !process.env.ADMIN_BASE_PATH && !process.env.VITE_ADMIN_BASE_PATH) {
  // eslint-disable-next-line no-console
  console.warn(
    '[SECURITY] adminBasePath is using the default "/admin". ' +
      'Set ADMIN_BASE_PATH to a non-guessable path (e.g. "/portal-x9f2") to reduce brute-force exposure.'
  );
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

// ===== Middleware =====

const { requireAuth, requireAdmin } = createAuthMiddleware(prisma);

// SECURITY: dev no longer defaults to allow-all origins. Operators must set
// CORS_ORIGINS explicitly even in development; the previous default made it
// trivial to ship a staging instance that lets any origin read authenticated
// API responses. Set CORS_ALLOW_ALL=true ONLY for local debugging.
const allowAllCors = CORS_ALLOW_ALL;
if (!IS_PRODUCTION && CORS_ORIGINS.length === 0 && !CORS_ALLOW_ALL) {
  // eslint-disable-next-line no-console
  console.warn('[SECURITY] No CORS_ORIGINS configured. Browser cross-origin requests will be blocked; same-origin via vite proxy still works.');
}
const corsOptions: cors.CorsOptions = allowAllCors
  ? { origin: true, credentials: true }
  : { origin: CORS_ORIGINS, credentials: true };

function isMarkdownDocUploadRequest(req: express.Request): boolean {
  if (req.method !== 'PUT') return false;
  if (req.path === '/api/hackathon/markdown-doc') return true;
  return /^\/api\/hackathons\/[^/]+\/markdown-doc$/.test(req.path);
}

function shouldParseJsonBody(req: express.Request): boolean {
  if (isMarkdownDocUploadRequest(req)) return false;
  const contentTypeHeader = req.headers['content-type'];
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader;
  if (!contentType) return false;
  return /\bapplication\/([a-z0-9.+-]*\+)?json\b/i.test(contentType);
}

app.disable('x-powered-by');
if (TRUST_PROXY !== undefined) {
  app.set('trust proxy', TRUST_PROXY);
}
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // Vite dev injects inline scripts/styles; allow 'unsafe-inline' as a baseline.
      // Tighten further in a follow-up if XSS is still a concern.
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      // Web3 + API + WalletConnect (WSS) connections
      connectSrc: ["'self'", 'https:', 'wss:'],
      // Disallow embedding the app in iframes (clickjacking protection)
      frameAncestors: ["'none'"],
      // Allow form submissions back to the API
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // Force HTTPS for 1 year, including subdomains. Production only.
  strictTransportSecurity: IS_PRODUCTION
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,
  // Disallow MIME-type sniffing
  noSniff: true,
  // Disallow legacy XSS filter (browsers ignore it anyway; explicit is safer)
  xssFilter: true,
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT, type: shouldParseJsonBody }));
app.use('/uploads', express.static(UPLOADS_ROOT, {
  dotfiles: 'deny',
  index: false,
  redirect: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // SECURITY: 1-day cache (was 1 year + immutable). Uploads can be re-uploaded
    // by admins to correct mistakes, so 1 year was too sticky. Operators
    // uploading sensitive material (e.g. an admin screenshot) should use
    // /api/admin/upload with an auth-gated signed-URL flow (TODO SECURITY-P2).
    res.setHeader('Cache-Control', 'public, max-age=86400, must-revalidate');
  },
}));
app.use('/api', apiRateLimiter);

// ===== Routes =====

registerHealthRoutes(app, prisma);
registerAuthRoutes(app, prisma, { authRateLimiter });
registerWeb3AuthRoutes(app, prisma, { authRateLimiter, requireAuth });
registerIdentityRoutes(app, prisma, { requireAuth });
registerSetupRoutes(app, prisma);
registerSiteSettingsRoutes(app, prisma, { requireAdmin, defaultSiteSettings: DEFAULT_SITE_SETTINGS as unknown as Record<string, unknown> });
registerHackathonRoutes(app, prisma, { requireAdmin });
registerProjectRoutes(app, prisma, { requireAdmin, submissionRateLimiter, defaultSiteSettings: DEFAULT_SITE_SETTINGS as unknown as Record<string, unknown> });
registerAssignmentRoutes(app, prisma, { requireAuth, requireAdmin });
registerScoreRoutes(app, prisma, { requireAuth });
registerDashboardRoutes(app, prisma, { requireAuth });
registerLeaderboardRoutes(app, prisma, { requireAdmin });
registerReportRoutes(app, prisma, { requireAdmin });
registerJudgeRoutes(app, prisma, { requireAdmin });
registerUserRoutes(app, prisma, { requireAdmin });
registerActivityLogRoutes(app, prisma, { requireAdmin });
registerSystemResetRoutes(app, prisma, { requireAdmin });

// AI Routes (supports both admin and judge access)
registerAIRoutes(app, prisma, { requireAuth, requireAdmin, aiRateLimiter });

// ===== Catch-all =====

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
