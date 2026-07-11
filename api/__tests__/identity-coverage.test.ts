/**
 * Unit tests for services/identity.ts (synth-design-spec §2.2 P0-3).
 *
 * Covers the two helpers that the spec calls out for "cross-chain
 * identity merge":
 *   - resolveUserByWallet — fast path on (address, chain)
 *   - getOrCreateUserFromWallet — same chain direct, cross-chain
 *     fallback (no new user), brand-new user creation
 *   - linkWalletToUser — same-user no-op, different-user error,
 *     first-wallet-isPrimary
 *   - walletDisplayName — short chain:0xAAA…BBB format
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../server';
import {
  getOrCreateUserFromWallet,
  linkWalletToUser,
  resolveUserByWallet,
  walletDisplayName,
} from '../services/identity';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.crossHackathonActivity.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.hackathonJudge.deleteMany();
  await prisma.scoringCriterion.deleteMany();
  await prisma.project.deleteMany();
  await prisma.hackathon.deleteMany();
  await prisma.walletAddress.deleteMany();
  await prisma.user.deleteMany();
});

describe('walletDisplayName', () => {
  it('produces a chain:0xAAA…BBB format with 6 leading + 4 trailing hex', () => {
    const name = walletDisplayName('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', 'ethereum');
    expect(name).toBe('ethereum:0xf39F…2266');
  });

  it('preserves the chain prefix verbatim', () => {
    expect(walletDisplayName('0x1234567890abcdef1234567890abcdef12345678', 'polygon')).toMatch(/^polygon:/);
    expect(walletDisplayName('0x1234567890abcdef1234567890abcdef12345678', 'base')).toMatch(/^base:/);
  });
});

describe('resolveUserByWallet', () => {
  it('returns null when no wallet matches', async () => {
    const out = await resolveUserByWallet(prisma, '0xNoMatch', 'ethereum');
    expect(out).toBeNull();
  });

  it('returns the user that owns the matching wallet', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'A',
        role: 'user',
        isWeb3User: true,
        wallets: {
          create: { address: '0xmatch', chain: 'ethereum', chainId: 1, isPrimary: true },
        },
      },
    });
    const out = await resolveUserByWallet(prisma, '0xmatch', 'ethereum');
    expect(out?.id).toBe(user.id);
  });

  it('does not return a user for the same address on a different chain', async () => {
    await prisma.user.create({
      data: {
        name: 'A',
        role: 'user',
        isWeb3User: true,
        wallets: {
          create: { address: '0xmatch', chain: 'ethereum', chainId: 1, isPrimary: true },
        },
      },
    });
    const out = await resolveUserByWallet(prisma, '0xmatch', 'polygon');
    expect(out).toBeNull();
  });
});

describe('getOrCreateUserFromWallet', () => {
  it('creates a brand-new user when no wallet matches at all', async () => {
    const u = await getOrCreateUserFromWallet(prisma, {
      address: '0xbrandnew',
      chain: 'ethereum',
      chainId: 1,
    });
    expect(u).toBeTruthy();
    expect(u.wallets).toHaveLength(1);
    expect(u.wallets[0].address).toBe('0xbrandnew');
    expect(u.role).toBe('user'); // default per spec P0-4
  });

  it('finds an existing user on the same chain without creating a duplicate', async () => {
    const a = await getOrCreateUserFromWallet(prisma, {
      address: '0xsame',
      chain: 'ethereum',
      chainId: 1,
    });
    const b = await getOrCreateUserFromWallet(prisma, {
      address: '0xsame',
      chain: 'ethereum',
      chainId: 1,
    });
    expect(b.id).toBe(a.id);
    // Should still have exactly one WalletAddress row.
    const walletCount = await prisma.walletAddress.count({ where: { userId: a.id } });
    expect(walletCount).toBe(1);
  });

  it('cross-chain fallback: same address on a different chain merges into the existing user', async () => {
    // KNOWN ISSUE: the current implementation looks up by
    // (address, chain) rather than (address, chainId). To exercise
    // the cross-chain merge path we use two DIFFERENT chain names
    // here. The spec says the unique key should be (address, chainId)
    // and a future fix should treat (address, chain) under different
    // chainIds as the same wallet.
    const a = await getOrCreateUserFromWallet(prisma, {
      address: '0xcross',
      chain: 'ethereum',
      chainId: 1,
    });
    const b = await getOrCreateUserFromWallet(prisma, {
      address: '0xcross',
      chain: 'polygon',
      chainId: 137,
    });
    expect(b.id).toBe(a.id);
    const wallets = await prisma.walletAddress.findMany({ where: { userId: a.id } });
    const chains = wallets.map((w) => w.chain).sort();
    expect(chains).toEqual(['ethereum', 'polygon']);
  });

  it('updates lastUsedAt on the matched wallet (freshens the touch timestamp)', async () => {
    const a = await getOrCreateUserFromWallet(prisma, {
      address: '0xtouch',
      chain: 'ethereum',
      chainId: 1,
    });
    const before = await prisma.walletAddress.findFirst({ where: { userId: a.id, address: '0xtouch' } });
    const beforeTime = before?.lastUsedAt?.getTime() ?? 0;

    // Wait a moment so the timestamp can advance.
    await new Promise((r) => setTimeout(r, 5));

    await getOrCreateUserFromWallet(prisma, {
      address: '0xtouch',
      chain: 'ethereum',
      chainId: 1,
    });
    const after = await prisma.walletAddress.findFirst({ where: { userId: a.id, address: '0xtouch' } });
    const afterTime = after?.lastUsedAt?.getTime() ?? 0;
    expect(afterTime).toBeGreaterThan(beforeTime);
  });
});

describe('linkWalletToUser', () => {
  it('marks isWeb3User and creates a new wallet for an email-only user', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'email-only@example.com',
        name: 'Email Only',
        role: 'user',
        password: 'hashed',
        isWeb3User: false,
      },
    });
    const result = await linkWalletToUser(prisma, {
      userId: user.id,
      address: '0xlink1',
      chain: 'ethereum',
      chainId: 1,
    });
    expect(result.error).toBeUndefined();
    expect(result.user?.isWeb3User).toBe(true);
    const wallets = await prisma.walletAddress.findMany({ where: { userId: user.id } });
    expect(wallets).toHaveLength(1);
    expect(wallets[0].isPrimary).toBe(true); // first wallet is primary
  });

  it('subsequent wallet on the same user is NOT primary', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Multi',
        role: 'user',
        isWeb3User: false,
        wallets: {
          create: { address: '0xfirst', chain: 'ethereum', chainId: 1, isPrimary: true },
        },
      },
    });
    await linkWalletToUser(prisma, {
      userId: user.id,
      address: '0xsecond',
      chain: 'polygon',
      chainId: 137,
    });
    const wallets = await prisma.walletAddress.findMany({
      where: { userId: user.id },
      orderBy: { isPrimary: 'desc' },
    });
    expect(wallets).toHaveLength(2);
    const primary = wallets.filter((w) => w.isPrimary);
    expect(primary).toHaveLength(1);
    expect(primary[0].address).toBe('0xfirst');
  });

  it('returns wallet_taken if the address is already linked to a different user', async () => {
    const a = await prisma.user.create({
      data: {
        name: 'A',
        role: 'user',
        isWeb3User: true,
        wallets: {
          create: { address: '0xtaken', chain: 'ethereum', chainId: 1, isPrimary: true },
        },
      },
    });
    const b = await prisma.user.create({
      data: { name: 'B', role: 'user', isWeb3User: false },
    });
    const result = await linkWalletToUser(prisma, {
      userId: b.id,
      address: '0xtaken',
      chain: 'ethereum',
      chainId: 1,
    });
    expect(result.error).toBe('wallet_taken');
    expect(result.user).toBeUndefined();
    // A is unaffected.
    const aWallets = await prisma.walletAddress.count({ where: { userId: a.id } });
    expect(aWallets).toBe(1);
  });

  it('returns success (no-op) when the same user re-links the same wallet', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Self',
        role: 'user',
        isWeb3User: true,
        wallets: {
          create: { address: '0xre', chain: 'ethereum', chainId: 1, isPrimary: true },
        },
      },
    });
    const result = await linkWalletToUser(prisma, {
      userId: user.id,
      address: '0xre',
      chain: 'ethereum',
      chainId: 1,
    });
    expect(result.error).toBeUndefined();
    const wallets = await prisma.walletAddress.findMany({ where: { userId: user.id } });
    expect(wallets).toHaveLength(1);
  });
});
