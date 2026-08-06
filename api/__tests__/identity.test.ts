import { describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  resolveUserByWallet,
  walletDisplayName,
  getOrCreateUserFromWallet,
  linkWalletToUser,
  unlinkWalletFromUser,
} from '../services/identity';
import { createUser, createHackathon } from './factories';

const prisma = new PrismaClient();

describe('walletDisplayName', () => {
  it('formats as "chain:short" with leading 6 and trailing 4 chars', () => {
    expect(walletDisplayName('0xabcdef1234567890', 'ethereum')).toBe('ethereum:0xabcd…7890');
  });
});

describe('identity service - resolveUserByWallet', () => {
  it('returns null when no wallet matches', async () => {
    const result = await resolveUserByWallet(prisma, '0xnonexistent', 'ethereum');
    expect(result).toBeNull();
  });

  it('returns the user when wallet exists', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await prisma.walletAddress.create({
      data: {
        address: '0xmatch',
        chain: 'ethereum',
        userId: user.id,
        isPrimary: true,
      },
    });

    const found = await resolveUserByWallet(prisma, '0xmatch', 'ethereum');
    expect(found?.id).toBe(user.id);
    expect(found?.wallets.length).toBe(1);
  });
});

describe('getOrCreateUserFromWallet', () => {
  it('creates a new Web3 user when wallet does not exist', async () => {
    const result = await getOrCreateUserFromWallet(prisma, {
      address: '0xnewuser',
      chain: 'ethereum',
    });

    expect(result.role).toBe('user');
    expect(result.isWeb3User).toBe(true);
    expect(result.wallets.length).toBe(1);
    expect(result.wallets[0]?.isPrimary).toBe(true);
  });

  it('returns the existing user and updates lastUsedAt', async () => {
    const first = await getOrCreateUserFromWallet(prisma, {
      address: '0xexisting',
      chain: 'ethereum',
    });

    await new Promise((r) => setTimeout(r, 10));
    const second = await getOrCreateUserFromWallet(prisma, {
      address: '0xexisting',
      chain: 'ethereum',
    });

    expect(second.id).toBe(first.id);
    expect(second.wallets[0]?.lastUsedAt.getTime()).toBeGreaterThanOrEqual(first.wallets[0]?.lastUsedAt.getTime() ?? 0);
  });
});

describe('linkWalletToUser', () => {
  it('marks the user as Web3 and links the wallet', async () => {
    const user = await createUser(prisma, { role: 'judge' });

    const result = await linkWalletToUser(prisma, {
      userId: user.id,
      address: '0xlinked',
      chain: 'ethereum',
    });

    expect(result.error).toBeUndefined();
    expect(result.user?.isWeb3User).toBe(true);
    expect(result.user?.wallets.length).toBe(1);
  });

  it('returns wallet_taken when another user already owns the wallet', async () => {
    const owner = await createUser(prisma, { role: 'judge' });
    const other = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, {
      userId: owner.id,
      address: '0xtaken',
      chain: 'ethereum',
    });

    const result = await linkWalletToUser(prisma, {
      userId: other.id,
      address: '0xtaken',
      chain: 'ethereum',
    });

    expect(result.error).toBe('wallet_taken');
  });

  it('makes the first wallet primary', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const result = await linkWalletToUser(prisma, {
      userId: user.id,
      address: '0xfirst',
      chain: 'base',
    });
    expect(result.user?.wallets[0]?.isPrimary).toBe(true);
  });

  it('does not steal primary status when adding a second wallet', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, { userId: user.id, address: '0xa', chain: 'ethereum' });

    const result = await linkWalletToUser(prisma, {
      userId: user.id,
      address: '0xb',
      chain: 'base',
    });

    const eth = result.user?.wallets.find((w) => w.address === '0xa');
    const base = result.user?.wallets.find((w) => w.address === '0xb');
    expect(eth?.isPrimary).toBe(true);
    expect(base?.isPrimary).toBe(false);
  });
});

describe('unlinkWalletFromUser', () => {
  it('removes the wallet from a user', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, { userId: user.id, address: '0xunlink', chain: 'ethereum' });

    const result = await unlinkWalletFromUser(prisma, {
      userId: user.id,
      address: '0xunlink',
      chain: 'ethereum',
    });

    expect(result.success).toBe(true);
    const after = await resolveUserByWallet(prisma, '0xunlink', 'ethereum');
    expect(after).toBeNull();
  });

  it('promotes a remaining wallet to primary when removing the primary', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, { userId: user.id, address: '0xprimary', chain: 'ethereum' });
    await linkWalletToUser(prisma, { userId: user.id, address: '0xsecondary', chain: 'base' });

    await unlinkWalletFromUser(prisma, {
      userId: user.id,
      address: '0xprimary',
      chain: 'ethereum',
    });

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      include: { wallets: true },
    });

    const promoted = updated?.wallets.find((w) => w.isPrimary);
    expect(promoted?.address).toBe('0xsecondary');
  });

  it('clears isWeb3User when last wallet is removed', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, { userId: user.id, address: '0xonly', chain: 'ethereum' });

    await unlinkWalletFromUser(prisma, {
      userId: user.id,
      address: '0xonly',
      chain: 'ethereum',
    });

    const updated = await prisma.user.findUnique({ where: { id: user.id } });
    expect(updated?.isWeb3User).toBe(false);
  });

  it('returns success=false when wallet does not belong to the user', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    const result = await unlinkWalletFromUser(prisma, {
      userId: user.id,
      address: '0xghost',
      chain: 'ethereum',
    });
    expect(result.success).toBe(false);
  });

  it('blocks unlinking a wallet that belongs to a different user', async () => {
    const owner = await createUser(prisma, { role: 'judge' });
    const stranger = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, { userId: owner.id, address: '0xowned', chain: 'ethereum' });

    const result = await unlinkWalletFromUser(prisma, {
      userId: stranger.id,
      address: '0xowned',
      chain: 'ethereum',
    });

    expect(result.success).toBe(false);
    // Wallet still owned by the original user
    const stillOwner = await resolveUserByWallet(prisma, '0xowned', 'ethereum');
    expect(stillOwner?.id).toBe(owner.id);
  });

  it('integration with createHackathon still leaves wallet linkage intact', async () => {
    const user = await createUser(prisma, { role: 'judge' });
    await linkWalletToUser(prisma, { userId: user.id, address: '0xh', chain: 'ethereum' });
    const h = await createHackathon(prisma);
    expect(h.id).toBeDefined();

    const after = await resolveUserByWallet(prisma, '0xh', 'ethereum');
    expect(after?.id).toBe(user.id);
  });
});
