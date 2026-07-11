/**
 * Integration tests for the DB-backed nonce store
 * (synth-design-spec §2.2 P0-1).
 *
 * Exercises the full Prisma → Web3Nonce table round-trip:
 *   - generate returns a fresh nonce each call
 *   - consume succeeds exactly once
 *   - second consume of the same nonce returns false
 *   - expired nonces are rejected
 *   - nonces are scoped by (address, chain, purpose)
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../server';
import { consumeNonce, generateNonce } from '../utils/nonce-store';

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.web3Nonce.deleteMany();
});

describe('DB-backed nonce store', () => {
  it('mints and consumes a nonce in a single round-trip', async () => {
    const { nonce } = await generateNonce(prisma, '0xabc', 'ethereum', 'siwe');
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);

    const ok = await consumeNonce(prisma, '0xabc', 'ethereum', 'siwe', nonce);
    expect(ok).toBe(true);
  });

  it('refuses to consume a nonce twice (single-use)', async () => {
    const { nonce } = await generateNonce(prisma, '0xdef', 'ethereum', 'siwe');
    await consumeNonce(prisma, '0xdef', 'ethereum', 'siwe', nonce);
    const second = await consumeNonce(prisma, '0xdef', 'ethereum', 'siwe', nonce);
    expect(second).toBe(false);
  });

  it('rejects an unknown nonce without throwing', async () => {
    const ok = await consumeNonce(prisma, '0xmissing', 'ethereum', 'siwe', 'deadbeef');
    expect(ok).toBe(false);
  });

  it('scopes nonces by purpose (siwe vs link-wallet)', async () => {
    const { nonce } = await generateNonce(prisma, '0xabc', 'ethereum', 'siwe');
    const wrongPurpose = await consumeNonce(prisma, '0xabc', 'ethereum', 'link-wallet', nonce);
    expect(wrongPurpose).toBe(false);
    const rightPurpose = await consumeNonce(prisma, '0xabc', 'ethereum', 'siwe', nonce);
    expect(rightPurpose).toBe(true);
  });

  it('scopes nonces by chain', async () => {
    const { nonce } = await generateNonce(prisma, '0xabc', 'ethereum', 'siwe');
    const wrongChain = await consumeNonce(prisma, '0xabc', 'polygon', 'siwe', nonce);
    expect(wrongChain).toBe(false);
    const rightChain = await consumeNonce(prisma, '0xabc', 'ethereum', 'siwe', nonce);
    expect(rightChain).toBe(true);
  });

  it('rejects a nonce whose stored value does not match', async () => {
    await generateNonce(prisma, '0xabc', 'ethereum', 'siwe');
    const wrong = await consumeNonce(prisma, '0xabc', 'ethereum', 'siwe', 'not-the-nonce');
    expect(wrong).toBe(false);
  });

  it('rejects an expired nonce', async () => {
    // Insert a nonce that is already expired.
    await prisma.web3Nonce.create({
      data: {
        address: '0xexpired',
        chain: 'ethereum',
        purpose: 'siwe',
        nonce: 'expirednonce',
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const ok = await consumeNonce(prisma, '0xexpired', 'ethereum', 'siwe', 'expirednonce');
    expect(ok).toBe(false);
  });
});
