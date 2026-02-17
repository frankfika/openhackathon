import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { assignments, projects, judges } from '@/lib/mock-data'
import { ArrowLeft, ExternalLink, Github, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function JudgingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [scores, setScores] = useState({
    innovation: 0,
    technology: 0,
    design: 0,
    completion: 0
  })
  const [comment, setComment] = useState('')

  const assignment = useMemo(() => assignments.find((a) => a.id === id), [id])
  const project = useMemo(() => projects.find((p) => p.id === assignment?.projectId), [assignment])

  if (!assignment || !project) {
    return <div>Project not found</div>
  }

  const handleScoreChange = (key: keyof typeof scores, value: number[]) => {
    setScores((prev) => ({ ...prev, [key]: value[0] }))
  }

  const handleSubmit = () => {
    // In a real app, this would submit to the backend
    console.log('Submitting scores:', { scores, comment })
    toast.success(t('judging.score_submitted', 'Score submitted successfully'))
    navigate('/dashboard/judging')
  }

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0) / 4

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/judging')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="text-muted-foreground">{t('judging.judging_project', 'Judging Project')}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Project Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>{t('projects.details', 'Details')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground/80 leading-relaxed">{project.oneLiner}</p>
              
              <div className="flex flex-wrap gap-2">
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

        {/* Scoring Form */}
        <div className="space-y-6">
          <Card className="border-0 shadow-sm sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {t('judging.score_card', 'Score Card')}
                <span className="text-2xl font-bold text-primary">{totalScore.toFixed(1)}</span>
              </CardTitle>
              <CardDescription>Rate the project on a scale of 1-10</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>{t('judging.criteria.innovation', 'Innovation')}</Label>
                    <span className="text-sm font-medium">{scores.innovation}</span>
                  </div>
                  <Slider
                    value={[scores.innovation]}
                    max={10}
                    step={0.5}
                    onValueChange={(val) => handleScoreChange('innovation', val)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>{t('judging.criteria.technology', 'Technology')}</Label>
                    <span className="text-sm font-medium">{scores.technology}</span>
                  </div>
                  <Slider
                    value={[scores.technology]}
                    max={10}
                    step={0.5}
                    onValueChange={(val) => handleScoreChange('technology', val)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>{t('judging.criteria.design', 'Design')}</Label>
                    <span className="text-sm font-medium">{scores.design}</span>
                  </div>
                  <Slider
                    value={[scores.design]}
                    max={10}
                    step={0.5}
                    onValueChange={(val) => handleScoreChange('design', val)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label>{t('judging.criteria.completion', 'Completion')}</Label>
                    <span className="text-sm font-medium">{scores.completion}</span>
                  </div>
                  <Slider
                    value={[scores.completion]}
                    max={10}
                    step={0.5}
                    onValueChange={(val) => handleScoreChange('completion', val)}
                  />
                </div>
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
      </div>
    </div>
  )
}
