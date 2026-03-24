import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

export function registerHealthRoutes(app: Express, prisma: PrismaClient) {
  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'up',
      });
    } catch {
      res.status(503).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'down',
      });
    }
  });
}
