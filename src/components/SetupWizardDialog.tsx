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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  createSetupWizardBlueprint,
  SetupWizardDimension,
  SetupWizardSubmissionStyle,
} from '@/lib/setup-wizard'
import { formatDateRange, ScoringCriterion, SubmissionField } from '@/lib/types'
import { getFieldLabel } from '@/lib/submission-fields'
import { ArrowLeft, ArrowRight, Check, Filter, ListChecks, Loader2, Sparkles, Wand2 } from 'lucide-react'

type SetupWizardApplyPayload = {
  title: string
  tagline: string
  city?: string
  prizePool?: string
  startAt?: string
  endAt?: string
  docsUrl?: string
  submissionSchema: {
    fields: SubmissionField[]
  }
  scoringCriteria: ScoringCriterion[]
}

type SetupWizardDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  tagline: string
  city?: string
  prizePool?: string
  startAt: string
  endAt: string
  docsUrl?: string
  existingSubmissionFields: SubmissionField[]
  isApplying?: boolean
  onApply: (payload: SetupWizardApplyPayload) => Promise<void>
}

type SetupProfileState = {
  title: string
  tagline: string
  city: string
  prizePool: string
  startAt: string
  endAt: string
  docsUrl: string
}

const TOTAL_STEPS = 3

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

  if (fieldIds.has('className')) dimensions.push('class_name')
  if (fieldIds.has('category')) dimensions.push('category')

  return dimensions
}

function getFieldLabelLocal(fieldId: string, t: ReturnType<typeof useTranslation>['t']) {
  return getFieldLabel(fieldId, t(`settings.setup_wizard.field_labels.${fieldId}`, fieldId), t)
}

