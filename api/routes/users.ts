import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { asString } from '../config';
import { normalizeEmail, isValidEmail, isValidPassword } from '../utils/validation';
import { asUserRole } from '../utils/validation';
import { logActivity } from '../utils/activity';

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
        return res.status(400).json({ error: 'Password must be 8-72 characters with at least one uppercase letter, one lowercase letter, and one digit' });
      }
      if (!roleValue) {
        return res.status(400).json({ error: 'role must be admin or judge' });
      }
      const existing = await prisma.user.findUnique({ where: { email: emailValue }, select: { id: true } });
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
      // Get user info before deletion for audit log
      const userToDelete = await prisma.user.findUnique({
        where: { id: req.params.id },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!userToDelete) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (req.authUser?.id === userToDelete.id) {
        return res.status(400).json({ error: 'Cannot delete the currently logged-in admin account' });
      }

      if (userToDelete.role === 'admin') {
        const adminCount = await prisma.user.count({ where: { role: 'admin' } });
        if (adminCount <= 1) {
          return res.status(409).json({
            error: 'Cannot delete the last admin account',
            code: 'LAST_ADMIN_PROTECTED',
          });
        }
      }

      const assignmentCount = await prisma.assignment.count({
        where: { judgeId: req.params.id },
      });
      if (assignmentCount > 0) {
        return res.status(409).json({
          error: 'Cannot delete user with existing assignments. Remove or reassign assignments first.',
          code: 'USER_DELETE_BLOCKED_BY_ASSIGNMENTS',
          assignmentCount,
        });
      }

      await prisma.$transaction(async (tx) => {
        await tx.hackathonJudge.deleteMany({
          where: { userId: req.params.id },
        });
        await tx.user.delete({
          where: { id: req.params.id },
        });
      });

      // Audit log for user deletion
      await logActivity(prisma, {
        action: 'delete',
        entityType: 'user',
        entityId: userToDelete.id,
        actorId: req.authUser!.id,
        actorRole: 'admin',
        actorName: req.authUser!.name || req.authUser!.email,
        metadata: {
          deletedUserId: userToDelete.id,
          deletedUserEmail: userToDelete.email,
          deletedUserRole: userToDelete.role,
        },
        ipAddress: req.ip,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });
}
