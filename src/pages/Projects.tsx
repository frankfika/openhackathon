import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { projects as allProjects, hackathons } from '@/lib/mock-data'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Search, SlidersHorizontal, Plus, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'

export function Projects() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeHackathon } = useActiveHackathon()
  const [query, setQuery] = useState('')

  // Filter projects by active hackathon and search query
  const projects = useMemo(() => {
    const scoped = allProjects.filter(p => p.hackathonId === activeHackathon.id)
    if (!query) return scoped
    const lowerQuery = query.toLowerCase()
    return scoped.filter(
      (p) =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.oneLiner.toLowerCase().includes(lowerQuery) ||
        p.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
    )
  }, [query, activeHackathon.id])

  return (
    <div className="flex-1">
      <section className="container py-6 md:py-14">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight md:text-4xl">{t('projects.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{t('projects.subtitle')}</p>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('projects.search_placeholder')}
                className="h-10 w-full rounded-full border border-input bg-background pl-10 pr-4 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button variant="outline" className="rounded-full">
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              {t('projects.filters')}
            </Button>
            {user && (
              <Button onClick={() => navigate('/dashboard/projects/submit')} className="rounded-full">
                <Plus className="mr-2 h-4 w-4" />
                {t('projects.submit', 'Submit')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 md:mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const hackathon = hackathons.find((h) => h.id === p.hackathonId)

            return (
              <Card key={p.id} className="border-0 shadow-sm flex flex-col h-full hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <CardTitle className="text-lg line-clamp-1">{p.title}</CardTitle>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {p.score > 0 && (
                        <span className="font-medium text-foreground">{p.score.toFixed(1)} <span className="text-muted-foreground text-[10px]">/ 10</span></span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {hackathon?.title}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 flex-1">
                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
                    {p.oneLiner}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {p.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                      >
                        {t}
                      </span>
                    ))}
                    {p.tags.length > 3 && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        +{p.tags.length - 3}
                      </span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between group text-muted-foreground hover:text-foreground"
                    onClick={() => navigate(`/dashboard/judging/${p.id}`)} // Reusing JudgingDetail as ProjectDetail for now
                  >
                    <span className="text-sm">{t('common.details', 'View Details')}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
