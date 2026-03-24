export type EmailProviderPresetId = 'gmail' | 'mail163' | 'custom'

export type EmailProviderPreset = {
  id: EmailProviderPresetId
  host: string
  port: number
  secure: boolean
  usernameHint: string
  passwordHintKey: string
  fromHint: string
  replyToHint: string
  evidence: 'official' | 'common'
  docUrl?: string
  noteKeys: string[]
}

export type EmailSettingsFormLike = {
  smtpHost: string
  smtpPort: string
  smtpSecure: boolean
  submissionEmailSubject: string
  submissionEmailTimeoutMs: string
}

export const DEFAULT_SUBMISSION_EMAIL_SUBJECT = '[{{hackathonTitle}}] Submission Receipt {{receiptId}}'
export const DEFAULT_SUBMISSION_EMAIL_TIMEOUT_MS = 10000

export const EMAIL_PROVIDER_PRESETS: EmailProviderPreset[] = [
  {
    id: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    usernameHint: 'yourname@gmail.com',
    passwordHintKey: 'settings.email_preset_password_hint_gmail',
    fromHint: 'OpenHackathon <yourname@gmail.com>',
    replyToHint: 'yourname@gmail.com',
    evidence: 'official',
    docUrl: 'https://support.google.com/mail/answer/7126229',
    noteKeys: [
      'settings.email_preset_note_gmail_app_password',
      'settings.email_preset_note_from_match',
    ],
  },
  {
    id: 'mail163',
    host: 'smtp.163.com',
    port: 465,
    secure: true,
    usernameHint: 'yourname@163.com',
    passwordHintKey: 'settings.email_preset_password_hint_163',
    fromHint: 'OpenHackathon <yourname@163.com>',
    replyToHint: 'yourname@163.com',
    evidence: 'common',
    noteKeys: [
      'settings.email_preset_note_163_auth_code',
      'settings.email_preset_note_from_match',
    ],
  },
  {
    id: 'custom',
    host: '',
    port: 587,
    secure: false,
    usernameHint: 'apikey or account user',
    passwordHintKey: 'settings.email_preset_password_hint_custom',
    fromHint: 'OpenHackathon <no-reply@example.com>',
    replyToHint: 'support@example.com',
    evidence: 'common',
    noteKeys: [
      'settings.email_preset_note_custom_provider',
      'settings.email_preset_note_from_match',
    ],
  },
]

export function getEmailProviderPreset(id: EmailProviderPresetId) {
  return EMAIL_PROVIDER_PRESETS.find((preset) => preset.id === id) ?? EMAIL_PROVIDER_PRESETS[EMAIL_PROVIDER_PRESETS.length - 1]
}

export function inferEmailProviderPresetId(config: Pick<EmailSettingsFormLike, 'smtpHost' | 'smtpPort' | 'smtpSecure'>): EmailProviderPresetId {
  const host = config.smtpHost.trim().toLowerCase()
  const port = config.smtpPort.trim()

  if (host === 'smtp.gmail.com' && port === '587' && !config.smtpSecure) return 'gmail'
  if (host === 'smtp.163.com' && (port === '465' || port === '994') && config.smtpSecure) return 'mail163'

  return 'custom'
}

export function applyEmailProviderPreset<T extends EmailSettingsFormLike>(form: T, preset: EmailProviderPreset): T {
  if (preset.id === 'custom') return form

  return {
    ...form,
    smtpHost: preset.host,
    smtpPort: String(preset.port),
    smtpSecure: preset.secure,
    submissionEmailSubject: form.submissionEmailSubject.trim() || DEFAULT_SUBMISSION_EMAIL_SUBJECT,
    submissionEmailTimeoutMs: form.submissionEmailTimeoutMs.trim() || String(DEFAULT_SUBMISSION_EMAIL_TIMEOUT_MS),
  }
}
