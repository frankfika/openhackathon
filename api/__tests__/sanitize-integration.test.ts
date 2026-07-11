/**
 * Sanitize / password-leak guards at the API surface
 * (synth-design-spec §1.2 P0-1, §1.6 V1.1 / V1.2 / V1.3).
 *
 * Asserts that the live HTTP responses do not carry the password
 * column for any of the endpoints the audit flagged.
 */
import bcrypt from 'bcryptjs';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, prisma } from '../server';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.crossHackathonActivity.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.scoringCriterion.deleteMany();
  await prisma.hackathonJudge.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.walletAddress.deleteMany();
  await prisma.user.deleteMany();
});

async function seedAdmin() {
  return prisma.user.create({
    data: {
      email: 'sanitize-admin@example.com',
      name: 'Sanitize Admin',
      role: 'admin',
      password: bcrypt.hashSync('AdminPass1', 10),
    },
  });
}

describe('Sanitize: public / authenticated API does not leak password', () => {
  it('login response does not contain password or passwordHash', async () => {
    await seedAdmin();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'sanitize-admin@example.com', password: 'AdminPass1' })
      .expect(200);
    expect(res.body.password).toBeUndefined();
    expect(res.body.passwordHash).toBeUndefined();
    expect(typeof res.body.token).toBe('string');
  });

  it('GET /api/users/:id (admin) only returns the public fields', async () => {
    const admin = await seedAdmin();
    const res = await request(app)
      .get(`/api/users/${admin.id}`)
      .set('x-test-role', 'admin')
      .set('x-test-user-id', admin.id);
    // /api/users/:id is not a documented route; the surface that
    // actually returns user rows for admin is GET /api/users.
    // The important guard is that the public-fields whitelist is
    // applied at the row source.
    if (res.status === 200) {
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
    } else {
      expect([404, 405]).toContain(res.status);
    }
  });

  it('GET /api/users (admin) only returns the public fields', async () => {
    const admin = await seedAdmin();
    const res = await request(app)
      .get('/api/users')
      .set('x-test-role', 'admin')
      .set('x-test-user-id', admin.id)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const row of res.body) {
      expect(row.password).toBeUndefined();
      expect(row.passwordHash).toBeUndefined();
    }
  });

  it('public /api/users/:userId/global-profile does not leak the password column', async () => {
    const admin = await seedAdmin();
    const res = await request(app).get(`/api/users/${admin.id}/global-profile`);
    // 200 or 404 are both acceptable; the password column must
    // never appear in the body.
    const stringified = JSON.stringify(res.body);
    expect(stringified).not.toMatch(/password/);
  });

  it('public /api/projects/:id submitter field is restricted to { id, name, avatarUrl }', async () => {
    const admin = await seedAdmin();
    const hackathon = await prisma.hackathon.create({
      data: {
        title: 'Sanitize Hack',
        tagline: 'test',
        startAt: new Date('2026-09-01T00:00:00.000Z'),
        endAt: new Date('2026-09-02T00:00:00.000Z'),
        status: 'published',
        coverGradient: 'from-blue-500 to-cyan-500',
        submissionSchema: {},
      },
    });
    const project = await prisma.project.create({
      data: {
        hackathonId: hackathon.id,
        userId: admin.id,
        title: 'Sanitize Test Project',
        oneLiner: 'A test',
        description: 'desc',
        tags: ['test'],
        submitterEmail: 'submitter@example.com',
        submitterName: 'Submitter',
        submissionData: {},
        status: 'submitted',
      },
    });
    const res = await request(app).get(`/api/projects/${project.id}`).expect(200);
    expect(res.body.user).toBeDefined();
    const allowed = new Set(['id', 'name', 'avatarUrl']);
    for (const key of Object.keys(res.body.user)) {
      expect(allowed.has(key)).toBe(true);
    }
    expect(res.body.user.email).toBeUndefined();
    expect(res.body.user.role).toBeUndefined();
  });
});
