import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { projects as allProjects, hackathons, sessions } from '@/lib/mock-data'
import { ExternalLink, Github, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Projects() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')

  const projects = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allProjects
    return allProjects.filter((p) => {
      const haystack = `${p.title} ${p.oneLiner} ${p.tags.join(' ')}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [query])

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <section className="container py-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{t('projects.title')}</h1>
            <p className="text-muted-foreground">{t('projects.subtitle')}</p>
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
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const hackathon = hackathons.find((h) => h.id === p.hackathonId)
            const session = sessions.find((s) => s.id === p.sessionId)

            return (
              <Card key={p.id} className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{p.title}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {hackathon?.title} · {session?.name}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-foreground/80 leading-relaxed">{p.oneLiner}</p>
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-apple-blue/10 px-2.5 py-1 text-xs font-medium text-apple-blue"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{p.score.toFixed(1)}</span>
                      <span> {t('projects.score')} · </span>
                      <span className="font-medium text-foreground">{p.votes}</span>
                      <span> {t('projects.votes')}</span>
                    </div>
                    <div className="flex gap-2">
                      {p.repoUrl ? (
                        <a href={p.repoUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="icon" className="rounded-full">
                            <Github className="h-4 w-4" />
                          </Button>
                        </a>
                      ) : null}
                      {p.demoUrl ? (
                        <a href={p.demoUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="icon" className="rounded-full">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}

