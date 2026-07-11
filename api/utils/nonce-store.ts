/**
 * DB-backed SIWE / link-wallet nonce store.
 *
 * Replaces the in-process Map in siwe.ts so that nonces survive
 * process restarts and are consistent across multiple API instances
 * (Block 2 P0-1 in synth-design-spec).
 *
 * Backed by the Web3Nonce Prisma table. An in-memory implementation is
 * still available for dev when NONCE_STORE=memory; tests rely on the
 * database path (default).
 */
import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { NONCE_STORE_BACKEND, WEB3_NONCE_TTL_MS } from '../config';

export type NoncePurpose = 'siwe' | 'link-wallet';

interface NonceStore {
  generate(
    prisma: PrismaClient,
    address: string,
    chain: string,
    purpose: NoncePurpose,
  ): Promise<{ nonce: string; expiresAt: Date }>;
  consume(
    prisma: PrismaClient,
    address: string,
    chain: string,
    purpose: NoncePurpose,
    nonce: string,
  ): Promise<boolean>;
}

class DatabaseNonceStore implements NonceStore {
  async generate(
    prisma: PrismaClient,
    address: string,
    chain: string,
    purpose: NoncePurpose,
  ): Promise<{ nonce: string; expiresAt: Date }> {
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + WEB3_NONCE_TTL_MS);
    // Best-effort cleanup of expired rows for this address. We do not
    // block the request on the cleanup; if the unique nonce collides
    // (vanishingly unlikely with 16 random bytes) the caller retries.
    await prisma.web3Nonce.deleteMany({
      where: {
        address,
        chain,
        purpose,
        OR: [{ expiresAt: { lt: new Date() } }, { nonce }],
      },
    });
    await prisma.web3Nonce.create({
      data: { address, chain, purpose, nonce, expiresAt },
    });
    return { nonce, expiresAt };
  }

  async consume(
    prisma: PrismaClient,
    address: string,
    chain: string,
    purpose: NoncePurpose,
    nonce: string,
  ): Promise<boolean> {
    // Single-use: delete the row inside a transaction. If the row is
    // missing, expired, or the nonce does not match, the call returns
    // false without throwing.
    try {
      const result = await prisma.web3Nonce.deleteMany({
        where: {
          address,
          chain,
          purpose,
          nonce,
          expiresAt: { gt: new Date() },
        },
      });
      return result.count === 1;
    } catch (err) {
      console.error('[nonce-store] consume failed:', err);
      return false;
    }
  }
}

class MemoryNonceStore implements NonceStore {
  private store = new Map<string, { nonce: string; expiresAt: number }>();

  private key(address: string, chain: string, purpose: NoncePurpose) {
    return `${purpose}:${chain}:${address.toLowerCase()}`;
  }

  private prune(now: number) {
    for (const [k, v] of this.store.entries()) {
      if (v.expiresAt < now) this.store.delete(k);
    }
  }

  async generate(
    _prisma: PrismaClient,
    address: string,
    chain: string,
    purpose: NoncePurpose,
  ): Promise<{ nonce: string; expiresAt: Date }> {
    this.prune(Date.now());
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + WEB3_NONCE_TTL_MS);
    this.store.set(this.key(address, chain, purpose), {
      nonce,
      expiresAt: expiresAt.getTime(),
    });
    return { nonce, expiresAt };
  }

  async consume(
    _prisma: PrismaClient,
    address: string,
    chain: string,
    purpose: NoncePurpose,
    nonce: string,
  ): Promise<boolean> {
    const k = this.key(address, chain, purpose);
    const entry = this.store.get(k);
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(k);
      return false;
    }
    if (entry.nonce !== nonce) return false;
    this.store.delete(k);
    return true;
  }
}

const databaseStore = new DatabaseNonceStore();
const memoryStore = new MemoryNonceStore();

function pickStore(): NonceStore {
  return NONCE_STORE_BACKEND === 'memory' ? memoryStore : databaseStore;
}

/** Generate a fresh nonce. Persists to the database by default. */
export async function generateNonce(
  prisma: PrismaClient,
  address: string,
  chain: string,
  purpose: NoncePurpose,
): Promise<string> {
  const { nonce } = await pickStore().generate(prisma, address, chain, purpose);
  return nonce;
}

/**
 * Validate and consume a nonce (single-use).
 * Returns true on success, false if the nonce is unknown, expired, or
 * the value does not match.
 */
export async function consumeNonce(
  prisma: PrismaClient,
  address: string,
  chain: string,
  purpose: NoncePurpose,
  nonce: string,
): Promise<boolean> {
  return pickStore().consume(prisma, address, chain, purpose, nonce);
}

/** For tests + the in-memory dev path. */
export function _resetMemoryStore() {
  memoryStore['store'].clear();
}
