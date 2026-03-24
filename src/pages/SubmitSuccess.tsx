import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, Home, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTranslation } from 'react-i18next'
import { useActiveHackathon } from '@/lib/active-hackathon'

type SubmitSuccessState = {
  receiptId?: string
  projectId?: string
  submitterEmail?: string
  issuedAt?: string
  emailSent?: boolean
  emailFailureReason?: string
}

export function SubmitSuccess() {
  const { t } = useTranslation()
  const location = useLocation()
  const { activeHackathon: hackathon } = useActiveHackathon()
  const state = (location.state || {}) as SubmitSuccessState
  const receiptId = typeof state.receiptId === 'string' && state.receiptId.trim().length > 0 ? state.receiptId : null
  const projectId = typeof state.projectId === 'string' && state.projectId.trim().length > 0 ? state.projectId : null
  const submitterEmail =
    typeof state.submitterEmail === 'string' && state.submitterEmail.trim().length > 0
      ? state.submitterEmail
      : null
  const emailSent = typeof state.emailSent === 'boolean' ? state.emailSent : null
  const successHintText = typeof hackathon.submissionSuccessHintText === 'string'
    ? hackathon.submissionSuccessHintText.trim()
    : ''
  const successHintImageUrl = typeof hackathon.submissionSuccessHintImageUrl === 'string'
    ? hackathon.submissionSuccessHintImageUrl.trim()
    : ''

  return (
    <div className="container max-w-2xl py-12 md:py-20">
      <Card className="surface-panel-strong border-0 shadow-none">
        <CardContent className="pt-12 pb-12 px-6 md:px-12 text-center">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-green-100 p-4 dark:bg-green-900/20">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-500" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-3">
            {t('submission.success_title')}
          </h1>

          <p className="text-lg text-muted-foreground mb-2">
            {t('submission.success_subtitle')}
          </p>
          <p className="text-xl font-semibold text-foreground mb-6">
            {hackathon.title}
          </p>

          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-8">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('submission.success_message')}
            </p>
          </div>

          {receiptId && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-8 text-left">
              <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1">
                {t('submission.receipt_number_label')}
              </p>
              <p className="font-mono text-base font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                {receiptId}
              </p>
              {projectId && (
                <p className="text-sm text-emerald-900/90 dark:text-emerald-100/90 mb-2">
                  {t('submission.project_id_label')}: <span className="font-mono">{projectId}</span>
                </p>
              )}
              {submitterEmail && (
                <p className="text-sm text-emerald-900/90 dark:text-emerald-100/90">
                  {t('submission.receipt_email_label')}: {submitterEmail}
                </p>
              )}
              {emailSent === true && (
                <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-100/90">
                  {t('submission.receipt_status_sent')}
                </p>
              )}
              {emailSent === false && (
                <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                  {t('submission.receipt_status_pending')}
                </p>
              )}
            </div>
          )}

          {(successHintText || successHintImageUrl) && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 p-4 mb-8 text-left dark:border-indigo-800 dark:bg-indigo-950/20">
              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
                {t('submission.success_hint_title', 'Next Step')}
              </p>
              {successHintText && (
                <p className="text-sm text-indigo-900/90 dark:text-indigo-100/90 whitespace-pre-line">
                  {successHintText}
                </p>
              )}
              {successHintImageUrl && (
                <div className="mt-3 flex justify-center">
                  <img
                    src={successHintImageUrl}
                    alt={t('submission.success_hint_image_alt', 'Submission success hint image')}
                    className="max-h-64 w-auto rounded-md border border-indigo-200 bg-white p-1 dark:border-indigo-700 dark:bg-indigo-950/40"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <Home className="h-4 w-4" />
                {t('common.home')}
              </Button>
            </Link>
            <Link to="/leaderboard">
              <Button className="gap-2 grand-cta">
                <Trophy className="h-4 w-4" />
                {t('nav.leaderboard')}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
