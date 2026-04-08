import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ExternalLink, Github, Minus, Plus, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { getVisibleSubmissionDataEntries } from '@/lib/submission-fields'
import { cn } from '@/lib/utils'
import {
  clampScore,
  countUnscoredCriteria,
  createEmptyScoreDraft,
  isScoreDraftComplete,
  scoreDraftToPayload,
  scoresToDraft,
  sumScoreDraft,
  type ScoreDraft,
} from '@/lib/judging-scores'

export function JudgingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { adminBasePath } = useAdminRoutes()
  const queryClient = useQueryClient()
  const hasMarkedInProgress = React.useRef(false)
  const infoPanelClassName = 'border border-sky-500/15 bg-sky-500/[0.04] shadow-none backdrop-blur'
  const scoringPanelClassName = 'border border-amber-500/15 bg-amber-500/[0.05] shadow-none backdrop-blur'

  // Fetch assignment by ID directly (single request instead of fetching all)
  const { data: assignment, isLoading: isLoadingAssignment } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api.getAssignment(id!),
    enabled: !!id,
    retry: false,
  })

  // Project comes from assignment.project (included in response), or fetch directly
  const projectFromAssignment = assignment?.project
  const { data: projectFromDirectId, isLoading: isLoadingProjectFromDirectId } = useQuery({
    queryKey: ['project', id, 'direct'],
    queryFn: () => api.getProject(id!),
    enabled: !!id && !isLoadingAssignment && !assignment,
    retry: false,
  })

  const project = projectFromAssignment || projectFromDirectId

  // Fetch hackathon for scoring criteria
  const { data: hackathon } = useQuery({
    queryKey: ['hackathon', project?.hackathonId],
    queryFn: () => api.getHackathon(project!.hackathonId),
    enabled: !!project?.hackathonId,
  })

  const scoringCriteria = React.useMemo(() => hackathon?.scoringCriteria || [], [hackathon?.scoringCriteria])
  const visibleSubmissionEntries = React.useMemo(() => {
    return getVisibleSubmissionDataEntries(project?.submissionData, hackathon?.submissionSchema, t)
  }, [project?.submissionData, hackathon?.submissionSchema, t])

  // Initialize scores from existing scores
  const [scores, setScores] = useState<ScoreDraft>(() => {
    if (assignment?.scores) {
      return scoresToDraft(assignment.scores)
    }
    return createEmptyScoreDraft(scoringCriteria)
  })

  const [comment, setComment] = useState(assignment?.comment || '')

  // Submit scores mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!assignment || user?.role !== 'judge' || assignment.judgeId !== user.id) {
        throw new Error('Only the assigned judge can submit scores')
      }
      if (!isScoreDraftComplete(scores, scoringCriteria)) {
        throw new Error(t('judging.complete_all_scores', 'Please complete every score before submitting'))
      }
      const scoresArray = scoreDraftToPayload(scores, scoringCriteria)
      return api.submitScores(assignment.id, {
        scores: scoresArray,
        comment,
        status: 'completed',
      })
    },
    onSuccess: () => {
      toast.success(t('judging.score_submitted', 'Score submitted successfully'))
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      // Navigate based on user role
      const redirectPath = user?.role === 'judge' ? '/judge' : buildAdminPath(adminBasePath, 'assignments')
      navigate(redirectPath)
    },
    onError: () => {
      toast.error(t('judging.submit_error', 'Failed to submit score'))
    },
  })

  // Update scores when assignment data loads
  React.useEffect(() => {
    if (assignment?.scores) {
      setScores(scoresToDraft(assignment.scores))
    } else if (scoringCriteria.length > 0) {
      setScores(createEmptyScoreDraft(scoringCriteria))
    }
    if (assignment?.comment) {
      setComment(assignment.comment)
    } else {
      setComment('')
    }
  }, [assignment, scoringCriteria])

  React.useEffect(() => {
    if (!assignment || assignment.status !== 'pending') return
    if (user?.role !== 'judge') return
    if (hasMarkedInProgress.current) return

    hasMarkedInProgress.current = true
    api.updateAssignmentStatus(assignment.id, 'in_progress')
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['assignment', id] })
        queryClient.invalidateQueries({ queryKey: ['assignments'] })
      })
      .catch(() => {
        hasMarkedInProgress.current = false
      })
  }, [assignment, id, queryClient, user?.role])

  const isLoadingProject = assignment ? false : isLoadingProjectFromDirectId

  if (isLoadingAssignment || isLoadingProject) {
    return <div>{t('common.loading')}</div>
  }

  if (!project) {
    return <div>{t('projects.not_found')}</div>
  }

  // If we're viewing directly by project ID (no assignment), show read-only view
  const canScore = Boolean(assignment && user?.role === 'judge' && assignment.judgeId === user.id)
  const isReadOnly = !canScore

  const handleSubmit = () => {
    if (!canScore) return
    const confirmed = confirm(
      t('judging.submit_confirm', 'Once submitted, scores cannot be changed. Are you sure you want to submit?')
    )
    if (!confirmed) return
    submitMutation.mutate()
  }

  const assignmentScoreMap = scoresToDraft(assignment?.scores)
  const totalScore = assignment?.totalScore ?? sumScoreDraft(scores)
  const maxPossible = scoringCriteria.reduce((sum, c) => sum + (c.maxScore || 0), 0)
  const unscoredCount = countUnscoredCriteria(scores, scoringCriteria)
  const backPath = user?.role === 'judge' ? '/judge' : buildAdminPath(adminBasePath, 'assignments')

  const updateCriterionScore = (criterionId: string, maxScore: number, nextValue: number) => {
    setScores((prev) => ({
      ...prev,
      [criterionId]: clampScore(nextValue, maxScore),
    }))
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="text-sm text-muted-foreground">
            {canScore
              ? t('judging.judging_project', 'Judging Project')
              : t('judging.assignment_detail', 'Assignment Detail')}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Project Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className={infoPanelClassName}>
            <CardHeader>
              <CardTitle>{t('projects.details', 'Details')}</CardTitle>
              <CardDescription>
                {t('judging.review_panel_desc', 'Use this section to inspect the project profile and submission details before scoring.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/80 leading-relaxed">{project.oneLiner}</p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t('projects.project_id')}</Label>
                  <p className="text-sm font-mono break-all">{project.id}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-muted-foreground">{t('projects.submitter')}</Label>
                  <p className="text-sm font-medium">{project.submitterName || t('common.anonymous')}</p>
                  <p className="text-xs text-muted-foreground break-all">{project.submitterEmail}</p>
                </div>
              </div>

              {project.description && (
                <div className="mt-4 prose dark:prose-invert max-w-none">
                  <h3 className="text-lg font-semibold mb-2">{t('projects.description', 'Description')}</h3>
                  <div className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {project.description}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-4">
                {project.tags?.map((tag: string) => (
                  <span key={tag} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex gap-4 pt-4">
                {project.repoUrl && (
                  <a href={project.repoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2">
                      <Github className="h-4 w-4" />
                      {t('projects.repository')}
                    </Button>
                  </a>
                )}
                {project.demoUrl && (
                  <a href={project.demoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      {t('projects.live_demo')}
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Submission Data */}
          {visibleSubmissionEntries.length > 0 && (
            <Card className={infoPanelClassName}>
              <CardHeader>
                <CardTitle>{t('projects.submission_data', 'Submission Data')}</CardTitle>
                <CardDescription>{t('projects.submission_data_desc', 'Custom fields submitted with the project')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleSubmissionEntries.map((entry) => (
                  <div key={entry.key}>
                    <Label className="text-muted-foreground">{entry.label}</Label>
                    <p className="text-sm whitespace-pre-wrap">{entry.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Scoring form is reserved for the assigned judge. Admins can inspect results only. */}
        {!isReadOnly ? (
          <div className="space-y-6">
            <Card className={cn('sticky top-6', scoringPanelClassName)}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('judging.scoring_panel_title', 'Score Submission')}
                  <span className="text-2xl font-bold text-primary">{totalScore} / {maxPossible}</span>
                </CardTitle>
                <CardDescription>{t('judging.scoring_panel_desc', 'Enter numeric scores and final comments here. This section is the only place that affects submission results.')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {scoringCriteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="space-y-4 rounded-2xl border border-white/45 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold text-foreground">{criterion.name}</Label>
                          <p className="text-xs text-muted-foreground">
                            {t('judging.score_range', 'Range')}: 0 - {criterion.maxScore}
                          </p>
                        </div>
                        <span className="inline-flex min-w-[92px] items-center justify-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                          {scores[criterion.id] ?? t('judging.unscored_short', '—')} / {criterion.maxScore}
                        </span>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-2xl"
                            onClick={() =>
                              updateCriterionScore(
                                criterion.id,
                                criterion.maxScore,
                                (scores[criterion.id] ?? 0) - 1
                              )
                            }
                          >
                            <Minus className="h-4 w-4" />
                          </Button>

                          <div className="relative">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={criterion.maxScore}
                              step={1}
                              value={scores[criterion.id] ?? ''}
                              placeholder={t('judging.score_placeholder_short', 'Score')}
                              onChange={(e) => {
                                const nextValue = e.target.value === ''
                                  ? null
                                  : Number.parseInt(e.target.value, 10)
                                if (nextValue == null) {
                                  setScores((prev) => ({ ...prev, [criterion.id]: null }))
                                  return
                                }
                                updateCriterionScore(criterion.id, criterion.maxScore, nextValue)
                              }}
                              className="h-11 w-24 rounded-2xl border-primary/20 bg-background/90 px-3 text-center font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-11 w-11 rounded-2xl"
                            onClick={() =>
                              updateCriterionScore(
                                criterion.id,
                                criterion.maxScore,
                                (scores[criterion.id] ?? 0) + 1
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="rounded-2xl border border-dashed border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
                          {t('judging.score_range', 'Range')}: 0 - {criterion.maxScore}
                        </div>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-cyan-400 transition-[width] duration-300"
                          style={{
                            width: `${criterion.maxScore > 0 ? ((scores[criterion.id] ?? 0) / criterion.maxScore) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {unscoredCount > 0 && (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-background/55 p-4 text-sm text-muted-foreground">
                    {t('judging.unscored_hint', { count: unscoredCount, defaultValue: '{{count}} criteria still need scores.' })}
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">{t('judging.comments', 'Comments')}</Label>
                  <Textarea
                    placeholder={t('judging.comments_placeholder', 'Optional feedback for the team...')}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[120px] rounded-2xl bg-background/85 px-4 py-3 leading-6"
                  />
                </div>

                <Button
                  onClick={handleSubmit}
                  className="h-11 w-full rounded-2xl"
                  disabled={submitMutation.isPending || !isScoreDraftComplete(scores, scoringCriteria)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {submitMutation.isPending ? t('judging.submitting') : t('judging.submit_score', 'Submit Score')}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className={cn('sticky top-6', scoringPanelClassName)}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('projects.score', 'Score')}
                  <span className="text-2xl font-bold text-primary">
                    {totalScore > 0 ? totalScore : '-'} / {maxPossible || 100}
                  </span>
                </CardTitle>
                <CardDescription>
                  {assignment
                    ? t('judging.read_only_assignment', 'Admins can inspect this assignment, but only the assigned judge can submit or edit scores.')
                    : t('projects.score_desc', 'Final score awarded by judges')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {assignment ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-white/45 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t('judging.assigned_judge', 'Assigned Judge')}
                        </Label>
                        <p className="mt-2 text-sm font-semibold text-foreground">{assignment.judge?.name || '-'}</p>
                      </div>
                      <div className="rounded-2xl border border-white/45 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t('judging.assignment_status_label', 'Assignment Status')}
                        </Label>
                        <p className="mt-2 text-sm font-semibold text-foreground">
                          {t(`judging.status.${assignment.status}`)}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    {scoringCriteria.length > 0 ? (
                      <div className="space-y-3">
                        <Label className="text-sm font-semibold">{t('judging.score_breakdown', 'Score Breakdown')}</Label>
                        {scoringCriteria.map((criterion) => {
                          const criterionScore = assignmentScoreMap[criterion.id]
                          const scoreValue = criterionScore ?? 0
                          const scorePercent = criterion.maxScore > 0 ? (scoreValue / criterion.maxScore) * 100 : 0

                          return (
                            <div
                              key={criterion.id}
                              className="space-y-3 rounded-2xl border border-white/45 bg-white/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                  <p className="text-sm font-semibold text-foreground">{criterion.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {t('judging.score_range', 'Range')}: 0 - {criterion.maxScore}
                                  </p>
                                </div>
                                <span className="inline-flex min-w-[92px] items-center justify-center rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
                                  {criterionScore ?? '-'} / {criterion.maxScore}
                                </span>
                              </div>

                              <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary via-sky-400 to-cyan-400 transition-[width] duration-300"
                                  style={{ width: `${scorePercent}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">{t('judging.comments', 'Comments')}</Label>
                      <div className="rounded-2xl border border-white/45 bg-white/70 p-4 text-sm leading-6 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/45 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        {assignment.comment || t('judging.no_comment', 'No comment submitted yet.')}
                      </div>
                    </div>

                    {assignment.totalScore == null && (
                      <div className="rounded-2xl border border-dashed border-border/80 bg-background/55 p-4 text-center text-sm text-muted-foreground">
                        {t('judging.no_score_yet', 'This assignment has not been scored yet.')}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border/80 bg-background/55 p-4 text-center text-sm text-muted-foreground">
                    {t('projects.read_only_score', 'Scoring is closed or you do not have permission to judge this project.')}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
