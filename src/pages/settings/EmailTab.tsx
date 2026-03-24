import { useEffect, useState } from 'react'
import { extractApiErrorMessage } from '@/lib/api-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  applyEmailProviderPreset,
  DEFAULT_SUBMISSION_EMAIL_SUBJECT,
  DEFAULT_SUBMISSION_EMAIL_TIMEOUT_MS,
  EmailProviderPresetId,
  getEmailProviderPreset,
  inferEmailProviderPresetId,
  EMAIL_PROVIDER_PRESETS,
} from '@/lib/email-presets'
import { buildEmailTestErrorMessage } from '@/lib/email-test-feedback'

interface EmailTabProps {
  siteSettings: {
    siteName?: string
  }
  adminSettingsData: {
    submissionEmailEnabled?: boolean
    smtpHost?: string
    smtpPort?: number
    smtpSecure?: boolean
    smtpUser?: string
    submissionEmailFrom?: string
    submissionEmailReplyTo?: string
    submissionEmailSubject?: string
    submissionEmailTimeoutMs?: number
    smtpPasswordConfigured?: boolean
  } | undefined
}

export function EmailTab({ siteSettings, adminSettingsData }: EmailTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')
  const [selectedEmailPresetId, setSelectedEmailPresetId] = useState<EmailProviderPresetId>('custom')
  const [emailForm, setEmailForm] = useState({
    submissionEmailEnabled: false,
    smtpHost: '',
    smtpPort: '587',
    smtpSecure: false,
    smtpUser: '',
    smtpPass: '',
    submissionEmailFrom: '',
    submissionEmailReplyTo: '',
    submissionEmailSubject: '',
    submissionEmailTimeoutMs: '10000',
    smtpPasswordConfigured: false,
  })

  const getDerivedEmailFrom = () => {
    const smtpUser = emailForm.smtpUser.trim()
    const siteName = siteSettings.siteName?.trim() || 'OpenHackathon'
    const emailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(smtpUser)

    if (emailLike) {
      return `${siteName} <${smtpUser}>`
    }

    return emailForm.submissionEmailFrom.trim() || `${siteName} <no-reply@localhost>`
  }

  useEffect(() => {
    const adminSettings = adminSettingsData
    if (!adminSettings) return

    setEmailForm({
      submissionEmailEnabled: !!adminSettings.submissionEmailEnabled,
      smtpHost: adminSettings.smtpHost || '',
      smtpPort: String(adminSettings.smtpPort ?? 587),
      smtpSecure: !!adminSettings.smtpSecure,
      smtpUser: adminSettings.smtpUser || '',
      smtpPass: '',
      submissionEmailFrom: adminSettings.submissionEmailFrom || 'OpenHackathon <no-reply@localhost>',
      submissionEmailReplyTo: adminSettings.submissionEmailReplyTo || '',
      submissionEmailSubject: adminSettings.submissionEmailSubject || DEFAULT_SUBMISSION_EMAIL_SUBJECT,
      submissionEmailTimeoutMs: String(adminSettings.submissionEmailTimeoutMs ?? DEFAULT_SUBMISSION_EMAIL_TIMEOUT_MS),
      smtpPasswordConfigured: !!adminSettings.smtpPasswordConfigured,
    })
    setSelectedEmailPresetId(
      inferEmailProviderPresetId({
        smtpHost: adminSettings.smtpHost || '',
        smtpPort: String(adminSettings.smtpPort ?? 587),
        smtpSecure: !!adminSettings.smtpSecure,
      })
    )
    setClearSmtpPassword(false)
  }, [adminSettingsData])

  const selectedEmailPreset = getEmailProviderPreset(selectedEmailPresetId)

  const handleApplyEmailPreset = (presetId: EmailProviderPresetId) => {
    setSelectedEmailPresetId(presetId)
    const preset = getEmailProviderPreset(presetId)
    if (preset.id === 'custom') return

    setEmailForm((prev) => applyEmailProviderPreset(prev, preset))
    if (clearSmtpPassword) setClearSmtpPassword(false)
  }

  const saveEmailMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<{
        submissionEmailEnabled: boolean
        smtpHost: string
        smtpPort: number
        smtpSecure: boolean
        smtpUser: string
        smtpPass: string
        submissionEmailFrom: string
        submissionEmailReplyTo: string
        submissionEmailSubject: string
        submissionEmailTimeoutMs: number
      }> = {
        submissionEmailEnabled: emailForm.submissionEmailEnabled,
        smtpHost: emailForm.smtpHost.trim(),
        smtpPort: Number.parseInt(emailForm.smtpPort, 10) || 587,
        smtpSecure: emailForm.smtpSecure,
        smtpUser: emailForm.smtpUser.trim(),
        submissionEmailFrom: getDerivedEmailFrom(),
        submissionEmailReplyTo: '',
        submissionEmailSubject: emailForm.submissionEmailSubject.trim(),
        submissionEmailTimeoutMs: Number.parseInt(emailForm.submissionEmailTimeoutMs, 10) || 10000,
      }

      if (clearSmtpPassword) {
        payload.smtpPass = ''
      } else if (emailForm.smtpPass.trim()) {
        payload.smtpPass = emailForm.smtpPass.trim()
      }

      return api.updateSiteSettings(payload)
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] })
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] })
      setEmailForm((prev) => ({
        ...prev,
        smtpPass: '',
        smtpPasswordConfigured: !!updated.smtpPasswordConfigured,
      }))
      setClearSmtpPassword(false)
      toast.success(t('settings.email_saved', 'Email settings saved'))
    },
    onError: (error: unknown) => {
      toast.error(extractApiErrorMessage(error, t('settings.email_save_failed', 'Failed to save email settings')))
    },
  })

  const testEmailMutation = useMutation({
    mutationFn: () => api.testSubmissionEmail(testRecipient.trim()),
    onSuccess: () => {
      toast.success(t('settings.email_test_sent', 'Test email sent'))
    },
    onError: (error: unknown) => {
      const responseData =
        typeof error === 'object' &&
        error !== null &&
        'response' in error
          ? (error as {
              response?: {
                data?: {
                  error?: string
                  reason?: string
                  errorCode?: string
                  errorDetail?: string
                }
              }
            }).response?.data
          : undefined

      const message = buildEmailTestErrorMessage(responseData, emailForm.smtpHost, t)
      toast.error(message || t('settings.email_test_failed', 'Failed to send test email'))
    },
  })

  return (
    <Card className="surface-panel border-none shadow-none">
      <CardHeader>
        <CardTitle>{t('settings.email_title', 'Submission Email Delivery')}</CardTitle>
        <CardDescription>
          {t(
            'settings.email_desc',
            'Configure SMTP in admin panel so participants receive submission receipts without editing server .env files.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between surface-inset p-3">
          <div>
            <p className="text-sm font-medium">{t('settings.email_enabled', 'Enable receipt email sending')}</p>
            <p className="text-xs text-muted-foreground">
              {t('settings.email_enabled_desc', 'When enabled, each successful submission triggers a receipt email.')}
            </p>
          </div>
          <Switch
            checked={emailForm.submissionEmailEnabled}
            onCheckedChange={(checked) => setEmailForm((prev) => ({ ...prev, submissionEmailEnabled: checked }))}
          />
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium">{t('settings.email_presets_title', 'Common SMTP Presets')}</p>
            <p className="text-xs text-muted-foreground">
              {t('settings.email_presets_desc', 'Click a preset to fill host, port, and TLS defaults, then finish the account-specific fields below.')}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            {EMAIL_PROVIDER_PRESETS.map((preset) => {
              const isActive = preset.id === selectedEmailPresetId
              return (
                <button
                  key={preset.id}
                  type="button"
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40 hover:bg-muted/40'
                  }`}
                  onClick={() => handleApplyEmailPreset(preset.id)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">
                      {t(`settings.email_presets_items.${preset.id}.label`)}
                    </span>
                    <Badge variant={preset.evidence === 'official' ? 'secondary' : 'outline'}>
                      {preset.evidence === 'official'
                        ? t('settings.email_preset_source_official', 'Official')
                        : t('settings.email_preset_source_common', 'Common')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(`settings.email_presets_items.${preset.id}.desc`)}
                  </p>
                  <p className="mt-3 font-mono text-xs text-muted-foreground">
                    {preset.host ? `${preset.host}:${preset.port} ${preset.secure ? 'SSL' : 'STARTTLS'}` : 'SMTP host / port'}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="rounded-md bg-muted/50 p-3 space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">
              {t(`settings.email_presets_items.${selectedEmailPreset.id}.label`)}
            </p>
            <p>{t(selectedEmailPreset.passwordHintKey)}</p>
            <p>{t('settings.email_preset_username_hint', { example: selectedEmailPreset.usernameHint, defaultValue: 'Username example: {{example}}' })}</p>
            <p>{t('settings.email_preset_from_hint', { example: selectedEmailPreset.fromHint, defaultValue: 'From example: {{example}}' })}</p>
            <p>{t('settings.email_preset_reply_to_hint', { example: selectedEmailPreset.replyToHint, defaultValue: 'Reply-To example: {{example}}' })}</p>
            {selectedEmailPreset.noteKeys.map((noteKey) => (
              <p key={noteKey}>{t(noteKey)}</p>
            ))}
            {selectedEmailPreset.docUrl ? (
              <a
                href={selectedEmailPreset.docUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex text-primary hover:underline"
              >
                {t('settings.email_preset_doc_link', 'View provider documentation')}
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="smtpHost">{t('settings.smtp_host', 'SMTP Host')}</Label>
            <Input
              id="smtpHost"
              placeholder={selectedEmailPreset.host || 'smtp.example.com'}
              value={emailForm.smtpHost}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, smtpHost: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPort">{t('settings.smtp_port', 'SMTP Port')}</Label>
            <Input
              id="smtpPort"
              type="number"
              min={1}
              max={65535}
              value={emailForm.smtpPort}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, smtpPort: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpUser">{t('settings.smtp_user', 'SMTP Username')}</Label>
            <Input
              id="smtpUser"
              placeholder={selectedEmailPreset.usernameHint}
              value={emailForm.smtpUser}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, smtpUser: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="smtpPass">{t('settings.smtp_pass', 'SMTP Password')}</Label>
            <div className="relative">
              <Input
                id="smtpPass"
                type={showSmtpPassword ? 'text' : 'password'}
                placeholder={emailForm.smtpPasswordConfigured ? t('settings.smtp_pass_masked', 'Saved (leave blank to keep)') : t(selectedEmailPreset.passwordHintKey)}
                value={emailForm.smtpPass}
                onChange={(e) => {
                  setEmailForm((prev) => ({ ...prev, smtpPass: e.target.value }))
                  if (clearSmtpPassword) setClearSmtpPassword(false)
                }}
                className="pr-9"
              />
              <button
                type="button"
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSmtpPassword((prev) => !prev)}
              >
                {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {emailForm.smtpPasswordConfigured
                  ? t('settings.smtp_pass_configured', 'Password is configured.')
                  : t('settings.smtp_pass_not_configured', 'Password is not configured yet.')}
              </span>
              {emailForm.smtpPasswordConfigured ? (
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => {
                    setClearSmtpPassword(true)
                    setEmailForm((prev) => ({ ...prev, smtpPass: '' }))
                  }}
                >
                  {t('settings.smtp_pass_clear', 'Clear saved password')}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-medium">{t('settings.email_from_auto_title', 'Automatic sender address')}</p>
            <p className="mt-1 font-mono text-xs text-muted-foreground break-all">
              {getDerivedEmailFrom()}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t('settings.email_from_auto_desc', 'Generated automatically as "Site Name <SMTP mailbox>". Replies will also go to this address.')}
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="submissionEmailSubject">{t('settings.email_subject', 'Subject Template')}</Label>
            <Input
              id="submissionEmailSubject"
              placeholder="[{{hackathonTitle}}] Submission Receipt {{receiptId}}"
              value={emailForm.submissionEmailSubject}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, submissionEmailSubject: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {t('settings.email_subject_desc', 'Supports {{hackathonTitle}}, {{receiptId}}, {{projectTitle}}')}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="submissionEmailTimeoutMs">{t('settings.email_timeout', 'Timeout (ms)')}</Label>
            <Input
              id="submissionEmailTimeoutMs"
              type="number"
              min={1000}
              max={120000}
              value={emailForm.submissionEmailTimeoutMs}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, submissionEmailTimeoutMs: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="smtpSecure">{t('settings.smtp_secure', 'Use TLS / SSL')}</Label>
              <Switch
                id="smtpSecure"
                checked={emailForm.smtpSecure}
                onCheckedChange={(checked) => setEmailForm((prev) => ({ ...prev, smtpSecure: checked }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settings.smtp_secure_desc', 'Usually false for 587 (STARTTLS), true for 465 (implicit TLS).')}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-4 space-y-3">
          <p className="text-sm font-medium">{t('settings.email_test_title', 'Send Test Email')}</p>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              type="email"
              placeholder="you@example.com"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
            />
            <Button
              variant="outline"
              disabled={!testRecipient.trim() || testEmailMutation.isPending}
              onClick={() => testEmailMutation.mutate()}
            >
              {testEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('settings.email_test_send', 'Send Test')}
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => saveEmailMutation.mutate()} disabled={saveEmailMutation.isPending}>
            {saveEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            {t('settings.email_save', 'Save Email Settings')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
