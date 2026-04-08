/**
 * Test Factories for OpenHackathon API Tests
 *
 * Centralized test data creation with sensible defaults.
 * All factories clean up after themselves via test lifecycle hooks.
 */

import { randomUUID } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DEFAULT_PASSWORD = 'Secret123';

// Type for factory context (prisma client)
type FactoryContext = PrismaClient;

// Helper types for created records
type HackathonWithCriteria = Prisma.HackathonGetPayload<{
  include: { scoringCriteria: true };
}>;

/**
 * Create a hackathon with default values
 */
export async function createHackathon(
  prisma: FactoryContext,
  overrides: Partial<Prisma.HackathonCreateInput> = {}
): Promise<HackathonWithCriteria> {
  const timestamp = Date.now();
  const defaults: Prisma.HackathonCreateInput = {
    title: `Test Hackathon ${timestamp}`,
    tagline: 'Build something amazing',
    city: 'San Francisco',
    startAt: new Date('2026-01-10T09:00:00.000Z'),
    endAt: new Date('2026-01-12T18:00:00.000Z'),
    status: 'upcoming',
    coverGradient: 'from-blue-500 to-cyan-500',
    submissionSchema: {},
    scoringCriteria: {
      create: [
        { name: 'Innovation', maxScore: 60, sortOrder: 0 },
        { name: 'Execution', maxScore: 40, sortOrder: 1 },
      ],
    },
  };

  return prisma.hackathon.create({
    data: { ...defaults, ...overrides },
    include: { scoringCriteria: true },
  });
}

/**
 * Create a user (admin or judge)
 */
