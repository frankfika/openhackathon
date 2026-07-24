import React, { createContext, useContext, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'
import { defaultSiteSettings } from './site-config'
import { SiteSettings } from './types'
import { queryKeys } from './queryKeys'

type SiteBrandingContextValue = {
  settings: SiteSettings
  isLoading: boolean
  refresh: () => void
}

const SiteBrandingContext = createContext<SiteBrandingContextValue | undefined>(undefined)

function setMetaTag(name: string, content: string) {
  if (!document?.head) return
  let tag = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }
  tag.setAttribute('content', content)
}

function setFavicon(href: string) {
  if (!document?.head) return
  let icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null
  if (!icon) {
    icon = document.createElement('link')
    icon.setAttribute('rel', 'icon')
    icon.setAttribute('type', 'image/svg+xml')
    document.head.appendChild(icon)
  }
  icon.setAttribute('href', href)
}

export function SiteBrandingProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.siteSettings.all,
    queryFn: api.getSiteSettings,
    staleTime: 60_000,
    retry: 1,
  })

  const settings = useMemo<SiteSettings>(() => ({
    ...defaultSiteSettings,
    ...(data || {}),
  }), [data])

  useEffect(() => {
    document.title = settings.tabTitle || settings.siteName || defaultSiteSettings.tabTitle
    setMetaTag('description', settings.seoDescription || defaultSiteSettings.seoDescription)
    setMetaTag('application-name', settings.seoTitle || settings.siteName || defaultSiteSettings.seoTitle)

    if (settings.faviconUrl) {
      setFavicon(settings.faviconUrl)
    }
  }, [settings])

  const value = useMemo<SiteBrandingContextValue>(() => ({
    settings,
    isLoading,
    refresh: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings.all })
    },
  }), [isLoading, queryClient, settings])

  return <SiteBrandingContext.Provider value={value}>{children}</SiteBrandingContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSiteBranding() {
  const context = useContext(SiteBrandingContext)
  if (!context) {
    throw new Error('useSiteBranding must be used within a SiteBrandingProvider')
  }
  return context
}
