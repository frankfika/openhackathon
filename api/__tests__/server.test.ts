import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app, prisma } from '../server';

const DEFAULT_PASSWORD = 'secret123';

async function seedHackathon() {
  const hackathon = await prisma.hackathon.create({
    data: {
      title: 'OpenHack 2026',
      tagline: 'Build fast',
      city: 'San Francisco',
      startAt: new Date('2026-01-10T09:00:00.000Z'),
      endAt: new Date('2026-01-12T18:00:00.000Z'),
      status: 'published',
      coverGradient: 'from-blue-500 to-cyan-500',
      submissionSchema: {},
      sessions: {
        create: [
          {
            name: 'Preliminary',
            type: 'preliminary',
            status: 'active',
            startAt: new Date('2026-01-10T10:00:00.000Z'),
            endAt: new Date('2026-01-10T18:00:00.000Z'),
          },
        ],
      },
      scoringCriteria: {
        create: [
          { name: 'Innovation', maxScore: 60, sortOrder: 0 },
          { name: 'Execution', maxScore: 40, sortOrder: 1 },
        ],
      },
    },
    include: {
      sessions: true,
      scoringCriteria: true,
    },
  });

  return {
    hackathon,
    session: hackathon.sessions[0],
    criteria: hackathon.scoringCriteria,
  };
}

async function createJudge(email = 'judge@example.com', name = 'Judge One') {
  return prisma.user.create({
    data: {
      email,
      name,
      role: 'judge',
      password: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
    },
  });
}

