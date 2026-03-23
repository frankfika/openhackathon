import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle2, Clock, Loader2, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'

export function JudgeDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', 'judge', user?.id],
    queryFn: () => api.getAssignments({ judgeId: user?.id }),
    enabled: !!user?.id,
  })

  const pendingAssignments = assignments.filter((a) => a.status === 'pending')
  const completedAssignments = assignments.filter((a) => a.status === 'completed')

  if (isLoadingAssignments) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 md:space-y-8">
      <div className="surface-panel-strong p-5 md:p-7">
        <h1 className="font-display text-4xl font-semibold tracking-tight md:text-5xl">{t('dashboard.judge.title', 'Judge Dashboard')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.judge.subtitle', 'Review assigned projects and submit consistent scores.')}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="surface-panel rounded-3xl border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('dashboard.judge.pending', 'Pending Reviews')}
            </CardTitle>
            <div className="rounded-xl bg-orange-500/15 p-2 text-orange-700">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{pendingAssignments.length}</div>
            <p className="text-xs text-muted-foreground">{t('dashboard.judge.due_soon', 'Awaiting your review')}</p>
          </CardContent>
        </Card>

        <Card className="surface-panel rounded-3xl border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('dashboard.judge.completed', 'Completed')}
            </CardTitle>
            <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold tabular-nums">{completedAssignments.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-7">
        <Card className="surface-panel rounded-3xl border-none shadow-none lg:col-span-4">
          <CardHeader>
            <CardTitle>{t('dashboard.judge.queue', 'Judging Queue')}</CardTitle>
            <CardDescription>{t('dashboard.judge.queue_desc', 'Projects assigned to you for review.')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingAssignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/80 bg-background/50 px-4 py-8 text-center text-sm text-muted-foreground">
                  {t('dashboard.judge.no_pending', 'No pending assignments. Great job!')}
                </div>
              ) : (
                pendingAssignments.map((assignment) => {
                  return (
                    <div
                      key={assignment.id}
                      className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/78 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/10 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="font-semibold">{assignment.project?.title}</div>
                        <div className="text-xs text-muted-foreground">{assignment.project?.oneLiner}</div>
                      </div>
                      <Button size="sm" className="rounded-full grand-cta" onClick={() => navigate(`/judge/review/${assignment.id}`)}>
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

        <Card className="surface-panel-strong rounded-3xl border-none bg-gradient-to-br from-primary/10 to-orange-100/70 shadow-none lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t('dashboard.judge.ai_copilot', 'AI Copilot')}
              <Badge variant="secondary" className="text-xs">
                {t('common.coming_soon', 'Coming Soon')}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {t('dashboard.judge.ai_desc', 'Use the scoring rubric to ensure fair and consistent evaluation of all projects.')}
            </p>
            <div className="rounded-lg border border-primary/20 bg-white/75 p-3 text-xs backdrop-blur">
              <strong>{t('dashboard.judge.ai_copilot_tip_title', 'Pro Tip:')}</strong>{' '}
              {t('dashboard.judge.ai_copilot_tip', 'Click "Start Review" to access the detailed scoring interface.')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
