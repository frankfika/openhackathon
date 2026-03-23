import React, { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle2, ExternalLink, Github, Save, FileText, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveHackathon } from '@/lib/active-hackathon'
import type { Assignment, Project, ScoringCriterion } from '@/lib/types'
import { cn } from '@/lib/utils'

const statuses: Array<'pending' | 'in_progress' | 'completed'> = [
  'pending',
  'in_progress',
  'completed',
]

function scoresToRecord(scores: Assignment['scores']): Record<string, number> {
  if (!scores) return {}
  if (Array.isArray(scores)) {
    return scores.reduce<Record<string, number>>((acc, item) => {
      acc[item.criterionId] = item.score
      return acc
    }, {})
  }
  return { ...scores }
}

export function Judging() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { activeHackathon } = useActiveHackathon()
  const isJudge = user?.role === 'judge'
  const [status, setStatus] = useState<(typeof statuses)[number]>(isJudge ? 'pending' : 'in_progress')
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null)
  const [sidebarPage, setSidebarPage] = useState(1)
  const SIDEBAR_PAGE_SIZE = 50

  // Fetch assignments from API
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', activeHackathon?.id, user?.id, user?.role],
    queryFn: async () => {
      const params: { judgeId?: string; hackathonId?: string } = {
        hackathonId: activeHackathon?.id,
      }
      if (user?.role === 'judge') {
        params.judgeId = user.id
      }
      return api.getAssignments(params)
    },
    enabled: !!activeHackathon?.id,
  })

  // Fetch projects for display
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', activeHackathon?.id],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

  // Fetch hackathon for scoring criteria
  const { data: hackathon } = useQuery({
    queryKey: ['hackathon', activeHackathon?.id],
    queryFn: () => api.getHackathon(activeHackathon!.id),
    enabled: !!activeHackathon?.id,
  })

  const scoringCriteria = hackathon?.scoringCriteria || []

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => a.status === status)
  }, [assignments, status])

  // Reset sidebar page when tab changes
  useEffect(() => { setSidebarPage(1) }, [status])

  const sidebarTotalPages = Math.max(1, Math.ceil(filteredAssignments.length / SIDEBAR_PAGE_SIZE))
  const pagedAssignments = useMemo(
    () => filteredAssignments.slice((sidebarPage - 1) * SIDEBAR_PAGE_SIZE, sidebarPage * SIDEBAR_PAGE_SIZE),
    [filteredAssignments, sidebarPage]
  )

  const selectedAssignment = useMemo(() => {
    return assignments.find((a) => a.id === selectedAssignmentId) || filteredAssignments[0]
  }, [assignments, selectedAssignmentId, filteredAssignments])

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.id === selectedAssignment?.projectId)
  }, [projects, selectedAssignment])

  // Initialize selected assignment when filter changes
  useEffect(() => {
    if (filteredAssignments.length > 0 && !selectedAssignment) {
      setSelectedAssignmentId(filteredAssignments[0].id)
    }
  }, [filteredAssignments, selectedAssignment])

  // Scoring state
  const [scores, setScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('')

  // Reset scores when assignment changes
  useEffect(() => {
    if (selectedAssignment?.scores) {
      setScores(scoresToRecord(selectedAssignment.scores))
      setComment(selectedAssignment.comment || '')
    } else {
      const initialScores: Record<string, number> = {}
      scoringCriteria.forEach((criterion) => {
        initialScores[criterion.id] = 0
      })
      setScores(initialScores)
      setComment('')
    }
  }, [selectedAssignment, scoringCriteria])

  // Calculate total score
  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, score) => sum + (score || 0), 0)
  }, [scores])

  // Submit scores mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selectedAssignment || user?.role !== 'judge' || selectedAssignment.judgeId !== user.id) {
        throw new Error('Only the assigned judge can submit scores')
      }
      const scoresArray = Object.entries(scores).map(([criterionId, score]) => ({
        criterionId,
        score,
      }))
      return api.submitScores(selectedAssignment.id, {
        scores: scoresArray,
        comment,
        status: 'completed',
      })
    },
    onSuccess: () => {
      toast.success(t('judging.scores_saved'))
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      queryClient.invalidateQueries({ queryKey: ['assignment', selectedAssignment?.id] })
    },
    onError: (error: Error) => {
      toast.error(error.message || t('judging.scores_save_failed'))
    },
  })

  const isLoading = isLoadingAssignments
  const isCompleted = selectedAssignment?.status === 'completed'
  const canSubmit = isJudge && selectedAssignment?.judgeId === user?.id && !isCompleted

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <div className="flex h-full">
        {/* Left Sidebar - Assignment List */}
        <div className="w-80 flex-shrink-0 border-r bg-muted/20 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b bg-background">
            <h1 className="text-lg font-semibold tracking-tight">
              {isJudge ? t('judging.judge_title', 'My Review Queue') : t('judging.admin_title', 'Judging Progress')}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {isJudge
                ? t('judging.judge_subtitle', 'Review your assigned projects and submit scores.')
                : t('judging.admin_subtitle', 'Track judging progress across judges.')}
            </p>
          </div>

          {/* Status Tabs */}
          <div className="flex border-b bg-background">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 px-2 py-2 text-xs font-medium transition-colors border-b-2',
                  s === status
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {t(`judging.status.${s}`)}
                <span className="ml-1 tabular-nums">
                  ({assignments.filter((a) => a.status === s).length})
                </span>
              </button>
            ))}
          </div>

          {/* Assignment List */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            {filteredAssignments.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t('judging.no_assignments', 'No assignments found')}
              </div>
            ) : (
              <>
                <div className="divide-y flex-1">
                  {pagedAssignments.map((assignment) => {
                    const project = projects.find((p) => p.id === assignment.projectId)
                    const isSelected = selectedAssignment?.id === assignment.id

                    return (
                      <button
                        key={assignment.id}
                        onClick={() => setSelectedAssignmentId(assignment.id)}
                        className={cn(
                          'w-full text-left p-3 transition-colors hover:bg-muted/50',
                          isSelected && 'bg-primary/5 border-l-2 border-l-primary'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate">
                              {project?.title || 'Unknown Project'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate mt-0.5">
                              {project?.oneLiner}
                            </div>
                          </div>
                          <div className="shrink-0">
                            {assignment.status === 'completed' ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/30">
                                <CheckCircle2 className="h-3 w-3 mr-0.5" />
                                {assignment.totalScore}
                              </span>
                            ) : assignment.status === 'in_progress' ? (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30">
                                {t('judging.status.in_progress')}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-slate-800">
                                {t('judging.status.pending')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
                {/* Sidebar pagination */}
                {sidebarTotalPages > 1 && (
                  <div className="border-t p-2 flex items-center justify-between bg-background shrink-0">
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {(sidebarPage - 1) * SIDEBAR_PAGE_SIZE + 1}–{Math.min(sidebarPage * SIDEBAR_PAGE_SIZE, filteredAssignments.length)} / {filteredAssignments.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSidebarPage(p => p - 1)}
                        disabled={sidebarPage <= 1}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <span className="text-[11px] tabular-nums px-1">{sidebarPage}/{sidebarTotalPages}</span>
                      <button
                        onClick={() => setSidebarPage(p => p + 1)}
                        disabled={sidebarPage >= sidebarTotalPages}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Right Content - Project Details & Scoring */}
        <div className="flex-1 overflow-y-auto">
          {!selectedAssignment || !selectedProject ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 opacity-20 mb-2" />
                <p>{t('judging.select_assignment', 'Select an assignment to view details')}</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-6">
              {/* Project Header */}
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold">{selectedProject.title}</h2>
                    <p className="text-muted-foreground mt-1">{selectedProject.oneLiner}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedProject.demoUrl && (
                      <a
                        href={selectedProject.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Demo
                      </a>
                    )}
                    {selectedProject.repoUrl && (
                      <a
                        href={selectedProject.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Github className="h-4 w-4" />
                        Code
                      </a>
                    )}
                  </div>
                </div>

                {selectedProject.description && (
                  <div className="mt-4 prose prose-sm max-w-none dark:prose-invert">
                    <div className="whitespace-pre-wrap text-sm text-foreground/80">
                      {selectedProject.description}
                    </div>
                  </div>
                )}

                {selectedProject.tags && selectedProject.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {selectedProject.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Scoring Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{t('judging.scoring', 'Scoring')}</h3>
                  {isCompleted && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('judging.completed', 'Completed')} · {selectedAssignment.totalScore} {t('judging.points', 'points')}
                    </span>
                  )}
                </div>

                {scoringCriteria.length === 0 ? (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    {t('judging.no_criteria', 'No scoring criteria configured for this hackathon.')}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {scoringCriteria.map((criterion) => (
                      <div key={criterion.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-medium">{criterion.name}</Label>
                          <span className="text-sm font-semibold tabular-nums">
                            <span className={cn(
                              scores[criterion.id] === criterion.maxScore && 'text-emerald-600'
                            )}>
                              {scores[criterion.id] || 0}
                            </span>
                            <span className="text-muted-foreground font-normal"> / {criterion.maxScore}</span>
                          </span>
                        </div>
                        <Slider
                          value={[scores[criterion.id] || 0]}
                          onValueChange={([value]) => {
                            if (!canSubmit) return
                            setScores((prev) => ({ ...prev, [criterion.id]: value }))
                          }}
                          max={criterion.maxScore}
                          step={1}
                          disabled={!canSubmit}
                          className={cn(!canSubmit && 'opacity-60')}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>0</span>
                          <span>{criterion.maxScore}</span>
                        </div>
                      </div>
                    ))}

                    {/* Total Score */}
                    <div className="rounded-lg bg-muted/50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t('judging.total_score', 'Total Score')}</span>
                        <span className="text-2xl font-bold tabular-nums">{totalScore}</span>
                      </div>
                    </div>

                    {/* Comment */}
                    <div className="space-y-2">
                      <Label htmlFor="comment">{t('judging.comment', 'Comment')}</Label>
                      <Textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => canSubmit && setComment(e.target.value)}
                        placeholder={t('judging.comment_placeholder', 'Add your feedback...')}
                        disabled={!canSubmit}
                        className="min-h-[100px] resize-none"
                      />
                    </div>

                    {/* Submit Button */}
                    {canSubmit && (
                      <Button
                        onClick={() => submitMutation.mutate()}
                        disabled={submitMutation.isPending}
                        className="w-full"
                      >
                        {submitMutation.isPending ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            {t('judging.saving')}
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            {t('judging.submit_scores', 'Submit Scores')}
                          </>
                        )}
                      </Button>
                    )}

                    {isCompleted && (
                      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-800 dark:text-emerald-400">
                        {t('judging.already_scored', 'You have already submitted scores for this project.')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
