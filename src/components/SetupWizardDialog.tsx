import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  createSetupWizardBlueprint,
  planSetupWizardSessions,
  SetupWizardDimension,
  SetupWizardFormat,
  SetupWizardSessionBlueprint,
  SetupWizardSubmissionStyle,
} from '@/lib/setup-wizard'
import { formatDateRange, HackathonSessionInput, ScoringCriterion, Session, SubmissionField } from '@/lib/types'
import { CalendarClock, Filter, ListChecks, Loader2, Wand2 } from 'lucide-react'

type SetupWizardApplyPayload = {
  startAt?: string
  endAt?: string
  submissionSchema: { fields: SubmissionField[] }
  scoringCriteria: ScoringCriterion[]
  sessions?: HackathonSessionInput[]
}

type SetupWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  startAt: string
  endAt: string
  existingSessions: Session[]
  existingSubmissionFields: SubmissionField[]
  isApplying?: boolean
  onApply: (payload: SetupWizardApplyPayload) => Promise<void>
}

function inferFormat(existingSessions: Session[]): SetupWizardFormat {
  if (existingSessions.length === 0) return 'prelim_final'
  if (existingSessions.length >= 3) return 'three_stage'
  if (existingSessions.length === 2) return 'prelim_final'
  return 'single_round'
}

function inferSubmissionStyle(existingSubmissionFields: SubmissionField[]): SetupWizardSubmissionStyle {
  if (existingSubmissionFields.length === 0) return 'standard'
  if (existingSubmissionFields.some((field) => field.id === 'description' && field.required)) {
    return 'detailed'
  }
  if (existingSubmissionFields.some((field) => ['oneLiner', 'description', 'tags'].includes(field.id))) {
    return 'standard'
  }
  return 'lean'
}

function inferDimensions(existingSubmissionFields: SubmissionField[]): SetupWizardDimension[] {
  const dimensions: SetupWizardDimension[] = []
  const fieldIds = new Set(existingSubmissionFields.map((field) => field.id))

  if (fieldIds.has('region')) dimensions.push('region')
  if (fieldIds.has('className')) dimensions.push('class_name')
  if (fieldIds.has('category')) dimensions.push('category')

  return dimensions
}

function getFieldLabel(fieldId: string, t: ReturnType<typeof useTranslation>['t']) {
  switch (fieldId) {
    case 'title':
      return t('projects.project_name')
    case 'oneLiner':
      return t('projects.one_liner')
    case 'description':
      return t('projects.description')
    case 'demoUrl':
      return t('projects.demo_url')
    case 'repoUrl':
      return t('projects.repo_url')
    case 'tags':
      return t('projects.tags')
    default:
      return t(`settings.setup_wizard.field_labels.${fieldId}`)
  }
}

function getCriterionLabel(criterionKey: 'innovation' | 'execution' | 'impact', t: ReturnType<typeof useTranslation>['t']) {
  return t(`settings.setup_wizard.criteria.${criterionKey}`)
}

function getGeneratedSessionName(session: SetupWizardSessionBlueprint, t: ReturnType<typeof useTranslation>['t']) {
  return t(`settings.setup_wizard.session_names.${session.key}`)
}

function OptionCard({
  title,
  description,
  selected,
  disabled,
  badge,
  onClick,
}: {
  title: string
  description: string
  selected: boolean
  disabled?: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-2xl border px-4 py-4 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        selected
          ? 'border-primary/60 bg-primary/5 shadow-[0_12px_30px_rgba(14,165,233,0.08)]'
          : 'border-border/60 bg-background/70 hover:border-primary/30 hover:bg-muted/20',
        disabled && 'cursor-not-allowed opacity-55 hover:border-border/60 hover:bg-background/70'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {badge ? <Badge variant="secondary">{badge}</Badge> : null}
      </div>
    </button>
  )
}

