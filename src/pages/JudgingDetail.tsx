import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ExternalLink, Github, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function JudgingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Fetch assignment
  const { data: assignment, isLoading: isLoadingAssignment } = useQuery({
    queryKey: ['assignment', id],
    queryFn: () => api.getAssignments().then(assignments => assignments.find(a => a.id === id)),
    enabled: !!id,
  })

  // Fetch project
  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', assignment?.projectId],
    queryFn: () => api.getProject(assignment!.projectId),
    enabled: !!assignment?.projectId,
  })

  // Fetch hackathon for scoring criteria
  const { data: hackathon } = useQuery({
    queryKey: ['hackathon', project?.hackathonId],
    queryFn: () => api.getHackathon(project!.hackathonId),
    enabled: !!project?.hackathonId,
  })

  const scoringCriteria = hackathon?.scoringCriteria || []

  // Initialize scores from existing scores
  const [scores, setScores] = useState<Record<string, number>>(() => {
    if (assignment?.scores) {
      const existingScores: Record<string, number> = {}
      // Handle both array format (from API) and Record format (from mock)
      if (Array.isArray(assignment.scores)) {
        assignment.scores.forEach((s: any) => {
          existingScores[s.criterionId] = s.score
        })
      } else {
        Object.assign(existingScores, assignment.scores)
      }
      return existingScores
    }
    const initialScores: Record<string, number> = {}
    scoringCriteria.forEach(criterion => {
      initialScores[criterion.id] = 0
    })
    return initialScores
  })

  const [comment, setComment] = useState(assignment?.comment || '')

  // Submit scores mutation
  const submitMutation = useMutation({
    mutationFn: () => {
      if (!assignment) throw new Error('No assignment')
      const scoresArray = Object.entries(scores).map(([criterionId, score]) => ({
        criterionId,
        score,
      }))
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
      const redirectPath = user?.role === 'judge' ? '/judge' : '/dashboard/judging'
      navigate(redirectPath)
    },
    onError: () => {
      toast.error(t('judging.submit_error', 'Failed to submit score'))
    },
  })

  // Update scores when assignment data loads
  React.useEffect(() => {
    if (assignment?.scores) {
      const existingScores: Record<string, number> = {}
      // Handle both array format (from API) and Record format (from mock)
      if (Array.isArray(assignment.scores)) {
        assignment.scores.forEach((s: any) => {
          existingScores[s.criterionId] = s.score
        })
      } else {
        Object.assign(existingScores, assignment.scores)
      }
      setScores(existingScores)
    }
    if (assignment?.comment) {
      setComment(assignment.comment)
    }
  }, [assignment])

  if (isLoadingAssignment || isLoadingProject) {
    return <div>{t('common.loading')}</div>
  }

  if (!project) {
    return <div>{t('projects.not_found')}</div>
  }

  // If we're viewing directly by project ID (no assignment), show read-only view
  const isReadOnly = !assignment

  const handleScoreChange = (criterionId: string, value: number[]) => {
    setScores((prev) => ({ ...prev, [criterionId]: value[0] }))
  }

  const handleSubmit = () => {
    submitMutation.mutate()
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
  const maxPossible = scoringCriteria.reduce((sum, c) => sum + (c.maxScore || 0), 0)
  const backPath = user?.role === 'judge' ? '/judge' : '/dashboard/judging'

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="text-sm text-muted-foreground">{t('judging.judging_project', 'Judging Project')}</p>
        </div>
      </div>

      <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
        {/* Project Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{t('projects.details', 'Details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/80 leading-relaxed">{project.oneLiner}</p>

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
          {project.submissionData && Object.keys(project.submissionData).length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>{t('projects.submission_data', 'Submission Data')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(project.submissionData).map(([key, value]) => (
                  <div key={key}>
                    <Label className="text-muted-foreground">{key}</Label>
                    <p className="text-sm">{String(value)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Scoring Form - Only visible to judges/admins with an assignment */}
        {!isReadOnly ? (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('judging.score_card', 'Score Card')}
                  <span className="text-2xl font-bold text-primary">{totalScore} / {maxPossible}</span>
                </CardTitle>
                <CardDescription>{t('judging.score_criteria_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {scoringCriteria.map((criterion) => (
                    <div key={criterion.id} className="space-y-2">
                      <div className="flex justify-between">
                        <Label>{criterion.name}</Label>
                        <span className="text-sm font-medium">
                          {scores[criterion.id] || 0} / {criterion.maxScore}
                        </span>
                      </div>
                      <Slider
                        value={[scores[criterion.id] || 0]}
                        max={criterion.maxScore}
                        step={1}
                        onValueChange={(val) => handleScoreChange(criterion.id, val)}
                      />
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>{t('judging.comments', 'Comments')}</Label>
                  <Textarea
                    placeholder={t('judging.comments_placeholder', 'Optional feedback for the team...')}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>

                <Button onClick={handleSubmit} className="w-full" disabled={submitMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {submitMutation.isPending ? t('judging.submitting') : t('judging.submit_score', 'Submit Score')}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('projects.score', 'Score')}
                  <span className="text-2xl font-bold text-primary">
                    {totalScore > 0 ? totalScore : '-'} / {maxPossible || 100}
                  </span>
                </CardTitle>
                <CardDescription>{t('projects.score_desc', 'Final score awarded by judges')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                 <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                   {t('projects.read_only_score', 'Scoring is closed or you do not have permission to judge this project.')}
                 </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
