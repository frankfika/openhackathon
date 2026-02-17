import React from 'react'
import { siteConfig } from '@/lib/site-config'

export function PoweredByBadge() {
  if (!siteConfig.poweredBy.show) return null

  return (
    <a
      href={siteConfig.poweredBy.url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
    >
      {siteConfig.poweredBy.text}
    </a>
  )
}
