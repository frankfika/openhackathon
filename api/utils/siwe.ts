import { randomBytes } from 'crypto';
import { verifyMessage, getAddress, isAddress } from 'viem';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { WEB3_NONCE_TTL_MS } from '../config';

// ===== Nonce management (in-memory store) =====
// For multi-instance deployments, replace with Redis or a DB table.

type NonceEntry = {
  nonce: string;
  expiresAt: number;
};

const nonceStore = new Map<string, NonceEntry>();

/** Periodically clean up expired nonces to avoid unbounded growth. */
function pruneExpiredNonces() {
  const now = Date.now();
  for (const [key, entry] of nonceStore.entries()) {
    if (entry.expiresAt < now) {
      nonceStore.delete(key);
    }
  }
}

/** Generate a new nonce for a wallet address, keyed by lowercased address. */
export function generateNonce(addressKey: string): string {
  pruneExpiredNonces();
  const nonce = randomBytes(16).toString('hex');
  nonceStore.set(addressKey.toLowerCase(), {
    nonce,
    expiresAt: Date.now() + WEB3_NONCE_TTL_MS,
  });
  return nonce;
}

/** Validate and consume a nonce (single-use). Returns true if valid. */
export function consumeNonce(addressKey: string, nonce: string): boolean {
  const key = addressKey.toLowerCase();
  const entry = nonceStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    nonceStore.delete(key);
    return false;
  }
  if (entry.nonce !== nonce) return false;
  // Single-use: delete after successful match
  nonceStore.delete(key);
  return true;
}

/** Build the canonical sign-in message a wallet must sign. */
export function buildSignInMessage(params: {
  address: string;
  chain: string;
  nonce: string;
  domain?: string;
}): string {
  const { address, chain, nonce, domain = 'OpenHackathon' } = params;
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your ${chain} account:`,
    address,
    '',
    'Sign in to OpenHackathon to verify your identity for cross-hackathon tracking.',
    '',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

// ===== Address normalization =====

const SOLANA_CHAINS = new Set(['solana', 'solana-devnet', 'solana-mainnet']);

export function isSolanaChain(chain: string): boolean {
  return SOLANA_CHAINS.has(chain.toLowerCase());
}

/**
 * Normalize a wallet address for storage and comparison.
 * EVM addresses are checksummed; Solana addresses are returned as-is (base58).
 */
export function normalizeWalletAddress(address: string, chain: string): string | null {
  if (isSolanaChain(chain)) {
    // Basic base58 validation: decode should yield a 32-byte public key
    try {
      const decoded = bs58.decode(address);
      if (decoded.length !== 32) return null;
      return address;
    } catch {
      return null;
    }
  }
  // EVM
  if (!isAddress(address)) return null;
  return getAddress(address); // checksummed
}

// ===== Signature verification =====

/**
 * Verify a signed message for the given address and chain.
 * Supports EVM (ECDSA via viem) and Solana (ed25519 via tweetnacl).
 */
export async function verifyWalletSignature(params: {
  address: string;
  chain: string;
  message: string;
  signature: string;
}): Promise<boolean> {
  const { address, chain, message, signature } = params;

  if (isSolanaChain(chain)) {
    try {
      const publicKey = bs58.decode(address);
      const messageBytes = new TextEncoder().encode(message);
      // Solana signatures are base58 or base64; try base58 first, then base64
      let signatureBytes: Uint8Array;
      try {
        signatureBytes = bs58.decode(signature);
      } catch {
        signatureBytes = Uint8Array.from(Buffer.from(signature, 'base64'));
      }
      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey);
    } catch {
      return false;
    }
  }

  // EVM signature verification
  try {
    return await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return false;
  }
}
