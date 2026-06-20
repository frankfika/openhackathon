import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asString } from '../config';
import type { AssignmentScorePayload } from '../types';
import { logActivity } from '../utils/activity';
import { awardPoints } from '../services/points';

export function registerScoreRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAuth }: { requireAuth: RequestHandler },
) {
  app.post('/api/assignments/:id/scores', requireAuth, async (req, res) => {
    const { scores, comment, status } = req.body;
    const assignmentId = req.params.id;

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        project: { select: { hackathonId: true } },
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const viewer = req.authUser!;
    if (viewer.role !== 'judge' || existing.judgeId !== viewer.id) {
      return res.status(403).json({ error: 'Only the assigned judge can submit scores' });
    }

    if (!Array.isArray(scores) || scores.length === 0) {
      return res.status(400).json({ error: 'Scores payload is required' });
    }
    const parsedScores = scores
      .map((row: unknown): AssignmentScorePayload | null => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
        const criterionId = asString((row as { criterionId?: unknown }).criterionId);
        const scoreValue = Number((row as { score?: unknown }).score);
        if (!criterionId || !Number.isInteger(scoreValue)) {
          return null;
        }
        return {
          criterionId,
          score: scoreValue,
        };
      })
      .filter((row): row is AssignmentScorePayload => row !== null);
    if (parsedScores.length !== scores.length) {
      return res.status(400).json({ error: 'Scores payload contains invalid entries' });
    }

    const scoringCriteria = await prisma.scoringCriterion.findMany({
      where: { hackathonId: existing.project.hackathonId },
      select: { id: true, maxScore: true },
    });
    if (scoringCriteria.length === 0) {
      return res.status(400).json({ error: 'No scoring criteria configured for this hackathon' });
    }

    const criterionMaxMap = new Map(scoringCriteria.map((criterion) => [criterion.id, criterion.maxScore]));
    const seenCriteria = new Set<string>();

    for (const scoreItem of parsedScores) {
      const criterionMax = criterionMaxMap.get(scoreItem.criterionId);
      if (criterionMax === undefined) {
        return res.status(400).json({ error: `Unknown criterionId: ${scoreItem.criterionId}` });
      }
      if (seenCriteria.has(scoreItem.criterionId)) {
        return res.status(400).json({ error: 'Scores payload contains duplicate criterion entries' });
      }
      if (scoreItem.score < 0 || scoreItem.score > criterionMax) {
        return res.status(400).json({ error: `Score for criterion ${scoreItem.criterionId} must be between 0 and ${criterionMax}` });
      }
      seenCriteria.add(scoreItem.criterionId);
    }

    if (seenCriteria.size !== scoringCriteria.length) {
      return res.status(400).json({ error: 'Scores payload must include every scoring criterion exactly once' });
    }

    const totalScore = parsedScores.reduce((sum, scoreItem) => sum + scoreItem.score, 0);

    const assignment = await prisma.$transaction(async (tx) => {
      await tx.score.deleteMany({ where: { assignmentId } });
      await tx.score.createMany({
        data: parsedScores.map((scoreItem) => ({
          assignmentId,
          criterionId: scoreItem.criterionId,
          score: scoreItem.score,
        })),
      });
      return tx.assignment.update({
        where: { id: assignmentId },
        data: { status: status || 'completed', comment, totalScore },
        include: { project: true, judge: true, scores: true },
      });
    });

    const action = existing.status === 'completed' ? 'update_score' : 'score';
    await logActivity(prisma, {
      hackathonId: assignment.project.hackathonId,
      actorId: viewer.id,
      actorRole: viewer.role,
      actorName: viewer.name,
      action,
      entityType: 'score',
      entityId: assignmentId,
      metadata: {
        projectId: assignment.projectId,
        projectTitle: assignment.project.title,
        judgeId: assignment.judgeId,
        judgeName: assignment.judge.name,
        totalScore,
        scores: parsedScores,
      },
      ipAddress: req.ip,
    });

    // Award cross-hackathon "judged" points the first time a review is completed.
    // No-op for non-Web3 judges and idempotent per (judge, hackathon).
    if (assignment.status === 'completed' && existing.status !== 'completed') {
      try {
        await awardPoints(prisma, {
          userId: viewer.id,
          hackathonId: assignment.project.hackathonId,
          activityType: 'judged',
          metadata: { assignmentId },
        });
      } catch (error) {
        console.error('Failed to award judging points:', error);
      }
    }

    res.json(assignment);
  });
}
