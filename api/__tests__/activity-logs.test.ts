import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, prisma } from '../server';
import {
  createHackathon,
  createUser,
} from './factories';

const adminHeaders = (admin: { id: string; email: string; name: string }) => ({
  'x-test-role': 'admin',
  'x-test-user-id': admin.id,
  'x-test-email': admin.email,
  'x-test-name': admin.name,
});

describe('Activity Logs API', () => {
  describe('GET /api/hackathon/activity-logs', () => {
    it('returns empty logs for new hackathon', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);

      const res = await request(app)
        .get(`/api/hackathon/activity-logs?hackathonId=${hackathon.id}`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body.logs).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
    });

    it('returns activity logs with stats on first page', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);

      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'create',
          entityType: 'project',
          entityId: 'test-project',
          metadata: {},
        },
      });

      const res = await request(app)
        .get(`/api/hackathon/activity-logs?hackathonId=${hackathon.id}`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body.logs).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.stats).toBeDefined();
      expect(res.body.stats.totalActions).toBe(1);
    });

    it('supports pagination with limit and offset', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);

      for (let i = 0; i < 5; i++) {
        await prisma.activityLog.create({
          data: {
            hackathonId: hackathon.id,
            actorId: admin.id,
            actorRole: 'admin',
            actorName: admin.name,
            action: 'create',
            entityType: 'project',
            entityId: `project-${i}`,
            metadata: {},
          },
        });
      }

      const res1 = await request(app)
        .get(`/api/hackathon/activity-logs?hackathonId=${hackathon.id}&limit=2&offset=0`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res1.body.logs).toHaveLength(2);
      expect(res1.body.total).toBe(5);

      const res2 = await request(app)
        .get(`/api/hackathon/activity-logs?hackathonId=${hackathon.id}&limit=2&offset=2`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res2.body.logs).toHaveLength(2);
      expect(res2.body.offset).toBe(2);
    });

    it('filters by action', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);

      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'create',
          entityType: 'project',
          entityId: 'test-1',
          metadata: {},
        },
      });
      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'delete',
          entityType: 'project',
          entityId: 'test-2',
          metadata: {},
        },
      });

      const res = await request(app)
        .get(`/api/hackathon/activity-logs?hackathonId=${hackathon.id}&action=create`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body.logs).toHaveLength(1);
      expect(res.body.logs[0].action).toBe('create');
    });

    it('filters by entityType', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);

      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'create',
          entityType: 'project',
          entityId: 'test-1',
          metadata: {},
        },
      });
      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'create',
          entityType: 'judge',
          entityId: 'test-2',
          metadata: {},
        },
      });

      const res = await request(app)
        .get(`/api/hackathon/activity-logs?hackathonId=${hackathon.id}&entityType=project`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body.logs).toHaveLength(1);
      expect(res.body.logs[0].entityType).toBe('project');
    });
  });

  describe('GET /api/hackathon/activity-logs/:entityType/:entityId', () => {
    it('returns logs for specific entity', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const projectId = 'test-project';

      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'create',
          entityType: 'project',
          entityId: projectId,
          metadata: { projectTitle: 'Test' },
        },
      });

      const res = await request(app)
        .get(`/api/hackathon/activity-logs/project/${projectId}`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body.logs).toHaveLength(1);
      expect(res.body.logs[0].entityId).toBe(projectId);
    });
  });

  describe('GET /api/hackathon/activity-stats', () => {
    it('returns activity statistics', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });

      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: admin.id,
          actorRole: 'admin',
          actorName: admin.name,
          action: 'create',
          entityType: 'project',
          entityId: 'p1',
          metadata: {},
        },
      });
      await prisma.activityLog.create({
        data: {
          hackathonId: hackathon.id,
          actorId: judge.id,
          actorRole: 'judge',
          actorName: judge.name,
          action: 'score',
          entityType: 'assignment',
          entityId: 'a1',
          metadata: {},
        },
      });

      const res = await request(app)
        .get(`/api/hackathon/activity-stats?hackathonId=${hackathon.id}`)
        .set(adminHeaders(admin))
        .expect(200);

      expect(res.body.totalActions).toBe(2);
      expect(res.body.recentActions).toBe(2);
      expect(res.body.byRole).toEqual({ admin: 1, judge: 1 });
      expect(res.body.byEntity).toEqual({ project: 1, assignment: 1 });
    });
  });
});