function getCriterionLabel(criterionKey: 'innovation' | 'execution' | 'impact', t: ReturnType<typeof useTranslation>['t']) {
  return t(`settings.setup_wizard.criteria.${criterionKey}`, criterionKey)
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

function StepIndicator({ current, total, labels }: { current: number; total: number; labels: string[] }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <React.Fragment key={step}>
            {i > 0 && <div className={cn('h-px flex-1', isDone ? 'bg-primary' : 'bg-border')} />}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isActive && 'bg-primary text-primary-foreground',
                  isDone && 'bg-primary/20 text-primary',
                  !isActive && !isDone && 'bg-muted text-muted-foreground'
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : step}
              </div>
              <span className={cn('hidden text-sm sm:inline', isActive ? 'font-medium' : 'text-muted-foreground')}>
                {labels[i]}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

export function SetupWizardDialog({
  open,
  onOpenChange,
  title,
  tagline,
  city,
  prizePool,
  startAt,
  endAt,
  docsUrl,
  existingSubmissionFields,
  isApplying,
  onApply,
}: SetupWizardDialogProps) {
  const { t } = useTranslation()

  const [step, setStep] = useState(1)
  const [submissionStyle, setSubmissionStyle] = useState<SetupWizardSubmissionStyle>('standard')
  const [dimensions, setDimensions] = useState<SetupWizardDimension[]>([])
  const [profile, setProfile] = useState<SetupProfileState>({
    title: '',
    tagline: '',
    city: '',
    prizePool: '',
    startAt: '',
    endAt: '',
    docsUrl: '',
  })

  const stepLabels = [
    t('settings.setup_wizard.step_basic', 'Basic Info'),
    t('settings.setup_wizard.step_submission', 'Submission'),
    t('settings.setup_wizard.step_preview', 'Preview'),
  ]

  useEffect(() => {
    if (!open) return

    setStep(1)
    setSubmissionStyle(inferSubmissionStyle(existingSubmissionFields))
    setDimensions(inferDimensions(existingSubmissionFields))
    setProfile({
      title: title || '',
      tagline: tagline || '',
      city: city || '',
      prizePool: prizePool || '',
      startAt: startAt || '',
      endAt: endAt || '',
      docsUrl: docsUrl || '',
    })
  }, [open, existingSubmissionFields, title, tagline, city, prizePool, startAt, endAt, docsUrl])

  const blueprint = useMemo(
    () =>
      createSetupWizardBlueprint({
        startAt: profile.startAt,
        endAt: profile.endAt,
        submissionStyle,
        dimensions,
      }),
    [profile.endAt, profile.startAt, submissionStyle, dimensions]
  )

  const previewFields = blueprint.submissionFields.map((field) => getFieldLabelLocal(field.id, t))
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

  const handleProfileChange = (field: keyof SetupProfileState, value: string) => {
    setProfile((current) => ({ ...current, [field]: value }))
  }

  const handleApply = async () => {
    const submissionSchema = {
      fields: blueprint.submissionFields.map((field) => ({
        id: field.id,
        label: getFieldLabelLocal(field.id, t),
        type: field.type,
        required: field.required,
        filterable: field.filterable,
        options: field.options,
      })),
    }

    const scoringCriteria: ScoringCriterion[] = blueprint.scoringCriteria.map((criterion) => ({
      id: `wizard_${criterion.key}`,
      name: getCriterionLabel(criterion.key, t),
      maxScore: criterion.maxScore,
    }))

    await onApply({
      title: profile.title.trim(),
      tagline: profile.tagline.trim(),
      city: profile.city.trim() || undefined,
      prizePool: profile.prizePool.trim() || undefined,
      startAt: profile.startAt,
      endAt: profile.endAt,
      docsUrl: profile.docsUrl.trim() || undefined,
      submissionSchema,
      scoringCriteria,
    })
  }

  const canProceedStep1 = profile.title.trim() && profile.tagline.trim() && profile.startAt && profile.endAt

  const configuredDocs = [profile.docsUrl].filter(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-r from-sky-500/14 via-cyan-500/10 to-emerald-500/12 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex items-center gap-2">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/75 text-sky-600 shadow-sm dark:bg-slate-900/70 dark:text-sky-300">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle>{t('settings.setup_wizard.title', 'Setup Wizard')}</DialogTitle>
                <DialogDescription className="mt-1">
                  {t('settings.setup_wizard.description', 'Configure the hackathon profile, submission flow, judging structure, and default rubric in one pass.')}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pt-4">
          <StepIndicator current={step} total={TOTAL_STEPS} labels={stepLabels} />
        </div>

        <div className="min-h-[340px] px-6 py-5">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in-0 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">{t('settings.setup_wizard.profile_title', 'Event Profile')}</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="wizard-title">{t('hackathons.title')}</Label>
                <Input id="wizard-title" value={profile.title} onChange={(e) => handleProfileChange('title', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wizard-tagline">{t('hackathons.tagline')}</Label>
                <Input id="wizard-tagline" value={profile.tagline} onChange={(e) => handleProfileChange('tagline', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wizard-start">{t('hackathons.start_date')}</Label>
                  <Input id="wizard-start" type="date" value={profile.startAt} onChange={(e) => handleProfileChange('startAt', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-end">{t('hackathons.end_date')}</Label>
                  <Input id="wizard-end" type="date" value={profile.endAt} onChange={(e) => handleProfileChange('endAt', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="wizard-city">{t('hackathons.city')}</Label>
                  <Input id="wizard-city" value={profile.city} onChange={(e) => handleProfileChange('city', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="wizard-prize">{t('hackathons.prize_pool')}</Label>
                  <Input id="wizard-prize" value={profile.prizePool} onChange={(e) => handleProfileChange('prizePool', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Submission & Filters */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in-0 duration-200">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <ListChecks className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="font-semibold">{t('settings.setup_wizard.submission_title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('settings.setup_wizard.submission_desc')}</p>
                  </div>
                </div>

                <div className="grid gap-3">
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
                    badge={t('assignments.recommended', 'Recommended')}
                    onClick={() => setSubmissionStyle('standard')}
                  />
                  <OptionCard
                    title={t('settings.setup_wizard.styles.detailed.title')}
                    description={t('settings.setup_wizard.styles.detailed.desc')}
                    selected={submissionStyle === 'detailed'}
                    onClick={() => setSubmissionStyle('detailed')}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Filter className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="font-semibold">{t('settings.setup_wizard.dimensions_title')}</h3>
                    <p className="text-sm text-muted-foreground">{t('settings.setup_wizard.dimensions_desc')}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {(['class_name', 'category'] as SetupWizardDimension[]).map((dimension) => (
                    <label
                      key={dimension}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/60 px-4 py-3 transition-colors hover:border-primary/20 hover:bg-muted/20"
                    >
                      <Checkbox
                        checked={dimensions.includes(dimension)}
                        onCheckedChange={(checked) => toggleDimension(dimension, checked === true)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="font-medium">{t(`settings.setup_wizard.dimensions.${dimension}.title`)}</div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {t(`settings.setup_wizard.dimensions.${dimension}.desc`)}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Preview & Confirm */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in-0 duration-200">
              <h3 className="font-semibold">{t('settings.setup_wizard.preview_title')}</h3>

              <section className="space-y-2">
                <div className="text-sm font-medium">{t('settings.setup_wizard.profile_title', 'Event Profile')}</div>
                <div className="rounded-2xl border border-border/60 bg-muted/10 px-4 py-3">
                  <div className="font-medium">{profile.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{profile.tagline}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {profile.startAt && profile.endAt ? formatDateRange(profile.startAt, profile.endAt) : null}
                    {profile.city ? ` · ${profile.city}` : ''}
                    {profile.prizePool ? ` · ${profile.prizePool}` : ''}
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-2 gap-4">
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t('settings.setup_wizard.preview_sections.submission')}</div>
                    <Badge variant="outline">{previewFields.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {previewFields.map((fieldLabel) => (
                      <Badge key={fieldLabel} variant="secondary" className="rounded-full px-2.5 py-0.5 text-xs">
                        {fieldLabel}
                      </Badge>
                    ))}
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">{t('settings.setup_wizard.preview_sections.scoring')}</div>
                    <Badge variant="outline">100</Badge>
                  </div>
                  <div className="space-y-1.5">
                    {previewCriteria.map((criterion) => (
                      <div key={criterion.label} className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/10 px-3 py-1.5">
                        <span className="text-sm">{criterion.label}</span>
                        <span className="text-sm font-medium">{criterion.maxScore}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {profile.docsUrl && (
                <section className="space-y-2">
                  <div className="text-sm font-medium">{t('settings.setup_wizard.docs_title', 'Docs & Links')}</div>
                  <div className="rounded-xl border border-border/60 bg-muted/10 px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">{t('settings.docs_url')}</div>
                    <div className="mt-0.5 break-all text-sm">{profile.docsUrl}</div>
                  </div>
                </section>
              )}

              {/* Optional links on preview step */}
              <section className="space-y-3 rounded-2xl border border-border/60 bg-muted/10 p-4">
                <div className="text-sm font-medium">{t('settings.setup_wizard.optional_links', 'Optional Links')}</div>
                <div className="space-y-1">
                  <Label htmlFor="wizard-docs" className="text-xs">{t('settings.docs_url')}</Label>
                  <Input
                    id="wizard-docs"
                    type="url"
                    placeholder="https://docs.example.com"
                    value={profile.docsUrl}
                    onChange={(e) => handleProfileChange('docsUrl', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('settings.docs_url_desc')}</p>
                </div>
              </section>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border/60 px-6 py-4">
          <div className="flex w-full items-center justify-between">
            <div>
              {step > 1 && (
                <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={isApplying}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {t('settings.setup_wizard.prev', 'Previous')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isApplying}>
                {t('common.cancel')}
              </Button>
              {step < TOTAL_STEPS ? (
                <Button onClick={() => setStep(step + 1)} disabled={step === 1 && !canProceedStep1}>
                  {t('settings.setup_wizard.next', 'Next')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleApply} disabled={isApplying}>
                  {isApplying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                  {t('settings.setup_wizard.apply')}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
