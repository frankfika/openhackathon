import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useAuth } from '@/lib/auth'
import { Trophy, Medal, Award, Star, Loader2, Pencil, Save, Eye, EyeOff, GripVertical, Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

type LeaderboardEntry = {
  projectId: string
  rank: number
  award: string
}

export function Leaderboard() {
  const { t } = useTranslation()
  const location = useLocation()
  const { activeHackathon } = useActiveHackathon()
  const { user } = useAuth()
  const queryClient = useQueryClient()

  // Only show admin controls when inside /dashboard
  const isDashboard = location.pathname.startsWith('/dashboard')
  const isAdmin = user?.role === 'admin' && isDashboard

  const [editing, setEditing] = useState(false)
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [published, setPublished] = useState(false)

  // Fetch leaderboard (public view)
  const { data: rankedProjects = [], isLoading } = useQuery({
    queryKey: ['leaderboard', activeHackathon?.id],
    queryFn: () => api.getLeaderboard({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id,
  })

  // Fetch admin config (always fetch so public can check published status)
  const { data: config } = useQuery({
    queryKey: ['leaderboard-config', activeHackathon?.id],
    queryFn: () => api.getLeaderboardConfig(activeHackathon!.id),
    enabled: !!activeHackathon?.id,
  })

  // Fetch all projects for admin to pick from
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects', activeHackathon?.id],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id }),
    enabled: !!activeHackathon?.id && isAdmin && editing,
  })

  useEffect(() => {
    if (config) {
      setEntries((config.leaderboardData as LeaderboardEntry[]) || [])
      setPublished(config.leaderboardPublished || false)
    }
  }, [config])

  const saveMutation = useMutation({
    mutationFn: (data: { entries: LeaderboardEntry[]; published: boolean }) =>
      api.saveLeaderboard(activeHackathon!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      queryClient.invalidateQueries({ queryKey: ['leaderboard-config'] })
      toast.success(t('leaderboard.saved'))
      setEditing(false)
    },
    onError: () => toast.error(t('leaderboard.save_failed')),
  })

  const handleSave = (pub: boolean) => {
    saveMutation.mutate({ entries, published: pub })
    setPublished(pub)
  }

  const addEntry = (projectId: string) => {
    if (entries.some(e => e.projectId === projectId)) return
    setEntries([...entries, { projectId, rank: entries.length + 1, award: '' }])
  }

  const removeEntry = (projectId: string) => {
    const updated = entries.filter(e => e.projectId !== projectId)
      .map((e, i) => ({ ...e, rank: i + 1 }))
    setEntries(updated)
  }

  const updateAward = (projectId: string, award: string) => {
    setEntries(entries.map(e => e.projectId === projectId ? { ...e, award } : e))
  }

  const moveEntry = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= entries.length) return
    const updated = [...entries]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    setEntries(updated.map((e, i) => ({ ...e, rank: i + 1 })))
  }

  const getProjectTitle = (projectId: string) => {
    const fromRanked = rankedProjects.find(p => p.id === projectId)
    if (fromRanked) return fromRanked.title
    const fromAll = allProjects.find((p: any) => p.id === projectId)
    return fromAll?.title || projectId
  }

  const getProjectOneLiner = (projectId: string) => {
    const fromRanked = rankedProjects.find(p => p.id === projectId)
    if (fromRanked) return fromRanked.oneLiner
    const fromAll = allProjects.find((p: any) => p.id === projectId)
    return fromAll?.oneLiner || ''
  }

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-6 w-6 text-yellow-500" />
      case 1: return <Medal className="h-6 w-6 text-slate-400" />
      case 2: return <Award className="h-6 w-6 text-amber-600" />
      default: return <span className="text-lg font-bold text-muted-foreground w-6 text-center">{index + 1}</span>
    }
  }

  const getRankColor = (index: number) => {
    switch (index) {
      case 0: return "bg-yellow-500/10 border-yellow-500/20"
      case 1: return "bg-slate-400/10 border-slate-400/20"
      case 2: return "bg-amber-600/10 border-amber-600/20"
      default: return "bg-card"
    }
  }

  // Public view: if not published, show placeholder
  const isPublicView = !isDashboard
  const isPublished = config?.leaderboardPublished ?? false

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Public: leaderboard hidden by admin
  if (isPublicView && !isPublished) {
    return (
      <div className="flex-1">
        <section className="container py-6 md:py-14">
          <div className="space-y-2 mb-8">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('leaderboard.title')}</h1>
            <p className="text-sm md:text-base text-muted-foreground">{t('leaderboard.subtitle')}</p>
          </div>
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg">{t('leaderboard.not_published_yet')}</p>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="flex-1">
      <section className="container py-6 md:py-14">
        <div className="space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('leaderboard.title')}</h1>
                {isAdmin && (
                  <Badge variant={published ? "default" : "secondary"}>
                    {published ? t('leaderboard.published') : t('leaderboard.draft')}
                  </Badge>
                )}
              </div>
              <p className="text-sm md:text-base text-muted-foreground">{t('leaderboard.subtitle')}</p>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                {!editing ? (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    {t('leaderboard.edit_rankings')}
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
                    <Button variant="outline" onClick={() => handleSave(false)} disabled={saveMutation.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      {t('leaderboard.save_draft')}
                    </Button>
                    <Button onClick={() => handleSave(true)} disabled={saveMutation.isPending}>
                      {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                      {t('leaderboard.publish')}
                    </Button>
                  </>
                )}
                {!editing && published && (
                  <Button variant="ghost" onClick={() => handleSave(false)}>
                    <EyeOff className="h-4 w-4 mr-2" />
                    {t('leaderboard.unpublish')}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Admin editing mode */}
          {isAdmin && editing && (
            <div className="space-y-4">
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">{t('leaderboard.add_projects')}</p>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
                    {allProjects
                      .filter((p: any) => !entries.some(e => e.projectId === p.id))
                      .map((p: any) => (
                        <Button key={p.id} variant="outline" size="sm" onClick={() => addEntry(p.id)}>
                          <Plus className="h-3 w-3 mr-1" />
                          {p.title}
                        </Button>
                      ))}
                    {allProjects.filter((p: any) => !entries.some(e => e.projectId === p.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground">{t('leaderboard.all_added')}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3">
                {entries.map((entry, index) => (
                  <Card key={entry.projectId} className={cn("border shadow-sm", getRankColor(index))}>
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEntry(index, -1)} disabled={index === 0}>
                          <span className="text-xs">▲</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveEntry(index, 1)} disabled={index === entries.length - 1}>
                          <span className="text-xs">▼</span>
                        </Button>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center shrink-0">
                        {getRankIcon(index)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{getProjectTitle(entry.projectId)}</h3>
                        <p className="text-xs text-muted-foreground truncate">{getProjectOneLiner(entry.projectId)}</p>
                      </div>
                      <Input
                        className="w-40"
                        placeholder={t('leaderboard.award_placeholder')}
                        value={entry.award}
                        onChange={e => updateAward(entry.projectId, e.target.value)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeEntry(entry.projectId)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {entries.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('leaderboard.empty_hint')}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Display mode */}
          {!editing && (
            <div className="grid gap-3 md:gap-4">
              {rankedProjects.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {t('leaderboard.no_projects', 'No projects scored yet')}
                </div>
              )}
              {rankedProjects.map((project, index) => (
                <Card
                  key={project.id}
                  className={cn("border shadow-sm transition-all hover:shadow-md", getRankColor(index))}
                >
                  <CardContent className="flex items-center gap-3 md:gap-4 p-4 md:p-6">
                    <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center shrink-0">
                      {getRankIcon(index)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-2 mb-1">
                        <h3 className="text-base md:text-lg font-semibold truncate">{project.title}</h3>
                        {(project as any).award && (
                          <Badge variant="default" className="w-fit">{(project as any).award}</Badge>
                        )}
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
          )}
        </div>
      </section>
    </div>
  )
}
