import { useMemo } from 'react'
import { SiteSettings } from './types'
import { useSiteBranding } from './site-branding'

export function normalizeAdminBasePath(value?: string | null) {
  const fallback = '/admin'
  const trimmed = typeof value === 'string' ? value.trim() : ''
  if (!trimmed) return fallback

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const collapsed = withLeadingSlash.replace(/\/+/g, '/')
  const normalized = collapsed.length > 1 ? collapsed.replace(/\/$/, '') : collapsed

  return normalized === '/' ? fallback : normalized
}

export function buildAdminPath(basePath: string, suffix = '') {
  const normalizedBasePath = normalizeAdminBasePath(basePath)
  if (!suffix) return normalizedBasePath

  const normalizedSuffix = suffix.startsWith('/') ? suffix : `/${suffix}`
  return `${normalizedBasePath}${normalizedSuffix}`.replace(/\/+/g, '/')
}

export function getAdminBasePath(settings?: Pick<SiteSettings, 'adminBasePath'> | null) {
  return normalizeAdminBasePath(settings?.adminBasePath)
}

export function useAdminRoutes() {
  const { settings } = useSiteBranding()

  return useMemo(() => {
    const adminBasePath = getAdminBasePath(settings)

    return {
      adminBasePath,
      adminLoginPath: buildAdminPath(adminBasePath, 'login'),
    }
  }, [settings])
}
