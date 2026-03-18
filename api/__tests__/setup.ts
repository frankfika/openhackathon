import { PrismaClient } from '@prisma/client';
import { afterAll, beforeEach } from 'vitest';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://postgres:postgrespassword@localhost:5432/openhackathon_test?schema=public';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
}

const prisma = new PrismaClient();

beforeEach(async () => {
  await prisma.score.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.scoringCriterion.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
