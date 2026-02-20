import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, Clock, Sparkles, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'

export function JudgeDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeHackathon } = useActiveHackathon()

  // Fetch assignments for the current judge
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', 'judge', user?.id],
    queryFn: () => api.getAssignments({ judgeId: user?.id }),
    enabled: !!user?.id,
  })

  // Fetch projects for display
  const { data: projects = [] } = useQuery({
    queryKey: ['projects', activeHackathon?.id],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

  const pendingAssignments = assignments.filter(a => a.status === 'pending')
  const completedAssignments = assignments.filter(a => a.status === 'completed')

  if (isLoadingAssignments) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('dashboard.judge.title', 'Judge Dashboard')}</h1>
        <p className="text-sm md:text-base text-muted-foreground">{t('dashboard.judge.subtitle', 'Review and score assigned projects.')}</p>
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
              {t('dashboard.judge.due_soon', 'Awaiting your review')}
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

                  return (
                    <div key={assignment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="font-semibold">{project?.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {project?.oneLiner}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => navigate(`/judge/review/${assignment.id}`)}>
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
              <Badge variant="secondary" className="text-xs">{t('common.coming_soon', 'Coming Soon')}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('dashboard.judge.ai_desc', 'Use the scoring rubric to ensure fair and consistent evaluation of all projects.')}
            </p>
            <div className="bg-background/50 p-3 rounded-lg text-xs border border-indigo-100 dark:border-indigo-900">
              <strong>{t('dashboard.judge.ai_copilot_tip_title', 'Pro Tip:')}</strong> {t('dashboard.judge.ai_copilot_tip', 'Click "Start Review" to access the detailed scoring interface.')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
