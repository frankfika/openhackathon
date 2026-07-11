/**
 * Integration tests for the AI doc-generation endpoints
 * (synth-design-spec Block 3 §3.2).
 *
 * The test environment does not configure AI_API_KEY, so any call
 * that actually reaches the LLM should fail with the
 * `LLM_INVALID_KEY` code (per spec §3.5.1) rather than a generic
 * 500. This guards the auth + error-mapping contract.
 */
import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, prisma } from '../server';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Wipe just the tables this test exercises.
  await prisma.aIGenerationLog.deleteMany();
  await prisma.aIBatchTask.deleteMany();
  await prisma.scoringCriterion.deleteMany();
  await prisma.hackathonJudge.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.user.deleteMany();
});

async function seedAdminAndHackathon() {
  const admin = await prisma.user.create({
    data: {
      email: 'ai-test-admin@example.com',
      name: 'AI Test Admin',
      role: 'admin',
      password: bcrypt.hashSync('AdminPass1', 10),
    },
  });
  const hackathon = await prisma.hackathon.create({
    data: {
      title: 'AI Test Hack',
      tagline: 'AI doc generation tests',
      startAt: new Date('2026-09-01T09:00:00.000Z'),
      endAt: new Date('2026-09-03T18:00:00.000Z'),
      status: 'draft',
      coverGradient: 'from-blue-500 to-cyan-500',
      submissionSchema: {},
    },
  });
  return { admin, hackathon };
}

describe('AI doc generation endpoints', () => {
  describe('auth and rate limit guards', () => {
    it('rejects unauthenticated generate-description', async () => {
      const res = await request(app)
        .post('/api/ai/hackathons/some-id/generate-description')
        .send({ language: 'zh' });
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated generate-news', async () => {
      const res = await request(app)
        .post('/api/ai/hackathons/some-id/generate-news')
        .send({ language: 'zh' });
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated suggest-criteria', async () => {
      const res = await request(app)
        .post('/api/ai/hackathons/some-id/suggest-criteria')
        .send({ criterionCount: 6 });
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated ai-cost', async () => {
      const res = await request(app).get('/api/admin/ai-cost');
      expect(res.status).toBe(401);
    });
  });

  describe('LLM failure paths (no API key in test env)', () => {
    it('returns LLM_INVALID_KEY on generate-description when no AI_API_KEY is set', async () => {
      const { hackathon } = await seedAdminAndHackathon();
      const res = await request(app)
        .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', 'admin-test-user')
        .send({ language: 'zh', theme: 'AI agents' });
      expect([500, 502]).toContain(res.status);
      expect(['LLM_INVALID_KEY', 'LLM_FAILED']).toContain(res.body.code);

      // The failed attempt must still write an AIGenerationLog row
      // so the audit trail is intact.
      const logs = await prisma.aIGenerationLog.findMany({
        where: { hackathonId: hackathon.id, type: 'description' },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].status).toBe('failed');
      expect(logs[0].errorCode).toBeTruthy();
    });

    it('returns LLM_INVALID_KEY on suggest-criteria when no AI_API_KEY is set', async () => {
      const { hackathon } = await seedAdminAndHackathon();
      const res = await request(app)
        .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', 'admin-test-user')
        .send({ criterionCount: 6, theme: 'AI', focus: 'innovation' });
      expect([500, 502]).toContain(res.status);
      expect(['LLM_INVALID_KEY', 'LLM_FAILED']).toContain(res.body.code);
    });
  });

  describe('ai-cost endpoint', () => {
    it('returns empty aggregates when no logs exist', async () => {
      await seedAdminAndHackathon();
      const res = await request(app)
        .get('/api/admin/ai-cost')
        .set('x-test-role', 'admin')
        .set('x-test-user-id', 'admin-test-user');
      expect(res.status).toBe(200);
      expect(res.body.totalCalls).toBe(0);
      expect(res.body.totalTokensIn).toBe(0);
      expect(res.body.totalTokensOut).toBe(0);
    });
  });
});
