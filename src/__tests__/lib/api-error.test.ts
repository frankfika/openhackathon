import { describe, it, expect } from 'vitest'
import { extractApiErrorMessage, sanitizeUser, USER_PUBLIC_FIELDS } from '@/lib/api-error'

describe('extractApiErrorMessage', () => {
  it('returns response.data.code as the top-priority signal', () => {
    const err = {
      response: { data: { error: 'human', code: 'TOKEN_EXPIRED' } },
    }
    expect(extractApiErrorMessage(err, 'fallback')).toBe('TOKEN_EXPIRED')
  })

  it('prefers response.data.code over err.code for axios errors', () => {
    // axios sets err.code to the HTTP code (e.g. '401'). We want the
    // server-provided code instead.
    const err = {
      code: '401',
      response: { data: { error: 'session expired', code: 'TOKEN_EXPIRED' } },
    }
    expect(extractApiErrorMessage(err, 'fallback')).toBe('TOKEN_EXPIRED')
  })

  it('falls back to response.data.error when no code field', () => {
    const err = {
      response: { data: { error: 'something broke' } },
    }
    expect(extractApiErrorMessage(err, 'fallback')).toBe('something broke')
  })

  it('falls back to err.message for non-axios errors', () => {
    expect(extractApiErrorMessage(new Error('boom'), 'fallback')).toBe('boom')
  })

  it('returns the supplied fallback for null/undefined', () => {
    expect(extractApiErrorMessage(null, 'fb')).toBe('fb')
    expect(extractApiErrorMessage(undefined, 'fb')).toBe('fb')
    expect(extractApiErrorMessage('not-an-object', 'fb')).toBe('fb')
  })

  it('returns fallback for empty response data', () => {
    const err = { response: { data: {} } }
    expect(extractApiErrorMessage(err, 'fb')).toBe('fb')
  })
})

describe('sanitizeUser', () => {
  it('keeps only fields in USER_PUBLIC_FIELDS', () => {
    const user = {
      id: '1',
      email: 'a@b.com',
      name: 'A',
      role: 'admin',
      avatarUrl: 'http://x',
      createdAt: '2026-01-01',
      password: 'SECRET',
      passwordHash: 'HASH',
      wallets: [{ address: '0x' }],
      globalPoints: 100,
    }
    const out = sanitizeUser(user)
    for (const key of USER_PUBLIC_FIELDS) {
      expect(out).toHaveProperty(key)
    }
    expect(out).not.toHaveProperty('password')
    expect(out).not.toHaveProperty('passwordHash')
    expect(out).not.toHaveProperty('wallets')
    expect(out).not.toHaveProperty('globalPoints')
  })

  it('returns an empty object for empty input', () => {
    expect(sanitizeUser({} as Record<string, unknown>)).toEqual({})
  })

  it('returns an empty object for null', () => {
    expect(sanitizeUser(null as unknown as Record<string, unknown>)).toEqual({})
  })
})
