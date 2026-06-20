import type { PrismaClient, Prisma } from '@prisma/client';
import { WEB3_DEFAULT_ROLE } from '../config';

export type WalletUserResult = Prisma.UserGetPayload<{ include: { wallets: true } }>;

/** Find a user by wallet address + chain. Returns null if no match. */
export async function resolveUserByWallet(
  prisma: PrismaClient,
  address: string,
  chain: string,
): Promise<WalletUserResult | null> {
  const wallet = await prisma.walletAddress.findUnique({
    where: { address_chain: { address, chain } },
    include: { user: { include: { wallets: true } } },
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

  const existing = await resolveUserByWallet(prisma, address, chain);
  if (existing) {
    await prisma.walletAddress.update({
      where: { address_chain: { address, chain } },
      data: { lastUsedAt: new Date() },
    });
    return existing;
  }

  // Create a fresh Web3 user with this wallet as primary.
  const role = WEB3_DEFAULT_ROLE === 'admin' ? 'admin' : 'judge';
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
    include: { wallets: true },
  });

  return user;
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

  const existingWallet = await prisma.walletAddress.findUnique({
    where: { address_chain: { address, chain } },
  });

  if (existingWallet && existingWallet.userId !== userId) {
    return { error: 'wallet_taken' };
  }

  // If already linked to this same user, just ensure isWeb3User and return.
  if (existingWallet && existingWallet.userId === userId) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { isWeb3User: true },
      include: { wallets: true },
    });
    return { user };
  }

  // Determine if this is the user's first wallet (becomes primary).
  const walletCount = await prisma.walletAddress.count({ where: { userId } });

  const user = await prisma.user.update({
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
    include: { wallets: true },
  });

  return { user };
}
