import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';

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

      return res.json({ success: true, mode: 'factory' });
    } catch (error) {
      console.error('System reset error:', error);
      res.status(500).json({ error: 'System reset failed' });
    }
  });
}
