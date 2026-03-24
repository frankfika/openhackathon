import type { TFunction } from 'i18next'

type EmailTestErrorData = {
  error?: string
  reason?: string
  errorCode?: string
  errorDetail?: string
}

function includesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle))
}

export function buildEmailTestErrorMessage(
  data: EmailTestErrorData | undefined,
  smtpHost: string,
  t: TFunction
) {
  const baseMessage = data?.error || t('settings.email_test_failed', 'Failed to send test email')
  const host = smtpHost.trim().toLowerCase()
  const code = (data?.errorCode || '').toLowerCase()
  const detail = (data?.errorDetail || '').toLowerCase()
  const combined = `${code} ${detail}`.trim()

  if (data?.reason === 'missing_config') {
    return t(
      'settings.email_test_hint_missing',
      'SMTP configuration is incomplete. Please check server, port, username, and password.'
    )
  }

  if (includesAny(combined, ['eauth', '535', '534', 'authentication failed', 'auth fail', 'invalid login'])) {
    if (host === 'smtp.163.com') {
      return t(
        'settings.email_test_hint_163_auth',
        '163 SMTP usually requires a client authorization code, not your web login password. Please enable SMTP in 163 Mail and use the authorization code here.'
      )
    }

    return t(
      'settings.email_test_hint_auth',
      'SMTP authentication failed. Check the username and password, and if your mail provider requires an app password or authorization code, use that instead of the web login password.'
    )
  }

  if (includesAny(combined, ['esocket', 'ssl routines', 'wrong version number', 'certificate', 'tls', 'ssl'])) {
    return t(
      'settings.email_test_hint_tls',
      'SMTP connected but TLS/SSL negotiation failed. Common fix: use port 465 with SSL enabled, or port 587 with SSL disabled.'
    )
  }

  if (includesAny(combined, ['etimedout', 'timeout', 'econnrefused', 'econnreset', 'network', 'greeting never received'])) {
    return t(
      'settings.email_test_hint_network',
      'Unable to connect to the SMTP server. Check the host, port, TLS setting, and whether the mail provider is blocking the connection.'
    )
  }

  const detailParts = [data?.errorCode, data?.errorDetail].filter(Boolean)
  return detailParts.length > 0 ? `${baseMessage}: ${detailParts.join(' | ')}` : baseMessage
}
