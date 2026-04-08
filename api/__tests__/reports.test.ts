import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app, prisma } from '../server';
import {
  createHackathon,
  createUser,
  createProject,
  createAssignment,
  createScore,
} from './factories';

describe('Reports API', () => {
  describe('GET /api/reports/projects', () => {
    it('returns empty array when no projects exist', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns project report with assignment stats', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id, { title: 'Test Project' });
      await createAssignment(prisma, project.id, judge.id, { status: 'pending' });

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        projectId: project.id,
        projectTitle: 'Test Project',
        totalAssignments: 1,
        completedAssignments: 0,
        pendingAssignments: 1,
        inProgressAssignments: 0,
        averageScore: 0,
      });
      expect(res.body[0].judges).toHaveLength(1);
      expect(res.body[0].judges[0]).toMatchObject({
        judgeId: judge.id,
        judgeName: judge.name,
        status: 'pending',
      });
    });

    it('calculates average score from completed assignments', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge1 = await createUser(prisma, { role: 'judge' });
      const judge2 = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);

      const assignment1 = await createAssignment(prisma, project.id, judge1.id, {
        status: 'completed',
        totalScore: 80,
      });
      const assignment2 = await createAssignment(prisma, project.id, judge2.id, {
        status: 'completed',
        totalScore: 90,
      });

      await Promise.all(
        hackathon.scoringCriteria.map((c) =>
          Promise.all([
            createScore(prisma, assignment1.id, c.id, 40),
            createScore(prisma, assignment2.id, c.id, 45),
          ])
        )
      );

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body[0].averageScore).toBe(85);
      expect(res.body[0].completedAssignments).toBe(2);
    });

    it('sorts by average score desc, then by title', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });

      const projectA = await createProject(prisma, hackathon.id, { title: 'Project A' });
      const projectB = await createProject(prisma, hackathon.id, { title: 'Project B' });
      const projectC = await createProject(prisma, hackathon.id, { title: 'Project C' });

      // Project A: score 50
      const assignA = await createAssignment(prisma, projectA.id, judge.id, {
        status: 'completed',
        totalScore: 50,
      });
      await Promise.all(hackathon.scoringCriteria.map((c) => createScore(prisma, assignA.id, c.id, 25)));

      // Project B: score 90
      const assignB = await createAssignment(prisma, projectB.id, judge.id, {
        status: 'completed',
        totalScore: 90,
      });
      await Promise.all(hackathon.scoringCriteria.map((c) => createScore(prisma, assignB.id, c.id, 45)));

      // Project C: no score
      await createAssignment(prisma, projectC.id, judge.id, { status: 'pending' });

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body[0].projectTitle).toBe('Project B'); // 90
      expect(res.body[1].projectTitle).toBe('Project A'); // 50
      expect(res.body[2].projectTitle).toBe('Project C'); // 0
    });

    it('filters by hackathonId', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon1 = await createHackathon(prisma);
      const hackathon2 = await createHackathon(prisma, { title: 'Other' });
      await createProject(prisma, hackathon1.id, { title: 'Project 1' });
      await createProject(prisma, hackathon2.id, { title: 'Project 2' });

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon1.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].projectTitle).toBe('Project 1');
    });

    it('includes all judge details in report', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id, {
        status: 'completed',
        totalScore: 75,
        comment: 'Great work!',
      });
      await Promise.all(hackathon.scoringCriteria.map((c) => createScore(prisma, assignment.id, c.id, 37)));

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body[0].judges[0]).toMatchObject({
        assignmentId: assignment.id,
        judgeId: judge.id,
        judgeName: judge.name,
        judgeEmail: judge.email,
        status: 'completed',
        totalScore: 75,
        comment: 'Great work!',
      });
      expect(res.body[0].judges[0].scores).toHaveLength(2);
      expect(res.body[0].judges[0].scoredAt).toBeDefined();
    });

    it('handles in_progress assignments correctly', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      await createAssignment(prisma, project.id, judge.id, { status: 'in_progress' });

      const res = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body[0]).toMatchObject({
        totalAssignments: 1,
        completedAssignments: 0,
        pendingAssignments: 0,
        inProgressAssignments: 1,
      });
    });
  });

  describe('GET /api/reports/scoring', () => {
    it('returns empty array when no completed assignments', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      await createAssignment(prisma, project.id, judge.id, { status: 'pending' });

      const res = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns only completed assignments with scores', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id, { title: 'Test Project' });
      const assignment = await createAssignment(prisma, project.id, judge.id, {
        status: 'completed',
        totalScore: 85,
        comment: 'Well done',
      });
      await Promise.all(hackathon.scoringCriteria.map((c) => createScore(prisma, assignment.id, c.id, 42)));

      const res = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        assignmentId: assignment.id,
        projectId: project.id,
        projectTitle: 'Test Project',
        judgeId: judge.id,
        judgeName: judge.name,
        totalScore: 85,
        comment: 'Well done',
      });
      expect(res.body[0].scores).toHaveLength(2);
    });

    it('filters by hackathonId', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon1 = await createHackathon(prisma);
      const hackathon2 = await createHackathon(prisma, { title: 'Other' });
      const judge = await createUser(prisma, { role: 'judge' });

      const project1 = await createProject(prisma, hackathon1.id);
      const project2 = await createProject(prisma, hackathon2.id);

      const assign1 = await createAssignment(prisma, project1.id, judge.id, { status: 'completed', totalScore: 80 });
      const assign2 = await createAssignment(prisma, project2.id, judge.id, { status: 'completed', totalScore: 90 });

      await Promise.all(hackathon1.scoringCriteria.map((c) =>
        Promise.all([
          createScore(prisma, assign1.id, c.id, 40),
          createScore(prisma, assign2.id, c.id, 45),
        ])
      ));

      const res = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon1.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].totalScore).toBe(80);
    });

    it('excludes pending and in_progress assignments', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge1 = await createUser(prisma, { role: 'judge' });
      const judge2 = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);

      await createAssignment(prisma, project.id, judge1.id, { status: 'pending' });
      await createAssignment(prisma, project.id, judge2.id, { status: 'in_progress' });

      const res = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('includes createdAt for each assignment', async () => {
      const admin = await createUser(prisma, { role: 'admin' });
      const hackathon = await createHackathon(prisma);
      const judge = await createUser(prisma, { role: 'judge' });
      const project = await createProject(prisma, hackathon.id);
      const assignment = await createAssignment(prisma, project.id, judge.id, { status: 'completed', totalScore: 75 });
      await Promise.all(hackathon.scoringCriteria.map((c) => createScore(prisma, assignment.id, c.id, 37)));

      const res = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon.id}`)
        .set('x-test-role', 'admin')
        .set('x-test-user-id', admin.id)
        .set('x-test-email', admin.email)
        .set('x-test-name', admin.name)
        .expect(200);

      expect(res.body[0].createdAt).toBeDefined();
      expect(new Date(res.body[0].createdAt)).toBeInstanceOf(Date);
    });
  });
});
