import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getScopedHackathonId, getCurrentHackathon } from '../utils/hackathon';

export function registerLeaderboardRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
  app.get('/api/leaderboard', async (req, res) => {
    const { hackathonId } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);

    const hackathon = hackathonIdValue ? await prisma.hackathon.findUnique({
      where: { id: hackathonIdValue },
      select: { leaderboardData: true, leaderboardPublished: true }
    }) : null;

    const hackathonFull = hackathonIdValue ? await prisma.hackathon.findUnique({
      where: { id: hackathonIdValue },
      select: { scoringCriteria: true },
    }) : null;
    const maxPossible = hackathonFull?.scoringCriteria?.reduce((sum, c) => sum + c.maxScore, 0) ?? 0;

    if (hackathon?.leaderboardPublished && hackathon?.leaderboardData) {
      const entries = hackathon.leaderboardData as { projectId: string; rank: number; award: string }[];
      const projectIds = entries.map(e => e.projectId);
      const projects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        include: {
          assignments: {
            where: { status: 'completed' },
            select: { totalScore: true },
          },
        },
      });

      type CuratedLeaderboardItem = {
        id: string;
        title: string;
        oneLiner: string;
        tags: string[];
        avgScore: number;
        maxPossible: number;
        judgeCount: number;
        submitterName: string | null;
        submissionData: Record<string, unknown> | null;
        rank: number;
        award: string;
      };

      const projectMap = new Map(projects.map(p => [p.id, p]));
      const result = entries.map((entry): CuratedLeaderboardItem | null => {
        const p = projectMap.get(entry.projectId);
        if (!p) return null;
        const scores = p.assignments.map(a => a.totalScore || 0);
        const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        return {
          id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
          avgScore: Math.round(avgScore * 100) / 100, maxPossible,
          judgeCount: scores.length, submitterName: p.submitterName,
          submissionData: (p.submissionData as Record<string, unknown>) || null,
          rank: entry.rank, award: entry.award,
        };
      }).filter((item): item is CuratedLeaderboardItem => item !== null);

      result.sort((a, b) => a.rank - b.rank);
      return res.json(result);
    }

    const projects = await prisma.project.findMany({
      where: {
        ...(hackathonIdValue ? { hackathonId: hackathonIdValue } : {}),
      },
      include: {
        assignments: {
          where: { status: 'completed' },
          select: { totalScore: true },
        },
      },
    });

    const leaderboard = projects.map(p => {
      const scores = p.assignments.map(a => a.totalScore || 0);
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0;

      return {
        id: p.id, title: p.title, oneLiner: p.oneLiner, tags: p.tags,
        avgScore: Math.round(avgScore * 100) / 100, maxPossible,
        judgeCount: scores.length, submitterName: p.submitterName,
        submissionData: (p.submissionData as Record<string, unknown>) || null,
      };
    });

    leaderboard.sort((a, b) => b.avgScore - a.avgScore);
    res.json(leaderboard);
  });

  app.put('/api/hackathon/leaderboard', requireAdmin, async (req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const { entries, published } = req.body;
    const hackathon = await prisma.hackathon.update({
      where: { id: currentHackathon.id },
      data: {
        leaderboardData: entries,
        leaderboardPublished: published,
      }
    });
    res.json(hackathon);
  });

  app.get('/api/hackathon/leaderboard', requireAdmin, async (_req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const hackathon = await prisma.hackathon.findUnique({
      where: { id: currentHackathon.id },
      select: { leaderboardData: true, leaderboardPublished: true }
    });
    res.json(hackathon);
  });

  app.put('/api/hackathons/:id/leaderboard', requireAdmin, async (req, res) => {
    const { entries, published } = req.body;
    const hackathon = await prisma.hackathon.update({
      where: { id: req.params.id },
      data: {
        leaderboardData: entries,
        leaderboardPublished: published,
      }
    });
    res.json(hackathon);
  });

  app.get('/api/hackathons/:id/leaderboard', requireAdmin, async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { leaderboardData: true, leaderboardPublished: true }
    });
    res.json(hackathon);
  });
}
