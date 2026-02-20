import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Plus, Users, FolderGit2, Gavel, BarChart3, Settings as SettingsIcon, FileText, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'

export function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeHackathon } = useActiveHackathon()
  const { user } = useAuth()

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', activeHackathon?.id],
    queryFn: () => api.getDashboardStats({
      hackathonId: activeHackathon?.id,
      role: 'admin',
    }),
    enabled: !!activeHackathon?.id,
  })

  const statCards = [
    { label: t('dashboard.stats.total_projects', 'Projects'), value: stats?.totalProjects || 0, icon: FolderGit2, color: 'text-blue-600 bg-blue-100' },
    { label: t('dashboard.stats.judges', 'Judges'), value: stats?.totalJudges || 0, icon: Gavel, color: 'text-purple-600 bg-purple-100' },
    { label: t('dashboard.stats.pending_reviews', 'Pending Reviews'), value: stats?.pendingReviews || 0, icon: FileText, color: 'text-orange-600 bg-orange-100' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('dashboard.admin.title', 'Admin Dashboard')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{activeHackathon.title}</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <Button onClick={() => navigate('/dashboard/hackathons')} variant="outline" className="flex-1 md:flex-none">
            {t('dashboard.manage_hackathons', 'Manage Hackathons')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((stat, index) => (
          <Card key={index} className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>{t('dashboard.quick_actions', 'Quick Actions')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="justify-start" onClick={() => navigate('/dashboard/projects')}>
            <FolderGit2 className="mr-2 h-4 w-4" />
            {t('dashboard.view_submissions', 'View Submissions')}
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => navigate('/dashboard/assignments')}>
            <Users className="mr-2 h-4 w-4" />
            {t('dashboard.assign_projects', 'Assign Projects')}
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => navigate('/dashboard/judging')}>
            <Gavel className="mr-2 h-4 w-4" />
            {t('dashboard.manage_judging', 'Manage Judging')}
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => navigate('/dashboard/reports')}>
            <FileText className="mr-2 h-4 w-4" />
            {t('dashboard.view_reports', 'View Reports')}
          </Button>
          <Button variant="outline" className="justify-start" onClick={() => navigate('/dashboard/leaderboard')}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {t('nav.leaderboard', 'Leaderboard')}
          </Button>
          <Button variant="default" className="justify-start" onClick={() => navigate(`/dashboard/hackathons/${activeHackathon.id}/settings`)}>
            <SettingsIcon className="mr-2 h-4 w-4" />
            {t('dashboard.hackathon_settings', 'Hackathon Settings')}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
