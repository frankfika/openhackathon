/**
 * Unit tests for the centralized User sanitization whitelist
 * (synth-design-spec §1.2 P0-1).
 *
 * Covers:
 *   - USER_PUBLIC_FIELDS does not include the password column
 *   - sanitizeUser strips every column listed in USER_SENSITIVE_FIELDS
 *   - sanitizeUser is a no-op for objects that do not carry the
 *     sensitive columns (e.g. the result of select: USER_PUBLIC_FIELDS)
 *   - isSensitiveUserField is the inverse of the constants
 */
import { describe, expect, it } from 'vitest';
import {
  PROJECT_SUBMITTER_PUBLIC_FIELDS,
  USER_PUBLIC_FIELDS,
  USER_SENSITIVE_FIELDS,
  isSensitiveUserField,
  sanitizeUser,
} from '../sanitize';

describe('USER_PUBLIC_FIELDS whitelist', () => {
  it('does not expose the password column', () => {
    expect(USER_PUBLIC_FIELDS).not.toHaveProperty('password');
    expect(USER_PUBLIC_FIELDS).not.toHaveProperty('passwordHash');
  });

  it('exposes only the documented public columns', () => {
    expect(Object.keys(USER_PUBLIC_FIELDS).sort()).toEqual(
      ['avatarUrl', 'createdAt', 'email', 'id', 'name', 'role'],
    );
  });

  it('does not expose Web3-only counters', () => {
    for (const key of [
      'globalPoints',
      'participationCount',
      'judgeCount',
      'awardCount',
      'primaryWalletId',
      'isWeb3User',
      'wallets',
    ]) {
      expect(USER_PUBLIC_FIELDS).not.toHaveProperty(key);
    }
  });
});

describe('PROJECT_SUBMITTER_PUBLIC_FIELDS', () => {
  it('is a strict subset of USER_PUBLIC_FIELDS', () => {
    for (const key of Object.keys(PROJECT_SUBMITTER_PUBLIC_FIELDS)) {
      expect(USER_PUBLIC_FIELDS).toHaveProperty(key);
    }
  });

  it('never exposes email or role on the public project detail endpoint', () => {
    expect(PROJECT_SUBMITTER_PUBLIC_FIELDS).not.toHaveProperty('email');
    expect(PROJECT_SUBMITTER_PUBLIC_FIELDS).not.toHaveProperty('role');
    expect(PROJECT_SUBMITTER_PUBLIC_FIELDS).not.toHaveProperty('createdAt');
  });
});

describe('sanitizeUser', () => {
  it('strips every column listed in USER_SENSITIVE_FIELDS', () => {
    const full = {
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      avatarUrl: null,
      createdAt: new Date(),
      password: '$2b$10$abcdef',
      passwordHash: 'bcrypt$10$abcdef',
      wallets: [{ address: '0xabc', chain: 'ethereum' }],
      primaryWalletId: 'w1',
      isWeb3User: true,
      globalPoints: 100,
      participationCount: 5,
      judgeCount: 2,
      awardCount: 1,
      updatedAt: new Date(),
    };
    const clean = sanitizeUser(full) as Record<string, unknown>;
    for (const key of USER_SENSITIVE_FIELDS) {
      expect(clean).not.toHaveProperty(key);
    }
    expect(clean.id).toBe('u1');
    expect(clean.email).toBe('admin@example.com');
    expect(clean.role).toBe('admin');
  });

  it('returns null / undefined unchanged', () => {
    expect(sanitizeUser(null)).toBeNull();
    expect(sanitizeUser(undefined)).toBeUndefined();
  });

  it('does not mutate the input object', () => {
    const input = { id: 'u1', password: 'secret', name: 'A' };
    const copy = { ...input };
    sanitizeUser(input);
    expect(input).toEqual(copy);
  });

  it('is a no-op for objects that already lack the sensitive columns', () => {
    const publicRow = {
      id: 'u1',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      avatarUrl: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    };
    const out = sanitizeUser(publicRow) as Record<string, unknown>;
    expect(Object.keys(out).sort()).toEqual(Object.keys(publicRow).sort());
  });
});

describe('isSensitiveUserField', () => {
  it('returns true for every column in USER_SENSITIVE_FIELDS', () => {
    for (const key of USER_SENSITIVE_FIELDS) {
      expect(isSensitiveUserField(key)).toBe(true);
    }
  });

  it('returns false for safe columns', () => {
    for (const key of ['id', 'email', 'name', 'role', 'avatarUrl', 'createdAt']) {
      expect(isSensitiveUserField(key)).toBe(false);
    }
  });
});
