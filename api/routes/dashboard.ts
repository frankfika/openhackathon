import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { DashboardStats } from '../types';
import { getScopedHackathonId } from '../utils/hackathon';

export function registerDashboardRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAuth }: { requireAuth: RequestHandler },
) {
  app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
    const { hackathonId, userId, role } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);
    const viewer = req.authUser!;
    const effectiveRole = viewer.role === 'judge' ? 'judge' : (role ? String(role) : 'admin');
    const effectiveUserId = viewer.role === 'judge' ? viewer.id : (userId ? String(userId) : undefined);

    const stats: DashboardStats = {};

    if (effectiveRole === 'admin') {
      const hackathonFilter = hackathonIdValue ? { hackathonId: hackathonIdValue } : {};
      const assignmentHackathonFilter = hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {};

      const [totalProjects, totalJudges, totalAssignments, completedAssignments] = await Promise.all([
        prisma.project.count({ where: hackathonFilter }),
        hackathonIdValue
          ? prisma.hackathonJudge.count({ where: { hackathonId: hackathonIdValue } })
          : prisma.user.count({ where: { role: 'judge' } }),
        prisma.assignment.count({ where: assignmentHackathonFilter }),
        prisma.assignment.count({ where: { status: 'completed', ...assignmentHackathonFilter } }),
      ]);

      stats.totalProjects = totalProjects;
      stats.totalJudges = totalJudges;
      stats.totalAssignments = totalAssignments;
      stats.completedAssignments = completedAssignments;
      stats.pendingReviews = totalAssignments - completedAssignments;
    } else if (effectiveRole === 'judge') {
      const baseWhere = {
        judgeId: String(effectiveUserId),
        ...(hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {}),
      };

      const [myAssignments, completed, pending] = await Promise.all([
        prisma.assignment.count({ where: baseWhere }),
        prisma.assignment.count({ where: { ...baseWhere, status: 'completed' } }),
        prisma.assignment.count({ where: { ...baseWhere, status: 'pending' } }),
      ]);

      stats.totalAssignments = myAssignments;
      stats.completed = completed;
      stats.pending = pending;
    }

    res.json(stats);
  });
}
