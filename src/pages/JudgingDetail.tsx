import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { assignments, projects, hackathons } from '@/lib/mock-data'
import { calculateProjectScore } from '@/lib/scoring'
import { ArrowLeft, ExternalLink, Github, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'

export function JudgingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { user } = useAuth()

  // Try to find by assignment ID first (for judges)
  const assignment = useMemo(() => assignments.find((a) => a.id === id), [id])
  // If not found, try to find by project ID (for public view)
  const project = useMemo(() => {
    if (assignment) {
      return projects.find((p) => p.id === assignment.projectId)
    }
    return projects.find((p) => p.id === id)
  }, [assignment, id])

  const hackathon = useMemo(() => {
    if (project) {
      return hackathons.find(h => h.id === project.hackathonId)
    }
    return null
  }, [project])

  const scoringCriteria = hackathon?.scoringCriteria || []

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initialScores: Record<string, number> = {}
    scoringCriteria.forEach(criterion => {
      initialScores[criterion.id] = 0
    })
    return initialScores
  })
  const [comment, setComment] = useState('')

  if (!project) {
    return <div>Project not found</div>
  }

  // If we're viewing directly by project ID (no assignment), show read-only view
  const isReadOnly = !assignment

  const handleScoreChange = (criterionId: string, value: number[]) => {
    setScores((prev) => ({ ...prev, [criterionId]: value[0] }))
  }

  const handleSubmit = () => {
    // In a real app, this would submit to the backend
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
    console.log('Submitting scores:', { scores, comment, totalScore })
    toast.success(t('judging.score_submitted', 'Score submitted successfully'))
    if (user?.role === 'judge') {
      navigate('/judge')
    } else {
      navigate('/dashboard/judging')
    }
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/judging')}>
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
                {project.tags.map((tag) => (
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
                      Repository
                    </Button>
                  </a>
                )}
                {project.demoUrl && (
                  <a href={project.demoUrl} target="_blank" rel="noreferrer">
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Live Demo
                    </Button>
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{t('projects.media', 'Media')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video w-full rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                Project Demo Video / Screenshots
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scoring Form - Only visible to judges/admins with an assignment */}
        {!isReadOnly ? (
          <div className="space-y-6">
            <Card className="border-0 shadow-sm sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {t('judging.score_card', 'Score Card')}
                  <span className="text-2xl font-bold text-primary">{totalScore} / 100</span>
                </CardTitle>
                <CardDescription>Rate the project based on the criteria below</CardDescription>
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

                <Button onClick={handleSubmit} className="w-full">
                  <Save className="mr-2 h-4 w-4" />
                  {t('judging.submit_score', 'Submit Score')}
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
                    {calculateProjectScore(project.id, assignments).toFixed(1)} / 100
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
