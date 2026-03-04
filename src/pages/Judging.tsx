import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const statuses: Array<'pending' | 'in_progress' | 'completed'> = [
  'pending',
  'in_progress',
  'completed',
]

export function Judging() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeHackathon } = useActiveHackathon()
  const [status, setStatus] = useState<(typeof statuses)[number]>('in_progress')
  const [selectedSessionId, setSelectedSessionId] = useState('all')

  // Fetch assignments from API
  const { data: assignments = [] } = useQuery({
    queryKey: ['assignments', activeHackathon?.id, user?.id, user?.role, selectedSessionId],
    queryFn: async () => {
      const params: { sessionId?: string; judgeId?: string; hackathonId?: string } = {
        hackathonId: activeHackathon?.id,
      }
      if (selectedSessionId !== 'all') {
        params.sessionId = selectedSessionId
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

  const rows = useMemo(() => {
    const filteredAssignments = assignments.filter((a) => a.status === status)
    return filteredAssignments.map((a) => {
      const project = projects.find((p) => p.id === a.projectId)
      return { a, project, session: a.session }
    })
  }, [status, assignments, projects])

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <section className="container py-6 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight md:text-4xl">{t('judging.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              {t('judging.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[220px]">
              <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('reports.session', 'Session')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('reports.filter_all', 'All')}</SelectItem>
                  {(activeHackathon?.sessions || []).map((session) => (
                    <SelectItem key={session.id} value={session.id}>
                      {session.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {statuses.map((s) => (
              <Button
                key={s}
                variant={s === status ? 'default' : 'outline'}
                className={s === status ? 'rounded-full bg-apple-blue text-white hover:bg-apple-blue/90' : 'rounded-full'}
                onClick={() => setStatus(s)}
              >
                {t(`judging.status.${s}`)}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {rows.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {t('judging.no_assignments', 'No assignments found')}
            </div>
          )}
          {rows.map(({ a, project, session }) => (
            <Card key={a.id} className="surface-panel border-none shadow-none">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{project?.title}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {session?.name} · {a.judge?.name}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {t('judging.done')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-apple-blue/10 px-2.5 py-1 text-xs font-medium text-apple-blue">
                      {t(`judging.status.${a.status}`)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-foreground/80 leading-relaxed md:max-w-3xl">
                  {project?.oneLiner}
                </p>
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    // Navigate based on user role
                    const reviewPath = user?.role === 'judge'
                      ? `/judge/review/${a.id}`
                      : `/dashboard/judging/${a.id}`
                    navigate(reviewPath)
                  }}
                >
                  {t('judging.open_review')}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
