import type { Express, RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import { asString } from '../config';
import { getErrorMessage, dedupeIds } from '../utils/validation';
import { getCurrentHackathon } from '../utils/hackathon';
import { logActivity, getActorInfo } from '../utils/activity';

export function registerJudgeRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAdmin }: { requireAdmin: RequestHandler },
) {
  app.get('/api/hackathon/judges', requireAdmin, async (_req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const memberships = await prisma.hackathonJudge.findMany({
      where: { hackathonId: currentHackathon.id },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(memberships.map((membership) => membership.user));
  });

  app.post('/api/hackathon/judges', requireAdmin, async (req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const judgeIds = Array.isArray(req.body?.judgeIds)
      ? req.body.judgeIds.map((id: unknown) => asString(id)).filter(Boolean) as string[]
      : [];
    if (judgeIds.length === 0) {
      return res.status(400).json({ error: 'judgeIds is required' });
    }

    const uniqueJudgeIds = dedupeIds(judgeIds);

    try {
      const users = await prisma.$transaction(async (tx) => {
        const existingUsers = await tx.user.findMany({
          where: {
            id: { in: uniqueJudgeIds },
            role: 'judge',
          },
          select: { id: true },
        });

        if (existingUsers.length !== uniqueJudgeIds.length) {
          throw new Error('Some judge IDs are invalid');
        }

        for (const judgeId of uniqueJudgeIds) {
          await tx.hackathonJudge.upsert({
            where: {
              hackathonId_userId: {
                hackathonId: currentHackathon.id,
                userId: judgeId,
              },
            },
            update: {},
            create: {
              hackathonId: currentHackathon.id,
              userId: judgeId,
            },
          });
        }

        return tx.hackathonJudge.findMany({
          where: { hackathonId: currentHackathon.id },
          include: {
            user: {
              select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        });
      });

      const actor = getActorInfo(req);
      for (const judgeId of uniqueJudgeIds) {
        const judge = users.find((u) => u.userId === judgeId)?.user;
        if (judge) {
          await logActivity(prisma, {
            hackathonId: currentHackathon.id,
            actorId: actor?.actorId,
            actorRole: actor?.actorRole ?? 'system',
            actorName: actor?.actorName ?? 'System',
            action: 'invite',
            entityType: 'judge',
            entityId: judgeId,
            metadata: {
              judgeName: judge.name,
              judgeEmail: judge.email,
            },
            ipAddress: req.ip,
          });
        }
      }

      res.json(users.map((membership) => membership.user));
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error, 'Failed to register judges') });
    }
  });

  app.delete('/api/hackathon/judges/:judgeId', requireAdmin, async (req, res) => {
    const currentHackathon = await getCurrentHackathon(prisma);
    if (!currentHackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const judgeId = req.params.judgeId;
    const existingMembership = await prisma.hackathonJudge.findUnique({
      where: {
        hackathonId_userId: {
          hackathonId: currentHackathon.id,
          userId: judgeId,
        },
      },
    });

    if (!existingMembership) {
      return res.status(404).json({ error: 'Judge is not registered for this hackathon' });
    }

    const blockingAssignments = await prisma.assignment.count({
      where: {
        judgeId,
        project: { hackathonId: currentHackathon.id },
      },
    });

    if (blockingAssignments > 0) {
      return res.status(409).json({
        error: 'Cannot remove judge registration while assignments exist in this hackathon',
        blockingAssignments,
      });
    }

    await prisma.hackathonJudge.delete({
      where: {
        hackathonId_userId: {
          hackathonId: currentHackathon.id,
          userId: judgeId,
        },
      },
    });

    const actor = getActorInfo(req);
    await logActivity(prisma, {
      hackathonId: currentHackathon.id,
      actorId: actor?.actorId,
      actorRole: actor?.actorRole ?? 'system',
      actorName: actor?.actorName ?? 'System',
      action: 'delete',
      entityType: 'judge',
      entityId: judgeId,
      metadata: {},
      ipAddress: req.ip,
    });

    res.json({ success: true });
  });

  app.get('/api/hackathons/:id/judges', requireAdmin, async (req, res) => {
    const hackathonId = req.params.id;
    const hackathon = await prisma.hackathon.findUnique({
      where: { id: hackathonId },
      select: { id: true },
    });
    if (!hackathon) {
      return res.status(404).json({ error: 'Hackathon not found' });
    }

    const memberships = await prisma.hackathonJudge.findMany({
      where: { hackathonId },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(memberships.map((membership) => membership.user));
  });

  app.post('/api/hackathons/:id/judges', requireAdmin, async (req, res) => {
    const hackathonId = req.params.id;
    const incomingJudgeIds = Array.isArray(req.body?.judgeIds)
      ? req.body.judgeIds.map((value: unknown) => asString(value)).filter(Boolean) as string[]
      : [];
    const judgeIds = dedupeIds(incomingJudgeIds);

    if (judgeIds.length === 0) {
      return res.status(400).json({ error: 'judgeIds is required' });
    }

    try {
      await prisma.$transaction(async (tx) => {
        const hackathon = await tx.hackathon.findUnique({
          where: { id: hackathonId },
          select: { id: true },
        });
        if (!hackathon) {
          throw new Error('Hackathon not found');
        }

        const judges = await tx.user.findMany({
          where: {
            id: { in: judgeIds },
            role: 'judge',
          },
          select: { id: true },
        });
        if (judges.length !== judgeIds.length) {
          throw new Error('Some judges were not found');
        }

        for (const judgeId of judgeIds) {
          await tx.hackathonJudge.upsert({
            where: {
              hackathonId_userId: {
                hackathonId,
                userId: judgeId,
              },
            },
            update: {},
            create: {
              hackathonId,
              userId: judgeId,
            },
          });
        }
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to register judges');
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }

    const memberships = await prisma.hackathonJudge.findMany({
      where: { hackathonId },
      include: {
        user: {
          select: { id: true, email: true, name: true, role: true, avatarUrl: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(memberships.map((membership) => membership.user));
  });

  app.delete('/api/hackathons/:id/judges/:judgeId', requireAdmin, async (req, res) => {
    const hackathonId = req.params.id;
    const judgeId = req.params.judgeId;

    try {
      await prisma.$transaction(async (tx) => {
        const membership = await tx.hackathonJudge.findUnique({
          where: {
            hackathonId_userId: {
              hackathonId,
              userId: judgeId,
            },
          },
        });
        if (!membership) {
          throw new Error('Judge registration not found');
        }

        const blockingAssignment = await tx.assignment.findFirst({
          where: {
            judgeId,
            project: { hackathonId },
          },
          select: {
            id: true,
          },
        });
        if (blockingAssignment) {
          const blockedError = new Error('Cannot remove judge registration while assignments exist in this hackathon') as Error & {
            code?: string;
          };
          blockedError.code = 'JUDGE_REGISTRATION_BLOCKED_BY_ASSIGNMENTS';
          throw blockedError;
        }
        await tx.hackathonJudge.delete({
          where: {
            hackathonId_userId: {
              hackathonId,
              userId: judgeId,
            },
          },
        });
      });
    } catch (error: unknown) {
      const message = getErrorMessage(error, 'Failed to remove judge registration');
      const typedError = error as { code?: string } | null;
      if (typedError?.code === 'JUDGE_REGISTRATION_BLOCKED_BY_ASSIGNMENTS') {
        return res.status(400).json({
          error: message,
          code: typedError.code,
        });
      }
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }
      return res.status(400).json({ error: message });
    }

    res.json({ success: true });
  });
}
