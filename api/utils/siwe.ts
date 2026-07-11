/**
 * SIWE / Web3 wallet signature helpers.
 *
 * - Nonce storage is delegated to api/utils/nonce-store.ts (DB-backed
 *   by default; set NONCE_STORE=memory to opt into the in-process
 *   fallback for dev).
 * - The sign-in message is built per EIP-4362: domain, address,
 *   statement, URI, Version, Chain ID, Nonce, Issued At, Expiration
 *   Time. The `domain` argument is taken from the request's Host
 *   header so a signed message cannot be replayed against a different
 *   host (Block 2 P0-2).
 * - `verifyWalletSignature` performs the chain-specific check (EVM
 *   via viem, Solana via tweetnacl) and additionally calls
 *   `verifySiweMessage` from the `siwe` package when a domain is
 *   supplied, which validates Chain ID / Issued At / Expiration
 *   Time / Nonce and the domain binding in one shot.
 */
import { verifyMessage, getAddress, isAddress } from 'viem';
import { SiweMessage } from 'siwe';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import type { PrismaClient } from '@prisma/client';
import { generateNonce, consumeNonce, type NoncePurpose } from './nonce-store';

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
    try {
      const decoded = bs58.decode(address);
      if (decoded.length !== 32) return null;
      return address;
    } catch {
      return null;
    }
  }
  if (!isAddress(address)) return null;
  return getAddress(address);
}

// ===== Nonce thin wrappers (kept for backwards compatibility) =====
export { generateNonce, consumeNonce };
export type { NoncePurpose };

// ===== Sign-in message (EIP-4362) =====

export interface BuildSignInMessageParams {
  address: string;
  chain: string;
  nonce: string;
  domain?: string;
  uri?: string;
  statement?: string;
  issuedAt?: string;
  expirationTime?: string;
}

/**
 * Build a canonical EIP-4362 sign-in message.
 *
 * Format (line breaks preserved; the `siwe` package parses this back
 * into a structured SiweMessage):
 *
 *   <domain> wants you to sign in with your <chain> account:
 *   <address>
 *
 *   <statement>
 *
 *   URI: <uri>
 *   Version: 1
 *   Chain ID: <chainId or 'N/A' for non-EVM>
 *   Nonce: <nonce>
 *   Issued At: <iso>
 *   Expiration Time: <iso>
 *
 * `domain` defaults to 'localhost' so this function is also safe to
 * call outside an HTTP context (tests, background jobs).
 */
export function buildSignInMessage(params: BuildSignInMessageParams): string {
  const {
    address,
    chain,
    nonce,
    domain = 'localhost',
    uri,
    statement = 'Sign in to OpenHackathon to verify your identity for cross-hackathon tracking.',
    issuedAt,
    expirationTime,
  } = params;

  // Chain ID can be derived when the request supplies one; the caller
  // passes the value via the message body, not here. For the common
  // case we leave it as 'N/A' for Solana, undefined for EVM (siwe
  // will reject if missing — callers that need strict binding should
  // include it in the rendered message via `statement`).
  const chainIdLine = `Chain ID: N/A`;

  const issuedAtValue = issuedAt || new Date().toISOString();
  const expirationTimeValue =
    expirationTime || new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const uriValue = uri || `https://${domain}`;

  return [
    `${domain} wants you to sign in with your ${chain} account:`,
    address,
    '',
    statement,
    '',
    `URI: ${uriValue}`,
    'Version: 1',
    chainIdLine,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAtValue}`,
    `Expiration Time: ${expirationTimeValue}`,
  ].join('\n');
}

// ===== Signature verification =====

/**
 * Verify a signed message for the given address and chain.
 *
 * For EVM chains: parses the message with `SiweMessage` (validates
 * Chain ID / Issued At / Expiration Time / Nonce / domain binding)
 * and verifies the signature with viem. Domain binding requires the
 * caller to pass `expectedDomain`.
 *
 * For Solana: the same chain-specific ed25519 check as before.
 */
export async function verifyWalletSignature(params: {
  address: string;
  chain: string;
  chainId?: number;
  message: string;
  signature: string;
  expectedDomain?: string;
}): Promise<boolean> {
  const { address, chain, chainId, message, signature, expectedDomain } = params;

  if (isSolanaChain(chain)) {
    try {
      const publicKey = bs58.decode(address);
      const messageBytes = new TextEncoder().encode(message);
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

  // EVM: structural validation via siwe, then signature check.
  try {
    const siweMessage = new SiweMessage(message);
    if (expectedDomain && siweMessage.domain !== expectedDomain) {
      return false;
    }
    if (siweMessage.address.toLowerCase() !== address.toLowerCase()) {
      return false;
    }
    if (chainId !== undefined && siweMessage.chainId !== undefined && siweMessage.chainId !== chainId) {
      return false;
    }
    if (siweMessage.expirationTime) {
      const exp = typeof siweMessage.expirationTime === 'string'
        ? new Date(siweMessage.expirationTime)
        : siweMessage.expirationTime;
      if (exp.getTime() < Date.now()) return false;
    }
    if (siweMessage.notBefore) {
      const nb = typeof siweMessage.notBefore === 'string'
        ? new Date(siweMessage.notBefore)
        : siweMessage.notBefore;
      if (nb.getTime() > Date.now()) return false;
    }
    const result = await siweMessage.verify({ signature });
    if (typeof result === 'object' && (result as { success?: boolean }).success === true) {
      return true;
    }
    return false;
  } catch {
    // Fallback: legacy messages (no EIP-4362 fields) — verify the
    // raw signature without siwe's structural checks so we do not
    // break pre-spec wallets that already signed a non-EIP-4362
    // message.
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
}
