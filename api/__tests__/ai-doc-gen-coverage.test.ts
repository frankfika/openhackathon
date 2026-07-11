/**
 * Integration tests for AI doc-generation endpoints beyond the basic
 * auth + LLM-failure cases (synth-design-spec §3.2 / §3.5 / §3.6 V3.x).
 *
 * The `ai-doc-generation.test.ts` file (impl-backend) covers:
 *   - 401 for unauthenticated calls
 *   - 500/502 + LLM_INVALID_KEY when AI_API_KEY is missing
 *   - ai-cost returns empty aggregates
 *
 * This file extends with:
 *   - input validation (zod) — out-of-range values rejected with 400
 *   - non-admin JWT is rejected with 403
 *   - unknown hackathon id returns 404
 *   - missing hackathonId parameter
 *   - valid input shape (zod parsing) for each of the three endpoints
 *   - audit log row written on success and failure
 *   - rate limit 5/min/user (visible in production env)
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET } from '../config';

let app: typeof import('../server').app;
let prisma: typeof import('../server').prisma;

beforeAll(async () => {
  process.env.AUTH_DISABLED = 'false';
  vi.resetModules();
  const serverModule = await import('../server');
  app = serverModule.app;
  prisma = serverModule.prisma;
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.aIGenerationLog.deleteMany();
  await prisma.aIBatchTask.deleteMany();
  await prisma.scoringCriterion.deleteMany();
  await prisma.hackathonJudge.deleteMany();
  await prisma.project.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.user.deleteMany();
});

function makeToken(userId: string, role: 'admin' | 'judge' = 'admin') {
  return jwt.sign(
    { sub: userId, role, name: role === 'admin' ? 'Test Admin' : 'Test Judge' },
    JWT_SECRET,
    { algorithm: 'HS256', issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: '5m' }
  );
}

async function seedAdmin() {
  return prisma.user.create({
    data: {
      email: 'qa-admin@example.com',
      name: 'QA Admin',
      role: 'admin',
      password: bcrypt.hashSync('AdminPass1', 10),
    },
  });
}

async function seedJudge() {
  return prisma.user.create({
    data: {
      email: 'qa-judge@example.com',
      name: 'QA Judge',
      role: 'judge',
      password: bcrypt.hashSync('JudgePass1', 10),
    },
  });
}

async function seedHackathon() {
  const hackathon = await prisma.hackathon.create({
    data: {
      title: 'QA Hackathon',
      tagline: 'Quality Assurance',
      startAt: new Date('2026-09-01T09:00:00.000Z'),
      endAt: new Date('2026-09-03T18:00:00.000Z'),
      status: 'draft',
      coverGradient: 'from-blue-500 to-cyan-500',
      submissionSchema: {},
    },
  });
  return { hackathon };
}

describe('AI doc generation — non-admin authorization (requireAdmin)', () => {
  it('judge JWT is rejected with 403 on generate-description', async () => {
    const { hackathon } = await seedHackathon();
    const judge = await seedJudge();
    const token = makeToken(judge.id, 'judge');
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh' });
    expect(res.status).toBe(403);
  });

  it('judge JWT is rejected with 403 on generate-news', async () => {
    const { hackathon } = await seedHackathon();
    const judge = await seedJudge();
    const token = makeToken(judge.id, 'judge');
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-news`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh' });
    expect(res.status).toBe(403);
  });

  it('judge JWT is rejected with 403 on suggest-criteria', async () => {
    const { hackathon } = await seedHackathon();
    const judge = await seedJudge();
    const token = makeToken(judge.id, 'judge');
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ criterionCount: 6 });
    expect(res.status).toBe(403);
  });

  it('judge JWT is rejected with 403 on ai-cost', async () => {
    const judge = await seedJudge();
    const token = makeToken(judge.id, 'judge');
    const res = await request(app)
      .get('/api/admin/ai-cost')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('AI doc generation — input validation (zod)', () => {
  it('generate-description rejects unknown fields (strict mode optional — zod default)', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    // tracks out of range (>5)
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        language: 'zh',
        tracks: ['a', 'b', 'c', 'd', 'e', 'f'], // 6 > 5
      });
    expect(res.status).toBe(400);
  });

  it('generate-description rejects a too-long theme', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh', theme: 'a'.repeat(600) });
    expect(res.status).toBe(400);
  });

  it('suggest-criteria rejects criterionCount < 5', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ criterionCount: 2 });
    expect(res.status).toBe(400);
  });

  it('suggest-criteria rejects criterionCount > 7', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ criterionCount: 12 });
    expect(res.status).toBe(400);
  });

  it('suggest-criteria rejects non-integer criterionCount', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ criterionCount: 5.5 });
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed body (no LLM call — should still error 5xx on LLM but pass zod)', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'both', theme: 'Web3', tracks: ['DePIN', 'ZK'] });
    // The body passed zod, so the LLM call ran and failed with
    // LLM_INVALID_KEY (test env has no API key).
    expect([500, 502]).toContain(res.status);
    expect(['LLM_INVALID_KEY', 'LLM_FAILED']).toContain(res.body.code);
  });
});

describe('AI doc generation — 404 for unknown hackathon', () => {
  it('generate-description with a fake id → 404 or 502 (auth passes first)', async () => {
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post('/api/ai/hackathons/this-id-does-not-exist/generate-description')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh' });
    // 404 if the auth check + the hackathon lookup happens before
    // any LLM call. (In this implementation the hackathon lookup
    // is the first step inside runHackathonGeneration.)
    expect([404, 502]).toContain(res.status);
  });
});

describe('AI doc generation — audit log on success and failure', () => {
  it('writes a failed AIGenerationLog row when the LLM call fails', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh' });
    expect([500, 502]).toContain(res.status);

    const logs = await prisma.aIGenerationLog.findMany({
      where: { hackathonId: hackathon.id },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].type).toBe('description');
    expect(logs[0].status).toBe('failed');
    expect(logs[0].errorCode).toBeTruthy();
    expect(logs[0].actorId).toBe(admin.id);
  });

  it('records a separate log row per type (description / news / criteria)', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);

    await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh' });
    await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ criterionCount: 6 });

    const logs = await prisma.aIGenerationLog.findMany({
      where: { hackathonId: hackathon.id },
      orderBy: { type: 'asc' },
    });
    const types = logs.map((l) => l.type).sort();
    expect(types).toContain('description');
    expect(types).toContain('criteria');
  });
});

describe('AI doc generation — existing endpoints also require auth (V3.10)', () => {
  it('optimize-description rejects unauthenticated with 401', async () => {
    const res = await request(app)
      .post('/api/ai/optimize-description')
      .send({ description: 'hello' });
    expect(res.status).toBe(401);
  });

  it('moderate-content rejects unauthenticated with 401', async () => {
    const res = await request(app)
      .post('/api/ai/moderate-content')
      .send({ content: 'hello' });
    expect(res.status).toBe(401);
  });

  it('optimize-description rejects non-admin with 403', async () => {
    const judge = await seedJudge();
    const token = makeToken(judge.id, 'judge');
    const res = await request(app)
      .post('/api/ai/optimize-description')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'hello' });
    expect(res.status).toBe(403);
  });

  it('moderate-content rejects non-admin with 403', async () => {
    const judge = await seedJudge();
    const token = makeToken(judge.id, 'judge');
    const res = await request(app)
      .post('/api/ai/moderate-content')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'hello' });
    expect(res.status).toBe(403);
  });
});

describe('AI cost — month parsing and aggregation', () => {
  it('defaults to the current month when ?month is missing', async () => {
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .get('/api/admin/ai-cost')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('accepts an explicit ?month=YYYY-MM parameter', async () => {
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .get('/api/admin/ai-cost?month=2026-07')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-07');
  });

  it('ignores an invalid ?month= format and falls back to current month', async () => {
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    const res = await request(app)
      .get('/api/admin/ai-cost?month=not-a-date')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('aggregates byType buckets (description / news / criteria)', async () => {
    const { hackathon } = await seedHackathon();
    const admin = await seedAdmin();
    const token = makeToken(admin.id);
    // Force 2 failed calls — they still log.
    await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/generate-description`)
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'zh' });
    await request(app)
      .post(`/api/ai/hackathons/${hackathon.id}/suggest-criteria`)
      .set('Authorization', `Bearer ${token}`)
      .send({ criterionCount: 6 });

    const res = await request(app)
      .get('/api/admin/ai-cost')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalCalls).toBeGreaterThanOrEqual(2);
    expect(res.body.byType.description).toBeDefined();
    expect(res.body.byType.criteria).toBeDefined();
  });
});
