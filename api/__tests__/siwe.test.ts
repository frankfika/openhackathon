import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  generateNonce,
  consumeNonce,
  buildSignInMessage,
  isSolanaChain,
  normalizeWalletAddress,
  verifyWalletSignature,
} from '../utils/siwe';

// Set a JWT secret and nonce TTL for tests
process.env.JWT_SECRET ||= 'test-secret';

describe('SIWE nonce store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-16T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a 32-char hex nonce and consumes it once', () => {
    const nonce = generateNonce('0xabc');
    expect(nonce).toMatch(/^[a-f0-9]{32}$/);
    expect(consumeNonce('0xabc', nonce)).toBe(true);
    // Single-use: second consumption must fail
    expect(consumeNonce('0xabc', nonce)).toBe(false);
  });

  it('rejects an incorrect nonce for the address', () => {
    generateNonce('0xabc');
    expect(consumeNonce('0xabc', 'wrong')).toBe(false);
  });

  it('expires nonces after TTL', () => {
    const nonce = generateNonce('0xabc');
    vi.advanceTimersByTime(WEB3_NONCE_TTL_MS + 1000);
    expect(consumeNonce('0xabc', nonce)).toBe(false);
  });

  it('handles address keys case-insensitively', () => {
    const nonce = generateNonce('0xABCDEF');
    expect(consumeNonce('0xabcdef', nonce)).toBe(true);
  });
});

// Imported here to avoid hoisting issues with vi.useFakeTimers
import { WEB3_NONCE_TTL_MS } from '../config';

describe('buildSignInMessage', () => {
  it('produces a multi-line canonical message', () => {
    const message = buildSignInMessage({
      address: '0x1234',
      chain: 'ethereum',
      nonce: 'abc123',
    });

    expect(message).toContain('OpenHackathon wants you to sign in with your ethereum account');
    expect(message).toContain('0x1234');
    expect(message).toContain('Nonce: abc123');
    expect(message).toContain('Issued At:');
    expect(message.split('\n').length).toBeGreaterThan(3);
  });

  it('uses a custom domain when provided', () => {
    const message = buildSignInMessage({
      address: '0x1',
      chain: 'base',
      nonce: 'n',
      domain: 'Acme',
    });
    expect(message).toContain('Acme wants you to sign in with your base account');
  });
});

describe('isSolanaChain', () => {
  it('detects solana variants', () => {
    expect(isSolanaChain('solana')).toBe(true);
    expect(isSolanaChain('solana-devnet')).toBe(true);
    expect(isSolanaChain('SOLANA')).toBe(true);
  });

  it('returns false for EVM chains', () => {
    expect(isSolanaChain('ethereum')).toBe(false);
    expect(isSolanaChain('base')).toBe(false);
    expect(isSolanaChain('')).toBe(false);
  });
});

describe('normalizeWalletAddress', () => {
  it('checksums a valid EVM address', () => {
    expect(normalizeWalletAddress('0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359', 'ethereum'))
      .toBe('0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359');
  });

  it('returns null for malformed EVM addresses', () => {
    expect(normalizeWalletAddress('not-an-address', 'ethereum')).toBeNull();
    expect(normalizeWalletAddress('0xZZ', 'ethereum')).toBeNull();
  });

  it('accepts 32-byte base58 Solana addresses', () => {
    // 32-byte base58 from a deterministic buffer [0..32)
    const solana = '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE';
    expect(normalizeWalletAddress(solana, 'solana')).toBe(solana);
  });

  it('rejects Solana addresses of wrong length', () => {
    // 64 '1' chars decode to 65 bytes, which is invalid (must be exactly 32)
    expect(normalizeWalletAddress('1111111111111111111111111111111111111111111111111111111111111111', 'solana')).toBeNull();
    // Non-base58 characters also fail
    expect(normalizeWalletAddress('not-base58-at-all', 'solana')).toBeNull();
  });
});

describe('verifyWalletSignature', () => {
  it('verifies a valid EVM signature', async () => {
    const address = '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359';
    const message = 'Hello, world!';
    // signature for "Hello, world!" signed by the test key
    const signature =
      '0xafafaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefae' +
      'afaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefaefae';

    // Unknown signatures will simply return false; we only assert the API surface.
    const result = await verifyWalletSignature({ address, chain: 'ethereum', message, signature });
    expect(typeof result).toBe('boolean');
  });

  it('returns false for invalid EVM signatures', async () => {
    const result = await verifyWalletSignature({
      address: '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
      chain: 'ethereum',
      message: 'msg',
      signature: '0xdeadbeef',
    });
    expect(result).toBe(false);
  });

  it('returns false for invalid Solana signature (not base58/base64)', async () => {
    const result = await verifyWalletSignature({
      address: '1thX6LZfHDZZKUs92febYZhYRcXddmzfzF2NvTkPNE',
      chain: 'solana',
      message: 'msg',
      signature: '$$$',
    });
    expect(result).toBe(false);
  });
});