export async function createUser(
  prisma: FactoryContext,
  overrides: Partial<Prisma.UserCreateInput> & { role: 'admin' | 'judge' } = { role: 'judge' }
) {
  const timestamp = Date.now();
  const defaults: Prisma.UserCreateInput = {
    email: `user-${timestamp}-${randomUUID().slice(0, 8)}@example.com`,
    name: `Test User ${timestamp}`,
    role: overrides.role,
    password: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
  };

  return prisma.user.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a judge and optionally register to hackathons
 */
export async function createJudge(
  prisma: FactoryContext,
  overrides: Partial<Prisma.UserCreateInput> = {},
  options: { hackathonIds?: string[] } = {}
) {
  const judge = await createUser(prisma, { ...overrides, role: 'judge' });

  if (options.hackathonIds && options.hackathonIds.length > 0) {
    await prisma.hackathonJudge.createMany({
      data: options.hackathonIds.map((hackathonId) => ({
        hackathonId,
        userId: judge.id,
      })),
      skipDuplicates: true,
    });
  }

  return judge;
}

/**
 * Create an admin user
 */
export async function createAdmin(
  prisma: FactoryContext,
  overrides: Partial<Prisma.UserCreateInput> = {}
) {
  return createUser(prisma, { ...overrides, role: 'admin' });
}

/**
 * Create a project for a hackathon
 */
export async function createProject(
  prisma: FactoryContext,
  hackathonId: string,
  overrides: Partial<Prisma.ProjectCreateInput> = {}
) {
  const timestamp = Date.now();
  const defaults: Prisma.ProjectCreateInput = {
    hackathonId,
    title: `Test Project ${timestamp}`,
    oneLiner: 'An amazing project',
    description: 'Detailed project description',
    tags: ['AI', 'Web3'],
    demoUrl: 'https://demo.example.com',
    repoUrl: 'https://github.com/example/repo',
    submitterEmail: `submitter-${timestamp}@example.com`,
    submitterName: 'Project Submitter',
    submissionData: {},
    status: 'submitted',
  };

  return prisma.project.create({
    data: { ...defaults, ...overrides, hackathonId },
  });
}

/**
 * Create a scoring criterion for a hackathon
 */
export async function createCriterion(
  prisma: FactoryContext,
  hackathonId: string,
  overrides: Partial<Prisma.ScoringCriterionCreateInput> = {}
) {
  const defaults: Prisma.ScoringCriterionCreateInput = {
    hackathonId,
    name: 'Test Criterion',
    maxScore: 50,
    sortOrder: 0,
  };

  return prisma.scoringCriterion.create({
    data: { ...defaults, ...overrides, hackathonId },
  });
}

/**
 * Create an assignment (judge-project pair)
 */
export async function createAssignment(
  prisma: FactoryContext,
  projectId: string,
  judgeId: string,
  overrides: Partial<Prisma.AssignmentCreateInput> = {}
) {
  const defaults: Prisma.AssignmentCreateInput = {
    projectId,
    judgeId,
    status: 'pending',
  };

  return prisma.assignment.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Create a score for an assignment on a specific criterion
 */
export async function createScore(
  prisma: FactoryContext,
  assignmentId: string,
  criterionId: string,
  score: number
) {
  return prisma.score.create({
    data: {
      assignmentId,
      criterionId,
      score,
    },
  });
}

/**
 * Create a complete scoring scenario:
 * - Assignment with status 'completed'
 * - Scores for all criteria
 * - totalScore calculated
 */
export async function createCompleteScoring(
  prisma: FactoryContext,
  projectId: string,
  judgeId: string,
  criteriaIds: string[],
  scores: number[] // must match criteriaIds length
) {
  if (criteriaIds.length !== scores.length) {
    throw new Error('criteriaIds and scores must have same length');
  }

  const totalScore = scores.reduce((sum, s) => sum + s, 0);

  const assignment = await createAssignment(prisma, projectId, judgeId, {
    status: 'completed',
    totalScore,
    comment: 'Great work!',
  });

  await Promise.all(
    criteriaIds.map((criterionId, index) =>
      createScore(prisma, assignment.id, criterionId, scores[index])
    )
  );

  return prisma.assignment.findUnique({
    where: { id: assignment.id },
    include: { scores: true },
  });
}

/**
 * Register a judge to a hackathon
 */
export async function registerJudgeToHackathon(
  prisma: FactoryContext,
  judgeId: string,
  hackathonId: string
) {
  return prisma.hackathonJudge.create({
    data: { userId: judgeId, hackathonId },
  });
}

/**
 * Create site settings with defaults
 */
export async function createSiteSettings(
  prisma: FactoryContext,
  overrides: Partial<Prisma.SiteSettingCreateInput> = {}
) {
  const defaults: Prisma.SiteSettingCreateInput = {
    key: 'default',
    siteName: 'OpenHackathon',
    adminBasePath: '/admin',
    tabTitle: 'OpenHackathon',
    seoTitle: 'OpenHackathon',
    seoDescription: 'Open source hackathon management platform',
    faviconUrl: '/favicon.svg',
    showPoweredBy: true,
    poweredByText: 'Powered by OpenHackathon',
    poweredByUrl: 'https://openhackathon.dev',
    submissionEmailEnabled: false,
    smtpPort: 587,
    smtpSecure: false,
    submissionEmailFrom: 'OpenHackathon <no-reply@localhost>',
    submissionEmailSubject: '[{{hackathonTitle}}] Submission Receipt {{receiptId}}',
    submissionEmailTimeoutMs: 10000,
  };

  return prisma.siteSetting.create({
    data: { ...defaults, ...overrides },
  });
}

/**
 * Build an admin auth token for API requests
 */
export function buildAdminToken(userId: string, email: string, name = 'Test Admin'): string {
  return `Bearer ${require('jsonwebtoken').sign(
    { sub: userId, email, name, role: 'admin' },
    process.env.JWT_SECRET || 'test-secret'
  )}`;
}

/**
 * Build a judge auth token for API requests
 */
export function buildJudgeToken(userId: string, email: string, name = 'Test Judge'): string {
  return `Bearer ${require('jsonwebtoken').sign(
    { sub: userId, email, name, role: 'judge' },
    process.env.JWT_SECRET || 'test-secret'
  )}`;
}

/**
 * Factory builder for complex test scenarios
 */
export class TestScenarioBuilder {
  private prisma: FactoryContext;
  public hackathon: HackathonWithCriteria | null = null;
  public judges: Prisma.UserGetPayload<{}>[] = [];
  public projects: Prisma.ProjectGetPayload<{}>[] = [];
  public assignments: Prisma.AssignmentGetPayload<{}>[] = [];

  constructor(prisma: FactoryContext) {
    this.prisma = prisma;
  }

  async createHackathon(overrides: Partial<Prisma.HackathonCreateInput> = {}) {
    this.hackathon = await createHackathon(this.prisma, overrides);
    return this;
  }

  async addJudges(count: number, overrides: Partial<Prisma.UserCreateInput> = {}) {
    if (!this.hackathon) throw new Error('Create hackathon first');

    for (let i = 0; i < count; i++) {
      const judge = await createJudge(this.prisma, overrides, {
        hackathonIds: [this.hackathon.id],
      });
      this.judges.push(judge);
    }
    return this;
  }

  async addProjects(count: number, overrides: Partial<Prisma.ProjectCreateInput> = {}) {
    if (!this.hackathon) throw new Error('Create hackathon first');

    for (let i = 0; i < count; i++) {
      const project = await createProject(this.prisma, this.hackathon.id, overrides);
      this.projects.push(project);
    }
    return this;
  }

  async assignAll() {
    if (!this.hackathon || this.judges.length === 0 || this.projects.length === 0) {
      throw new Error('Need hackathon, judges, and projects');
    }

    for (const project of this.projects) {
      for (const judge of this.judges) {
        const assignment = await createAssignment(this.prisma, project.id, judge.id);
        this.assignments.push(assignment);
      }
    }
    return this;
  }

  async completeScoring(assignmentIndex: number, scores: number[]) {
    if (!this.hackathon) throw new Error('Create hackathon first');

    const assignment = this.assignments[assignmentIndex];
    if (!assignment) throw new Error('Invalid assignment index');

    const criteriaIds = this.hackathon.scoringCriteria.map((c) => c.id);
    await createCompleteScoring(
      this.prisma,
      assignment.projectId,
      assignment.judgeId,
      criteriaIds,
      scores
    );
    return this;
  }

  build() {
    return {
      hackathon: this.hackathon!,
      judges: this.judges,
      projects: this.projects,
      assignments: this.assignments,
    };
  }
}