async function createProject(params: { hackathonId: string; sessionId: string; title: string }) {
  const { hackathonId, sessionId, title } = params;
  const project = await prisma.project.create({
    data: {
      hackathonId,
      sessionId,
      title,
      oneLiner: `${title} one-liner`,
      description: `${title} description`,
      tags: ['AI'],
      demoUrl: 'https://demo.example.com',
      repoUrl: 'https://github.com/example/repo',
      submitterEmail: `${title.toLowerCase().replace(/\s+/g, '-')}-owner@example.com`,
      submitterName: 'Project Owner',
      submissionData: {},
      status: 'submitted',
    },
  });

  await prisma.projectRound.upsert({
    where: {
      projectId_sessionId: {
        projectId: project.id,
        sessionId,
      },
    },
    update: {},
    create: {
      projectId: project.id,
      sessionId,
      promotionStatus: 'pending',
    },
  });

  return project;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('API integration tests (real database)', () => {
  describe('Site Settings', () => {
    it('returns default site settings when none exist', async () => {
      const res = await request(app).get('/api/site-settings').expect(200);
      expect(res.body.siteName).toBe('OpenHackathon');
      expect(res.body.tabTitle).toBe('OpenHackathon');
      expect(res.body.showPoweredBy).toBe(true);
    });

    it('updates site settings and supports clearing logo url', async () => {
      const updateRes = await request(app)
        .put('/api/site-settings')
        .send({
          siteName: 'My Hackathon Hub',
          tabTitle: 'My Hackathon Hub Admin',
          seoTitle: 'Best Hackathon Platform',
          seoDescription: 'Custom SEO description',
          faviconUrl: '/favicon.svg',
          logoUrl: 'https://cdn.example.com/logo.svg',
          showPoweredBy: false,
          poweredByText: 'Built with OpenHackathon',
          poweredByUrl: 'https://openhackathon.dev',
        })
        .expect(200);

      expect(updateRes.body.siteName).toBe('My Hackathon Hub');
      expect(updateRes.body.logoUrl).toBe('https://cdn.example.com/logo.svg');
      expect(updateRes.body.showPoweredBy).toBe(false);

      const clearLogoRes = await request(app)
        .put('/api/site-settings')
        .send({ logoUrl: '' })
        .expect(200);

      expect(clearLogoRes.body.logoUrl).toBeNull();
    });
  });

  describe('Hackathons', () => {
    it('creates and fetches hackathons with nested sessions and scoring criteria', async () => {
      const payload = {
        title: 'City Hack',
        tagline: 'Hack for good',
        city: 'New York',
        startAt: '2026-02-01T09:00:00.000Z',
        endAt: '2026-02-03T18:00:00.000Z',
        status: 'draft',
        coverGradient: 'from-red-400 to-orange-500',
        submissionSchema: { sections: [{ key: 'pitch' }] },
        sessions: [
          {
            name: 'Round 1',
            type: 'preliminary',
            status: 'draft',
            startAt: '2026-02-01T10:00:00.000Z',
            endAt: '2026-02-01T18:00:00.000Z',
          },
        ],
        scoringCriteria: [
          { name: 'Impact', maxScore: 50, sortOrder: 0 },
          { name: 'Feasibility', maxScore: 50, sortOrder: 1 },
        ],
      };

      const createRes = await request(app).post('/api/hackathons').send(payload).expect(200);
      expect(createRes.body.title).toBe('City Hack');
      expect(createRes.body.sessions).toHaveLength(1);
      expect(createRes.body.scoringCriteria).toHaveLength(2);

      const listRes = await request(app).get('/api/hackathons').expect(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(createRes.body.id);

      const detailRes = await request(app)
        .get(`/api/hackathons/${createRes.body.id}`)
        .expect(200);
      expect(detailRes.body.id).toBe(createRes.body.id);
      expect(detailRes.body.scoringCriteria[0].name).toBe('Impact');
    });

    it('updates hackathon fields, updates existing sessions, and creates new sessions', async () => {
      const { hackathon, session } = await seedHackathon();

      const payload = {
        title: 'OpenHack Updated',
        tagline: 'Build better',
        city: 'Seattle',
        startAt: '2026-01-11T09:00:00.000Z',
        endAt: '2026-01-13T18:00:00.000Z',
        status: 'active',
        coverGradient: 'from-green-400 to-emerald-600',
        submissionSchema: { sections: [{ key: 'video' }] },
        sessions: [
          {
            id: session.id,
            name: 'Preliminary Updated',
            type: 'preliminary',
            status: 'judging',
            startAt: '2026-01-11T10:00:00.000Z',
            endAt: '2026-01-11T18:00:00.000Z',
          },
          {
            name: 'Final Round',
            type: 'final',
            status: 'draft',
            startAt: '2026-01-12T10:00:00.000Z',
            endAt: '2026-01-12T18:00:00.000Z',
          },
        ],
        scoringCriteria: [
          { name: 'Novelty', maxScore: 70, sortOrder: 0 },
          { name: 'Quality', maxScore: 30, sortOrder: 1 },
        ],
      };

      const updateRes = await request(app)
        .put(`/api/hackathons/${hackathon.id}`)
        .send(payload)
        .expect(200);

      expect(updateRes.body.title).toBe('OpenHack Updated');
      expect(updateRes.body.sessions).toHaveLength(2);
      expect(updateRes.body.scoringCriteria).toHaveLength(2);

      const criteria = await prisma.scoringCriterion.findMany({
        where: { hackathonId: hackathon.id },
        orderBy: { sortOrder: 'asc' },
      });
      expect(criteria.map((c) => c.name)).toEqual(['Novelty', 'Quality']);

      const sessions = await prisma.session.findMany({ where: { hackathonId: hackathon.id } });
      expect(sessions).toHaveLength(2);
      expect(sessions.some((s) => s.name === 'Preliminary Updated')).toBe(true);
      expect(sessions.some((s) => s.name === 'Final Round')).toBe(true);
    });

    it('returns 404 for a non-existing hackathon', async () => {
      await request(app).get('/api/hackathons/non-existent-id').expect(404);
    });
  });

  describe('Projects', () => {
    it('runs full project CRUD with related assignment cleanup', async () => {
      const { hackathon, session } = await seedHackathon();
      const judge = await createJudge();

      const createPayload = {
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Vision AI',
        oneLiner: 'Computer vision helper',
        description: 'Detects defects in real time',
        tags: ['AI', 'Vision'],
        demoUrl: 'https://demo.example.com/vision-ai',
        repoUrl: 'https://github.com/example/vision-ai',
        submitterEmail: 'owner@example.com',
        submitterName: 'Owner',
        submissionData: { stack: ['vite', 'node'] },
      };

      const createRes = await request(app).post('/api/projects').send(createPayload).expect(200);
      const projectId = createRes.body.id;
      expect(createRes.body.title).toBe('Vision AI');
      expect(createRes.body.hackathon.id).toBe(hackathon.id);
      expect(createRes.body.status).toBe('submitted');
      expect(createRes.body.receipt?.id).toMatch(/^SUB-\d{8}-[A-F0-9]{6}$/);
      expect(createRes.body.receipt?.email).toBe('owner@example.com');
      expect(createRes.body.receipt?.emailSent).toBe(false);
      expect(createRes.body.receipt?.emailFailureReason).toBe('disabled');

      const listRes = await request(app)
        .get(`/api/projects?hackathonId=${hackathon.id}`)
        .expect(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(projectId);

      const detailRes = await request(app).get(`/api/projects/${projectId}`).expect(200);
      expect(detailRes.body.id).toBe(projectId);
      expect(detailRes.body.hackathon.scoringCriteria).toHaveLength(2);
      expect(detailRes.body.submissionData._receipt.emailSent).toBe(false);
      expect(detailRes.body.submissionData._receipt.emailFailureReason).toBe('disabled');

      const updateRes = await request(app)
        .put(`/api/projects/${projectId}`)
        .send({
          title: 'Vision AI Updated',
          oneLiner: 'Updated one-liner',
          description: 'Updated description',
          tags: ['AI'],
          demoUrl: 'https://demo.example.com/v2',
          repoUrl: 'https://github.com/example/vision-ai-v2',
          submissionData: { stack: ['react'] },
          status: 'draft',
        })
        .expect(200);
      expect(updateRes.body.title).toBe('Vision AI Updated');
      expect(updateRes.body.status).toBe('draft');
      expect(updateRes.body.submissionData.stack).toEqual(['react']);
      expect(updateRes.body.submissionData._receipt.id).toBe(createRes.body.receipt.id);

      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId,
          judgeId: judge.id,
          status: 'pending',
        },
      });

      await request(app).delete(`/api/projects/${projectId}`).expect(200);

      const assignmentCount = await prisma.assignment.count({ where: { projectId } });
      const projectCount = await prisma.project.count({ where: { id: projectId } });
      expect(assignmentCount).toBe(0);
      expect(projectCount).toBe(0);
    });

    it('supports resending submission receipt and persists latest delivery status', async () => {
      const { hackathon, session } = await seedHackathon();
      const createRes = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          sessionId: session.id,
          title: 'Resend Test Project',
          submitterEmail: 'resend-owner@example.com',
          submitterName: 'Resend Owner',
        })
        .expect(200);

      const resendRes = await request(app)
        .post(`/api/projects/${createRes.body.id}/receipt/resend`)
        .expect(200);

      expect(resendRes.body.projectId).toBe(createRes.body.id);
      expect(resendRes.body.receipt.id).toBe(createRes.body.receipt.id);
      expect(resendRes.body.receipt.email).toBe('resend-owner@example.com');
      expect(resendRes.body.receipt.emailSent).toBe(false);
      expect(resendRes.body.receipt.emailFailureReason).toBe('disabled');
      expect(resendRes.body.receipt.emailLastAttemptAt).toBeDefined();

      const detailRes = await request(app).get(`/api/projects/${createRes.body.id}`).expect(200);
      expect(detailRes.body.submissionData._receipt.id).toBe(createRes.body.receipt.id);
      expect(detailRes.body.submissionData._receipt.emailLastAttemptAt).toBeDefined();
      expect(detailRes.body.submissionData._receipt.emailFailureReason).toBe('disabled');
    });

    it('returns 404 for a non-existing project', async () => {
      await request(app).get('/api/projects/non-existent-id').expect(404);
    });

    it('requires submitterEmail for public project submission', async () => {
      const { hackathon, session } = await seedHackathon();
      const res = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          sessionId: session.id,
          title: 'No Email Project',
        })
        .expect(400);

      expect(res.body.error).toBe('submitterEmail is required');
    });
  });

  describe('Users and Auth', () => {
    it('creates user with real bcrypt hash, supports role filtering, and validates duplicates', async () => {
      const createRes = await request(app)
        .post('/api/users')
        .send({
          email: 'judge.new@example.com',
          name: 'Judge New',
          password: 'judge-password',
          role: 'judge',
        })
        .expect(200);

      expect(createRes.body.email).toBe('judge.new@example.com');
      expect(createRes.body.password).toBeUndefined();

      const stored = await prisma.user.findUnique({ where: { email: 'judge.new@example.com' } });
      expect(stored).toBeTruthy();
      expect(stored?.password).not.toBe('judge-password');
      expect(bcrypt.compareSync('judge-password', stored!.password)).toBe(true);

      await prisma.user.create({
        data: {
          email: 'admin.filter@example.com',
          name: 'Admin Filter',
          role: 'admin',
          password: bcrypt.hashSync('admin-password', 10),
        },
      });

      const judges = await request(app).get('/api/users?role=judge').expect(200);
      expect(judges.body).toHaveLength(1);
      expect(judges.body[0].email).toBe('judge.new@example.com');

      await request(app)
        .post('/api/users')
        .send({
          email: 'judge.new@example.com',
          name: 'Duplicate',
          password: '12345678',
          role: 'judge',
        })
        .expect(409);
    });

    it('authenticates with real password check and handles auth failures', async () => {
      await request(app)
        .post('/api/users')
        .send({
          email: 'auth.user@example.com',
          name: 'Auth User',
          password: 'my-password',
          role: 'admin',
        })
        .expect(200);

      const loginOk = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth.user@example.com',
          password: 'my-password',
        })
        .expect(200);

      expect(loginOk.body.email).toBe('auth.user@example.com');
      expect(loginOk.body.password).toBeUndefined();

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth.user@example.com',
          password: 'wrong-password',
        })
        .expect(401);

      await request(app).post('/api/auth/login').send({ email: 'auth.user@example.com' }).expect(400);
    });

    it('deletes user and cascades assignment + score cleanup', async () => {
      const { hackathon, session, criteria } = await seedHackathon();
      const judge = await createJudge('cascade.judge@example.com', 'Cascade Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Cascade Project',
      });

      const assignment = await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project.id,
          judgeId: judge.id,
          status: 'completed',
          totalScore: 88,
        },
      });

      await prisma.score.create({
        data: {
          assignmentId: assignment.id,
          criterionId: criteria[0].id,
          score: 88,
        },
      });

      await request(app).delete(`/api/users/${judge.id}`).expect(200);

      const userCount = await prisma.user.count({ where: { id: judge.id } });
      const assignmentCount = await prisma.assignment.count({ where: { judgeId: judge.id } });
      const scoreCount = await prisma.score.count({ where: { assignmentId: assignment.id } });

      expect(userCount).toBe(0);
      expect(assignmentCount).toBe(0);
      expect(scoreCount).toBe(0);
    });
  });

  describe('Assignments and Scores', () => {
    it('supports bulk assignment upsert and avoids duplicates', async () => {
      const { hackathon, session } = await seedHackathon();
      const judge = await createJudge('bulk.judge@example.com', 'Bulk Judge');
      const projectA = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Project A',
      });
      const projectB = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Project B',
      });

      const payload = {
        assignments: [
          { sessionId: session.id, projectId: projectA.id, judgeId: judge.id },
          { sessionId: session.id, projectId: projectB.id, judgeId: judge.id },
        ],
      };

      const first = await request(app).post('/api/assignments').send(payload).expect(200);
      expect(first.body).toHaveLength(2);

      const second = await request(app).post('/api/assignments').send(payload).expect(200);
      expect(second.body).toHaveLength(2);

      const count = await prisma.assignment.count();
      expect(count).toBe(2);

      const filtered = await request(app)
        .get(`/api/assignments?judgeId=${judge.id}&status=pending`)
        .expect(200);
      expect(filtered.body).toHaveLength(2);

      await request(app).delete(`/api/assignments/${first.body[0].id}`).expect(200);
      const afterDelete = await prisma.assignment.count();
      expect(afterDelete).toBe(1);
    });

    it('updates assignment status to in_progress', async () => {
      const { hackathon, session } = await seedHackathon();
      const judge = await createJudge('status.judge@example.com', 'Status Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Status Project',
      });

      const assignment = await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project.id,
          judgeId: judge.id,
          status: 'pending',
        },
      });

      const updateRes = await request(app)
        .put(`/api/assignments/${assignment.id}/status`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(updateRes.body.status).toBe('in_progress');

      const assignmentInDb = await prisma.assignment.findUnique({
        where: { id: assignment.id },
      });
      expect(assignmentInDb?.status).toBe('in_progress');
    });

    it('submits scores, computes totalScore, and persists score rows', async () => {
      const { hackathon, session, criteria } = await seedHackathon();
      const judge = await createJudge('score.judge@example.com', 'Score Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Score Project',
      });

      const assignment = await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project.id,
          judgeId: judge.id,
          status: 'pending',
        },
      });

      const submitRes = await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .send({
          scores: [
            { criterionId: criteria[0].id, score: 45 },
            { criterionId: criteria[1].id, score: 35 },
          ],
          comment: 'Solid implementation',
          status: 'completed',
        })
        .expect(200);

      expect(submitRes.body.totalScore).toBe(80);
      expect(submitRes.body.status).toBe('completed');

      const assignmentInDb = await prisma.assignment.findUnique({
        where: { id: assignment.id },
      });
      expect(assignmentInDb?.totalScore).toBe(80);
      expect(assignmentInDb?.comment).toBe('Solid implementation');

      const scoresInDb = await prisma.score.findMany({
        where: { assignmentId: assignment.id },
      });
      expect(scoresInDb).toHaveLength(2);
      expect(scoresInDb.map((s) => s.score).sort((a, b) => a - b)).toEqual([35, 45]);
    });
  });

  describe('Project Rounds and Promotions', () => {
    it('initializes project rounds for a session', async () => {
      const { hackathon, session } = await seedHackathon();
      const projectA = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Round Init A',
      });
      const projectB = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Round Init B',
      });

      const res = await request(app)
        .post('/api/project-rounds/initialize')
        .send({ sessionId: session.id })
        .expect(200);

      expect(res.body.initializedCount).toBe(2);

      const rounds = await prisma.projectRound.findMany({
        where: { sessionId: session.id },
        orderBy: { projectId: 'asc' },
      });
      expect(rounds).toHaveLength(2);
      expect(rounds.map((round) => round.projectId)).toEqual([projectA.id, projectB.id].sort());
    });

    it('advances a project to next round and auto-creates next-round assignments', async () => {
      const { hackathon, session } = await seedHackathon();
      const finalSession = await prisma.session.create({
        data: {
          hackathonId: hackathon.id,
          name: 'Final Round',
          type: 'final',
          status: 'draft',
          startAt: new Date('2026-01-11T10:00:00.000Z'),
          endAt: new Date('2026-01-11T18:00:00.000Z'),
        },
      });

      const judgeA = await createJudge('promo.a@example.com', 'Promo Judge A');
      const judgeB = await createJudge('promo.b@example.com', 'Promo Judge B');

      const project = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Promotion Project',
      });

      const currentRound = await prisma.projectRound.findUnique({
        where: {
          projectId_sessionId: {
            projectId: project.id,
            sessionId: session.id,
          },
        },
      });
      expect(currentRound).toBeTruthy();

      const currentAssignment = await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project.id,
          projectRoundId: currentRound!.id,
          judgeId: judgeA.id,
          status: 'completed',
          totalScore: 88,
        },
      });

      const promoteRes = await request(app)
        .put(`/api/project-rounds/${currentRound!.id}/promotion`)
        .send({
          decision: 'advanced',
          nextSessionId: finalSession.id,
          judgeIds: [judgeB.id],
        })
        .expect(200);

      expect(promoteRes.body.promotionStatus).toBe('advanced');
      expect(promoteRes.body.nextSessionId).toBe(finalSession.id);

      const nextRound = await prisma.projectRound.findUnique({
        where: {
          projectId_sessionId: {
            projectId: project.id,
            sessionId: finalSession.id,
          },
        },
      });
      expect(nextRound).toBeTruthy();
      expect(nextRound?.sourceRoundId).toBe(currentRound!.id);

      const previousAssignment = await prisma.assignment.findUnique({
        where: { id: currentAssignment.id },
      });
      expect(previousAssignment?.isLocked).toBe(true);

      const nextAssignments = await prisma.assignment.findMany({
        where: {
          sessionId: finalSession.id,
          projectId: project.id,
        },
      });
      expect(nextAssignments).toHaveLength(1);
      expect(nextAssignments[0].judgeId).toBe(judgeB.id);
      expect(nextAssignments[0].projectRoundId).toBe(nextRound?.id);
      expect(nextAssignments[0].status).toBe('pending');
    });

    it('applies bulk promotion decisions', async () => {
      const { hackathon, session } = await seedHackathon();
      const finalSession = await prisma.session.create({
        data: {
          hackathonId: hackathon.id,
          name: 'Final Stage',
          type: 'final',
          status: 'draft',
          startAt: new Date('2026-01-11T10:00:00.000Z'),
          endAt: new Date('2026-01-11T18:00:00.000Z'),
        },
      });
      const judge = await createJudge('promo.bulk@example.com', 'Promo Bulk Judge');

      const projectA = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Bulk Promotion A',
      });
      const projectB = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Bulk Promotion B',
      });

      const roundA = await prisma.projectRound.findUnique({
        where: {
          projectId_sessionId: {
            projectId: projectA.id,
            sessionId: session.id,
          },
        },
      });
      const roundB = await prisma.projectRound.findUnique({
        where: {
          projectId_sessionId: {
            projectId: projectB.id,
            sessionId: session.id,
          },
        },
      });

      const bulkRes = await request(app)
        .post('/api/project-rounds/promotions/bulk')
        .send({
          nextSessionId: finalSession.id,
          judgeIds: [judge.id],
          decisions: [
            { projectRoundId: roundA?.id, decision: 'advanced' },
            { projectRoundId: roundB?.id, decision: 'eliminated' },
          ],
        })
        .expect(200);

      expect(bulkRes.body).toHaveLength(2);
      expect(bulkRes.body.every((item: any) => item.success)).toBe(true);

      const updatedA = await prisma.projectRound.findUnique({ where: { id: roundA!.id } });
      const updatedB = await prisma.projectRound.findUnique({ where: { id: roundB!.id } });
      expect(updatedA?.promotionStatus).toBe('advanced');
      expect(updatedA?.nextSessionId).toBe(finalSession.id);
      expect(updatedB?.promotionStatus).toBe('eliminated');

      const nextAssignments = await prisma.assignment.findMany({
        where: {
          sessionId: finalSession.id,
          projectId: projectA.id,
        },
      });
      expect(nextAssignments).toHaveLength(1);
      expect(nextAssignments[0].judgeId).toBe(judge.id);
    });
  });

  describe('Dashboard, Leaderboard, Reports', () => {
    it('returns dashboard stats from real data for admin and judge', async () => {
      const { hackathon, session } = await seedHackathon();
      const judge1 = await createJudge('judge1@example.com', 'Judge 1');
      const judge2 = await createJudge('judge2@example.com', 'Judge 2');

      const project1 = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Stats Project 1',
      });
      const project2 = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Stats Project 2',
      });

      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project1.id,
          judgeId: judge1.id,
          status: 'completed',
          totalScore: 80,
        },
      });
      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project2.id,
          judgeId: judge1.id,
          status: 'pending',
        },
      });
      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project1.id,
          judgeId: judge2.id,
          status: 'completed',
          totalScore: 90,
        },
      });

      const adminStats = await request(app)
        .get(`/api/dashboard/stats?role=admin&hackathonId=${hackathon.id}`)
        .expect(200);
      expect(adminStats.body).toMatchObject({
        totalProjects: 2,
        totalJudges: 2,
        totalAssignments: 3,
        completedAssignments: 2,
        pendingReviews: 1,
      });

      const judgeStats = await request(app)
        .get(`/api/dashboard/stats?role=judge&userId=${judge1.id}`)
        .expect(200);
      expect(judgeStats.body).toMatchObject({
        totalAssignments: 2,
        completed: 1,
        pending: 1,
      });
    });

    it('returns score-based leaderboard and curated leaderboard when published', async () => {
      const { hackathon, session } = await seedHackathon();
      const judge = await createJudge('leaderboard.judge@example.com', 'Leaderboard Judge');

      const projectA = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Leaderboard A',
      });
      const projectB = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Leaderboard B',
      });

      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: projectA.id,
          judgeId: judge.id,
          status: 'completed',
          totalScore: 72,
        },
      });
      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: projectB.id,
          judgeId: judge.id,
          status: 'completed',
          totalScore: 91,
        },
      });

      const scoresBased = await request(app)
        .get(`/api/leaderboard?hackathonId=${hackathon.id}`)
        .expect(200);
      expect(scoresBased.body).toHaveLength(2);
      expect(scoresBased.body[0].id).toBe(projectB.id);
      expect(scoresBased.body[0].avgScore).toBe(91);

      await request(app)
        .put(`/api/hackathons/${hackathon.id}/leaderboard`)
        .send({
          entries: [
            { projectId: projectA.id, rank: 1, award: 'Gold' },
            { projectId: projectB.id, rank: 2, award: 'Silver' },
          ],
          published: true,
        })
        .expect(200);

      const curated = await request(app)
        .get(`/api/leaderboard?hackathonId=${hackathon.id}`)
        .expect(200);
      expect(curated.body[0]).toMatchObject({
        id: projectA.id,
        rank: 1,
        award: 'Gold',
      });
      expect(curated.body[1]).toMatchObject({
        id: projectB.id,
        rank: 2,
        award: 'Silver',
      });

      const saved = await request(app).get(`/api/hackathons/${hackathon.id}/leaderboard`).expect(200);
      expect(saved.body.leaderboardPublished).toBe(true);
      expect(saved.body.leaderboardData).toHaveLength(2);
    });

    it('returns scoring report with completed assignments only', async () => {
      const { hackathon, session, criteria } = await seedHackathon();
      const judge = await createJudge('report.judge@example.com', 'Report Judge');
      const projectDone = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Report Done',
      });
      const projectPending = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Report Pending',
      });

      const completed = await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: projectDone.id,
          judgeId: judge.id,
          status: 'completed',
          comment: 'Great work',
          totalScore: 95,
        },
      });
      await prisma.score.create({
        data: {
          assignmentId: completed.id,
          criterionId: criteria[0].id,
          score: 55,
        },
      });
      await prisma.score.create({
        data: {
          assignmentId: completed.id,
          criterionId: criteria[1].id,
          score: 40,
        },
      });

      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: projectPending.id,
          judgeId: judge.id,
          status: 'pending',
        },
      });

      const report = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon.id}&sessionId=${session.id}`)
        .expect(200);
      expect(report.body).toHaveLength(1);
      expect(report.body[0]).toMatchObject({
        assignmentId: completed.id,
        projectTitle: 'Report Done',
        judgeName: 'Report Judge',
        totalScore: 95,
      });
      expect(report.body[0].scores).toHaveLength(2);
    });

    it('returns project report with real-time status per judge', async () => {
      const { hackathon, session } = await seedHackathon();
      const judgeA = await createJudge('project-report-a@example.com', 'Judge A');
      const judgeB = await createJudge('project-report-b@example.com', 'Judge B');
      const project = await createProject({
        hackathonId: hackathon.id,
        sessionId: session.id,
        title: 'Project Report Target',
      });

      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project.id,
          judgeId: judgeA.id,
          status: 'completed',
          totalScore: 84,
        },
      });
      await prisma.assignment.create({
        data: {
          sessionId: session.id,
          projectId: project.id,
          judgeId: judgeB.id,
          status: 'in_progress',
        },
      });

      const reportRes = await request(app)
        .get(`/api/reports/projects?hackathonId=${hackathon.id}`)
        .expect(200);

      expect(reportRes.body).toHaveLength(1);
      expect(reportRes.body[0]).toMatchObject({
        projectId: project.id,
        completedAssignments: 1,
        inProgressAssignments: 1,
        pendingAssignments: 0,
        totalAssignments: 2,
        averageScore: 84,
      });
      expect(reportRes.body[0].judges).toHaveLength(2);
      expect(reportRes.body[0].judges.some((j: any) => j.status === 'completed')).toBe(true);
      expect(reportRes.body[0].judges.some((j: any) => j.status === 'in_progress')).toBe(true);
    });
  });
});
