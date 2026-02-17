import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { assignments, judges, projects, sessions } from '@/lib/mock-data'
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const statuses: Array<'pending' | 'in_progress' | 'completed'> = [
  'pending',
  'in_progress',
  'completed',
]

import { useNavigate } from 'react-router-dom'

// ... existing imports ...

export function Judging() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [status, setStatus] = useState<(typeof statuses)[number]>('in_progress')

  const rows = useMemo(() => {
    return assignments
      .filter((a) => a.status === status)
      .map((a) => {
        const judge = judges.find((j) => j.id === a.judgeId)
        const project = projects.find((p) => p.id === a.projectId)
        const session = sessions.find((s) => s.id === a.sessionId)
        return { a, judge, project, session }
      })
  }, [status])

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <section className="container py-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('judging.title')}</h1>
            <p className="text-muted-foreground">
              {t('judging.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
          {rows.map(({ a, judge, project, session }) => (
            <Card key={a.id} className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{project?.title}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {session?.name} · {judge?.name}
                    {judge?.isAi ? ` · ${t('judging.ai_judge')}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {judge?.isAi ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2.5 py-1 text-xs font-medium text-fuchsia-600">
                      <Sparkles className="h-3.5 w-3.5" />
                      Optional
                    </span>
                  ) : null}
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
                  onClick={() => navigate(`/dashboard/judging/${a.id}`)}
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

