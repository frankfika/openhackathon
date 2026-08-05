/**
 * Rate limiter key generator tests.
 *
 * Verifies the per-user-id keying added in audit-launch-2026-08-06.md
 * P1-7: AI endpoints should be rate-limited per authenticated user, not
 * per IP, so a single user with rotating IPs / NAT'd colleagues do not
 * share or evade the same bucket.
 */
import { describe, it, expect } from 'vitest'
import type { Request } from 'express'
import { aiRateLimitKey } from '../middleware'
import type { AuthUser } from '../types'

function makeReq(opts: { ip?: string; authUser?: AuthUser | null } = {}): Request {
  return {
    ip: opts.ip ?? '192.0.2.1',
    authUser: opts.authUser ?? null,
  } as unknown as Request
}

describe('aiRateLimitKey', () => {
  it('uses the authenticated user id (prefixed with "user:")', () => {
    const req = makeReq({
      ip: '198.51.100.7',
      authUser: { id: 'user-abc', role: 'judge', email: 'a@b.com', name: 'A' },
    })
    expect(aiRateLimitKey(req)).toBe('user:user-abc')
  })

  it('falls back to ip when no authenticated user is attached', () => {
    const req = makeReq({ ip: '198.51.100.7' })
    const key = aiRateLimitKey(req)
    expect(key.startsWith('ip:')).toBe(true)
    // The default ipKeyGenerator wraps IPv4 in ::ffff: for v6 normalization.
    expect(key).toContain('198.51.100.7')
  })

  it('two different users from the same IP get different buckets', () => {
    const userA = makeReq({
      ip: '198.51.100.7',
      authUser: { id: 'user-a', role: 'judge', email: 'a@b.com', name: 'A' },
    })
    const userB = makeReq({
      ip: '198.51.100.7',
      authUser: { id: 'user-b', role: 'judge', email: 'b@b.com', name: 'B' },
    })
    expect(aiRateLimitKey(userA)).not.toBe(aiRateLimitKey(userB))
  })

  it('a user rotating IPs keeps the same bucket', () => {
    const userA1 = makeReq({
      ip: '198.51.100.1',
      authUser: { id: 'user-a', role: 'judge', email: 'a@b.com', name: 'A' },
    })
    const userA2 = makeReq({
      ip: '198.51.100.99',
      authUser: { id: 'user-a', role: 'judge', email: 'a@b.com', name: 'A' },
    })
    expect(aiRateLimitKey(userA1)).toBe(aiRateLimitKey(userA2))
  })
})
