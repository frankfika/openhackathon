/**
 * Unit tests for the JWT error-code helper (synth-design-spec §1.2 P0-2).
 *
 * The middleware exposes verifyJwt() which translates the four canonical
 * jsonwebtoken error classes into structured AuthError values. We
 * exercise the mapping by minting tokens with real keys + the same
 * issuer/audience as the API.
 */
import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  JWT_SECRET,
} from '../config';
import { verifyJwt } from '../middleware';

function sign(payload: Record<string, unknown>, options: jwt.SignOptions = {}) {
  return jwt.sign(payload, JWT_SECRET, {
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: '5m',
    ...options,
  });
}

describe('verifyJwt error-code mapping', () => {
  it('decodes a valid token', () => {
    const token = sign({ sub: 'u1', role: 'admin', name: 'Admin' });
    const result = verifyJwt(token);
    expect(result.error).toBeUndefined();
    expect(result.payload?.sub).toBe('u1');
    expect(result.payload?.role).toBe('admin');
  });

  it('returns TOKEN_EXPIRED for a token whose exp is in the past', () => {
    const token = sign({ sub: 'u1', role: 'admin', name: 'A' }, { expiresIn: -1 });
    const result = verifyJwt(token);
    expect(result.error?.body?.code).toBe('TOKEN_EXPIRED');
    expect(result.error?.status).toBe(401);
  });

  it('returns TOKEN_INVALID for a tampered signature', () => {
    const token = sign({ sub: 'u1', role: 'admin', name: 'A' });
    const tampered = `${token.slice(0, -2)}xx`;
    const result = verifyJwt(tampered);
    expect(result.error?.body?.code).toBe('TOKEN_INVALID');
    expect(result.error?.status).toBe(401);
  });

  it('returns TOKEN_INVALID for malformed input', () => {
    const result = verifyJwt('not.a.jwt');
    expect(result.error?.body?.code).toBe('TOKEN_INVALID');
    expect(result.error?.status).toBe(401);
  });

  it('returns TOKEN_NOT_ACTIVE for a notBefore in the future', () => {
    const token = jwt.sign(
      { sub: 'u1', role: 'admin', name: 'A' },
      JWT_SECRET,
      {
        algorithm: 'HS256',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        notBefore: '1h',
      },
    );
    const result = verifyJwt(token);
    expect(result.error?.body?.code).toBe('TOKEN_NOT_ACTIVE');
    expect(result.error?.status).toBe(401);
  });

  it('returns TOKEN_ALGORITHM_REJECTED for a wrong-algorithm token', () => {
    // jsonwebtoken only refuses to verify mismatched algorithms if we
    // tell it which algorithms to accept. Our middleware passes
    // { algorithms: ['HS256'] } so an HS512-signed token with the same
    // secret will be rejected as an algorithm mismatch.
    const token = jwt.sign(
      { sub: 'u1', role: 'admin', name: 'A' },
      JWT_SECRET,
      {
        algorithm: 'HS512',
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        expiresIn: '5m',
      },
    );
    const result = verifyJwt(token);
    expect(result.error?.body?.code).toBe('TOKEN_ALGORITHM_REJECTED');
    expect(result.error?.status).toBe(401);
  });
});
