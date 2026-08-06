import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { logActivity, getActorInfo } from '../utils/activity';
import type { ActivityAction } from '../types';

const prisma = new PrismaClient();

describe('logActivity', () => {
  it('persists a row and tolerates errors without throwing', async () => {
    await logActivity(prisma, {
      actorId: 'actor-1',
      actorRole: 'admin',
      actorName: 'A',
      action: 'create' as ActivityAction,
      entityType: 'hackathon',
      entityId: 'h1',
    });

    const logs = await prisma.activityLog.findMany({ where: { action: 'create' } });
    expect(logs.length).toBe(1);
    expect(logs[0]?.actorId).toBe('actor-1');
    expect(logs[0]?.metadata).toEqual({});
  });

  it('defaults metadata to empty object', async () => {
    await logActivity(prisma, {
      actorId: 'a',
      actorRole: 'judge',
      actorName: 'J',
      action: 'score' as ActivityAction,
      entityType: 'score',
      entityId: 's1',
    });
    const row = await prisma.activityLog.findFirst({ where: { action: 'score' } });
    expect(row?.metadata).toEqual({});
  });

  it('does not throw when prisma rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = {
      activityLog: {
        create: vi.fn().mockRejectedValue(new Error('boom')),
      },
    } as unknown as PrismaClient;

    await logActivity(broken, {
      actorId: 'a',
      actorRole: 'admin',
      actorName: 'A',
      action: 'update' as ActivityAction,
      entityType: 'user',
      entityId: 'u',
    });
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('getActorInfo', () => {
  it('returns actor info from req.authUser when present', () => {
    const req = {
      authUser: { id: 'u1', role: 'admin' as const, name: 'Alice', email: 'a@b.co' },
    } as unknown as import('express').Request;
    expect(getActorInfo(req)).toEqual({ actorId: 'u1', actorRole: 'admin', actorName: 'Alice' });
  });

  it('falls back to header-based auth when req.authUser is missing', () => {
    const req = {
      header: (name: string) => {
        if (name === 'x-test-user-id') return 'u2';
        if (name === 'x-test-role') return 'judge';
        if (name === 'x-test-name') return 'Bob';
        return undefined;
      },
    } as unknown as import('express').Request;
    expect(getActorInfo(req)).toEqual({ actorId: 'u2', actorRole: 'judge', actorName: 'Bob' });
  });

  it('returns the AUTH_DISABLED default identity when no auth information is available', () => {
    const req = { header: () => undefined } as unknown as import('express').Request;
    // In AUTH_DISABLED test mode, getAuthUserFromRequest falls back to 'test-user' / admin.
    expect(getActorInfo(req)).toEqual({
      actorId: 'test-user',
      actorRole: 'admin',
      actorName: 'Test User',
    });
  });
});
