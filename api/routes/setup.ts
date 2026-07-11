import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { asString } from '../config';
import type { AuthUser } from '../types';
import { normalizeEmail, isValidEmail, isValidPassword } from '../utils/validation';
import { resolveHackathonCoverGradient } from '../utils/hackathon';
import { signTokenForUser } from '../utils/crypto';
import { USER_PUBLIC_FIELDS } from '../utils/sanitize';

export function registerSetupRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/setup/status', async (_req, res) => {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    res.json({ needsSetup: adminCount === 0 });
  });

  app.post('/api/setup', async (req, res) => {
    const adminCount = await prisma.user.count({ where: { role: 'admin' } });
    if (adminCount > 0) {
      return res.status(403).json({ error: 'System is already initialized' });
    }

    const { admin, hackathon } = req.body;
    const adminNameValue = asString(admin?.name);
    const adminPasswordValue = asString(admin?.password);
    const emailValue = normalizeEmail(admin?.email);
    if (!emailValue || !adminNameValue || !adminPasswordValue) {
      return res.status(400).json({ error: 'Admin email, name, and password are required' });
    }

    const hackathonTitleValue = asString(hackathon?.title);
    const hackathonTaglineValue = asString(hackathon?.tagline);
    const hackathonCityValue = asString(hackathon?.city);
    const startAtValue = asString(hackathon?.startAt);
    const endAtValue = asString(hackathon?.endAt);

    if (!hackathonTitleValue || !hackathonTaglineValue || !startAtValue || !endAtValue) {
      return res.status(400).json({ error: 'Hackathon title, tagline, startAt, and endAt are required' });
    }

    if (!emailValue || !isValidEmail(emailValue)) {
      return res.status(400).json({ error: 'Invalid admin email' });
    }
    if (!isValidPassword(adminPasswordValue)) {
      return res.status(400).json({ error: 'Password must be between 8 and 72 characters' });
    }

    const hackathonStartAt = new Date(startAtValue);
    const hackathonEndAt = new Date(endAtValue);
    if (Number.isNaN(hackathonStartAt.getTime()) || Number.isNaN(hackathonEndAt.getTime())) {
      return res.status(400).json({ error: 'startAt and endAt must be valid dates' });
    }
    if (hackathonStartAt.getTime() > hackathonEndAt.getTime()) {
      return res.status(400).json({ error: 'startAt must be earlier than or equal to endAt' });
    }

    try {
      const existing = await prisma.user.findUnique({ where: { email: emailValue } });
      if (existing) {
        return res.status(409).json({ error: 'A user with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(adminPasswordValue, 10);

      const result = await prisma.$transaction(async (tx) => {
        const adminUser = await tx.user.create({
          data: {
            email: emailValue,
            name: adminNameValue,
            password: hashedPassword,
            role: 'admin',
          },
        });

        const newHackathon = await tx.hackathon.create({
          data: {
            title: hackathonTitleValue,
            tagline: hackathonTaglineValue,
            coverGradient: resolveHackathonCoverGradient(hackathon?.coverGradient),
            city: hackathonCityValue || null,
            startAt: hackathonStartAt,
            endAt: hackathonEndAt,
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

      // Re-fetch via the public-fields whitelist so we never echo a
      // password column.
      const publicAdmin = await prisma.user.findUnique({
        where: { id: result.admin.id },
        select: USER_PUBLIC_FIELDS,
      });

      res.json({
        admin: publicAdmin ? { ...publicAdmin, token } : null,
        hackathon: result.hackathon,
      });
    } catch (error) {
      console.error('Setup error:', error);
      res.status(500).json({ error: 'Setup failed' });
    }
  });
}
