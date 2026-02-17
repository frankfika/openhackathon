import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { hackathons, projects, users } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Plus, Users, FolderGit2, Gavel, BarChart3, Settings as SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function AdminDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeHackathon } = useActiveHackathon()

  const hackathonProjects = projects.filter(p => p.hackathonId === activeHackathon.id)
  const hackathonJudges = users.filter(u => u.role === 'judge')
  const hackathonParticipants = users.filter(u => u.role === 'user')

  const stats = [
    { label: t('dashboard.stats.participants', 'Participants'), value: hackathonParticipants.length, icon: Users, color: 'text-green-600 bg-green-100' },
    { label: t('dashboard.stats.total_projects', 'Projects'), value: hackathonProjects.length, icon: FolderGit2, color: 'text-blue-600 bg-blue-100' },
    { label: t('dashboard.stats.judges', 'Judges'), value: hackathonJudges.length, icon: Gavel, color: 'text-purple-600 bg-purple-100' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.admin.title', 'Admin Dashboard')}</h1>
          <p className="text-muted-foreground">{activeHackathon.title}</p>
        </div>
        <div className="flex gap-2">
           <Button onClick={() => navigate('/dashboard/hackathons/new')}>
            <Plus className="mr-2 h-4 w-4" />
            {t('dashboard.create_hackathon', 'Create Hackathon')}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((stat, index) => (
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('dashboard.all_hackathons', 'All Hackathons')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {hackathons.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="font-medium leading-none">{h.title}</p>
                    <p className="text-sm text-muted-foreground">{h.status}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/dashboard/hackathons/${h.id}/settings`)}>
                    {t('common.manage', 'Manage')}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-0 shadow-sm">
          <CardHeader>
            <CardTitle>{t('dashboard.quick_actions', 'Quick Actions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/projects')}>
              <FolderGit2 className="mr-2 h-4 w-4" />
              {t('dashboard.view_submissions', 'View Submissions')}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/judging')}>
              <Gavel className="mr-2 h-4 w-4" />
              {t('dashboard.manage_judging', 'Manage Judging')}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/dashboard/leaderboard')}>
              <BarChart3 className="mr-2 h-4 w-4" />
              {t('nav.leaderboard', 'Leaderboard')}
            </Button>
            <Button variant="outline" className="w-full justify-start" onClick={() => navigate(`/dashboard/hackathons/${activeHackathon.id}/settings`)}>
              <SettingsIcon className="mr-2 h-4 w-4" />
              {t('dashboard.hackathon_settings', 'Hackathon Settings')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
