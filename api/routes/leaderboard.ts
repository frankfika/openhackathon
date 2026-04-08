import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { getScopedHackathonId, getCurrentHackathon } from '../utils/hackathon';

type LeaderboardEntryInput = {
  projectId: string;
  rank: number;
  award: string;
};

async function validateLeaderboardPayload(
  prisma: PrismaClient,
  hackathonId: string,
  body: unknown,
): Promise<{ entries: LeaderboardEntryInput[]; published: boolean } | { error: string }> {
  const payload = (body && typeof body === 'object') ? body as Record<string, unknown> : {};
  const rawEntries = payload.entries;
  const rawPublished = payload.published;

  if (!Array.isArray(rawEntries)) {
    return { error: 'entries must be an array' };
  }
  if (typeof rawPublished !== 'boolean') {
    return { error: 'published must be a boolean' };
  }

  const entries: LeaderboardEntryInput[] = [];
  const seenProjects = new Set<string>();
  const seenRanks = new Set<number>();

  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') {
      return { error: 'each entry must be an object' };
    }

    const item = raw as Record<string, unknown>;
    const projectId = typeof item.projectId === 'string' ? item.projectId.trim() : '';
    const rank = typeof item.rank === 'number' ? item.rank : Number.NaN;
    const award = typeof item.award === 'string' ? item.award.trim() : '';

    if (!projectId) {
      return { error: 'entry.projectId is required' };
    }
    if (!Number.isInteger(rank) || rank <= 0) {
      return { error: 'entry.rank must be a positive integer' };
    }
    if (award.length > 100) {
      return { error: 'entry.award must be at most 100 characters' };
    }
    if (seenProjects.has(projectId)) {
      return { error: 'entries cannot contain duplicate projectId values' };
    }
    if (seenRanks.has(rank)) {
      return { error: 'entries cannot contain duplicate rank values' };
    }

    seenProjects.add(projectId);
    seenRanks.add(rank);
    entries.push({ projectId, rank, award });
  }

  if (entries.length > 0) {
    const projectCount = await prisma.project.count({
      where: {
        hackathonId,
        id: { in: entries.map((entry) => entry.projectId) },
      },
    });
    if (projectCount !== entries.length) {
      return { error: 'entries contain projectId values that do not belong to this hackathon' };
    }
  }

  return {
    entries: entries.sort((a, b) => a.rank - b.rank),
    published: rawPublished,
  };
}

export function registerLeaderboardRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
  app.get('/api/leaderboard', async (req, res) => {
    const { hackathonId } = req.query;
    const hackathonIdValue = await getScopedHackathonId(prisma, hackathonId);

    if (!hackathonIdValue) {
      return res.status(400).json({ error: 'hackathonId is required' });
    }

    const hackathon = await prisma.hackathon.findUnique({
      where: { id: hackathonIdValue },
      select: { scoringCriteria: true, leaderboardData: true, leaderboardPublished: true },
    });
    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    if (!hackathon.leaderboardPublished) {
      return res.json([]);
    }

    const maxPossible = hackathon.scoringCriteria?.reduce((sum, c) => sum + c.maxScore, 0) ?? 0;
    const curatedData = Array.isArray(hackathon.leaderboardData) && hackathon.leaderboardData.length > 0
      ? hackathon.leaderboardData as { projectId: string; rank: number; award: string }[]
      : null;

    if (curatedData) {
      const entries = curatedData;
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

    const validated = await validateLeaderboardPayload(prisma, currentHackathon.id, req.body);
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const hackathon = await prisma.hackathon.update({
      where: { id: currentHackathon.id },
      data: {
        leaderboardData: validated.entries,
        leaderboardPublished: validated.published,
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
    const hackathonExists = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    });
    if (!hackathonExists) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const validated = await validateLeaderboardPayload(prisma, req.params.id, req.body);
    if ('error' in validated) {
      return res.status(400).json({ error: validated.error });
    }

    const hackathon = await prisma.hackathon.update({
      where: { id: req.params.id },
      data: {
        leaderboardData: validated.entries,
        leaderboardPublished: validated.published,
      }
    });
    res.json(hackathon);
  });

  app.get('/api/hackathons/:id/leaderboard', requireAdmin, async (req, res) => {
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: req.params.id },
      select: { leaderboardData: true, leaderboardPublished: true }
    });
    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }
    res.json(hackathon);
  });
}
