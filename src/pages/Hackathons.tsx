import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDateRange, HackathonStatus } from '@/lib/types'
import { Calendar, MapPin, Settings, Check, Loader2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'

const STATUS_OPTIONS: HackathonStatus[] = ['draft', 'upcoming', 'active', 'judging', 'completed']

export function Hackathons() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { adminBasePath } = useAdminRoutes()
  const navigate = useNavigate()
  const { activeHackathon, setActiveHackathonId, hackathons, isLoading, refreshHackathons } = useActiveHackathon()
  const isAdmin = user?.role === 'admin'
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [newHackathon, setNewHackathon] = React.useState({
    title: '',
    tagline: '',
    startAt: '',
    endAt: '',
  })
  const hasInvalidCreateDateRange = Boolean(
    newHackathon.startAt && newHackathon.endAt && newHackathon.startAt > newHackathon.endAt
  )
  const canCreateHackathon = Boolean(
    newHackathon.title.trim()
      && newHackathon.tagline.trim()
      && newHackathon.startAt
      && newHackathon.endAt
      && !hasInvalidCreateDateRange
  )

  const handleCreate = async () => {
    if (!canCreateHackathon) {
      if (hasInvalidCreateDateRange) {
        toast.error(t('submission.validation.date_order_invalid'))
      }
      return
    }
    setCreating(true)
    try {
      const created = await api.createHackathon({
        title: newHackathon.title.trim(),
        tagline: newHackathon.tagline.trim(),
        startAt: newHackathon.startAt,
        endAt: newHackathon.endAt,
        status: 'draft',
      })
      refreshHackathons()
      setActiveHackathonId(created.id)
      setCreateOpen(false)
      setNewHackathon({ title: '', tagline: '', startAt: '', endAt: '' })
      toast.success(t('hackathons.create_success', 'Hackathon created'))
      navigate(buildAdminPath(adminBasePath, `hackathons/${created.id}`))
    } catch {
      toast.error(t('hackathons.create_error', 'Failed to create hackathon'))
    } finally {
      setCreating(false)
    }
  }

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
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('hackathons.create', 'Create Hackathon')}
            </Button>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {hackathons.map((h) => {
            const isSelected = activeHackathon.id === h.id
            return (
              <Card
                key={h.id}
                className={cn(
                  "surface-panel border-none shadow-none transition-all",
                  isSelected && "ring-2 ring-primary/40 ring-offset-2 ring-offset-transparent",
                  isAdmin && "cursor-pointer"
                )}
                onClick={() => {
                  if (isAdmin) {
                    navigate(buildAdminPath(adminBasePath, `hackathons/${h.id}`))
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
                                className="h-7 w-auto gap-1 rounded-full bg-background/60 px-3 text-xs font-medium backdrop-blur border-0 dark:bg-slate-900/60"
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
                            <div className="inline-flex items-center rounded-full bg-background/60 px-3 py-1 text-xs font-medium text-foreground/80 backdrop-blur dark:bg-slate-900/60">
                              {t(`hackathons.status.${h.status}`)}
                            </div>
                          )}
                          {h.source && h.source !== 'openhackathon' && (
                            <div className="inline-flex items-center rounded-full bg-purple-500/20 px-2.5 py-1 text-xs font-medium text-purple-700 dark:text-purple-300">
                              {h.organizer || h.source}
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
                            className="rounded-full bg-background/40 backdrop-blur hover:bg-background/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSwitchAndNavigate(h.id, buildAdminPath(adminBasePath, `hackathons/${h.id}/settings`))
                            }}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          className="rounded-full bg-background/40 backdrop-blur hover:bg-background/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSwitchAndNavigate(h.id, buildAdminPath(adminBasePath, 'projects'))
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('hackathons.create', 'Create Hackathon')}</DialogTitle>
            <DialogDescription>{t('hackathons.create_desc', 'Fill in the basics to get started. You can configure everything else later.')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">{t('common.required_fields_hint')}</p>
            <div className="space-y-2">
              <Label htmlFor="new-title">
                {t('hackathons.title')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="new-title"
                placeholder={t('hackathons.title')}
                value={newHackathon.title}
                onChange={(e) => setNewHackathon((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-tagline">
                {t('hackathons.tagline')}
                <span className="ml-1 text-destructive">*</span>
              </Label>
              <Input
                id="new-tagline"
                placeholder={t('hackathons.tagline')}
                value={newHackathon.tagline}
                onChange={(e) => setNewHackathon((prev) => ({ ...prev, tagline: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new-start">
                  {t('hackathons.start_date')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  id="new-start"
                  type="date"
                  value={newHackathon.startAt}
                  onChange={(e) => setNewHackathon((prev) => ({ ...prev, startAt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-end">
                  {t('hackathons.end_date')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  id="new-end"
                  type="date"
                  value={newHackathon.endAt}
                  onChange={(e) => setNewHackathon((prev) => ({ ...prev, endAt: e.target.value }))}
                />
              </div>
            </div>
            {hasInvalidCreateDateRange && (
              <p className="text-sm text-destructive">{t('submission.validation.date_order_invalid')}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !canCreateHackathon}
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('hackathons.create', 'Create Hackathon')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
