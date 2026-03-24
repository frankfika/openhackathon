import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { asString } from '../config';
import type { AuthUser } from '../types';
import { normalizeEmail, isValidEmail } from '../utils/validation';
import { asUserRole } from '../utils/validation';
import { signTokenForUser } from '../utils/crypto';

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

      const userWithoutPassword = { ...user };
      delete (userWithoutPassword as { password?: string }).password;
      res.json({ ...userWithoutPassword, token });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });
}
