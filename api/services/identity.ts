import type { PrismaClient, Prisma } from '@prisma/client';
import { WEB3_DEFAULT_ROLE } from '../config';
import { USER_PUBLIC_FIELDS, sanitizeUser } from '../utils/sanitize';

/** Selects the public user columns plus wallet data — safe to return. */
const USER_WITH_WALLETS_SELECT = {
  ...USER_PUBLIC_FIELDS,
  isWeb3User: true,
  globalPoints: true,
  participationCount: true,
  judgeCount: true,
  awardCount: true,
  wallets: { select: { address: true, chain: true, chainId: true, isPrimary: true, verifiedAt: true, lastUsedAt: true } },
} as const;

export type WalletUserResult = Prisma.UserGetPayload<{ select: typeof USER_WITH_WALLETS_SELECT }>;

/** Find a user by wallet address + chain. Returns null if no match. */
export async function resolveUserByWallet(
  prisma: PrismaClient,
  address: string,
  chain: string,
): Promise<WalletUserResult | null> {
  const wallet = await prisma.walletAddress.findFirst({
    where: { address, chain },
    select: { user: { select: USER_WITH_WALLETS_SELECT } },
  });
  return wallet?.user ?? null;
}

/** Build a friendly display name from a wallet address. */
export function walletDisplayName(address: string, chain: string): string {
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
  return `${chain}:${short}`;
}

/**
 * Get an existing user for a wallet, or create a new Web3 user.
 * Updates lastUsedAt on the matched wallet.
 */
export async function getOrCreateUserFromWallet(
  prisma: PrismaClient,
  params: { address: string; chain: string; chainId?: number },
): Promise<WalletUserResult> {
  const { address, chain, chainId } = params;

  // 1) Direct hit on (address, chain) — same chain.
  const direct = await resolveUserByWallet(prisma, address, chain);
  if (direct) {
    await prisma.walletAddress.updateMany({
      where: { address, chain },
      data: { lastUsedAt: new Date() },
    });
    return direct;
  }

  // 2) Cross-chain fallback: a user may have already registered this
  // address under a different chain (e.g. mainnet first, then sepolia).
  // Merge the wallet into the existing user rather than creating a new one.
  const crossChain = await prisma.walletAddress.findFirst({
    where: { address, NOT: { chain } },
    select: { user: { select: USER_WITH_WALLETS_SELECT } },
  });
  if (crossChain) {
    const existingUser = crossChain.user;
    try {
      await prisma.walletAddress.create({
        data: {
          userId: existingUser.id,
          address,
          chain,
          chainId: chainId ?? null,
          isPrimary: false,
        },
      });
    } catch (err) {
      // The (address, chain) unique is still in force (transitional);
      // if it fires, treat as success — the wallet already belongs to
      // this user via the other-chain row.
      if (!(err as { code?: string }).code?.startsWith('P2002')) throw err;
    }
    const merged = await prisma.user.findUnique({
      where: { id: existingUser.id },
      select: USER_WITH_WALLETS_SELECT,
    });
    if (merged) return merged;
  }

  // 3) Brand-new Web3 user. The role is configurable via
  // WEB3_DEFAULT_ROLE (defaults to 'user' per spec P0-4). Coerce
  // to the typed enum to satisfy Prisma's UserRole input.
  const role = (['admin', 'judge', 'user'].includes(WEB3_DEFAULT_ROLE)
    ? WEB3_DEFAULT_ROLE
    : 'user') as 'admin' | 'judge' | 'user';
  const user = await prisma.user.create({
    data: {
      name: walletDisplayName(address, chain),
      role,
      isWeb3User: true,
      wallets: {
        create: {
          address,
          chain,
          chainId: chainId ?? null,
          isPrimary: true,
        },
      },
    },
    include: { wallets: { select: { address: true, chain: true, chainId: true, isPrimary: true, verifiedAt: true, lastUsedAt: true } } },
  });

  return user as unknown as WalletUserResult;
}

/**
 * Link a wallet to an existing user account and mark them as a Web3 user.
 * Returns { error } if the wallet is already linked to a different account.
 */
export async function linkWalletToUser(
  prisma: PrismaClient,
  params: { userId: string; address: string; chain: string; chainId?: number },
): Promise<{ user?: WalletUserResult; error?: 'wallet_taken' }> {
  const { userId, address, chain, chainId } = params;

  // Look up the wallet under (address, chain). If it exists and belongs
  // to a different user, refuse. The same user may legitimately link
  // the same (address, chainId) pair multiple times — we treat that as
  // a no-op success.
  const existingWallet = await prisma.walletAddress.findFirst({
    where: { address, chain },
    select: { id: true, userId: true },
  });

  if (existingWallet && existingWallet.userId !== userId) {
    return { error: 'wallet_taken' };
  }

  // Already linked to this user — just bump isWeb3User.
  if (existingWallet && existingWallet.userId === userId) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isWeb3User: true },
      select: USER_WITH_WALLETS_SELECT,
    });
    return { user };
  }

  const walletCount = await prisma.walletAddress.count({ where: { userId } });

  await prisma.user.update({
    where: { id: userId },
    data: {
      isWeb3User: true,
      wallets: {
        create: {
          address,
          chain,
          chainId: chainId ?? null,
          isPrimary: walletCount === 0,
        },
      },
    },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_WITH_WALLETS_SELECT,
  });
  return { user };
}
