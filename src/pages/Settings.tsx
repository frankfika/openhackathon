import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Eye, EyeOff, Save, Key, Server, Cpu, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSiteBranding } from '@/lib/site-branding'

export function Settings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { settings: siteSettings } = useSiteBranding()
  const [showKey, setShowKey] = useState(false)
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

  const handleSave = () => {
    localStorage.setItem('ai_config', JSON.stringify(config))
    toast.success(t('settings.saved'), {
      description: t('settings.saved_desc')
    })
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

      {/* Branding & SEO */}
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
              <Input
                id="logoUrl"
                placeholder="/openhackathon-logo.svg"
                value={brandingForm.logoUrl}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
              />
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
              <Input
                id="faviconUrl"
                placeholder="/favicon.svg"
                value={brandingForm.faviconUrl}
                onChange={(e) => setBrandingForm((prev) => ({ ...prev, faviconUrl: e.target.value }))}
              />
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
    </div>
  )
}
