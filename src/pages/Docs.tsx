import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActiveHackathon } from '@/lib/active-hackathon'

export function Docs() {
  const { t } = useTranslation()
  const { activeHackathon: h } = useActiveHackathon()
  const [iframeError, setIframeError] = useState(false)

  if (!h.gitbookUrl) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        {t('landing.gitbook.no_docs', 'No documentation configured yet.')}
      </div>
    )
  }

  // Fallback: if iframe can't load (CSP / X-Frame-Options), show a direct link
  if (iframeError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">
          {t('landing.gitbook.embed_blocked', 'This documentation site cannot be embedded.')}
        </p>
        <a href={h.gitbookUrl} target="_blank" rel="noreferrer">
          <Button className="rounded-full">
            {t('landing.gitbook.open_external', 'Open in new tab')}
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2 md:px-6">
        <h1 className="text-sm font-semibold">
          {t('landing.gitbook.title', 'Event Details')}
        </h1>
        <a
          href={h.gitbookUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('landing.gitbook.open_external', 'Open in new tab')}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Full-height iframe */}
      <iframe
        src={h.gitbookUrl}
        title={t('landing.gitbook.title', 'Event Details')}
        className="flex-1 border-0"
        allow="clipboard-write"
        loading="lazy"
        onError={() => setIframeError(true)}
      />
    </div>
  )
}
