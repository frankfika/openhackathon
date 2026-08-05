import type { Express, RequestHandler } from 'express';
import type { PrismaClient, Prisma } from '@prisma/client';
import { asString, SUPPORTED_CHAINS } from '../config';
import { logger } from '../logger';
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

export function registerIdentityRoutes(
  app: Express,
  prisma: PrismaClient,
  { requireAuth }: { requireAuth: RequestHandler },
) {
  // SECURITY: previously this endpoint was unauthenticated and let anyone enumerate
  // any wallet's global points / activities / on-chain tx history.
  // Now requires login: a user can only look up wallets they own; admins can look up any.
  app.get('/api/identity/:address', requireAuth, async (req, res) => {
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

      // Authorization: requester must own a wallet with this address, or be an admin.
      const requester = req.authUser!;
      const isAdmin = requester.role === 'admin';
      if (!isAdmin) {
        const ownWallet = await prisma.walletAddress.findFirst({
          where: { userId: requester.id, address: normalized, chain },
          select: { id: true },
        });
        if (!ownWallet) {
          return res.status(403).json({ error: 'You can only look up identities for wallets you own' });
        }
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
        take: 100,
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
      logger.error('Identity lookup error', { err: error });
      res.status(500).json({ error: 'Failed to look up identity' });
    }
  });

  // SECURITY: profile data is private. Only the user themselves or an admin may read.
  app.get('/api/users/:userId/global-profile', requireAuth, async (req, res) => {
    try {
      const userId = asString(req.params.userId);
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const requester = req.authUser!;
      if (requester.role !== 'admin' && requester.id !== userId) {
        return res.status(403).json({ error: 'You can only view your own profile' });
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
        take: 100,
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
      logger.error('Global profile error', { err: error });
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // SECURITY: leaderboard was public; rate-limit by requiring auth so anonymous
  // scrapers cannot farm it. Limit/cap is still in place.
  app.get('/api/leaderboard/global-web3', requireAuth, async (req, res) => {
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
      logger.error('Global leaderboard error', { err: error });
      res.status(500).json({ error: 'Failed to load global leaderboard' });
    }
  });
}
