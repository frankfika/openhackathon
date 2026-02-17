import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { assignments, projects, hackathons } from '@/lib/mock-data'
import { ArrowRight, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function JudgeDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // Filter assignments for the current judge (mocking as user 'jd-alice' or first judge for now)
  // In a real app, we'd use the user ID from auth context
  const pendingAssignments = assignments.filter(a => a.status === 'pending')
  const completedAssignments = assignments.filter(a => a.status === 'completed')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.judge.title', 'Judge Dashboard')}</h1>
        <p className="text-muted-foreground">{t('dashboard.judge.subtitle', 'Review and score assigned projects.')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.judge.pending', 'Pending Reviews')}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingAssignments.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.judge.due_soon', 'Due within 24 hours')}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {t('dashboard.judge.completed', 'Completed')}
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedAssignments.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('dashboard.judge.queue', 'Judging Queue')}</CardTitle>
            <CardDescription>{t('dashboard.judge.queue_desc', 'Projects assigned to you for review.')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingAssignments.length === 0 ? (
                 <div className="text-center py-8 text-muted-foreground">
                   {t('dashboard.judge.no_pending', 'No pending assignments. Great job!')}
                 </div>
              ) : (
                pendingAssignments.map((assignment) => {
                  const project = projects.find(p => p.id === assignment.projectId)
                  const hackathon = hackathons.find(h => h.id === project?.hackathonId)
                  
                  return (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="font-semibold">{project?.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <span>{hackathon?.title}</span>
                          {project?.tags.slice(0, 2).map(tag => (
                             <span key={tag} className="px-1.5 py-0.5 bg-secondary rounded-md">{tag}</span>
                          ))}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/dashboard/judging/${assignment.id}`)}>
                        {t('dashboard.judge.start', 'Start Review')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="col-span-3 border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-500" />
              {t('dashboard.judge.ai_copilot', 'AI Copilot')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('dashboard.judge.ai_desc', 'AI has pre-screened all submissions for plagiarism and compliance. Use the AI summary to speed up your review process.')}
            </p>
            <div className="bg-background/50 p-3 rounded-lg text-xs border border-indigo-100 dark:border-indigo-900">
              <strong>Pro Tip:</strong> Look for the "AI Analysis" tab in the judging view for code quality metrics.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
