import type express from 'express';
import jwt from 'jsonwebtoken';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import {
  AUTH_DISABLED,
  ALLOW_TEST_AUTH_HEADER,
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  API_RATE_LIMIT_WINDOW_MS,
  API_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
  SUBMISSION_RATE_LIMIT_WINDOW_MS,
  SUBMISSION_RATE_LIMIT_MAX,
  AI_RATE_LIMIT_WINDOW_MS,
  AI_RATE_LIMIT_MAX,
} from './config';
import type { AuthUser, JwtPayload } from './types';
import { normalizeEmail, asUserRole } from './utils/validation';

export function getAuthUserFromRequest(req: express.Request): AuthUser | null {
  // SECURITY: AUTH_DISABLED alone is no longer enough to accept x-test-* headers.
  // The deployer must also set ALLOW_TEST_AUTH_HEADER=1 (typically only in CI / e2e).
  if (AUTH_DISABLED && ALLOW_TEST_AUTH_HEADER) {
    const testRole = asUserRole(req.header('x-test-role')) || 'admin';
    return {
      id: req.header('x-test-user-id') || 'test-user',
      role: testRole,
      email: req.header('x-test-email') || 'test@example.com',
      name: req.header('x-test-name') || 'Test User',
    };
  }

  if (AUTH_DISABLED && !ALLOW_TEST_AUTH_HEADER) {
    // Log once per request so misuse is visible, but do not return admin.
    // eslint-disable-next-line no-console
    console.warn('[SECURITY] AUTH_DISABLED is set but ALLOW_TEST_AUTH_HEADER is not; ignoring x-test-* headers');
  }

  const authorization = req.header('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;
    const role = asUserRole(decoded.role);
    if (!role || !decoded.sub || !decoded.name) {
      return null;
    }
    return {
      id: decoded.sub,
      role,
      email: decoded.email ?? null,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

function createGetValidatedAuthUser(prisma: PrismaClient) {
  return async function getValidatedAuthUserFromRequest(req: express.Request): Promise<AuthUser | null> {
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
  };
}

export function createAuthMiddleware(prisma: PrismaClient) {
  const getValidatedAuthUserFromRequest = createGetValidatedAuthUser(prisma);

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

  return { requireAuth, requireAdmin, getValidatedAuthUserFromRequest };
}

export const apiRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  max: API_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => AUTH_DISABLED,
});

export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => AUTH_DISABLED,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again later.' },
});

export const submissionRateLimiter = rateLimit({
  windowMs: SUBMISSION_RATE_LIMIT_WINDOW_MS,
  max: SUBMISSION_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  // SECURITY: key off IP first so a user with a missing/empty submitterEmail
  // body still gets rate-limited. Email is a soft second key (allows per-account
  // throttling when present) but must never be the only key.
  keyGenerator: (req) => {
    const ipKey = ipKeyGenerator(req.ip);
    const email = normalizeEmail(req.body?.submitterEmail);
    return email ? `${ipKey}:${email}` : ipKey;
  },
  message: { error: 'Too many submissions. Please try again later.' },
});

// SECURITY: AI endpoints are expensive. Limit each authenticated user to
// AI_RATE_LIMIT_MAX calls per AI_RATE_LIMIT_WINDOW_MS (default 30/min).
// Skip when AUTH_DISABLED (test mode) so the suite isn't throttled.
export const aiRateLimiter = rateLimit({
  windowMs: AI_RATE_LIMIT_WINDOW_MS,
  max: AI_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => AUTH_DISABLED,
  message: { error: 'Too many AI requests. Please slow down.' },
});
