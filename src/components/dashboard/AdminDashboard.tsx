import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useActiveHackathon } from '@/lib/active-hackathon'
import {
  BarChart3,
  FileText,
  FolderGit2,
  Gavel,
  Loader2,
  Settings as SettingsIcon,
  Trophy,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeHackathon } = useActiveHackathon()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', activeHackathon?.id],
    queryFn: () =>
      api.getDashboardStats({
        hackathonId: activeHackathon?.id,
        role: 'admin',
      }),
    enabled: !!activeHackathon?.id,
  })

  const statCards = [
    {
      label: t('dashboard.stats.total_projects', 'Projects'),
      value: stats?.totalProjects || 0,
      icon: FolderGit2,
      tone: 'bg-cyan-500/12 text-cyan-700',
    },
    {
      label: t('dashboard.stats.judges', 'Judges'),
      value: stats?.totalJudges || 0,
      icon: Users,
      tone: 'bg-emerald-500/12 text-emerald-700',
    },
    {
      label: t('dashboard.stats.pending_reviews', 'Pending Reviews'),
      value: stats?.pendingReviews || 0,
      icon: FileText,
      tone: 'bg-orange-500/12 text-orange-700',
    },
  ]

  const actionCards = [
    {
      icon: FolderGit2,
      title: t('dashboard.view_submissions', 'View Submissions'),
      to: '/dashboard/projects',
      desc: t('projects.subtitle', 'Browse project profiles, status and completeness.'),
    },
    {
      icon: Users,
      title: t('dashboard.assign_projects', 'Assign Projects'),
      to: '/dashboard/assignments',
      desc: t('dashboard.judging_queue', 'Distribute reviews and balance judge workload.'),
    },
    {
      icon: Gavel,
      title: t('dashboard.manage_judging', 'Manage Judging'),
      to: '/dashboard/judging',
      desc: t('nav.judging', 'Track scoring progress and pending work.'),
    },
    {
      icon: FileText,
      title: t('dashboard.view_reports', 'View Reports'),
      to: '/dashboard/reports',
      desc: t('nav.reports', 'Review score distribution and judge comments.'),
    },
    {
      icon: BarChart3,
      title: t('nav.leaderboard', 'Leaderboard'),
      to: '/dashboard/leaderboard',
      desc: t('landing.stats.prizes', 'Publish rankings and awards.'),
    },
    {
      icon: SettingsIcon,
      title: t('dashboard.hackathon_settings', 'Hackathon Settings'),
      to: `/dashboard/hackathons/${activeHackathon.id}/settings`,
      desc: t('settings.basic_info_desc', 'Adjust event details, rounds and criteria.'),
    },
  ]

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 md:space-y-8">
      <div className="surface-panel-strong p-5 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="grand-chip">
              <Trophy className="h-3.5 w-3.5 text-primary" />
              {t('dashboard.admin.title', 'Admin Dashboard')}
            </div>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight md:text-5xl">{activeHackathon.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{activeHackathon.tagline}</p>
          </div>
          <Button onClick={() => navigate('/dashboard/hackathons')} variant="outline" className="rounded-full border-white/65 bg-white/80 backdrop-blur">
            {t('dashboard.manage_hackathons', 'Manage Hackathons')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label} className="surface-panel rounded-3xl border-none shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={`rounded-xl p-2 ${stat.tone}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tabular-nums">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="surface-panel rounded-3xl border-none shadow-none">
        <CardHeader>
          <CardTitle>{t('dashboard.quick_actions', 'Quick Actions')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {actionCards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => navigate(card.to)}
              className="rounded-2xl border border-white/70 bg-white/78 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-200 hover:shadow-xl hover:shadow-slate-900/10"
            >
              <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <card.icon className="h-4 w-4" />
              </div>
              <div className="text-sm font-semibold">{card.title}</div>
              <div className="mt-1 text-xs text-muted-foreground">{card.desc}</div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
