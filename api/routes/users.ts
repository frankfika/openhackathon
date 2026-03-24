import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { asString } from '../config';
import { normalizeEmail, isValidEmail, isValidPassword } from '../utils/validation';
import { asUserRole } from '../utils/validation';

export function registerUserRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
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
}
