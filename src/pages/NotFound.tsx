import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getAdminBasePath } from '@/lib/admin-routing'
import { useSiteBranding } from '@/lib/site-branding'

export function NotFound() {
  const { t } = useTranslation()
  const location = useLocation()
  const { settings, isLoading } = useSiteBranding()
  const adminBasePath = isLoading ? '/admin' : getAdminBasePath(settings)

  // For admin / judge areas, send the user back to their own dashboard so they
  // don't get bounced to the public landing. For public paths, just go home.
  const isAdminPath = location.pathname.startsWith(adminBasePath)
  const isJudgePath = location.pathname.startsWith('/judge')
  const backHref = isAdminPath ? adminBasePath : isJudgePath ? '/judge' : '/'
  const backLabel = isAdminPath
    ? t('not_found.back_admin', 'Back to dashboard')
    : isJudgePath
      ? t('not_found.back_judge', 'Back to judging')
      : t('common.home')

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        {t('not_found.title', 'Page not found')}
      </h1>
      <p className="text-muted-foreground max-w-md mb-2">
        {t('not_found.description', 'The link you followed may be broken, or the page may have been moved.')}
      </p>
      <p className="text-xs text-muted-foreground/70 mb-6 font-mono">
        {location.pathname}
      </p>
      <div className="flex gap-3">
        <Button onClick={() => { window.location.href = backHref }}>
          {backLabel}
        </Button>
        <Button variant="outline" asChild>
          <Link to="/docs">{t('not_found.view_docs', 'Event Details')}</Link>
        </Button>
      </div>
    </div>
  )
}
