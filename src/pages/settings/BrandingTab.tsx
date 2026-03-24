import { useEffect, useRef, useState } from 'react'
import { extractApiErrorMessage } from '@/lib/api-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Save, Loader2, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useMutation, useQueryClient } from '@tanstack/react-query'

interface BrandingTabProps {
  siteSettings: {
    siteName?: string
    adminBasePath?: string
    logoUrl?: string
    tabTitle?: string
    seoTitle?: string
    seoDescription?: string
    faviconUrl?: string
    showPoweredBy?: boolean
    poweredByText?: string
    poweredByUrl?: string
  }
}

export function BrandingTab({ siteSettings }: BrandingTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const faviconFileInputRef = useRef<HTMLInputElement>(null)
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

  const uploadBrandingImage = async (file: File, field: 'logoUrl' | 'faviconUrl') => {
    if (!file) return

    const setUploading = field === 'logoUrl' ? setIsUploadingLogo : setIsUploadingFavicon
    setUploading(true)
    try {
      const uploaded = await api.uploadImage(file)
      setBrandingForm((prev) => ({ ...prev, [field]: uploaded.url }))
      toast.success(t('settings.image_uploaded', 'Image uploaded'))
    } catch (error: unknown) {
      toast.error(extractApiErrorMessage(error, t('settings.image_upload_failed', 'Failed to upload image')))
    } finally {
      setUploading(false)
    }
  }

  return (
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
  )
}
