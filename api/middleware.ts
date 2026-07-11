import type express from 'express';
import jwt from 'jsonwebtoken';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import {
  AUTH_DISABLED,
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  API_RATE_LIMIT_WINDOW_MS,
  API_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
  AUTH_RATE_LIMIT_MAX,
  SUBMISSION_RATE_LIMIT_WINDOW_MS,
  SUBMISSION_RATE_LIMIT_MAX,
} from './config';
import type { AuthUser, JwtPayload } from './types';
import { normalizeEmail, asUserRole } from './utils/validation';

export type AuthErrorCode =
  | 'TOKEN_MISSING'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'TOKEN_NOT_ACTIVE'
  | 'TOKEN_ALGORITHM_REJECTED'
  | 'TOKEN_PAYLOAD_INVALID'
  | 'ROLE_INVALID';

interface AuthError {
  status: 401 | 403;
  body: { error: string; code: AuthErrorCode };
}

/**
 * Verify a JWT and translate the error into a structured AuthError.
 * Each of the four canonical jsonwebtoken error classes maps to a
 * distinct client-facing code so the front-end interceptor can route
 * them to login / refresh / resend appropriately.
 */
export function verifyJwt(token: string): { payload?: JwtPayload; error?: AuthError } {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JwtPayload;
    return { payload: decoded };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { error: { status: 401, body: { error: 'Token expired', code: 'TOKEN_EXPIRED' } } };
    }
    if (err instanceof jwt.NotBeforeError) {
      return { error: { status: 401, body: { error: 'Token not active', code: 'TOKEN_NOT_ACTIVE' } } };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      // "invalid signature", "jwt malformed", "invalid algorithm", etc.
      const message = err.message.toLowerCase();
      if (message.includes('algorithm')) {
        return { error: { status: 401, body: { error: 'Unsupported algorithm', code: 'TOKEN_ALGORITHM_REJECTED' } } };
      }
      return { error: { status: 401, body: { error: 'Token invalid', code: 'TOKEN_INVALID' } } };
    }
    return { error: { status: 401, body: { error: 'Token invalid', code: 'TOKEN_INVALID' } } };
  }
}

export function getAuthUserFromRequest(req: express.Request): AuthUser | null {
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

  const { payload, error } = verifyJwt(token);
  if (error || !payload) return null;

  const role = asUserRole(payload.role);
  if (!role || !payload.sub || !payload.name) return null;
  return {
    id: payload.sub,
    role,
    email: payload.email ?? null,
    name: payload.name,
  };
}

function createGetValidatedAuthUser(prisma: PrismaClient) {
  return async function getValidatedAuthUserFromRequest(
    req: express.Request,
  ): Promise<{ user: AuthUser | null; error?: AuthError }> {
    if (AUTH_DISABLED) {
      const testRole = asUserRole(req.header('x-test-role')) || 'admin';
      return {
        user: {
          id: req.header('x-test-user-id') || 'test-user',
          role: testRole,
          email: req.header('x-test-email') || 'test@example.com',
          name: req.header('x-test-name') || 'Test User',
        },
      };
    }

    const authorization = req.header('authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return { user: null, error: { status: 401, body: { error: 'Missing token', code: 'TOKEN_MISSING' } } };
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return { user: null, error: { status: 401, body: { error: 'Missing token', code: 'TOKEN_MISSING' } } };
    }
    const { payload, error: jwtError } = verifyJwt(token);
    if (jwtError || !payload) {
      return { user: null, error: jwtError };
    }

    const role = asUserRole(payload.role);
    if (!role || !payload.sub || !payload.name) {
      return { user: null, error: { status: 401, body: { error: 'Token payload invalid', code: 'TOKEN_PAYLOAD_INVALID' } } };
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!dbUser) {
      return { user: null, error: { status: 401, body: { error: 'User not found', code: 'TOKEN_PAYLOAD_INVALID' } } };
    }

    const dbRole = asUserRole(dbUser.role);
    if (!dbRole) {
      return { user: null, error: { status: 401, body: { error: 'Invalid user role', code: 'ROLE_INVALID' } } };
    }

    return {
      user: {
        id: dbUser.id,
        role: dbRole,
        email: dbUser.email,
        name: dbUser.name,
      },
    };
  };
}

export function createAuthMiddleware(prisma: PrismaClient) {
  const getValidatedAuthUserFromRequest = createGetValidatedAuthUser(prisma);

  async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user, error } = await getValidatedAuthUserFromRequest(req);
    if (!user || error) {
      if (error) return res.status(error.status).json(error.body);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.authUser = user;
    next();
  }

  async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
    const { user, error } = await getValidatedAuthUserFromRequest(req);
    if (!user || error) {
      if (error) return res.status(error.status).json(error.body);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.authUser = user;
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
  keyGenerator: (req) => {
    const email = normalizeEmail(req.body?.submitterEmail);
    return email || ipKeyGenerator(req.ip);
  },
  message: { error: 'Too many submissions. Please try again later.' },
});

/**
 * AI generation rate limiter. Defaults to 5 calls per minute per user
 * (5/min — see synth-design-spec §3.2 Endpoint N for the rationale).
 * `keyGenerator` uses the authenticated user id when available so a
 * single admin cannot starve out other admins.
 */
export const aiGenRateLimiter = rateLimit({
  windowMs: Number(process.env.AI_GEN_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.AI_GEN_RATE_LIMIT_MAX) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => AUTH_DISABLED,
  keyGenerator: (req) => {
    const user = (req as { authUser?: { id?: string } }).authUser;
    if (user?.id) return `user:${user.id}`;
    return ipKeyGenerator(req.ip);
  },
  message: { error: 'Too many AI generation requests. Please try again later.', code: 'RATE_LIMITED' },
});
