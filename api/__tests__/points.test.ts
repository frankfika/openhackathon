import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { awardPoints, processLeaderboardPoints, resolveSubmitterUserId } from '../services/points';
import { createHackathon, createUser, createProject } from './factories';

const prisma = new PrismaClient();

describe('awardPoints', () => {
  it('skips non-Web3 users silently', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const hackathon = await createHackathon(prisma);

    const result = await awardPoints(prisma, {
      userId: user.id,
      hackathonId: hackathon.id,
      activityType: 'participated',
    });

    expect(result?.awarded).toBe(false);
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.globalPoints).toBe(0);
  });

  it('awards points and increments the stat counter for Web3 users', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'web3@test.com',
        name: 'Web3 User',
        role: 'user',
        isWeb3User: true,
      },
    });
    const hackathon = await createHackathon(prisma);

    const result = await awardPoints(prisma, {
      userId: user.id,
      hackathonId: hackathon.id,
      activityType: 'participated',
    });

    expect(result?.awarded).toBe(true);
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect((fresh?.globalPoints ?? 0) > 0).toBe(true);
    expect(fresh?.participationCount).toBe(1);

    const activity = await prisma.crossHackathonActivity.findFirst({
      where: { userId: user.id, hackathonId: hackathon.id, activityType: 'participated' },
    });
    expect(activity).not.toBeNull();
  });

  it('is idempotent for the same (user, hackathon, activity)', async () => {
    const user = await prisma.user.create({
      data: { email: 'w2@test.com', name: 'W2', role: 'user', isWeb3User: true },
    });
    const h = await createHackathon(prisma);

    const first = await awardPoints(prisma, {
      userId: user.id, hackathonId: h.id, activityType: 'participated',
    });
    const second = await awardPoints(prisma, {
      userId: user.id, hackathonId: h.id, activityType: 'participated',
    });

    expect(first?.awarded).toBe(true);
    expect(second?.awarded).toBe(false);
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.participationCount).toBe(1);
  });
});

describe('resolveSubmitterUserId', () => {
  it('returns userId when provided', async () => {
    expect(await resolveSubmitterUserId(prisma, { userId: 'u1', submitterEmail: 'a@b.co' })).toBe('u1');
  });

  it('falls back to email lookup when userId missing', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const found = await resolveSubmitterUserId(prisma, { submitterEmail: user.email });
    expect(found).toBe(user.id);
  });

  it('returns null when neither userId nor email match', async () => {
    expect(await resolveSubmitterUserId(prisma, { submitterEmail: 'missing@x.com' })).toBeNull();
    expect(await resolveSubmitterUserId(prisma, {})).toBeNull();
  });
});

describe('processLeaderboardPoints', () => {
  it('does nothing for empty entries', async () => {
    await processLeaderboardPoints(prisma, 'no-hackathon', []);
    // No exception, no rows
    const count = await prisma.crossHackathonActivity.count();
    expect(count).toBe(0);
  });

  it('awards won_first/second/third to top 3', async () => {
    const user = await prisma.user.create({
      data: { email: 'winner@test.com', name: 'Winner', role: 'user', isWeb3User: true },
    });
    const h = await createHackathon(prisma);
    const p1 = await createProject(prisma, h.id, { submitterEmail: user.email, userId: user.id });
    const p2 = await createProject(prisma, h.id, { submitterEmail: user.email, userId: user.id });
    const p3 = await createProject(prisma, h.id, { submitterEmail: user.email, userId: user.id });

    await processLeaderboardPoints(prisma, h.id, [
      { projectId: p1.id, rank: 1, award: 'gold' },
      { projectId: p2.id, rank: 2, award: 'silver' },
      { projectId: p3.id, rank: 3, award: 'bronze' },
    ]);

    const activities = await prisma.crossHackathonActivity.findMany({
      where: { userId: user.id, hackathonId: h.id },
    });
    const types = activities.map((a) => a.activityType).sort();
    expect(types).toContain('won_first');
    expect(types).toContain('won_second');
    expect(types).toContain('won_third');
  });

  it('skips projects whose submitter is not a registered user', async () => {
    const h = await createHackathon(prisma);
    const p = await createProject(prisma, h.id, { submitterEmail: 'ghost@x.com' });
    await processLeaderboardPoints(prisma, h.id, [
      { projectId: p.id, rank: 1, award: 'gold' },
    ]);
    const count = await prisma.crossHackathonActivity.count({ where: { hackathonId: h.id } });
    expect(count).toBe(0);
  });
});
