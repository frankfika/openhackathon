import { SiteSettings } from './types'

export const defaultSiteSettings: SiteSettings = {
  siteName: import.meta.env.VITE_SITE_NAME || import.meta.env.VITE_ORGANIZER_NAME || 'OpenHackathon',
  adminBasePath: import.meta.env.VITE_ADMIN_BASE_PATH || '/admin',
  logoUrl: import.meta.env.VITE_SITE_LOGO || import.meta.env.VITE_ORGANIZER_LOGO || '/openhackathon-logo.svg',
  tabTitle: import.meta.env.VITE_TAB_TITLE || 'OpenHackathon',
  seoTitle: import.meta.env.VITE_SEO_TITLE || 'OpenHackathon',
  seoDescription:
    import.meta.env.VITE_SEO_DESCRIPTION ||
    'OpenHackathon - Open source hackathon management platform',
  faviconUrl: import.meta.env.VITE_FAVICON_URL || '/favicon.svg',
  showPoweredBy: import.meta.env.VITE_SHOW_POWERED_BY !== 'false',
  poweredByText: import.meta.env.VITE_POWERED_BY_TEXT || 'Powered by OpenHackathon',
  poweredByUrl: import.meta.env.VITE_POWERED_BY_URL || 'https://openhackathon.dev',
  submissionSuccessHintText: null,
  submissionSuccessHintImageUrl: null,
}

// Backward-compatible static config for places that do not use context yet.
export const siteConfig = {
  organizerName: defaultSiteSettings.siteName,
  organizerLogo: defaultSiteSettings.logoUrl || '',
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR || '#2563EB',
  poweredBy: {
    show: defaultSiteSettings.showPoweredBy,
    text: defaultSiteSettings.poweredByText,
    url: defaultSiteSettings.poweredByUrl,
  },
}
