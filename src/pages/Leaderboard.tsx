import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { projects } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Trophy, Medal, Award, Star } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export function Leaderboard() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()

  const rankedProjects = useMemo(() => {
    return projects
      .filter(p => p.hackathonId === activeHackathon.id)
      .sort((a, b) => b.score - a.score)
  }, [activeHackathon.id])

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 1:
        return <Medal className="h-6 w-6 text-slate-400" />
      case 2:
        return <Award className="h-6 w-6 text-amber-600" />
      default:
        return <span className="text-lg font-bold text-muted-foreground w-6 text-center">{index + 1}</span>
    }
  }

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "bg-yellow-500/10 border-yellow-500/20"
      case 1:
        return "bg-slate-400/10 border-slate-400/20"
      case 2:
        return "bg-amber-600/10 border-amber-600/20"
      default:
        return "bg-card"
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <section className="container py-10 md:py-14">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{t('leaderboard.title', 'Leaderboard')}</h1>
            <p className="text-muted-foreground">{t('leaderboard.subtitle', 'Live rankings based on judge scores.')}</p>
          </div>

          <div className="grid gap-4">
            {rankedProjects.map((project, index) => (
              <Card
                key={project.id}
                className={cn(
                  "border shadow-sm transition-all hover:shadow-md",
                  getRankColor(index)
                )}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="flex h-12 w-12 items-center justify-center shrink-0">
                    {getRankIcon(index)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold truncate">{project.title}</h3>
                      <div className="flex gap-1">
                        {project.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-background/50 text-xs font-medium text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{project.oneLiner}</p>
                  </div>

                  <div className="flex items-center gap-6 shrink-0">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 text-lg font-bold text-primary">
                        <Star className="h-4 w-4 fill-primary text-primary" />
                        {project.score.toFixed(1)}
                      </div>
                      <span className="text-xs text-muted-foreground">{t('projects.score')}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
