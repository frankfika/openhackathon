import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import { buildEmailTestErrorMessage } from '@/lib/email-test-feedback'

const t = ((_: string, defaultValue: string) => defaultValue) as unknown as TFunction

describe('email test feedback', () => {
  it('returns a 163-specific auth hint for auth failures', () => {
    const message = buildEmailTestErrorMessage(
      {
        error: 'Failed to send test email',
        errorCode: 'EAUTH 535 AUTH LOGIN',
        errorDetail: 'Error: authentication failed',
      },
      'smtp.163.com',
      t
    )

    expect(message).toContain('163 SMTP usually requires a client authorization code')
  })

  it('returns a tls hint for tls failures', () => {
    const message = buildEmailTestErrorMessage(
      {
        errorCode: 'ESOCKET',
        errorDetail: 'ssl routines:wrong version number',
      },
      'smtp.example.com',
      t
    )

    expect(message).toContain('TLS/SSL negotiation failed')
  })

  it('falls back to the raw details for unknown failures', () => {
    const message = buildEmailTestErrorMessage(
      {
        error: 'Failed to send test email',
        errorCode: 'EUNKNOWN',
        errorDetail: 'unexpected provider error',
      },
      'smtp.example.com',
      t
    )

    expect(message).toBe('Failed to send test email: EUNKNOWN | unexpected provider error')
  })
})
