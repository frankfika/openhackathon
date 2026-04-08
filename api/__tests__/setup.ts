import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeEach } from 'vitest';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
}

const TEST_CONTENT_ROOT = path.join(os.tmpdir(), `openhackathon-api-tests-${process.pid}`);
const TEST_HACKATHON_DOCS_DIR = path.join(TEST_CONTENT_ROOT, 'hackathons');
const TEST_UPLOADS_DIR = path.join(TEST_CONTENT_ROOT, 'uploads');

process.env.HACKATHON_DOCS_DIR = TEST_HACKATHON_DOCS_DIR;
process.env.UPLOADS_DIR = TEST_UPLOADS_DIR;

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.score.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.project.deleteMany();
  await prisma.scoringCriterion.deleteMany();
  await prisma.hackathonJudge.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.user.deleteMany();

  await fs.rm(TEST_CONTENT_ROOT, { recursive: true, force: true });
  await fs.mkdir(TEST_HACKATHON_DOCS_DIR, { recursive: true });
  await fs.mkdir(path.join(TEST_UPLOADS_DIR, 'images'), { recursive: true });
});

afterAll(async () => {
  await fs.rm(TEST_CONTENT_ROOT, { recursive: true, force: true });
  await prisma.$disconnect();
});
