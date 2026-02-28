import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookOpenText, ExternalLink, FileText, Link2, ScrollText, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useAuth } from '@/lib/auth'

function normalizeUrl(url?: string | null) {
  if (!url) return ''
  const value = url.trim()
  if (!value) return ''
  return value
}

export function Docs() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { activeHackathon: h } = useActiveHackathon()
  const [iframeError, setIframeError] = useState(false)

  const source = useMemo(() => {
    const gitbookUrl = normalizeUrl(h.gitbookUrl)
    const rulesUrl = normalizeUrl(h.rulesUrl)
    const detailsUrl = normalizeUrl(h.detailsUrl)

    if (gitbookUrl) {
      return { url: gitbookUrl, label: 'GitBook', icon: BookOpenText }
    }
    if (rulesUrl) {
      return { url: rulesUrl, label: t('landing.footer.rules'), icon: ScrollText }
    }
    if (detailsUrl) {
      return { url: detailsUrl, label: t('nav.docs'), icon: Link2 }
    }

    return null
  }, [h.detailsUrl, h.gitbookUrl, h.rulesUrl, t])

  if (!source) {
    return (
      <div className="container py-10 md:py-16">
        <div className="surface-panel-strong mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-5 px-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/35" />
          <div className="space-y-2">
            <p className="text-xl font-semibold text-foreground">
              {t('landing.gitbook.no_docs_title')}
            </p>
            <p className="mx-auto max-w-xl text-sm text-muted-foreground">
              {t('landing.gitbook.no_docs_desc')}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <a href="https://www.gitbook.com" target="_blank" rel="noreferrer">
              <Button variant="outline" className="rounded-full gap-2">
                {t('landing.gitbook.go_gitbook')}
                <ExternalLink className="h-4 w-4" />
              </Button>
            </a>
            {user?.role === 'admin' && h.id && (
              <Link to={`/dashboard/hackathons/${h.id}/settings`}>
                <Button className="rounded-full gap-2 grand-cta">
                  {t('settings.hackathon_settings')}
                  <Settings2 className="h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (iframeError) {
    return (
      <div className="container py-10 md:py-16">
        <div className="surface-panel-strong mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
          <source.icon className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground">
            {t('landing.gitbook.embed_blocked')}
          </p>
          <a href={source.url} target="_blank" rel="noreferrer">
            <Button className="rounded-full gap-2 grand-cta">
              {t('landing.gitbook.open_external')}
              <ExternalLink className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="container flex h-[calc(100vh-8.8rem)] flex-col py-6 md:py-8">
      <div className="surface-panel-strong mb-3 flex items-center justify-between gap-3 px-4 py-3 md:px-5">
        <div className="flex items-center gap-3">
          <source.icon className="h-4 w-4 text-primary" />
          <div>
            <h1 className="text-sm font-semibold">{t('landing.gitbook.title')}</h1>
            <p className="text-xs text-muted-foreground">{h.title}</p>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px] uppercase tracking-wide">
            {source.label}
          </Badge>
        </div>
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('landing.gitbook.open_external')}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="surface-panel-strong min-h-0 flex-1 overflow-hidden">
        <iframe
          src={source.url}
          title={t('landing.gitbook.title')}
          className="h-full w-full border-0"
          allow="clipboard-write"
          loading="lazy"
          onError={() => setIframeError(true)}
        />
      </div>
    </div>
  )
}
