import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { hackathons, formatDateRange } from '@/lib/mock-data'
import { ArrowRight, Calendar, MapPin, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'

export function Hackathons() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <section className="container py-10 md:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight md:text-2xl">{t('hackathons.more_events')}</h2>
            <p className="text-sm text-muted-foreground md:text-base">
              {t('hackathons.more_desc')}
            </p>
          </div>
          <Link to="/dashboard">
            <Button variant="outline" className="h-11 rounded-full bg-background/70 px-6 backdrop-blur hover:bg-background">
              {t('hackathons.enter_workbench')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {hackathons.map((h) => (
            <Card key={h.id} className="border-0 bg-white/60 shadow-sm backdrop-blur">
              <CardContent className="p-0">
                <div className={`rounded-xl bg-gradient-to-br ${h.coverGradient} p-6`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="inline-flex items-center rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur">
                        {t(`hackathons.status.${h.status}`)}
                      </div>
                      <h2 className="text-xl font-semibold tracking-tight">
                        {h.title}
                      </h2>
                      <p className="text-sm text-foreground/70">
                        {h.tagline}
                      </p>
                    </div>
                    <div className="flex gap-2">
                    {user?.role === 'admin' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full bg-white/40 backdrop-blur hover:bg-white/60"
                        onClick={() => navigate(`/dashboard/hackathons/${h.id}/settings`)}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    )}
                    <Link to="/dashboard/projects">
                      <Button variant="outline" className="rounded-full bg-white/40 backdrop-blur hover:bg-white/60">
                        {t('hackathons.view_projects')}
                      </Button>
                    </Link>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-foreground/70">
                    <div className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDateRange(h.startAt, h.endAt)}
                    </div>
                    {h.city ? (
                      <div className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {h.city}
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
