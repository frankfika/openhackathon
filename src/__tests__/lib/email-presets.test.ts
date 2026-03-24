import { describe, expect, it } from 'vitest'
import {
  applyEmailProviderPreset,
  DEFAULT_SUBMISSION_EMAIL_SUBJECT,
  DEFAULT_SUBMISSION_EMAIL_TIMEOUT_MS,
  getEmailProviderPreset,
  inferEmailProviderPresetId,
} from '@/lib/email-presets'

describe('email presets', () => {
  it('detects the gmail preset from smtp settings', () => {
    expect(
      inferEmailProviderPresetId({
        smtpHost: 'smtp.gmail.com',
        smtpPort: '587',
        smtpSecure: false,
      })
    ).toBe('gmail')
  })

  it('detects the 163 preset from smtp settings', () => {
    expect(
      inferEmailProviderPresetId({
        smtpHost: 'smtp.163.com',
        smtpPort: '465',
        smtpSecure: true,
      })
    ).toBe('mail163')
  })

  it('falls back to custom for unknown smtp settings', () => {
    expect(
      inferEmailProviderPresetId({
        smtpHost: 'smtp.example.com',
        smtpPort: '2525',
        smtpSecure: false,
      })
    ).toBe('custom')
  })

  it('applies host, port, secure, and default email metadata from a preset', () => {
    const gmailPreset = getEmailProviderPreset('gmail')

    const result = applyEmailProviderPreset(
      {
        smtpHost: '',
        smtpPort: '',
        smtpSecure: true,
        submissionEmailSubject: '',
        submissionEmailTimeoutMs: '',
        smtpUser: 'team@example.com',
      },
      gmailPreset
    )

    expect(result).toMatchObject({
      smtpHost: 'smtp.gmail.com',
      smtpPort: '587',
      smtpSecure: false,
      submissionEmailSubject: DEFAULT_SUBMISSION_EMAIL_SUBJECT,
      submissionEmailTimeoutMs: String(DEFAULT_SUBMISSION_EMAIL_TIMEOUT_MS),
      smtpUser: 'team@example.com',
    })
  })
})
