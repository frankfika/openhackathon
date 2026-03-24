import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { app, prisma } from '../server';

const DEFAULT_PASSWORD = 'secret123';
const TINY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jm3sAAAAASUVORK5CYII=';
type ProjectReportJudge = {
  status: 'pending' | 'in_progress' | 'completed';
};
type LegacyIdRow = { id: string };
type LegacyBooleanRow = { exists: boolean };
type LegacyProjectRow = {
  id: string;
  hackathonId: string;
  sessionId: string | null;
};

async function supportsSessionScopedAssignments() {
  const rows = await prisma.$queryRaw<LegacyBooleanRow[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'Assignment'
        AND column_name = 'sessionId'
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
}

async function ensureLegacySessionId(hackathonId: string) {
  const existing = await prisma.$queryRaw<LegacyIdRow[]>(Prisma.sql`
    SELECT "id"
    FROM "Session"
    WHERE "hackathonId" = ${hackathonId}
    ORDER BY "startAt" ASC, "createdAt" ASC, "id" ASC
    LIMIT 1
  `);
  if (existing[0]?.id) {
    return existing[0].id;
  }

  const hackathon = await prisma.hackathon.findUnique({
    where: { id: hackathonId },
    select: { id: true, status: true, startAt: true, endAt: true },
  });
  if (!hackathon) {
    throw new Error(`Hackathon ${hackathonId} not found`);
  }

  const now = new Date();
  const created = await prisma.$queryRaw<LegacyIdRow[]>(Prisma.sql`
    INSERT INTO "Session" (
      "id",
      "hackathonId",
      "name",
      "type",
      "status",
      "startAt",
      "endAt",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${hackathon.id},
      ${'Main Round'},
      ${'preliminary'},
      ${hackathon.status},
      ${hackathon.startAt},
      ${hackathon.endAt},
      ${now},
      ${now}
    )
    RETURNING "id"
  `);

  return created[0]!.id;
}

async function createAssignment(params: {
  id?: string;
  projectId: string;
  judgeId: string;
  status: 'pending' | 'in_progress' | 'completed';
  totalScore?: number;
  comment?: string;
}) {
  if (!await supportsSessionScopedAssignments()) {
    return prisma.assignment.create({
      data: {
        id: params.id,
        projectId: params.projectId,
        judgeId: params.judgeId,
        status: params.status,
        totalScore: params.totalScore,
        comment: params.comment,
      },
    });
  }

  const projectRows = await prisma.$queryRaw<LegacyProjectRow[]>(Prisma.sql`
    SELECT "id", "hackathonId", "sessionId"
    FROM "Project"
    WHERE "id" = ${params.projectId}
    LIMIT 1
  `);
  const project = projectRows[0];
  if (!project) {
    throw new Error(`Project ${params.projectId} not found`);
  }

  const sessionId = project.sessionId ?? await ensureLegacySessionId(project.hackathonId);
  if (!project.sessionId) {
    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Project"
      SET "sessionId" = ${sessionId}, "updatedAt" = NOW()
      WHERE "id" = ${project.id} AND "sessionId" IS NULL
    `);
  }

  const assignmentId = params.id ?? randomUUID();
  await prisma.$queryRaw<LegacyIdRow[]>(Prisma.sql`
    INSERT INTO "Assignment" (
      "id",
      "sessionId",
      "projectId",
      "judgeId",
      "status",
      "comment",
      "totalScore",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${assignmentId},
      ${sessionId},
      ${params.projectId},
      ${params.judgeId},
      ${params.status},
      ${params.comment ?? null},
      ${params.totalScore ?? null},
      NOW(),
      NOW()
    )
    RETURNING "id"
  `);

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) {
    throw new Error(`Assignment ${assignmentId} not found after insert`);
  }

  return assignment;
}

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
      scoringCriteria: {
        create: [
          { name: 'Innovation', maxScore: 60, sortOrder: 0 },
          { name: 'Execution', maxScore: 40, sortOrder: 1 },
        ],
      },
    },
    include: {
      scoringCriteria: true,
    },
  });

  return {
    hackathon,
    criteria: hackathon.scoringCriteria,
  };
}

async function createJudge(email = 'judge@example.com', name = 'Judge One') {
  const judge = await prisma.user.create({
    data: {
      email,
      name,
      role: 'judge',
      password: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
    },
  });

  const hackathons = await prisma.hackathon.findMany({
    select: { id: true },
  });
  if (hackathons.length > 0) {
    await prisma.hackathonJudge.createMany({
      data: hackathons.map((hackathon) => ({
        hackathonId: hackathon.id,
        userId: judge.id,
      })),
      skipDuplicates: true,
    });
  }

  return judge;
}

async function createProject(params: { hackathonId: string; title: string; submissionData?: Record<string, unknown> }) {
  const { hackathonId, title, submissionData } = params;
  const project = await prisma.project.create({
    data: {
      hackathonId,
      title,
      oneLiner: `${title} one-liner`,
      description: `${title} description`,
      tags: ['AI'],
      demoUrl: 'https://demo.example.com',
      repoUrl: 'https://github.com/example/repo',
      submitterEmail: `${title.toLowerCase().replace(/\s+/g, '-')}-owner@example.com`,
      submitterName: 'Project Owner',
      submissionData: (submissionData || {}) as Prisma.InputJsonValue,
      status: 'submitted',
    },
  });

  return project;
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('API integration tests (real database)', () => {
  describe('Security and health', () => {
    it('returns API health status with database state', async () => {
      const res = await request(app).get('/api/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('up');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('applies core security headers on API responses', async () => {
      const res = await request(app).get('/api/site-settings').expect(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(String(res.headers['x-frame-options']).toUpperCase()).toBe('SAMEORIGIN');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('returns JSON 404 for unknown API routes', async () => {
      const res = await request(app).get('/api/not-found-endpoint').expect(404);
      expect(res.body.error).toBe('API route not found');
    });
  });

  describe('Site Settings', () => {
    it('returns default site settings when none exist', async () => {
      const res = await request(app).get('/api/site-settings').expect(200);
      expect(res.body.siteName).toBe('OpenHackathon');
      expect(res.body.adminBasePath).toBe('/admin');
      expect(res.body.tabTitle).toBe('OpenHackathon');
      expect(res.body.showPoweredBy).toBe(true);
    });

    it('updates site settings and supports clearing logo url', async () => {
      const updateRes = await request(app)
        .put('/api/site-settings')
        .set('x-test-role', 'admin')
        .send({
          siteName: 'My Hackathon Hub',
          adminBasePath: 'secret-console/',
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
      expect(updateRes.body.adminBasePath).toBe('/secret-console');
      expect(updateRes.body.logoUrl).toBe('https://cdn.example.com/logo.svg');
      expect(updateRes.body.showPoweredBy).toBe(false);

      const clearLogoRes = await request(app)
        .put('/api/site-settings')
        .set('x-test-role', 'admin')
        .send({ logoUrl: '' })
        .expect(200);

      expect(clearLogoRes.body.logoUrl).toBeNull();
    });

    it('does not expose SMTP configuration on public site settings endpoint', async () => {
      await request(app)
        .put('/api/site-settings')
        .set('x-test-role', 'admin')
        .send({
          smtpHost: 'smtp.mail.example',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: 'apikey',
          smtpPass: 'secret-token',
          submissionEmailEnabled: true,
        })
        .expect(200);

      const publicRes = await request(app)
        .get('/api/site-settings')
        .set('x-test-role', 'judge')
        .expect(200);

      expect(publicRes.body.smtpHost).toBeUndefined();
      expect(publicRes.body.smtpPort).toBeUndefined();
      expect(publicRes.body.smtpUser).toBeUndefined();
      expect(publicRes.body.smtpPasswordConfigured).toBeUndefined();
      expect(publicRes.body.submissionEmailEnabled).toBeUndefined();
    });

    it('returns admin site settings with smtp password masked', async () => {
      await request(app)
        .put('/api/site-settings')
        .set('x-test-role', 'admin')
        .send({
          smtpHost: 'smtp.mail.example',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: 'apikey',
          smtpPass: 'secret-token',
          submissionEmailEnabled: true,
        })
        .expect(200);

      const adminRes = await request(app)
        .get('/api/site-settings/admin')
        .set('x-test-role', 'admin')
        .expect(200);

      expect(adminRes.body.smtpHost).toBe('smtp.mail.example');
      expect(adminRes.body.smtpUser).toBe('apikey');
      expect(adminRes.body.smtpPasswordConfigured).toBe(true);
      expect(adminRes.body.smtpPassEncrypted).toBeUndefined();
    });

    it('forbids non-admin access to admin site settings endpoint', async () => {
      const res = await request(app)
        .get('/api/site-settings/admin')
        .set('x-test-role', 'judge')
        .expect(403);
      expect(res.body.error).toBe('Admin access required');
    });

    it('uploads image for admin and serves it from static uploads path', async () => {
      const imageBuffer = Buffer.from(TINY_PNG_BASE64, 'base64');
      const uploadRes = await request(app)
        .post('/api/uploads/images')
        .set('x-test-role', 'admin')
        .set('x-file-name', encodeURIComponent('site-logo.png'))
        .set('content-type', 'image/png')
        .send(imageBuffer)
        .expect(200);

      expect(uploadRes.body.url).toMatch(/^\/uploads\/images\/.+\.png$/);
      expect(uploadRes.body.fileName).toMatch(/\.png$/);

      const fileRes = await request(app)
        .get(uploadRes.body.url)
        .expect(200);
      expect(String(fileRes.headers['content-type'])).toContain('image/png');
    });

    it('validates test email endpoint and reports missing smtp config', async () => {
      await request(app)
        .put('/api/site-settings')
        .set('x-test-role', 'admin')
        .send({
          submissionEmailEnabled: false,
          smtpHost: '',
          smtpUser: '',
          smtpPass: '',
        })
        .expect(200);

      await request(app)
        .post('/api/site-settings/email/test')
        .set('x-test-role', 'admin')
        .send({ to: 'invalid-email' })
        .expect(400);

      const res = await request(app)
        .post('/api/site-settings/email/test')
        .set('x-test-role', 'admin')
        .send({ to: 'test@example.com' })
        .expect(400);

      expect(res.body.sent).toBe(false);
      expect(['missing_config', 'send_failed']).toContain(res.body.reason);
    });
  });

  describe('Setup', () => {
    it('validates setup payload for email, required fields, and date range', async () => {
      const payload = {
        admin: {
          email: 'admin@example.com',
          name: 'Admin User',
          password: 'supersecret',
        },
        hackathon: {
          title: 'Launch Event',
          tagline: 'Build amazing things',
          city: 'Shanghai',
          startAt: '2026-04-01',
          endAt: '2026-04-03',
        },
      };

      await request(app)
        .post('/api/setup')
        .send({
          ...payload,
          admin: {
            ...payload.admin,
            email: 'invalid-email',
          },
        })
        .expect(400);

      await request(app)
        .post('/api/setup')
        .send({
          ...payload,
          hackathon: {
            ...payload.hackathon,
            startAt: '',
          },
        })
        .expect(400);

      await request(app)
        .post('/api/setup')
        .send({
          ...payload,
          hackathon: {
            ...payload.hackathon,
            startAt: '2026-04-05',
            endAt: '2026-04-03',
          },
        })
        .expect(400);
    });
  });

  describe('Hackathons', () => {
    it('creates and fetches hackathons with scoring criteria', async () => {
      const payload = {
        title: 'City Hack',
        tagline: 'Hack for good',
        city: 'New York',
        startAt: '2026-02-01T09:00:00.000Z',
        endAt: '2026-02-03T18:00:00.000Z',
        status: 'draft',
        coverGradient: 'from-red-400 to-orange-500',
        submissionSchema: { sections: [{ key: 'pitch' }] },
        submissionSuccessHintText: 'Join the event group',
        submissionSuccessHintImageUrl: '/uploads/images/submit-success-qr.png',
        scoringCriteria: [
          { name: 'Impact', maxScore: 50, sortOrder: 0 },
          { name: 'Feasibility', maxScore: 50, sortOrder: 1 },
        ],
      };

      const createRes = await request(app).post('/api/hackathons').send(payload).expect(200);
      expect(createRes.body.title).toBe('City Hack');
      expect(createRes.body.scoringCriteria).toHaveLength(2);
      expect(createRes.body.submissionSuccessHintText).toBe('Join the event group');
      expect(createRes.body.submissionSuccessHintImageUrl).toBe('/uploads/images/submit-success-qr.png');

      const listRes = await request(app).get('/api/hackathons').expect(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].id).toBe(createRes.body.id);

      const detailRes = await request(app)
        .get(`/api/hackathons/${createRes.body.id}`)
        .expect(200);
      expect(detailRes.body.id).toBe(createRes.body.id);
      expect(detailRes.body.scoringCriteria[0].name).toBe('Impact');
    });

    it('validates required fields and date range when creating hackathons', async () => {
      await request(app)
        .post('/api/hackathons')
        .send({
          title: 'City Hack',
          tagline: '',
          startAt: '2026-02-01',
          endAt: '2026-02-03',
          status: 'draft',
        })
        .expect(400);

      await request(app)
        .post('/api/hackathons')
        .send({
          title: 'City Hack',
          tagline: 'Hack for good',
          status: 'draft',
        })
        .expect(400);

      await request(app)
        .post('/api/hackathons')
        .send({
          title: 'City Hack',
          tagline: 'Hack for good',
          startAt: '2026-02-05',
          endAt: '2026-02-03',
          status: 'draft',
        })
        .expect(400);
    });

    it('updates hackathon fields and scoring criteria', async () => {
      const { hackathon } = await seedHackathon();

      const payload = {
        title: 'OpenHack Updated',
        tagline: 'Build better',
        city: 'Seattle',
        startAt: '2026-01-11T09:00:00.000Z',
        endAt: '2026-01-13T18:00:00.000Z',
        status: 'active',
        coverGradient: 'from-green-400 to-emerald-600',
        submissionSchema: { sections: [{ key: 'video' }] },
        submissionSuccessHintText: 'Scan the event WeChat QR for updates',
        submissionSuccessHintImageUrl: '/uploads/images/updated-qr.png',
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
      expect(updateRes.body.scoringCriteria).toHaveLength(2);
      expect(updateRes.body.submissionSuccessHintText).toBe('Scan the event WeChat QR for updates');
      expect(updateRes.body.submissionSuccessHintImageUrl).toBe('/uploads/images/updated-qr.png');

      const criteria = await prisma.scoringCriterion.findMany({
        where: { hackathonId: hackathon.id },
        orderBy: { sortOrder: 'asc' },
      });
      expect(criteria.map((c) => c.name)).toEqual(['Novelty', 'Quality']);
    });

    it('validates empty string updates and invalid date range when updating hackathons', async () => {
      const { hackathon } = await seedHackathon();

      await request(app)
        .put(`/api/hackathons/${hackathon.id}`)
        .send({ title: '   ' })
        .expect(400);

      await request(app)
        .put(`/api/hackathons/${hackathon.id}`)
        .send({
          startAt: '2026-01-15',
          endAt: '2026-01-11',
        })
        .expect(400);
    });

    it('stores, reads, and deletes local markdown documents for a hackathon', async () => {
      const { hackathon } = await seedHackathon();

      const uploadRes = await request(app)
        .put(`/api/hackathons/${hackathon.id}/markdown-doc`)
        .send({
          fileName: 'guide.md',
          content: '# Event Guide\n\n- Check in\n- Demo day',
        })
        .expect(200);

      expect(uploadRes.body.fileName).toBe('guide.md');
      expect(uploadRes.body.content).toContain('# Event Guide');

      const docRes = await request(app)
        .get(`/api/hackathons/${hackathon.id}/markdown-doc`)
        .expect(200);

      expect(docRes.body.fileName).toBe('guide.md');
      expect(docRes.body.content).toContain('Demo day');

      const deleteRes = await request(app)
        .delete(`/api/hackathons/${hackathon.id}/markdown-doc`)
        .expect(200);

      expect(deleteRes.body.success).toBe(true);

      await request(app)
        .get(`/api/hackathons/${hackathon.id}/markdown-doc`)
        .expect(404);
    });

    it('accepts large local pdf upload payloads for markdown doc endpoint', async () => {
      const { hackathon } = await seedHackathon();
      const largePdfBytes = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.alloc(2 * 1024 * 1024, 0x20),
        Buffer.from('\n%%EOF'),
      ]);
      const largePdfBase64 = largePdfBytes.toString('base64');

      const uploadRes = await request(app)
        .put(`/api/hackathons/${hackathon.id}/markdown-doc`)
        .send({
          fileName: 'large-guide.pdf',
          content: largePdfBase64,
          isBase64: true,
        })
        .expect(200);

      expect(uploadRes.body.fileName).toBe('large-guide.pdf');

      const docRes = await request(app)
        .get(`/api/hackathons/${hackathon.id}/markdown-doc`)
        .expect(200);
      expect(docRes.body.fileName).toBe('large-guide.pdf');
      expect(docRes.body.contentType).toBe('application/pdf');
    });

    it('returns 404 for a non-existing hackathon', async () => {
      await request(app).get('/api/hackathons/non-existent-id').expect(404);
    });
  });

  describe('Projects', () => {
    it('runs full project CRUD with related assignment cleanup', async () => {
      const { hackathon } = await seedHackathon();
      const judge = await createJudge();

      const createPayload = {
        hackathonId: hackathon.id,
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

      await createAssignment({
        projectId,
        judgeId: judge.id,
        status: 'pending',
      });

      await request(app).delete(`/api/projects/${projectId}`).expect(200);

      const assignmentCount = await prisma.assignment.count({ where: { projectId } });
      const projectCount = await prisma.project.count({ where: { id: projectId } });
      expect(assignmentCount).toBe(0);
      expect(projectCount).toBe(0);
    });

    it('supports resending submission receipt and persists latest delivery status', async () => {
      const { hackathon } = await seedHackathon();
      const createRes = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
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

    it('filters paginated projects by submission field values', async () => {
      const { hackathon } = await seedHackathon();
      await createProject({
        hackathonId: hackathon.id,
        title: 'AI Copilot',
        submissionData: { category: 'AI' },
      });
      await createProject({
        hackathonId: hackathon.id,
        title: 'Web Portal',
        submissionData: { category: 'Web' },
      });

      const res = await request(app)
        .get('/api/projects')
        .query({
          hackathonId: hackathon.id,
          page: 1,
          pageSize: 50,
          submissionFilters: JSON.stringify({ category: 'AI' }),
        })
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('AI Copilot');
    });

    it('rejects blank title when updating a project', async () => {
      const { hackathon } = await seedHackathon();
      const createRes = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          title: 'Editable Project',
          submitterEmail: 'editable@example.com',
          submitterName: 'Editable Owner',
        })
        .expect(200);

      const res = await request(app)
        .put(`/api/projects/${createRes.body.id}`)
        .send({ title: '   ' })
        .expect(400);

      expect(res.body.error).toBe('title is required');
    });

    it('returns 404 for a non-existing project', async () => {
      await request(app).get('/api/projects/non-existent-id').expect(404);
    });

    it('requires submitterEmail for public project submission', async () => {
      const { hackathon } = await seedHackathon();
      const res = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          title: 'No Email Project',
        })
        .expect(400);

      expect(res.body.error).toBe('submitterEmail is required');
    });

    it('requires title for public project submission', async () => {
      const { hackathon } = await seedHackathon();
      const res = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          submitterEmail: 'no-title@example.com',
        })
        .expect(400);

      expect(res.body.error).toBe('title is required');
    });

    it('validates submitterEmail format for public submission', async () => {
      const { hackathon } = await seedHackathon();
      const res = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          title: 'Invalid Email Project',
          submitterEmail: 'invalid-email',
        })
        .expect(400);

      expect(res.body.error).toBe('submitterEmail must be a valid email');
    });

    it('rate limits repeated public submissions from the same submitter email', async () => {
      const { hackathon } = await seedHackathon();
      const maxSubmissions = Number(process.env.SUBMISSION_RATE_LIMIT_MAX || 30);
      const allowedSubmissions = Number.isFinite(maxSubmissions) && maxSubmissions > 0
        ? Math.min(Math.floor(maxSubmissions), 20)
        : 20;
      const submitterEmail = 'submission-limit-test@example.com';

      for (let i = 0; i < allowedSubmissions; i += 1) {
        await request(app)
          .post('/api/projects')
          .send({
            hackathonId: hackathon.id,
            title: `Rate Limit Project ${i + 1}`,
            submitterEmail,
            submitterName: 'Rate Limit Tester',
          })
          .expect(200);
      }

      const limited = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          title: 'Rate Limit Project Blocked',
          submitterEmail,
          submitterName: 'Rate Limit Tester',
        })
        .expect(429);

      expect(limited.body.error).toBe('Too many submissions. Please try again later.');
    });

    it('filters projects by status and rejects invalid status filters', async () => {
      const { hackathon } = await seedHackathon();

      const submittedRes = await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          title: 'Submitted Project',
          submitterEmail: 'submitted@example.com',
          submitterName: 'Submitted Owner',
        })
        .expect(200);

      await request(app)
        .post('/api/projects')
        .send({
          hackathonId: hackathon.id,
          title: 'Draft Project',
          submitterEmail: 'draft@example.com',
          submitterName: 'Draft Owner',
        })
        .expect(200);

      await request(app)
        .put(`/api/projects/${submittedRes.body.id}`)
        .send({ status: 'draft' })
        .expect(200);

      const submittedList = await request(app)
        .get('/api/projects')
        .query({ hackathonId: hackathon.id, status: 'submitted' })
        .expect(200);
      expect(submittedList.body).toHaveLength(1);
      expect(submittedList.body[0].title).toBe('Draft Project');
      expect(submittedList.body[0].status).toBe('submitted');

      const draftList = await request(app)
        .get('/api/projects')
        .query({ hackathonId: hackathon.id, status: 'draft' })
        .expect(200);
      expect(draftList.body).toHaveLength(1);
      expect(draftList.body[0].title).toBe('Submitted Project');
      expect(draftList.body[0].status).toBe('draft');

      await request(app)
        .get('/api/projects')
        .query({ hackathonId: hackathon.id, status: 'invalid' })
        .expect(400);
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
      expect(typeof loginOk.body.token).toBe('string');

      const verified = jwt.verify(
        loginOk.body.token as string,
        process.env.JWT_SECRET || 'openhackathon-change-this-secret',
        {
          issuer: process.env.JWT_ISSUER || 'openhackathon',
          audience: process.env.JWT_AUDIENCE || 'openhackathon-clients',
        }
      ) as jwt.JwtPayload;
      expect(verified.sub).toBeTruthy();
      expect(verified.iss).toBe(process.env.JWT_ISSUER || 'openhackathon');

      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth.user@example.com',
          password: 'wrong-password',
        })
        .expect(401);

      await request(app).post('/api/auth/login').send({ email: 'auth.user@example.com' }).expect(400);
    });

    it('rejects invalid email and weak password on user creation', async () => {
      await request(app)
        .post('/api/users')
        .send({
          email: 'invalid-email',
          name: 'Bad Email User',
          password: 'good-password',
          role: 'judge',
        })
        .expect(400);

      await request(app)
        .post('/api/users')
        .send({
          email: 'weak.password@example.com',
          name: 'Weak Password User',
          password: '123',
          role: 'judge',
        })
        .expect(400);
    });

    it('deletes user and cascades assignment + score cleanup', async () => {
      const { hackathon, criteria } = await seedHackathon();
      const judge = await createJudge('cascade.judge@example.com', 'Cascade Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Cascade Project',
      });

      const assignment = await createAssignment({
        projectId: project.id,
        judgeId: judge.id,
        status: 'completed',
        totalScore: 88,
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

    it('registers and unregisters judges per hackathon', async () => {
      const { hackathon } = await seedHackathon();
      const judge = await prisma.user.create({
        data: {
          email: 'membership.judge@example.com',
          name: 'Membership Judge',
          role: 'judge',
          password: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
        },
      });

      const registerRes = await request(app)
        .post(`/api/hackathons/${hackathon.id}/judges`)
        .send({ judgeIds: [judge.id] })
        .expect(200);
      expect(registerRes.body).toHaveLength(1);
      expect(registerRes.body[0].id).toBe(judge.id);

      const listRes = await request(app)
        .get(`/api/hackathons/${hackathon.id}/judges`)
        .expect(200);
      expect(listRes.body).toHaveLength(1);
      expect(listRes.body[0].email).toBe('membership.judge@example.com');

      await request(app)
        .delete(`/api/hackathons/${hackathon.id}/judges/${judge.id}`)
        .expect(200);

      const listAfterDelete = await request(app)
        .get(`/api/hackathons/${hackathon.id}/judges`)
        .expect(200);
      expect(listAfterDelete.body).toEqual([]);
    });

    it('blocks judge unregister when assignments still exist in the hackathon', async () => {
      const { hackathon } = await seedHackathon();
      const judge = await createJudge('membership.locked@example.com', 'Membership Locked Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Membership Locked Project',
      });

      await createAssignment({
        projectId: project.id,
        judgeId: judge.id,
        status: 'pending',
      });

      const res = await request(app)
        .delete(`/api/hackathons/${hackathon.id}/judges/${judge.id}`)
        .expect(400);
      expect(String(res.body.error)).toContain('assignments exist');
      expect(res.body.code).toBe('JUDGE_REGISTRATION_BLOCKED_BY_ASSIGNMENTS');

      const membership = await prisma.hackathonJudge.findUnique({
        where: {
          hackathonId_userId: {
            hackathonId: hackathon.id,
            userId: judge.id,
          },
        },
      });
      expect(membership).toBeTruthy();
    });
  });

  describe('Assignments and Scores', () => {
    it('supports bulk assignment upsert and avoids duplicates', async () => {
      const { hackathon } = await seedHackathon();
      const judge = await createJudge('bulk.judge@example.com', 'Bulk Judge');
      const projectA = await createProject({
        hackathonId: hackathon.id,
        title: 'Project A',
      });
      const projectB = await createProject({
        hackathonId: hackathon.id,
        title: 'Project B',
      });

      const payload = {
        assignments: [
          { projectId: projectA.id, judgeId: judge.id },
          { projectId: projectB.id, judgeId: judge.id },
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

    it('rejects assignment when judge is not registered to the hackathon', async () => {
      const { hackathon } = await seedHackathon();
      const unregisteredJudge = await prisma.user.create({
        data: {
          email: 'unregistered.assign@example.com',
          name: 'Unregistered Assign Judge',
          role: 'judge',
          password: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
        },
      });
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Unregistered Assignment Target',
      });

      const res = await request(app)
        .post('/api/assignments')
        .send({
          assignments: [
            { projectId: project.id, judgeId: unregisteredJudge.id },
          ],
        })
        .expect(400);

      expect(String(res.body.error)).toContain('not registered');
      const count = await prisma.assignment.count({
        where: {
          projectId: project.id,
          judgeId: unregisteredJudge.id,
        },
      });
      expect(count).toBe(0);
    });

    it('updates assignment status to in_progress', async () => {
      const { hackathon } = await seedHackathon();
      const judge = await createJudge('status.judge@example.com', 'Status Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Status Project',
      });

      const assignment = await createAssignment({
        projectId: project.id,
        judgeId: judge.id,
        status: 'pending',
      });

      const updateRes = await request(app)
        .put(`/api/assignments/${assignment.id}/status`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(updateRes.body.status).toBe('in_progress');

      const assignmentInDb = await prisma.assignment.findUnique({
        where: { id: assignment.id },
      });
      expect(assignmentInDb?.status).toBe('in_progress');
    });

    it('submits scores, computes totalScore, and persists score rows', async () => {
      const { hackathon, criteria } = await seedHackathon();
      const judge = await createJudge('score.judge@example.com', 'Score Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Score Project',
      });

      const assignment = await createAssignment({
        projectId: project.id,
        judgeId: judge.id,
        status: 'pending',
      });

      const submitRes = await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'judge')
        .set('x-test-user-id', judge.id)
        .set('x-test-email', judge.email)
        .set('x-test-name', judge.name)
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

    it('forbids admins from changing judge progress or submitting scores', async () => {
      const { hackathon, criteria } = await seedHackathon();
      const judge = await createJudge('locked-down.judge@example.com', 'Locked Down Judge');
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Permission Boundary Project',
      });

      const assignment = await createAssignment({
        projectId: project.id,
        judgeId: judge.id,
        status: 'pending',
      });

      await request(app)
        .put(`/api/assignments/${assignment.id}/status`)
        .set('x-test-role', 'admin')
        .send({ status: 'in_progress' })
        .expect(403);

      await request(app)
        .post(`/api/assignments/${assignment.id}/scores`)
        .set('x-test-role', 'admin')
        .send({
          scores: [
            { criterionId: criteria[0].id, score: 45 },
            { criterionId: criteria[1].id, score: 35 },
          ],
          comment: 'Admin should not be able to score',
          status: 'completed',
        })
        .expect(403);

      const assignmentInDb = await prisma.assignment.findUnique({
        where: { id: assignment.id },
      });
      expect(assignmentInDb?.status).toBe('pending');
      expect(assignmentInDb?.totalScore).toBeNull();
    });
  });

  describe('Dashboard, Leaderboard, Reports', () => {
    it('returns dashboard stats from real data for admin and judge', async () => {
      const { hackathon } = await seedHackathon();
      const judge1 = await createJudge('judge1@example.com', 'Judge 1');
      const judge2 = await createJudge('judge2@example.com', 'Judge 2');

      const project1 = await createProject({
        hackathonId: hackathon.id,
        title: 'Stats Project 1',
      });
      const project2 = await createProject({
        hackathonId: hackathon.id,
        title: 'Stats Project 2',
      });

      await createAssignment({
        projectId: project1.id,
        judgeId: judge1.id,
        status: 'completed',
        totalScore: 80,
      });
      await createAssignment({
        projectId: project2.id,
        judgeId: judge1.id,
        status: 'pending',
      });
      await createAssignment({
        projectId: project1.id,
        judgeId: judge2.id,
        status: 'completed',
        totalScore: 90,
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
      const { hackathon } = await seedHackathon();
      const judge = await createJudge('leaderboard.judge@example.com', 'Leaderboard Judge');

      const projectA = await createProject({
        hackathonId: hackathon.id,
        title: 'Leaderboard A',
      });
      const projectB = await createProject({
        hackathonId: hackathon.id,
        title: 'Leaderboard B',
      });

      await createAssignment({
        projectId: projectA.id,
        judgeId: judge.id,
        status: 'completed',
        totalScore: 72,
      });
      await createAssignment({
        projectId: projectB.id,
        judgeId: judge.id,
        status: 'completed',
        totalScore: 91,
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
      const { hackathon, criteria } = await seedHackathon();
      const judge = await createJudge('report.judge@example.com', 'Report Judge');
      const projectDone = await createProject({
        hackathonId: hackathon.id,
        title: 'Report Done',
      });
      const projectPending = await createProject({
        hackathonId: hackathon.id,
        title: 'Report Pending',
      });

      const completed = await createAssignment({
        projectId: projectDone.id,
        judgeId: judge.id,
        status: 'completed',
        comment: 'Great work',
        totalScore: 95,
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

      await createAssignment({
        projectId: projectPending.id,
        judgeId: judge.id,
        status: 'pending',
      });

      const report = await request(app)
        .get(`/api/reports/scoring?hackathonId=${hackathon.id}`)
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
      const { hackathon } = await seedHackathon();
      const judgeA = await createJudge('project-report-a@example.com', 'Judge A');
      const judgeB = await createJudge('project-report-b@example.com', 'Judge B');
      const project = await createProject({
        hackathonId: hackathon.id,
        title: 'Project Report Target',
      });

      await createAssignment({
        projectId: project.id,
        judgeId: judgeA.id,
        status: 'completed',
        totalScore: 84,
      });
      await createAssignment({
        projectId: project.id,
        judgeId: judgeB.id,
        status: 'in_progress',
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
      const judges = reportRes.body[0].judges as ProjectReportJudge[];
      expect(judges.some((judge) => judge.status === 'completed')).toBe(true);
      expect(judges.some((judge) => judge.status === 'in_progress')).toBe(true);
    });
  });
});
