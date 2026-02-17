import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { projects } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Plus, Calendar, MapPin, Rocket } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function HackerDashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { activeHackathon } = useActiveHackathon()

  // Mocking "My Projects" - in a real app, this would filter by user ID
  const myProjects = projects.slice(0, 2)

  return (
    <div className="space-y-4 md:space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('dashboard.hacker.title', 'Welcome back, Hacker!')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{t('dashboard.hacker.subtitle', 'Ready to build something amazing?')}</p>
        </div>
        <Button onClick={() => navigate('/dashboard/projects/submit')} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          {t('dashboard.hacker.submit_project', 'Submit New Project')}
        </Button>
      </div>

      <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{t('dashboard.hacker.current_event', 'Current Event')}</h2>
            </div>
            <div className="grid gap-4">
              <Card className="group border-0 shadow-sm overflow-hidden hover:shadow-md transition-all duration-300">
                <div className={`h-2 bg-gradient-to-r ${activeHackathon.coverGradient}`} />
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary mb-1">
                        {t(`hackathons.status.${activeHackathon.status}`)}
                      </div>
                      <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{activeHackathon.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-1">{activeHackathon.tagline}</p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {activeHackathon.startAt} - {activeHackathon.endAt}
                        </div>
                        {activeHackathon.city && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {activeHackathon.city}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                      {t('common.details', 'Details')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        </div>

        <div className="col-span-3 space-y-6">
          <Card className="border-0 shadow-sm bg-slate-50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-indigo-500" />
                {t('dashboard.hacker.my_projects', 'My Projects')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {myProjects.map((p) => (
                  <div key={p.id} className="bg-background rounded-lg p-3 border shadow-sm hover:border-primary/50 transition-colors cursor-pointer" onClick={() => navigate(`/dashboard/projects/${p.id}`)}>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.oneLiner}</div>
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex gap-1">
                        {p.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 bg-secondary text-[10px] rounded-sm text-secondary-foreground">{tag}</span>
                        ))}
                      </div>
                      <div className="text-xs font-medium text-primary">
                        {p.status === 'draft' ? 'Draft' : 'Submitted'}
                      </div>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" className="w-full text-sm text-muted-foreground hover:text-primary" onClick={() => navigate('/dashboard/projects')}>
                  {t('dashboard.hacker.view_all_projects', 'View all my projects')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
