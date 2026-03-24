import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getScopedHackathonId } from '../utils/hackathon';

export function registerActivityLogRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
  app.get('/api/hackathon/activity-logs', requireAdmin, async (req, res) => {
    try {
      const hackathonId = await getScopedHackathonId(prisma, req.query.hackathonId);
      if (!hackathonId) {
        return res.status(400).json({ error: 'Hackathon ID required' });
      }

      const { limit = '50', offset = '0', action, entityType, actorId } = req.query;
      const limitNum = Math.min(parseInt(limit as string, 10) || 50, 200);
      const offsetNum = parseInt(offset as string, 10) || 0;

      const where: Prisma.ActivityLogWhereInput = { hackathonId };
      if (action) where.action = action as string;
      if (entityType) where.entityType = entityType as string;
      if (actorId) where.actorId = actorId as string;

      const includeStats = offsetNum === 0 && !action && !entityType && !actorId;
      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [logs, total, ...statsResults] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limitNum,
          skip: offsetNum,
        }),
        prisma.activityLog.count({ where }),
        ...(includeStats ? [
          prisma.activityLog.count({ where: { hackathonId, createdAt: { gte: since } } }),
          prisma.activityLog.groupBy({ by: ['actorRole'], where: { hackathonId }, _count: { actorRole: true } }),
          prisma.activityLog.groupBy({ by: ['entityType'], where: { hackathonId }, _count: { entityType: true } }),
        ] : []),
      ]);

      const result: Record<string, unknown> = { logs, total, limit: limitNum, offset: offsetNum };
      if (includeStats) {
        const [recentActions, byRoleRaw, byEntityRaw] = statsResults;
        result.stats = {
          totalActions: total,
          recentActions: recentActions as number,
          byRole: (byRoleRaw as { actorRole: string; _count: { actorRole: number } }[])
            .reduce((acc: Record<string, number>, r) => ({ ...acc, [r.actorRole]: r._count.actorRole }), {}),
          byEntity: (byEntityRaw as { entityType: string; _count: { entityType: number } }[])
            .reduce((acc: Record<string, number>, e) => ({ ...acc, [e.entityType]: e._count.entityType }), {}),
        };
      }

      res.json(result);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  app.get('/api/hackathon/activity-logs/:entityType/:entityId', requireAdmin, async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const hackathonId = await getScopedHackathonId(prisma, req.query.hackathonId);

      const where: Prisma.ActivityLogWhereInput = { entityType, entityId };
      if (hackathonId) where.hackathonId = hackathonId;

      const logs = await prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ logs });
    } catch (error) {
      console.error('Error fetching entity activity logs:', error);
      res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
  });

  app.get('/api/hackathon/activity-stats', requireAdmin, async (req, res) => {
    try {
      const hackathonId = await getScopedHackathonId(prisma, req.query.hackathonId);
      if (!hackathonId) {
        return res.status(400).json({ error: 'Hackathon ID required' });
      }

      const since = new Date();
      since.setDate(since.getDate() - 7);

      const [totalActions, recentActions, byRole, byEntity] = await Promise.all([
        prisma.activityLog.count({ where: { hackathonId } }),
        prisma.activityLog.count({ where: { hackathonId, createdAt: { gte: since } } }),
        prisma.activityLog.groupBy({
          by: ['actorRole'],
          where: { hackathonId },
          _count: { actorRole: true },
        }),
        prisma.activityLog.groupBy({
          by: ['entityType'],
          where: { hackathonId },
          _count: { entityType: true },
        }),
      ]);

      res.json({
        totalActions,
        recentActions,
        byRole: byRole.reduce((acc, r) => ({ ...acc, [r.actorRole]: r._count.actorRole }), {}),
        byEntity: byEntity.reduce((acc, e) => ({ ...acc, [e.entityType]: e._count.entityType }), {}),
      });
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      res.status(500).json({ error: 'Failed to fetch activity stats' });
    }
  });
}
