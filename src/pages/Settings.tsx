import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, Key, Server, Cpu, Loader2, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSiteBranding } from '@/lib/site-branding'

export function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { settings: siteSettings } = useSiteBranding()
  const [showKey, setShowKey] = useState(false)
  const [resetMode, setResetMode] = useState<'hackathon' | 'factory' | null>(null)
  const [resetConfirmText, setResetConfirmText] = useState('')
  const [config, setConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: ''
  })
  const [brandingForm, setBrandingForm] = useState({
    siteName: '',
    adminBasePath: '',
    logoUrl: '',
    tabTitle: '',
    seoTitle: '',
    seoDescription: '',
    faviconUrl: '',
    showPoweredBy: true,
    poweredByText: '',
    poweredByUrl: '',
  })
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [clearSmtpPassword, setClearSmtpPassword] = useState(false)
  const [testRecipient, setTestRecipient] = useState('')
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const faviconFileInputRef = useRef<HTMLInputElement>(null)
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

  const adminSettingsQuery = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: api.getAdminSiteSettings,
  })

  useEffect(() => {
    setBrandingForm({
      siteName: siteSettings.siteName || '',
      adminBasePath: siteSettings.adminBasePath || '/admin',
      logoUrl: siteSettings.logoUrl || '',
      tabTitle: siteSettings.tabTitle || '',
      seoTitle: siteSettings.seoTitle || '',
      seoDescription: siteSettings.seoDescription || '',
      faviconUrl: siteSettings.faviconUrl || '',
      showPoweredBy: !!siteSettings.showPoweredBy,
      poweredByText: siteSettings.poweredByText || '',
      poweredByUrl: siteSettings.poweredByUrl || '',
    })
  }, [siteSettings])

  useEffect(() => {
    const adminSettings = adminSettingsQuery.data
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
      submissionEmailSubject: adminSettings.submissionEmailSubject || '[{{hackathonTitle}}] Submission Receipt {{receiptId}}',
      submissionEmailTimeoutMs: String(adminSettings.submissionEmailTimeoutMs ?? 10000),
      smtpPasswordConfigured: !!adminSettings.smtpPasswordConfigured,
    })
    setClearSmtpPassword(false)
  }, [adminSettingsQuery.data])

  const saveBrandingMutation = useMutation({
    mutationFn: () =>
      api.updateSiteSettings({
        siteName: brandingForm.siteName,
        adminBasePath: brandingForm.adminBasePath,
        logoUrl: brandingForm.logoUrl,
        tabTitle: brandingForm.tabTitle,
        seoTitle: brandingForm.seoTitle,
        seoDescription: brandingForm.seoDescription,
        faviconUrl: brandingForm.faviconUrl,
        showPoweredBy: brandingForm.showPoweredBy,
        poweredByText: brandingForm.poweredByText,
        poweredByUrl: brandingForm.poweredByUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings'] })
      toast.success(t('settings.branding_saved', 'Branding settings saved'))
    },
    onError: () => {
      toast.error(t('settings.branding_save_failed', 'Failed to save branding settings'))
    },
  })

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
        submissionEmailFrom: emailForm.submissionEmailFrom.trim(),
        submissionEmailReplyTo: emailForm.submissionEmailReplyTo.trim(),
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
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : t('settings.email_save_failed', 'Failed to save email settings')
      toast.error(message || t('settings.email_save_failed', 'Failed to save email settings'))
    },
  })

  const testEmailMutation = useMutation({
    mutationFn: () => api.testSubmissionEmail(testRecipient.trim()),
    onSuccess: () => {
      toast.success(t('settings.email_test_sent', 'Test email sent'))
    },
    onError: (error: unknown) => {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string; reason?: string } } }).response?.data?.error === 'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : t('settings.email_test_failed', 'Failed to send test email')
      toast.error(message || t('settings.email_test_failed', 'Failed to send test email'))
    },
  })

  useEffect(() => {
    // Load from localStorage on mount
    const savedConfig = localStorage.getItem('ai_config')
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig))
      } catch (e) {
        console.error('Failed to parse saved AI config', e)
      }
    } else {
      // Fallback to env vars if not set in local storage
      setConfig({
        baseUrl: import.meta.env.VITE_AI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: import.meta.env.VITE_AI_API_KEY || '',
        model: import.meta.env.VITE_AI_MODEL || 'gpt-3.5-turbo'
      })
    }
  }, [])

  const resetMutation = useMutation({
    mutationFn: (mode: 'hackathon' | 'factory') => api.resetSystem(mode),
    onSuccess: (_data, mode) => {
      toast.success(t('system_tools.reset_success'))
      setResetMode(null)
      setResetConfirmText('')
      if (mode === 'factory') {
        // Clear auth and redirect to setup
        localStorage.removeItem('openhackathon_admin_token')
        localStorage.removeItem('openhackathon_admin_user')
        localStorage.removeItem('openhackathon_judge_token')
        localStorage.removeItem('openhackathon_judge_user')
        window.location.href = '/setup'
      } else {
        queryClient.invalidateQueries()
        navigate('/')
      }
    },
    onError: () => {
      toast.error(t('system_tools.reset_failed'))
    },
  })

  const handleSave = () => {
    localStorage.setItem('ai_config', JSON.stringify(config))
    toast.success(t('settings.saved'), {
      description: t('settings.saved_desc')
    })
  }

  const uploadBrandingImage = async (file: File, field: 'logoUrl' | 'faviconUrl') => {
    if (!file) return

    const setUploading = field === 'logoUrl' ? setIsUploadingLogo : setIsUploadingFavicon
    setUploading(true)
    try {
      const uploaded = await api.uploadImage(file)
      setBrandingForm((prev) => ({ ...prev, [field]: uploaded.url }))
      toast.success(t('settings.image_uploaded', 'Image uploaded'))
    } catch (error: unknown) {
      const message =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : t('settings.image_upload_failed', 'Failed to upload image')
      toast.error(message || t('settings.image_upload_failed', 'Failed to upload image'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <Card className="surface-panel border-none shadow-none">
        <CardContent className="pt-6">
          <p className="text-sm font-medium">
            {t('settings.scope_hint_title', 'Scope of Site Settings')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'settings.scope_hint_desc',
              'This page controls branding, SEO, and admin entry path only. Judging workflow and review rules are configured in Hackathon Settings.'
            )}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 p-1">
          <TabsTrigger value="branding" className="min-w-[120px] flex-1">
            {t('settings.tab_branding', 'Branding')}
          </TabsTrigger>
          <TabsTrigger value="email" className="min-w-[120px] flex-1">
            {t('settings.tab_email', 'Email')}
          </TabsTrigger>
          <TabsTrigger value="ai" className="min-w-[120px] flex-1">
            {t('settings.tab_ai', 'AI')}
          </TabsTrigger>
          <TabsTrigger value="system" className="min-w-[120px] flex-1">
            {t('settings.tab_system', 'System Tools')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle>{t('settings.branding_title', 'Branding & SEO')}</CardTitle>
          <CardDescription>
            {t('settings.branding_desc', 'Configure site name, logo, tab title, and SEO metadata.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="siteName">{t('settings.site_name', 'Website Name')}</Label>
              <Input
                id="siteName"
                placeholder="OpenHackathon"
                value={brandingForm.siteName}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, siteName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminBasePath">{t('settings.admin_base_path', 'Workbench URL')}</Label>
              <Input
                id="adminBasePath"
                placeholder="/admin"
                value={brandingForm.adminBasePath}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, adminBasePath: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.admin_base_path_desc', 'Hidden management workspace entry path. Use a leading slash, for example /admin.')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">{t('settings.logo_url', 'Logo URL')}</Label>
              <input
                ref={logoFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) await uploadBrandingImage(file, 'logoUrl')
                  e.target.value = ''
                }}
              />
              <div className="flex gap-2">
                <Input
                  id="logoUrl"
                  placeholder="/openhackathon-logo.svg"
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => logoFileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  {isUploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t('settings.upload_image', 'Upload')}
                </Button>
              </div>
              {brandingForm.logoUrl ? (
                <div className="rounded-md border border-border/60 bg-muted/20 p-2">
                  <img src={brandingForm.logoUrl} alt={t('settings.logo_url', 'Logo URL')} className="h-8 w-auto object-contain" />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tabTitle">{t('settings.tab_title', 'Browser Tab Title')}</Label>
              <Input
                id="tabTitle"
                placeholder="OpenHackathon"
                value={brandingForm.tabTitle}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, tabTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="faviconUrl">{t('settings.favicon_url', 'Favicon URL')}</Label>
              <input
                ref={faviconFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon,.ico"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (file) await uploadBrandingImage(file, 'faviconUrl')
                  e.target.value = ''
                }}
              />
              <div className="flex gap-2">
                <Input
                  id="faviconUrl"
                  placeholder="/favicon.svg"
                  value={brandingForm.faviconUrl}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, faviconUrl: e.target.value }))}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => faviconFileInputRef.current?.click()}
                  disabled={isUploadingFavicon}
                >
                  {isUploadingFavicon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  {t('settings.upload_image', 'Upload')}
                </Button>
              </div>
              {brandingForm.faviconUrl ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border/60 bg-muted/20">
                  <img src={brandingForm.faviconUrl} alt={t('settings.favicon_url', 'Favicon URL')} className="h-5 w-5 object-contain" />
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="seoTitle">{t('settings.seo_title', 'SEO Title')}</Label>
              <Input
                id="seoTitle"
                placeholder="OpenHackathon"
                value={brandingForm.seoTitle}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seoDescription">{t('settings.seo_description', 'SEO Description')}</Label>
              <Textarea
                id="seoDescription"
                rows={2}
                placeholder={t('settings.seo_description_placeholder', 'OpenHackathon - Open source hackathon management platform')}
                value={brandingForm.seoDescription}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="poweredByText">{t('settings.powered_by_text', 'Powered By Text')}</Label>
              <Input
                id="poweredByText"
                placeholder="Powered by OpenHackathon"
                value={brandingForm.poweredByText}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, poweredByText: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="poweredByUrl">{t('settings.powered_by_url', 'Powered By URL')}</Label>
              <Input
                id="poweredByUrl"
                placeholder="https://openhackathon.dev"
                value={brandingForm.poweredByUrl}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, poweredByUrl: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center justify-between surface-inset p-3">
            <div>
              <p className="text-sm font-medium">{t('settings.show_powered_by', 'Show Powered By Badge')}</p>
              <p className="text-xs text-muted-foreground">{t('settings.show_powered_by_desc', 'Display the floating powered-by badge on pages.')}</p>
            </div>
            <Switch
              checked={brandingForm.showPoweredBy}
              onCheckedChange={(checked) => setBrandingForm((prev) => ({ ...prev, showPoweredBy: checked }))}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={() => saveBrandingMutation.mutate()} disabled={saveBrandingMutation.isPending}>
              {saveBrandingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              {t('settings.save_branding', 'Save Branding')}
            </Button>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">{t('settings.smtp_host', 'SMTP Host')}</Label>
              <Input
                id="smtpHost"
                placeholder="smtp.example.com"
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
                placeholder="apikey or account user"
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
                  placeholder={emailForm.smtpPasswordConfigured ? t('settings.smtp_pass_masked', 'Saved (leave blank to keep)') : '******'}
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
            <div className="space-y-2">
              <Label htmlFor="submissionEmailFrom">{t('settings.email_from', 'From')}</Label>
              <Input
                id="submissionEmailFrom"
                placeholder="OpenHackathon <no-reply@example.com>"
                value={emailForm.submissionEmailFrom}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, submissionEmailFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="submissionEmailReplyTo">{t('settings.email_reply_to', 'Reply-To')}</Label>
              <Input
                id="submissionEmailReplyTo"
                placeholder="support@example.com"
                value={emailForm.submissionEmailReplyTo}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, submissionEmailReplyTo: e.target.value }))}
              />
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
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            {t('settings.ai_config')}
          </CardTitle>
          <CardDescription>
            {t('settings.ai_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baseUrl">{t('settings.base_url')}</Label>
              <div className="relative">
                <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  className="pl-9"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t('settings.ai_compatible_desc', 'Compatible with OpenAI, DeepSeek, SiliconFlow, or local LLMs (e.g. Ollama).')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">{t('settings.model')}</Label>
              <Input
                id="model"
                placeholder="gpt-3.5-turbo"
                value={config.model}
                onChange={(e) => setConfig({ ...config, model: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">{t('settings.api_key')}</Label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                className="pl-9 pr-9"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              {t('settings.save')}
            </Button>
          </div>
        </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <RotateCcw className="h-5 w-5" />
            {t('system_tools.title')}
          </CardTitle>
          <CardDescription>{t('system_tools.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('system_tools.reset_hackathon')}</p>
              <p className="text-xs text-muted-foreground">{t('system_tools.reset_hackathon_desc')}</p>
            </div>
            <Button variant="outline" className="shrink-0" onClick={() => setResetMode('hackathon')}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t('system_tools.reset_hackathon')}
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{t('system_tools.factory_reset')}</p>
              <p className="text-xs text-muted-foreground">{t('system_tools.factory_reset_desc')}</p>
            </div>
            <Button variant="destructive" className="shrink-0" onClick={() => setResetMode('factory')}>
              <Trash2 className="mr-2 h-4 w-4" />
              {t('system_tools.factory_reset')}
            </Button>
          </div>
        </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={!!resetMode} onOpenChange={(open) => { if (!open) { setResetMode(null); setResetConfirmText('') } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('system_tools.confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {resetMode === 'factory' ? t('system_tools.confirm_factory') : t('system_tools.confirm_hackathon')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            placeholder={t('system_tools.confirm_placeholder')}
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={resetConfirmText !== 'RESET' || resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                if (resetMode) resetMutation.mutate(resetMode)
              }}
            >
              {resetMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('system_tools.resetting')}</>
              ) : (
                resetMode === 'factory' ? t('system_tools.factory_reset') : t('system_tools.reset_hackathon')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
