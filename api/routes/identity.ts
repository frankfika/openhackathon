import type { Express } from 'express';
import type { PrismaClient, Prisma } from '@prisma/client';
import { asString, SUPPORTED_CHAINS } from '../config';
import { resolveUserByWallet } from '../services/identity';
import { normalizeWalletAddress } from '../utils/siwe';

const EVM_EXPLORERS: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  base: 'https://basescan.org/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  optimism: 'https://optimistic.etherscan.io/tx/',
};

function explorerUrl(chain: string | undefined, txHash: string): string | null {
  if (!chain) return null;
  const base = EVM_EXPLORERS[chain.toLowerCase()];
  return base ? `${base}${txHash}` : null;
}

export function registerIdentityRoutes(app: Express, prisma: PrismaClient) {
  // Public: look up a user's cross-hackathon identity by wallet address
  app.get('/api/identity/:address', async (req, res) => {
    try {
      const address = asString(req.params.address);
      const chain = (asString(req.query.chain as string) || 'ethereum').toLowerCase();

      if (!address) {
        return res.status(400).json({ error: 'address is required' });
      }

      const normalized = normalizeWalletAddress(address, chain);
      if (!normalized) {
        return res.status(400).json({ error: 'Invalid wallet address' });
      }

      const user = await resolveUserByWallet(prisma, normalized, chain);
      if (!user) {
        return res.status(404).json({ error: 'No user found for this wallet' });
      }

      if (!user.isWeb3User) {
        return res.json({
          user: { id: user.id, name: user.name, isWeb3User: false },
          message: 'This user has not opted into cross-hackathon tracking.',
        });
      }

      const activities = await prisma.crossHackathonActivity.findMany({
        where: { userId: user.id },
        include: { hackathon: { select: { title: true, startAt: true } } },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          isWeb3User: true,
          wallets: user.wallets.map((w) => ({ address: w.address, chain: w.chain, isPrimary: w.isPrimary })),
        },
        stats: {
          globalPoints: user.globalPoints,
          participationCount: user.participationCount,
          judgeCount: user.judgeCount,
          awardCount: user.awardCount,
        },
        activities: activities.map((a) => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>;
          const actChain = typeof meta.chain === 'string' ? meta.chain : undefined;
          return {
            hackathon: a.hackathon.title,
            hackathonDate: a.hackathon.startAt,
            type: a.activityType,
            points: a.points,
            date: a.createdAt,
            onChain: !!a.onChainTxHash,
            onChainStatus: a.onChainStatus,
            txHash: a.onChainTxHash,
            explorerUrl: a.onChainTxHash ? explorerUrl(actChain, a.onChainTxHash) : null,
          };
        }),
      });
    } catch (error) {
      console.error('Identity lookup error:', error);
      res.status(500).json({ error: 'Failed to look up identity' });
    }
  });

  // Public: a user's full cross-hackathon profile by userId
  app.get('/api/users/:userId/global-profile', async (req, res) => {
    try {
      const userId = asString(req.params.userId);
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { wallets: true },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const activities = await prisma.crossHackathonActivity.findMany({
        where: { userId },
        include: { hackathon: { select: { title: true, startAt: true } } },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        user: {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          isWeb3User: user.isWeb3User,
          wallets: user.wallets.map((w) => ({
            address: w.address,
            chain: w.chain,
            isPrimary: w.isPrimary,
            verifiedAt: w.verifiedAt,
          })),
        },
        stats: {
          globalPoints: user.globalPoints,
          participationCount: user.participationCount,
          judgeCount: user.judgeCount,
          awardCount: user.awardCount,
        },
        activities: activities.map((a) => ({
          hackathon: a.hackathon.title,
          hackathonDate: a.hackathon.startAt,
          type: a.activityType,
          points: a.points,
          date: a.createdAt,
          onChain: !!a.onChainTxHash,
          onChainStatus: a.onChainStatus,
          txHash: a.onChainTxHash,
        })),
      });
    } catch (error) {
      console.error('Global profile error:', error);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // Public: global Web3 leaderboard (only isWeb3User=true)
  app.get('/api/leaderboard/global-web3', async (req, res) => {
    try {
      const chain = asString(req.query.chain as string)?.toLowerCase();
      const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

      const where: Prisma.UserWhereInput = { isWeb3User: true };

      if (chain) {
        if (!SUPPORTED_CHAINS.includes(chain)) {
          return res.status(400).json({ error: `Unsupported chain: ${chain}` });
        }
        where.wallets = { some: { chain } };
      }

      const users = await prisma.user.findMany({
        where,
        orderBy: { globalPoints: 'desc' },
        take: limit,
        include: { wallets: true },
      });

      const leaderboard = users.map((user, index) => {
        const primary = user.wallets.find((w) => w.isPrimary) ?? user.wallets[0];
        const lastActive = user.wallets.length
          ? Math.max(...user.wallets.map((w) => w.lastUsedAt.getTime()))
          : user.updatedAt.getTime();
        return {
          rank: index + 1,
          userId: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          primaryWallet: primary ? { address: primary.address, chain: primary.chain } : null,
          wallets: user.wallets.map((w) => ({ address: w.address, chain: w.chain })),
          globalPoints: user.globalPoints,
          participationCount: user.participationCount,
          judgeCount: user.judgeCount,
          awardCount: user.awardCount,
          lastActive: new Date(lastActive).toISOString(),
        };
      });

      res.json({ leaderboard, total: leaderboard.length });
    } catch (error) {
      console.error('Global leaderboard error:', error);
      res.status(500).json({ error: 'Failed to load global leaderboard' });
    }
  });
}