export function SetupWizardDialog({
  open,
  onOpenChange,
  startAt,
  endAt,
  existingSessions,
  existingSubmissionFields,
  isApplying,
  onApply,
}: SetupWizardDialogProps) {
  const { t } = useTranslation()
  const canGenerateSessions = existingSessions.length <= 1

  const [format, setFormat] = useState<SetupWizardFormat>('prelim_final')
  const [submissionStyle, setSubmissionStyle] = useState<SetupWizardSubmissionStyle>('standard')
  const [dimensions, setDimensions] = useState<SetupWizardDimension[]>([])

  useEffect(() => {
    if (!open) return

    setFormat(inferFormat(existingSessions))
    setSubmissionStyle(inferSubmissionStyle(existingSubmissionFields))
    setDimensions(inferDimensions(existingSubmissionFields))
  }, [open, existingSessions, existingSubmissionFields])

  const blueprint = useMemo(
    () =>
      createSetupWizardBlueprint({
        startAt,
        endAt,
        format,
        submissionStyle,
        dimensions,
      }),
    [startAt, endAt, format, submissionStyle, dimensions]
  )

  const sessionPlan = useMemo(
    () => planSetupWizardSessions(existingSessions, blueprint.sessions),
    [existingSessions, blueprint.sessions]
  )

  const previewSessions = sessionPlan.mode === 'generated'
    ? (sessionPlan.sessions || []).map((session) => ({
        title: getGeneratedSessionName(session, t),
        subtitle: t(`sessions.status_${session.status}`),
        range: formatDateRange(session.startAt, session.endAt),
      }))
    : existingSessions.map((session) => ({
        title: session.name,
        subtitle: `${t(`sessions.type_${session.type}`)} · ${t(`sessions.status_${session.status}`)}`,
        range: formatDateRange(session.startAt, session.endAt),
      }))

  const previewFields = blueprint.submissionFields.map((field) => getFieldLabel(field.id, t))
  const previewCriteria = blueprint.scoringCriteria.map((criterion) => ({
    label: getCriterionLabel(criterion.key, t),
    maxScore: criterion.maxScore,
  }))

  const toggleDimension = (dimension: SetupWizardDimension, checked: boolean) => {
    setDimensions((previous) => {
      if (checked) {
        return previous.includes(dimension) ? previous : [...previous, dimension]
      }
      return previous.filter((item) => item !== dimension)
    })
  }

  const handleApply = async () => {
    const submissionSchema = {
      fields: blueprint.submissionFields.map((field) => ({
        id: field.id,
        label: getFieldLabel(field.id, t),
        type: field.type,
        required: field.required,
        filterable: field.filterable,
      })),
    }

    const scoringCriteria: ScoringCriterion[] = blueprint.scoringCriteria.map((criterion) => ({
      id: `wizard_${criterion.key}`,
      name: getCriterionLabel(criterion.key, t),
      maxScore: criterion.maxScore,
    }))

    const sessions = canGenerateSessions
      ? (sessionPlan.sessions || []).map((session) => ({
          id: session.id,
          name: getGeneratedSessionName(session, t),
          type: session.type,
          status: session.status,
          startAt: session.startAt,
          endAt: session.endAt,
        }))
      : undefined

    await onApply({
      startAt,
      endAt,
      submissionSchema,
      scoringCriteria,
      sessions,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-hidden p-0">
        <div className="bg-gradient-to-r from-sky-500/14 via-cyan-500/10 to-emerald-500/12 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/75 text-sky-600 shadow-sm dark:bg-slate-900/70 dark:text-sky-300">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>{t('settings.setup_wizard.title')}</DialogTitle>
                <DialogDescription className="mt-1 max-w-2xl">
                  {t('settings.setup_wizard.description')}
                </DialogDescription>
              </div>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-muted-foreground shadow-sm dark:border-slate-700/60 dark:bg-slate-950/40">
              {t('settings.setup_wizard.apply_hint')}
            </div>
          </DialogHeader>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold">{t('settings.setup_wizard.format_title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.setup_wizard.format_desc')}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <OptionCard
                  title={t('settings.setup_wizard.formats.single_round.title')}
                  description={t('settings.setup_wizard.formats.single_round.desc')}
                  selected={format === 'single_round'}
                  disabled={!canGenerateSessions}
                  onClick={() => setFormat('single_round')}
                />
                <OptionCard
                  title={t('settings.setup_wizard.formats.prelim_final.title')}
                  description={t('settings.setup_wizard.formats.prelim_final.desc')}
                  selected={format === 'prelim_final'}
                  disabled={!canGenerateSessions}
                  badge={t('assignments.recommended')}
                  onClick={() => setFormat('prelim_final')}
                />
                <OptionCard
                  title={t('settings.setup_wizard.formats.three_stage.title')}
                  description={t('settings.setup_wizard.formats.three_stage.desc')}
                  selected={format === 'three_stage'}
                  disabled={!canGenerateSessions}
                  onClick={() => setFormat('three_stage')}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {canGenerateSessions
                  ? t('settings.setup_wizard.session_generation_note')
                  : t('settings.setup_wizard.session_preserve_note')}
              </p>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold">{t('settings.setup_wizard.dimensions_title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.setup_wizard.dimensions_desc')}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-3xl border border-border/60 bg-muted/10 p-4">
                {(['region', 'class_name', 'category'] as SetupWizardDimension[]).map((dimension) => (
                  <label
                    key={dimension}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-transparent px-3 py-3 transition-colors hover:border-primary/20 hover:bg-background/70"
                  >
                    <Checkbox
                      checked={dimensions.includes(dimension)}
                      onCheckedChange={(checked) => toggleDimension(dimension, checked === true)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <div className="font-medium">{t(`settings.setup_wizard.dimensions.${dimension}.title`)}</div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(`settings.setup_wizard.dimensions.${dimension}.desc`)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="font-semibold">{t('settings.setup_wizard.submission_title')}</h3>
                  <p className="text-sm text-muted-foreground">{t('settings.setup_wizard.submission_desc')}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <OptionCard
                  title={t('settings.setup_wizard.styles.lean.title')}
                  description={t('settings.setup_wizard.styles.lean.desc')}
                  selected={submissionStyle === 'lean'}
                  onClick={() => setSubmissionStyle('lean')}
                />
                <OptionCard
                  title={t('settings.setup_wizard.styles.standard.title')}
                  description={t('settings.setup_wizard.styles.standard.desc')}
                  selected={submissionStyle === 'standard'}
                  badge={t('assignments.recommended')}
                  onClick={() => setSubmissionStyle('standard')}
                />
                <OptionCard
                  title={t('settings.setup_wizard.styles.detailed.title')}
                  description={t('settings.setup_wizard.styles.detailed.desc')}
                  selected={submissionStyle === 'detailed'}
                  onClick={() => setSubmissionStyle('detailed')}
                />
              </div>
            </section>
          </div>

          <aside className="rounded-[28px] border border-border/60 bg-muted/10 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t('settings.setup_wizard.preview_title')}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{t('settings.setup_wizard.preview_desc')}</p>
              </div>
              <Badge variant={canGenerateSessions ? 'secondary' : 'outline'}>
                {canGenerateSessions
                  ? t('settings.setup_wizard.preview_badges.generated_sessions')
                  : t('settings.setup_wizard.preview_badges.keep_sessions')}
              </Badge>
            </div>

            <div className="mt-5 space-y-5">
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t('settings.setup_wizard.preview_sections.sessions')}</div>
                  <Badge variant="outline">{previewSessions.length}</Badge>
                </div>
                <div className="space-y-2">
                  {previewSessions.map((session) => (
                    <div key={`${session.title}-${session.range}`} className="rounded-2xl border border-border/60 bg-background/80 px-3 py-3">
                      <div className="font-medium">{session.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{session.subtitle}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{session.range}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t('settings.setup_wizard.preview_sections.submission')}</div>
                  <Badge variant="outline">{previewFields.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {previewFields.map((fieldLabel) => (
                    <Badge key={fieldLabel} variant="secondary" className="rounded-full px-3 py-1">
                      {fieldLabel}
                    </Badge>
                  ))}
                </div>
                {dimensions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('settings.setup_wizard.no_dimensions')}</p>
                ) : null}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{t('settings.setup_wizard.preview_sections.scoring')}</div>
                  <Badge variant="outline">100</Badge>
                </div>
                <div className="space-y-2">
                  {previewCriteria.map((criterion) => (
                    <div key={criterion.label} className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 px-3 py-2">
                      <span className="text-sm">{criterion.label}</span>
                      <span className="text-sm font-medium">{criterion.maxScore}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleApply} disabled={isApplying}>
            {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {t('settings.setup_wizard.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
