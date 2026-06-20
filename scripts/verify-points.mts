// Integration test for the cross-hackathon points service against the real DB.
import { PrismaClient } from '@prisma/client';
import { awardPoints, processLeaderboardPoints } from '../api/services/points';

const prisma = new PrismaClient();

async function main() {
  console.log('Running points service verification...\n');
  const suffix = Date.now();

  // Create a Web3 user and a non-Web3 user
  const web3User = await prisma.user.create({
    data: { name: `web3-${suffix}`, role: 'judge', isWeb3User: true },
  });
  const normalUser = await prisma.user.create({
    data: {
      name: `normal-${suffix}`,
      role: 'judge',
      isWeb3User: false,
      email: `normal-${suffix}@test.local`,
    },
  });

  const hackathon = await prisma.hackathon.create({
    data: {
      title: `Test Hackathon ${suffix}`,
      tagline: 'test',
      startAt: new Date(),
      endAt: new Date(Date.now() + 86400000),
      status: 'judging',
      coverGradient: 'x',
    },
  });

  try {
    // Web3 user earns judged points
    const r1 = await awardPoints(prisma, {
      userId: web3User.id,
      hackathonId: hackathon.id,
      activityType: 'judged',
    });
    if (!r1?.awarded || r1.points !== 20) throw new Error('judged points wrong');
    console.log('✓ Web3 user awarded 20 judged points');

    // Idempotency: same activity doesn't double-count
    const r2 = await awardPoints(prisma, {
      userId: web3User.id,
      hackathonId: hackathon.id,
      activityType: 'judged',
    });
    if (r2?.awarded) throw new Error('should be idempotent');
    console.log('✓ Duplicate award is idempotent');

    // Non-Web3 user earns nothing
    const r3 = await awardPoints(prisma, {
      userId: normalUser.id,
      hackathonId: hackathon.id,
      activityType: 'judged',
    });
    if (r3?.awarded) throw new Error('non-web3 user should not earn points');
    console.log('✓ Non-Web3 user earns no points');

    // Verify globalPoints updated correctly
    const refreshed = await prisma.user.findUnique({ where: { id: web3User.id } });
    if (refreshed?.globalPoints !== 20 || refreshed?.judgeCount !== 1) {
      throw new Error(`stats wrong: ${refreshed?.globalPoints}/${refreshed?.judgeCount}`);
    }
    console.log('✓ User stats updated: 20 points, judgeCount=1');

    // Leaderboard points: create a project owned by web3 user, award won_first
    const project = await prisma.project.create({
      data: {
        hackathonId: hackathon.id,
        userId: web3User.id,
        submitterEmail: `web3-${suffix}@test.local`,
        title: 'Winning Project',
        oneLiner: 'wins',
      },
    });

    await processLeaderboardPoints(prisma, hackathon.id, [
      { projectId: project.id, rank: 1, award: 'Grand Prize' },
    ]);

    const afterWin = await prisma.user.findUnique({ where: { id: web3User.id } });
    // 20 (judged) + 200 (won_first) = 220
    if (afterWin?.globalPoints !== 220 || afterWin?.awardCount !== 1) {
      throw new Error(`win stats wrong: ${afterWin?.globalPoints}/${afterWin?.awardCount}`);
    }
    console.log('✓ Leaderboard win awarded 200 points (total 220), awardCount=1');

    console.log('\n✅ All points service tests passed!');
  } finally {
    // Cleanup
    await prisma.crossHackathonActivity.deleteMany({ where: { hackathonId: hackathon.id } });
    await prisma.activityLog.deleteMany({ where: { hackathonId: hackathon.id } });
    await prisma.project.deleteMany({ where: { hackathonId: hackathon.id } });
    await prisma.hackathon.delete({ where: { id: hackathon.id } });
    await prisma.user.deleteMany({ where: { id: { in: [web3User.id, normalUser.id] } } });
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('\n❌ Test failed:', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
