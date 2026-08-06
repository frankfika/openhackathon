// One-off dev seed: creates admin/judge/normal users + 1 hackathon + site setting
// Run: cd openhackathon && npx tsx seed-dev.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Site setting (admin base path etc.)
  const site = await prisma.siteSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      siteName: 'OpenHackathon',
      adminBasePath: 'admin',
      showPoweredBy: true,
      poweredByText: 'OpenCSG',
      poweredByUrl: 'https://opencsg.com',
    },
  });
  console.log('Site setting:', site.id);

  // Users
  const users = [
    { email: 'admin@openhackathon.com', name: 'Admin', password: 'admin123', role: 'admin' as const },
    { email: 'judge@openhackathon.com', name: 'Judge', password: 'judge123', role: 'judge' as const },
    { email: 'user@openhackathon.com', name: 'User', password: 'user123', role: 'user' as const },
  ];

  for (const u of users) {
    const hashed = await bcrypt.hash(u.password, 10);
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, name: u.name },
      create: {
        email: u.email,
        name: u.name,
        password: hashed,
        role: u.role,
      },
    });
    console.log(`User: ${created.email} (${created.role})`);
  }

  // Hackathon
  const now = new Date();
  const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  const hackathon = await prisma.hackathon.upsert({
    where: { id: 'dev-hackathon-1' },
    update: {
      status: 'active',
      startAt: now,
      endAt: endDate,
    },
    create: {
      id: 'dev-hackathon-1',
      title: 'OpenHackathon 2026',
      tagline: 'Build something cool',
      city: 'Online',
      startAt: now,
      endAt: endDate,
      status: 'active',
      coverGradient: 'linear-gradient(135deg, #1D8C80 0%, #0FB5A1 100%)',
      prizePool: '$10,000',
      judgesPerProject: 2,
    },
  });
  console.log('Hackathon:', hackathon.title, hackathon.status);

  // Assign judge to hackathon
  const judge = await prisma.user.findUnique({ where: { email: 'judge@openhackathon.com' } });
  if (judge) {
    await prisma.hackathonJudge.upsert({
      where: { hackathonId_userId: { hackathonId: hackathon.id, userId: judge.id } },
      update: {},
      create: { hackathonId: hackathon.id, userId: judge.id },
    });
    console.log('Judge assigned to hackathon');
  }

  // Sample project
  const admin = await prisma.user.findUnique({ where: { email: 'admin@openhackathon.com' } });
  if (admin) {
    const project = await prisma.project.upsert({
      where: { id: 'dev-project-1' },
      update: {},
      create: {
        id: 'dev-project-1',
        hackathonId: hackathon.id,
        userId: admin.id,
        title: 'Demo Project',
        oneLiner: 'A sample project for dev',
        description: 'This is a sample project created by the dev seed script.',
        submitterEmail: admin.email,
        submitterName: admin.name,
        status: 'submitted',
      },
    });
    console.log('Project:', project.title);
  }

  // Sample scoring criteria
  const criteria = [
    { name: 'Innovation', maxScore: 10 },
    { name: 'Technical Execution', maxScore: 10 },
    { name: 'Design', maxScore: 10 },
    { name: 'Impact', maxScore: 10 },
  ];
  for (let i = 0; i < criteria.length; i++) {
    const c = criteria[i];
    await prisma.scoringCriterion.upsert({
      where: { id: `dev-criterion-${i + 1}` },
      update: { name: c.name, maxScore: c.maxScore, sortOrder: i },
      create: {
        id: `dev-criterion-${i + 1}`,
        hackathonId: hackathon.id,
        name: c.name,
        maxScore: c.maxScore,
        sortOrder: i,
      },
    });
  }
  console.log('Scoring criteria:', criteria.length);

  console.log('\nDev seed complete!');
  console.log('Login:');
  console.log('  admin@openhackathon.com / admin123 (admin)');
  console.log('  judge@openhackathon.com / judge123 (judge)');
  console.log('  user@openhackathon.com  / user123  (user)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
