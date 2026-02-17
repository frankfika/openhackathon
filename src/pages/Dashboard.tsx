import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { hackathons, sessions, assignments, projects, judges } from '@/lib/mock-data'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Dashboard() {
  const { t } = useTranslation()
  const activeHackathons = useMemo(() => hackathons.filter((h) => h.status === 'active' || h.status === 'judging'), [])
  const pending = useMemo(() => assignments.filter((a) => a.status !== 'completed'), [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/dashboard/hackathons">
            <Button variant="outline" className="rounded-full">
              {t('dashboard.browse_events')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Button className="rounded-full bg-apple-blue text-white hover:bg-apple-blue/90">
            {t('dashboard.create')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Card className="border-0 shadow-sm lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.active_events')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeHackathons.map((h) => {
              const currentSessions = sessions.filter((s) => s.hackathonId === h.id)
              return (
                <div key={h.id} className="flex items-center justify-between rounded-xl bg-apple-light/60 p-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{h.title}</div>
                    <div className="text-xs text-muted-foreground">{currentSessions.map((s) => s.name).join(' · ')}</div>
                  </div>
                  <Link to="/dashboard/judging">
                    <Button variant="outline" className="rounded-full">
                      {t('dashboard.operate')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )
            })}
            {activeHackathons.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                {t('dashboard.no_events')}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('dashboard.judging_queue')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.slice(0, 5).map((a) => {
              const p = projects.find((x) => x.id === a.projectId)
              const j = judges.find((x) => x.id === a.judgeId)
              const isAi = Boolean(j?.isAi)
              return (
                <div key={a.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold">{p?.title}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{a.status}</span>
                      <span>·</span>
                      <span>{j?.name}</span>
                      {isAi ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-fuchsia-600">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Link to="/dashboard/judging">
                    <Button variant="outline" className="rounded-full">{t('dashboard.open')}</Button>
                  </Link>
                </div>
              )
            })}
            {pending.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                {t('dashboard.no_assignments')}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
