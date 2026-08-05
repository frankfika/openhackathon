import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { logger } from '../logger';

export function registerSystemResetRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
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
        await prisma.$transaction(async (tx) => {
          await tx.score.deleteMany({});
          await tx.assignment.deleteMany({});
          await tx.hackathonJudge.deleteMany({});
          await tx.project.deleteMany({});
          await tx.scoringCriterion.deleteMany({});
          await tx.activityLog.deleteMany({});
          await tx.hackathon.deleteMany({});
        });

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

      // SECURITY: write an audit log AFTER the transaction completes (cannot
      // be in the transaction because we just deleted the activityLog table).
      // The factory reset nukes everything including users, so we use system
      // actor credentials. (P0-5 follow-on: this still leaves a permanent
      // forensic record of the action.)
      try {
        await prisma.$queryRaw`
          INSERT INTO "ActivityLog" (id, "actorId", "actorRole", "actorName", action, "entityType", "entityId", metadata, "createdAt")
          VALUES (gen_random_uuid()::text, ${adminUser.id}, 'admin', ${adminUser.name || adminUser.email}, 'system_reset', 'system', 'system', ${JSON.stringify({ mode: 'factory' })}::jsonb, NOW())
        `;
      } catch (logError) {
        // If the audit insert fails (e.g. table was just dropped) the reset
        // still succeeded, but operators need to know audit is missing.
        logger.error('[SECURITY] factory reset completed but audit log write failed', { err: logError });
      }

      return res.json({ success: true, mode: 'factory' });
    } catch (error) {
      logger.error('System reset error', { err: error });
      res.status(500).json({ error: 'System reset failed' });
    }
  });
}
