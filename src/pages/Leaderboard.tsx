import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Trophy, Medal, Award, Star, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

export function Leaderboard() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()

  // Fetch leaderboard from API
  const { data: rankedProjects = [], isLoading } = useQuery({
    queryKey: ['leaderboard', activeHackathon?.id],
    queryFn: () => api.getLeaderboard({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1">
      <section className="container py-6 md:py-14">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('leaderboard.title', 'Leaderboard')}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{t('leaderboard.subtitle', 'Live rankings based on judge scores.')}</p>
          </div>

          <div className="grid gap-3 md:gap-4">
            {rankedProjects.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {t('leaderboard.no_projects', 'No projects scored yet')}
              </div>
            )}
            {rankedProjects.map((project, index) => (
              <Card
                key={project.id}
                className={cn(
                  "border shadow-sm transition-all hover:shadow-md",
                  getRankColor(index)
                )}
              >
                <CardContent className="flex items-center gap-3 md:gap-4 p-4 md:p-6">
                  <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center shrink-0">
                    {getRankIcon(index)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-1">
                      <h3 className="text-base md:text-lg font-semibold truncate">{project.title}</h3>
                      <div className="flex flex-wrap gap-1">
                        {project.tags?.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full bg-background/50 text-[10px] md:text-xs font-medium text-muted-foreground">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{project.oneLiner}</p>
                  </div>

                  <div className="flex items-center gap-3 md:gap-6 shrink-0">
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 text-base md:text-lg font-bold text-primary">
                        <Star className="h-3 w-3 md:h-4 md:w-4 fill-primary text-primary" />
                        {project.avgScore > 0 ? project.avgScore.toFixed(1) : '-'}
                      </div>
                      <span className="text-[10px] md:text-xs text-muted-foreground">/ {project.maxPossible}</span>
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
