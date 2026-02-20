import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateRange, HackathonStatus } from '@/lib/types'
import { ArrowRight, Calendar, MapPin, Settings, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'

const STATUS_OPTIONS: HackathonStatus[] = ['draft', 'upcoming', 'active', 'judging', 'completed']

export function Hackathons() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { activeHackathon, setActiveHackathonId, hackathons, isLoading, refreshHackathons } = useActiveHackathon()
  const isAdmin = user?.role === 'admin'
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

  const handleSwitchAndNavigate = (hackathonId: string, path: string) => {
    setActiveHackathonId(hackathonId)
    navigate(path)
  }

  const handleStatusChange = async (hackathonId: string, newStatus: HackathonStatus) => {
    setUpdatingId(hackathonId)
    try {
      await api.updateHackathon(hackathonId, { status: newStatus })
      refreshHackathons()
      toast.success(t('hackathons.status_updated', 'Status updated'))
    } catch {
      toast.error(t('hackathons.status_error', 'Failed to update status'))
    } finally {
      setUpdatingId(null)
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
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg md:text-xl font-semibold tracking-tight md:text-2xl">{t('hackathons.more_events')}</h2>
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
          {hackathons.map((h) => {
            const isSelected = activeHackathon.id === h.id
            return (
              <Card
                key={h.id}
                className={cn(
                  "border-0 bg-white/60 shadow-sm backdrop-blur transition-all",
                  isSelected && "ring-2 ring-primary ring-offset-2",
                  isAdmin && !isSelected && "cursor-pointer hover:shadow-md"
                )}
                onClick={() => {
                  if (isAdmin && !isSelected) {
                    setActiveHackathonId(h.id)
                  }
                }}
              >
                <CardContent className="p-0">
                  <div className={`rounded-xl bg-gradient-to-br ${h.coverGradient} p-6`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <Select
                              value={h.status}
                              onValueChange={(val) => handleStatusChange(h.id, val as HackathonStatus)}
                              disabled={updatingId === h.id}
                            >
                              <SelectTrigger
                                className="h-7 w-auto gap-1 rounded-full bg-white/60 px-3 text-xs font-medium backdrop-blur border-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {updatingId === h.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <SelectValue />
                                )}
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {t(`hackathons.status.${s}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="inline-flex items-center rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur">
                              {t(`hackathons.status.${h.status}`)}
                            </div>
                          )}
                          {isSelected && (
                            <div className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
                              <Check className="h-3 w-3" />
                              {t('hackathons.current', 'Current')}
                            </div>
                          )}
                        </div>
                        <h2 className="text-xl font-semibold tracking-tight">
                          {h.title}
                        </h2>
                        <p className="text-sm text-foreground/70">
                          {h.tagline}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-full bg-white/40 backdrop-blur hover:bg-white/60"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSwitchAndNavigate(h.id, `/dashboard/hackathons/${h.id}/settings`)
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="rounded-full bg-white/40 backdrop-blur hover:bg-white/60"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSwitchAndNavigate(h.id, '/dashboard/projects')
                          }}
                        >
                          {t('hackathons.view_projects')}
                        </Button>
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
            )
          })}
        </div>
      </section>
    </div>
  )
}
