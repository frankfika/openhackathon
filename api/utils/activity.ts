import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { ActivityLogInput, AuthUser } from '../types';
import { getAuthUserFromRequest } from '../middleware';

export async function logActivity(prisma: PrismaClient, input: ActivityLogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        hackathonId: input.hackathonId,
        actorId: input.actorId,
        actorRole: input.actorRole,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

export function getActorInfo(req: express.Request): { actorId: string; actorRole: 'admin' | 'judge'; actorName: string } | null {
  const authUser = req.authUser || getAuthUserFromRequest(req);
  if (!authUser) return null;
  return {
    actorId: authUser.id,
    actorRole: authUser.role,
    actorName: authUser.name,
  };
}
