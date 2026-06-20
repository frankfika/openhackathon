import type { PrismaClient } from '@prisma/client';
import { POINTS_RULES } from '../config';
import { logActivity } from '../utils/activity';
import { recordAchievementOnChain, isOnChainEnabled } from './onchain';

export type ActivityType = keyof typeof POINTS_RULES;

const STAT_FIELD_BY_TYPE: Record<ActivityType, 'participationCount' | 'judgeCount' | 'awardCount' | null> = {
  participated: 'participationCount',
  judged: 'judgeCount',
  awarded: 'awardCount',
  won_first: 'awardCount',
  won_second: 'awardCount',
  won_third: 'awardCount',
};

/**
 * Award cross-hackathon points to a user for an activity.
 * Only applies to Web3 users (isWeb3User=true). Idempotent per
 * (userId, hackathonId, activityType) — re-awarding the same activity is a no-op.
 *
 * Returns the created activity record, or null if skipped.
 */
export async function awardPoints(
  prisma: PrismaClient,
  params: {
    userId: string;
    hackathonId: string;
    activityType: ActivityType;
    metadata?: Record<string, unknown>;
  },
): Promise<{ awarded: boolean; points: number } | null> {
  const { userId, hackathonId, activityType, metadata } = params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isWeb3User: true, name: true, role: true },
  });

  // Only Web3 users accumulate cross-hackathon points.
  if (!user || !user.isWeb3User) {
    return { awarded: false, points: 0 };
  }

  // Idempotency: skip if this activity already recorded.
  const existing = await prisma.crossHackathonActivity.findFirst({
    where: { userId, hackathonId, activityType },
  });
  if (existing) {
    return { awarded: false, points: existing.points };
  }

  const points = POINTS_RULES[activityType];
  const statField = STAT_FIELD_BY_TYPE[activityType];

  await prisma.$transaction(async (tx) => {
    await tx.crossHackathonActivity.create({
      data: {
        userId,
        hackathonId,
        activityType,
        points,
        metadata: (metadata ?? {}) as object,
        onChainStatus: null,
      },
    });

    const userUpdate: Record<string, unknown> = {
      globalPoints: { increment: points },
    };
    if (statField) {
      userUpdate[statField] = { increment: 1 };
    }

    await tx.user.update({
      where: { id: userId },
      data: userUpdate,
    });
  });

  await logActivity(prisma, {
    hackathonId,
    actorId: userId,
    actorRole: user.role === 'admin' ? 'admin' : 'judge',
    actorName: user.name,
    action: 'points_awarded',
    entityType: 'user',
    entityId: userId,
    metadata: { activityType, points, ...metadata },
  });

  return { awarded: true, points };
}

/**
 * Resolve the userId for a project submitter, matching by linked wallet or email.
 * Returns null if the submitter is not a registered Web3 user.
 */
export async function resolveSubmitterUserId(
  prisma: PrismaClient,
  params: { userId?: string | null; submitterEmail?: string | null },
): Promise<string | null> {
  if (params.userId) {
    return params.userId;
  }
  if (params.submitterEmail) {
    const user = await prisma.user.findUnique({
      where: { email: params.submitterEmail.toLowerCase() },
      select: { id: true },
    });
    return user?.id ?? null;
  }
  return null;
}

const RANK_ACTIVITY: Record<number, ActivityType> = {
  1: 'won_first',
  2: 'won_second',
  3: 'won_third',
};

/**
 * Award points to project submitters when a leaderboard is published.
 * - Top 3 ranked projects get won_first/second/third.
 * - All ranked projects also get 'awarded'.
 * Only affects Web3 users; on-chain attestation fires for top ranks if enabled.
 */
export async function processLeaderboardPoints(
  prisma: PrismaClient,
  hackathonId: string,
  entries: { projectId: string; rank: number; award: string }[],
): Promise<void> {
  if (entries.length === 0) return;

  const projects = await prisma.project.findMany({
    where: { hackathonId, id: { in: entries.map((e) => e.projectId) } },
    select: { id: true, userId: true, submitterEmail: true },
  });
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  for (const entry of entries) {
    const project = projectMap.get(entry.projectId);
    if (!project) continue;

    const userId = await resolveSubmitterUserId(prisma, {
      userId: project.userId,
      submitterEmail: project.submitterEmail,
    });
    if (!userId) continue;

    const rankActivity = RANK_ACTIVITY[entry.rank];

    // Award the rank-specific achievement (top 3).
    if (rankActivity) {
      const result = await awardPoints(prisma, {
        userId,
        hackathonId,
        activityType: rankActivity,
        metadata: { projectId: entry.projectId, rank: entry.rank, award: entry.award },
      });

      // Attest top-rank achievements on-chain when enabled.
      if (result?.awarded && isOnChainEnabled()) {
        try {
          await recordAchievementOnChain(prisma, {
            userId,
            hackathonId,
            activityType: rankActivity,
            points: POINTS_RULES[rankActivity],
          });
        } catch (error) {
          console.error('On-chain attestation failed:', error);
        }
      }
    }
  }
}
