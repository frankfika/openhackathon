import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { asString } from '../config';
import type { AuthUser } from '../types';
import { normalizeEmail, isValidEmail } from '../utils/validation';
import { asUserRole } from '../utils/validation';
import { signTokenForUser } from '../utils/crypto';
import { USER_PUBLIC_FIELDS } from '../utils/sanitize';

export function registerAuthRoutes(
  app: Express,
  prisma: PrismaClient,
  { authRateLimiter }: { authRateLimiter: RequestHandler },
) {
  app.use('/api/auth/login', authRateLimiter);

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

      const credentialRow = await prisma.user.findUnique({
        where: { email: emailValue },
        select: { ...USER_PUBLIC_FIELDS, password: true },
      });
      if (!credentialRow || !credentialRow.password) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(passwordValue, credentialRow.password);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const role = asUserRole(credentialRow.role);
      if (!role) {
        return res.status(401).json({ error: 'Invalid user role', code: 'ROLE_INVALID' });
      }

      const authUser: AuthUser = {
        id: credentialRow.id,
        role,
        email: credentialRow.email,
        name: credentialRow.name,
      };

      const token = signTokenForUser(authUser);

      // Strip password and return only the public whitelist fields.
      const publicUser = {
        id: credentialRow.id,
        email: credentialRow.email,
        name: credentialRow.name,
        role: credentialRow.role,
        avatarUrl: credentialRow.avatarUrl,
        createdAt: credentialRow.createdAt,
      };
      res.json({ ...publicUser, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
}
