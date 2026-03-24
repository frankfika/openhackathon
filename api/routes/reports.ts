import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getScopedHackathonId } from '../utils/hackathon';

export function registerReportRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
  app.get('/api/reports/projects', requireAdmin, async (req, res) => {
    const { hackathonId } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);

    const projects = await prisma.project.findMany({
      where: {
        ...(hackathonIdValue ? { hackathonId: hackathonIdValue } : {}),
      },
      include: {
        assignments: {
          include: {
            judge: {
              select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true }
            },
            scores: true,
          }
        }
      }
    });

    const report = projects.map((project) => {
      const statusCount = { pending: 0, in_progress: 0, completed: 0 };
      let totalCompletedScore = 0;

      for (const assignment of project.assignments) {
        if (assignment.status === 'pending') statusCount.pending += 1;
        if (assignment.status === 'in_progress') statusCount.in_progress += 1;
        if (assignment.status === 'completed') {
          statusCount.completed += 1;
          totalCompletedScore += assignment.totalScore || 0;
        }
      }

      const avgScore = statusCount.completed > 0
        ? Math.round((totalCompletedScore / statusCount.completed) * 100) / 100
        : 0;

      return {
        projectId: project.id,
        projectTitle: project.title,
        submitterName: project.submitterName,
        submitterEmail: project.submitterEmail,
        averageScore: avgScore,
        totalAssignments: project.assignments.length,
        completedAssignments: statusCount.completed,
        pendingAssignments: statusCount.pending,
        inProgressAssignments: statusCount.in_progress,
        judges: project.assignments.map((assignment) => ({
          assignmentId: assignment.id,
          judgeId: assignment.judgeId,
          judgeName: assignment.judge.name,
          judgeEmail: assignment.judge.email,
          status: assignment.status,
          totalScore: assignment.totalScore,
          comment: assignment.comment,
          scores: assignment.scores,
          scoredAt: assignment.updatedAt,
        })),
      };
    });

    report.sort((a, b) => {
      if (b.averageScore !== a.averageScore) return b.averageScore - a.averageScore;
      return a.projectTitle.localeCompare(b.projectTitle);
    });

    res.json(report);
  });

  app.get('/api/reports/scoring', requireAdmin, async (req, res) => {
    const { hackathonId } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);

    const assignments = await prisma.assignment.findMany({
      where: {
        status: 'completed',
        ...(hackathonIdValue ? { project: { hackathonId: hackathonIdValue } } : {}),
      },
      include: {
        project: true,
        judge: true,
        scores: true,
      }
    });

    const report = assignments.map(a => ({
      assignmentId: a.id,
      projectId: a.projectId,
      projectTitle: a.project.title,
      judgeId: a.judgeId,
      judgeName: a.judge.name,
      totalScore: a.totalScore,
      comment: a.comment,
      scores: a.scores,
      createdAt: a.createdAt,
    }));

    res.json(report);
  });
}
