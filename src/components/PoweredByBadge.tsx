import React from 'react'
import { useSiteBranding } from '@/lib/site-branding'

export function PoweredByBadge() {
  const { settings } = useSiteBranding()

  if (!settings.showPoweredBy) return null

  return (
    <a
      href={settings.poweredByUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
    >
      {settings.poweredByText}
    </a>
  )
}
