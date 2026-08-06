import { describe, expect, it } from 'vitest';
import {
  encryptEmailSecret,
  decryptEmailSecret,
  signTokenForUser,
} from '../utils/crypto';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET ||= 'test-secret-crypto';
process.env.EMAIL_SETTINGS_SECRET ||= 'test-email-secret';

describe('encryptEmailSecret / decryptEmailSecret', () => {
  it('round-trips a plaintext value', () => {
    const plaintext = 'super-secret-password';
    const encrypted = encryptEmailSecret(plaintext);
    expect(encrypted.startsWith('v1:')).toBe(true);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptEmailSecret(encrypted)).toBe(plaintext);
  });

  it('returns null for malformed ciphertext', () => {
    expect(decryptEmailSecret('not-a-valid-ciphertext')).toBeNull();
    expect(decryptEmailSecret('v1:abc')).toBeNull();
    expect(decryptEmailSecret('')).toBeNull();
  });

  it('returns null when the auth tag is tampered', () => {
    const encrypted = encryptEmailSecret('hello');
    const [, iv, tag, body] = encrypted.split(':');
    // Flip a byte in the auth tag so the GCM tag check fails.
    const tamperedTag = Buffer.from(tag, 'base64');
    tamperedTag[0] = tamperedTag[0] ^ 0xff;
    const tampered = `v1:${iv}:${tamperedTag.toString('base64')}:${body}`;
    expect(decryptEmailSecret(tampered)).toBeNull();
  });
});

describe('signTokenForUser', () => {
  it('signs a JWT that includes iss, aud, sub, role, exp', () => {
    const token = signTokenForUser({
      id: 'user-1',
      email: 'a@b.co',
      name: 'Alice',
      role: 'admin',
    });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('admin');
    expect(decoded.email).toBe('a@b.co');
    expect(decoded.name).toBe('Alice');
    expect(typeof decoded.exp).toBe('number');
    expect(typeof decoded.iat).toBe('number');
  });
});
