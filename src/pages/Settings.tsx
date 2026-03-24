import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useSiteBranding } from '@/lib/site-branding'
import { BrandingTab } from './settings/BrandingTab'
import { EmailTab } from './settings/EmailTab'
import { AITab } from './settings/AITab'
import { SystemToolsTab } from './settings/SystemToolsTab'

export function Settings() {
  const { t } = useTranslation()
  const { settings: siteSettings } = useSiteBranding()

  const adminSettingsQuery = useQuery({
    queryKey: ['admin-site-settings'],
    queryFn: api.getAdminSiteSettings,
  })

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
          <BrandingTab siteSettings={siteSettings} />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <EmailTab siteSettings={siteSettings} adminSettingsData={adminSettingsQuery.data} />
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <AITab />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemToolsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
