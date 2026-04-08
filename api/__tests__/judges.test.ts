import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, prisma } from '../server';
import {
  createHackathon,
  createUser,
  createProject,
  createAssignment,
} from './factories';

const adminHeaders = (admin: { id: string; email: string; name: string }) => ({
  'x-test-role': 'admin',
  'x-test-user-id': admin.id,
  'x-test-email': admin.email,
  'x-test-name': admin.name,
});

describe('Judges API', () => {
  describe('GET /api/hackathon/judges', () => {
    it('returns empty array when no judges registered', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      await createHackathon(prisma);

      const res = await request(app)
        .get('/api/hackathon/judges')
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns registered judges for current hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      await prisma.hackathonJudge.create({
        data: { hackathonId: hackathon.id, userId: judge.id },
      });

      const res = await request(app)
        .get('/api/hackathon/judges')
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(judge.id);
      expect(res.body[0].email).toBe(judge.email);
      expect(res.body[0].role).toBe('judge');
    });
  });

  describe('POST /api/hackathon/judges', () => {
    it('registers existing judges to current hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      await createHackathon(prisma);
      const judge1 = await createUser(prisma, { role: 'judge' });
      const judge2 = await createUser(prisma, { role: 'judge' });

      const res = await request(app)
        .post('/api/hackathon/judges')
        .set(adminHeaders(admin))
        .send({ judgeIds: [judge1.id, judge2.id] })
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body.map((j: { id: string }) => j.id)).toContain(judge1.id);
      expect(res.body.map((j: { id: string }) => j.id)).toContain(judge2.id);
    });

    it('validates judgeIds is required', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      await createHackathon(prisma);

      await request(app)
        .post('/api/hackathon/judges')
        .set(adminHeaders(admin))
        .send({})
        .expect(400);
    });
  });

  describe('DELETE /api/hackathon/judges/:judgeId', () => {
    it('removes judge registration from current hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      await prisma.hackathonJudge.create({
        data: { hackathonId: hackathon.id, userId: judge.id },
      });

      await request(app)
        .delete(`/api/hackathon/judges/${judge.id}`)
        .set(adminHeaders(admin))
        .expect(200);

      const registrations = await prisma.hackathonJudge.count({
        where: { hackathonId: hackathon.id },
      });
      expect(registrations).toBe(0);
    });

    it('blocks removal when judge has assignments in hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      await prisma.hackathonJudge.create({
        data: { hackathonId: hackathon.id, userId: judge.id },
      });
      const project = await createProject(prisma, hackathon.id);
      await createAssignment(prisma, project.id, judge.id);

      await request(app)
        .delete(`/api/hackathon/judges/${judge.id}`)
        .set(adminHeaders(admin))
        .expect(409);
    });
  });

  describe('GET /api/hackathons/:id/judges', () => {
    it('returns judges for specific hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      await prisma.hackathonJudge.create({
        data: { hackathonId: hackathon.id, userId: judge.id },
      });

      const res = await request(app)
        .get(`/api/hackathons/${hackathon.id}/judges`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe(judge.id);
    });

    it('returns 404 for non-existent hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });

      await request(app)
        .get('/api/hackathons/non-existent-id/judges')
        .set(adminHeaders(admin))
        .expect(404);
    });
  });

  describe('POST /api/hackathons/:id/judges', () => {
    it('registers judges to specific hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });

      const res = await request(app)
        .post(`/api/hackathons/${hackathon.id}/judges`)
        .set(adminHeaders(admin))
        .send({ judgeIds: [judge.id] })
        .expect(200);

      expect(res.body).toHaveLength(1);

      const registration = await prisma.hackathonJudge.findUnique({
        where: {
          hackathonId_userId: {
            hackathonId: hackathon.id,
            userId: judge.id,
          },
        },
      });
      expect(registration).not.toBeNull();
    });
  });

  describe('DELETE /api/hackathons/:id/judges/:judgeId', () => {
    it('removes judge from specific hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      await prisma.hackathonJudge.create({
        data: { hackathonId: hackathon.id, userId: judge.id },
      });

      await request(app)
        .delete(`/api/hackathons/${hackathon.id}/judges/${judge.id}`)
        .set(adminHeaders(admin))
        .expect(200);

      const registration = await prisma.hackathonJudge.findUnique({
        where: {
          hackathonId_userId: {
            hackathonId: hackathon.id,
            userId: judge.id,
          },
        },
      });
      expect(registration).toBeNull();
    });
  });
});
