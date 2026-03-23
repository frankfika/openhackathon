import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import {
  Loader2, Shuffle, Search, Download,
  Plus, X, Grid3X3, List, RotateCcw, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { planBalancedRandomAssignments } from '@/lib/assignment-planner'
import { getFilterableSubmissionFields, getFieldLabel, getProjectSubmissionFieldValue, getSubmissionFieldFilterOptions } from '@/lib/submission-fields'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed'
type ViewMode = 'list' | 'matrix'

export function AssignmentManager() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { adminBasePath } = useAdminRoutes()
  const [searchParams] = useSearchParams()
  const [projectQuery, setProjectQuery] = useState('')
  const [submissionFilters, setSubmissionFilters] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [judgesPerProject, setJudgesPerProject] = useState<number | null>(null)
  const [displayPage, setDisplayPage] = useState(1)
  const DISPLAY_PAGE_SIZE = 50
  const focusedJudgeId = searchParams.get('judgeId') || ''
  const hackathonId = activeHackathon?.id

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', hackathonId, 'lite'],
    queryFn: () => api.getProjects({ hackathonId, lite: true }),
    enabled: !!hackathonId,
    staleTime: 30_000,
  })

  const { data: judges = [], isLoading: isLoadingJudges } = useQuery({
    queryKey: ['hackathon-judges', hackathonId],
    queryFn: () => api.getHackathonJudges(activeHackathon.id),
    enabled: !!hackathonId,
    staleTime: 30_000,
  })

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', hackathonId, 'lite'],
    queryFn: async () => {
      if (!hackathonId) return []
      return api.getAssignments({ hackathonId, lite: true })
    },
    enabled: !!hackathonId,
    staleTime: 30_000,
  })

  const judgeMap = useMemo(() => new Map(judges.map(j => [j.id, j])), [judges])

  const filterableFields = useMemo(
    () => getFilterableSubmissionFields(activeHackathon?.submissionSchema),
    [activeHackathon?.submissionSchema]
  )

  useEffect(() => {
    const allowedFieldIds = new Set(filterableFields.map((field) => field.id))
    setSubmissionFilters((previous) => {
      const nextEntries = Object.entries(previous).filter(([fieldId, value]) => allowedFieldIds.has(fieldId) && value)
      return Object.fromEntries(nextEntries)
    })
  }, [filterableFields])

  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; judgeId: string }[]) => api.createAssignments(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assignments'] }) },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.deleteAssignment(id, force),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['assignments'] }) },
  })

  const resetMutation = useMutation({
    mutationFn: (hId: string) => api.resetAssignments(hId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success(t('assignments.reset_success', { count: data.deleted }))
    },
    onError: () => { toast.error(t('assignments.reset_failed')) },
  })

  // O(1) assignment lookup by project+judge key
  const assignmentIndex = useMemo(() => {
    const map = new Map<string, typeof assignments[number]>()
    for (const a of assignments) {
      map.set(`${a.projectId}:${a.judgeId}`, a)
    }
    return map
  }, [assignments])

  const getAssignment = (projectId: string, judgeId: string) =>
    assignmentIndex.get(`${projectId}:${judgeId}`)

  const updateSubmissionFilter = (fieldId: string, value: string) =>
    setSubmissionFilters(prev => value ? { ...prev, [fieldId]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== fieldId)))

  const clearFilters = () => { setProjectQuery(''); setSubmissionFilters({}) }

  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLowerCase()
    return projects.filter((project) => {
      if (normalizedQuery) {
        const searchableText = [
          project.title, project.oneLiner, project.submitterName, project.submitterEmail,
          ...(project.tags || []),
          ...filterableFields.map((field) => getProjectSubmissionFieldValue(project, field.id)),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!searchableText.includes(normalizedQuery)) return false
      }
      for (const [fieldId, selectedValue] of Object.entries(submissionFilters)) {
        if (!selectedValue) continue
        if (getProjectSubmissionFieldValue(project, fieldId) !== selectedValue) return false
      }
      return true
    })
  }, [projects, projectQuery, submissionFilters, filterableFields])

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((project) => project.id)),
    [filteredProjects]
  )

  // Precomputed judge assignment counts (scoped to filtered projects)
  const judgeAssignmentCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of assignments) {
      if (filteredProjectIds.has(a.projectId)) {
        counts.set(a.judgeId, (counts.get(a.judgeId) || 0) + 1)
      }
    }
    return counts
  }, [assignments, filteredProjectIds])

  // Per-project assignments lookup
  const projectAssignmentsMap = useMemo(() => {
    const map = new Map<string, typeof assignments>()
    for (const a of assignments) {
      const list = map.get(a.projectId) || []
      list.push(a)
      map.set(a.projectId, list)
    }
    return map
  }, [assignments])

  // Per-project stats (single pass per project)
  const projectStats = useMemo(() => {
    const map = new Map<string, {
      totalAssignments: number; completedAssignments: number
      pendingAssignments: number; inProgressAssignments: number
      totalScore: number; averageScore: number
    }>()
    for (const project of filteredProjects) {
      const pa = projectAssignmentsMap.get(project.id) || []
      let completedCount = 0, pendingCount = 0, inProgressCount = 0, totalScore = 0
      for (const a of pa) {
        if (a.status === 'completed') { completedCount++; totalScore += a.totalScore || 0 }
        else if (a.status === 'pending') pendingCount++
        else if (a.status === 'in_progress') inProgressCount++
      }
      map.set(project.id, {
        totalAssignments: pa.length, completedAssignments: completedCount,
        pendingAssignments: pendingCount, inProgressAssignments: inProgressCount,
        totalScore, averageScore: completedCount > 0 ? totalScore / completedCount : 0,
      })
    }
    return map
  }, [filteredProjects, projectAssignmentsMap])

  // Aggregate stats
  const stats = useMemo(() => {
    const entries = Array.from(projectStats.values())
    const totalAssignments = entries.reduce((sum, s) => sum + s.totalAssignments, 0)
    const completedAssignments = entries.reduce((sum, s) => sum + s.completedAssignments, 0)
    const totalCompletedScore = entries.reduce((sum, s) => sum + s.totalScore, 0)
    const avgScore = completedAssignments > 0 ? totalCompletedScore / completedAssignments : 0
    const completionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0
    return { totalProjects: entries.length, avgScore: avgScore.toFixed(1), completionRate: completionRate.toFixed(0), completedAssignments, totalAssignments }
  }, [projectStats])

  // Status-filtered projects
  const statusFilteredProjects = useMemo(() => {
    if (statusFilter === 'all') return filteredProjects
    return filteredProjects.filter((project) => {
      const s = projectStats.get(project.id)
      if (!s) return false
      if (statusFilter === 'pending') return s.pendingAssignments > 0
      if (statusFilter === 'in_progress') return s.inProgressAssignments > 0
      return s.totalAssignments > 0 && s.completedAssignments === s.totalAssignments
    })
  }, [filteredProjects, statusFilter, projectStats])

  const filterCounts = useMemo(() => {
    let pending = 0, in_progress = 0, completed = 0
    for (const p of filteredProjects) {
      const s = projectStats.get(p.id)
      if (!s) continue
      if (s.pendingAssignments > 0) pending++
      if (s.inProgressAssignments > 0) in_progress++
      if (s.totalAssignments > 0 && s.completedAssignments === s.totalAssignments) completed++
    }
    return { all: filteredProjects.length, pending, in_progress, completed }
  }, [filteredProjects, projectStats])

  const sortedProjects = useMemo(() => {
    return [...statusFilteredProjects].sort((a, b) => {
      const sa = projectStats.get(a.id)
      const sb = projectStats.get(b.id)
      return (sb?.averageScore ?? 0) - (sa?.averageScore ?? 0)
    })
  }, [statusFilteredProjects, projectStats])

  // Reset display page when filters change
  useEffect(() => { setDisplayPage(1) }, [projectQuery, submissionFilters, statusFilter])

  const displayTotalPages = Math.max(1, Math.ceil(sortedProjects.length / DISPLAY_PAGE_SIZE))
  const pagedProjects = useMemo(
    () => sortedProjects.slice((displayPage - 1) * DISPLAY_PAGE_SIZE, displayPage * DISPLAY_PAGE_SIZE),
    [sortedProjects, displayPage]
  )

  const createAssignments = async (rows: { projectId: string; judgeId: string }[], successMessage: string) => {
    if (rows.length === 0) { toast.message(t('assignments.no_changes')); return }
    try { await createMutation.mutateAsync(rows); toast.success(successMessage) }
    catch { toast.error(t('assignments.create_failed')) }
  }

  const removeAssignment = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id })
      toast.success(t('assignments.removed'))
    } catch (error: unknown) {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code
      toast.error(code === 'ALREADY_SCORED' ? t('assignments.remove_scored_blocked') : t('assignments.remove_failed'))
    }
  }

  const addAssignment = async (projectId: string, judgeId: string) => {
    if (!hackathonId) return
    await createAssignments([{ projectId, judgeId }], t('assignments.created'))
  }

  const toggleAssignment = async (projectId: string, judgeId: string) => {
    const existing = getAssignment(projectId, judgeId)
    if (existing) {
      if (existing.status !== 'pending') return
      await removeAssignment(existing.id)
    } else if (hackathonId) {
      await createAssignments([{ projectId, judgeId }], t('assignments.created'))
    }
  }

  const downloadCSV = () => {
    const headers = [t('reports.rank'), t('reports.project'), t('reports.submitter'), ...judges.map(j => j.name), t('reports.average'), t('reports.progress')]
    const rows = sortedProjects.map((project, index) => {
      const judgeCells = judges.map(judge => {
        const a = getAssignment(project.id, judge.id)
        if (!a) return ''
        if (a.status === 'completed' && a.totalScore != null) return `${a.totalScore}`
        return a.status
      })
      const s = projectStats.get(project.id)
      return [index + 1, `"${project.title}"`, `"${project.submitterName || project.submitterEmail}"`, ...judgeCells, s && s.averageScore > 0 ? s.averageScore.toFixed(1) : '-', `${s?.completedAssignments ?? 0}/${s?.totalAssignments ?? 0}`]
    })
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `review-management-${hackathonId}-${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const isMutating = createMutation.isPending || deleteMutation.isPending
  const activeFilterCount = (projectQuery.trim() ? 1 : 0) + Object.values(submissionFilters).filter(Boolean).length
  const isLoading = isLoadingProjects || isLoadingJudges || isLoadingAssignments
  // Count all pending assignments in hackathon (not just filtered), since reset is hackathon-wide
  const pendingCount = useMemo(() => {
    let count = 0
    for (const a of assignments) if (a.status === 'pending') count++
    return count
  }, [assignments])

  const effectiveJudgesPerProject = judgesPerProject ?? activeHackathon?.judgesPerProject ?? 2

  const randomPlan = useMemo(() => planBalancedRandomAssignments({
    projects,
    judgeIds: judges.map(j => j.id),
    existingAssignments: assignments,
    judgesPerProject: effectiveJudgesPerProject,
  }), [projects, judges, assignments, effectiveJudgesPerProject])

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('assignments.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('assignments.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadCSV}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {t('reports.download_csv')}
          </Button>
          <Button variant="outline" size="sm"
            disabled={isMutating || resetMutation.isPending || pendingCount === 0}
            onClick={() => {
              if (window.confirm(t('assignments.reset_confirm', { count: pendingCount }))) {
                resetMutation.mutate(hackathonId!)
              }
            }}
            className="gap-1.5 text-destructive hover:text-destructive">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('assignments.reset_title')}
          </Button>
          <div className="flex items-center gap-1">
            <Input
              type="number" min={1} max={Math.max(judges.length, 1)}
              value={effectiveJudgesPerProject}
              onChange={(e) => {
                const v = Number.parseInt(e.target.value, 10)
                setJudgesPerProject(Number.isFinite(v) && v > 0 ? v : null)
              }}
              className="h-8 w-16 text-center text-sm tabular-nums"
              title={t('assignments.judges_per_project')}
            />
            <Button size="sm"
              disabled={isMutating || !hackathonId || judges.length === 0 || projects.length === 0 || randomPlan.assignments.length === 0}
              onClick={() => {
                createAssignments(randomPlan.assignments, t('assignments.random_created', { count: randomPlan.assignments.length, judgesPerProject: effectiveJudgesPerProject }))
              }}
              className="gap-1.5">
              <Shuffle className="h-3.5 w-3.5" />
              {t('assignments.random_assign')}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
        <div>
          <span className="text-lg font-semibold">{stats.totalProjects}</span>
          <span className="ml-1.5 text-muted-foreground">{t('reports.total_projects')}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div>
          <span className="text-lg font-semibold">{stats.avgScore}</span>
          <span className="ml-1.5 text-muted-foreground">{t('reports.avg_score')}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div>
          <span className="text-lg font-semibold">{stats.completionRate}%</span>
          <span className="ml-1.5 text-muted-foreground">{t('reports.completion_rate')}</span>
          <span className="ml-1 text-xs text-muted-foreground">({stats.completedAssignments}/{stats.totalAssignments})</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div>
          <span className="text-lg font-semibold">{judges.length}</span>
          <span className="ml-1.5 text-muted-foreground">{t('reports.judges')}</span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] max-w-[280px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={projectQuery} onChange={(e) => setProjectQuery(e.target.value)}
            placeholder={t('assignments.search_projects_placeholder')} className="h-8 pl-8 text-sm" />
        </div>

        {filterableFields.map((field) => {
          const options = getSubmissionFieldFilterOptions(field, projects)
          return (
            <Select key={field.id} value={submissionFilters[field.id] || '__all__'}
              onValueChange={(value) => updateSubmissionFilter(field.id, value === '__all__' ? '' : value)}>
              <SelectTrigger className="h-8 w-[140px] text-sm">
                <SelectValue placeholder={getFieldLabel(field.id, field.label, t)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('assignments.all_filter_values')}</SelectItem>
                {options.map((option) => (<SelectItem key={option} value={option}>{option}</SelectItem>))}
              </SelectContent>
            </Select>
          )
        })}

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>{t('assignments.clear_filters')}</Button>
        )}

        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 mr-1">
          <button type="button" onClick={() => setViewMode('list')} title={t('assignments.view_list')}
            className={cn('rounded-md p-1.5 transition-colors', viewMode === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <List className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setViewMode('matrix')} title={t('assignments.view_matrix')}
            className={cn('rounded-md p-1.5 transition-colors', viewMode === 'matrix' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Status tabs */}
        <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
          {(['all', 'pending', 'in_progress', 'completed'] as const).map((status) => (
            <button key={status} type="button" onClick={() => setStatusFilter(status)}
              className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                statusFilter === status ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {t(`reports.filter_${status}`)}
              <span className="ml-1 tabular-nums">({filterCounts[status]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {judges.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('assignments.no_judges')}</p>
          <p className="text-xs mt-1">{t('assignments.no_judges_hint')}</p>
        </div>
      ) : sortedProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">{t('assignments.no_projects')}</div>
      ) : viewMode === 'list' ? (
        /* ── List view ── */
        <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">#</TableHead>
                <TableHead className="min-w-[180px]">{t('assignments.project')}</TableHead>
                <TableHead>{t('assignments.assigned_judges')}</TableHead>
                <TableHead className="text-center w-[70px]">{t('reports.average')}</TableHead>
                <TableHead className="text-center w-[70px]">{t('reports.progress')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProjects.map((project, index) => {
                const globalIndex = (displayPage - 1) * DISPLAY_PAGE_SIZE + index
                const s = projectStats.get(project.id)
                const pa = projectAssignmentsMap.get(project.id) || []
                const unassignedJudges = judges.filter(j => !pa.some(a => a.judgeId === j.id))

                return (
                  <TableRow key={project.id}>
                    <TableCell className="text-center text-muted-foreground text-xs tabular-nums">{globalIndex + 1}</TableCell>
                    <TableCell>
                      <button type="button"
                        onClick={() => navigate(`${buildAdminPath(adminBasePath, `projects/${project.id}`)}?tab=scores`)}
                        className="truncate text-sm text-left hover:underline block max-w-[220px] font-medium">
                        {project.title}
                      </button>
                      {project.submitterName && (
                        <p className="truncate text-[11px] text-muted-foreground max-w-[220px]">{project.submitterName}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pa.map((a) => {
                          const judge = judgeMap.get(a.judgeId)
                          if (!judge) return null
                          return (
                            <JudgeChip
                              key={a.id}
                              judgeName={judge.name}
                              status={a.status}
                              totalScore={a.totalScore}
                              canRemove={a.status === 'pending'}
                              isMutating={isMutating}
                              onRemove={() => removeAssignment(a.id)}
                              t={t}
                            />
                          )
                        })}

                        {/* Add judge button */}
                        {unassignedJudges.length > 0 && (
                          <AddJudgePopover
                            judges={unassignedJudges}
                            isMutating={isMutating}
                            onAdd={(judgeId) => addAssignment(project.id, judgeId)}
                            t={t}
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {s && s.averageScore > 0 ? (
                        <span className="text-sm font-semibold tabular-nums">{s.averageScore.toFixed(1)}</span>
                      ) : (
                        <span className="text-muted-foreground/40">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {s?.completedAssignments ?? 0}/{s?.totalAssignments ?? 0}
                      </span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        /* ── Matrix view ── */
        <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 sticky left-0 z-20 bg-background text-center">#</TableHead>
                <TableHead className="sticky left-10 z-20 bg-background min-w-[180px]">{t('assignments.project')}</TableHead>
                {judges.map((judge) => (
                  <TableHead key={judge.id}
                    className={cn('text-center whitespace-nowrap sticky top-0 z-10 bg-background min-w-[90px]',
                      judge.id === focusedJudgeId && 'bg-primary/10')}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-medium">{judge.name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {judgeAssignmentCounts.get(judge.id) || 0}
                      </span>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center font-semibold min-w-[70px] bg-muted/30">{t('reports.average')}</TableHead>
                <TableHead className="text-center font-semibold min-w-[70px] bg-muted/30">{t('reports.progress')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedProjects.map((project, index) => {
                const globalIndex = (displayPage - 1) * DISPLAY_PAGE_SIZE + index
                const s = projectStats.get(project.id)
                return (
                  <TableRow key={project.id} className="h-10">
                    <TableCell className="sticky left-0 z-10 bg-background text-center text-muted-foreground text-xs tabular-nums">{globalIndex + 1}</TableCell>
                    <TableCell className="sticky left-10 z-10 bg-background">
                      <button type="button"
                        onClick={() => navigate(`${buildAdminPath(adminBasePath, `projects/${project.id}`)}?tab=scores`)}
                        className="truncate text-sm text-left hover:underline block max-w-[220px]">
                        {project.title}
                      </button>
                    </TableCell>
                    {judges.map((judge) => (
                      <TableCell key={judge.id} className={cn('text-center p-1', judge.id === focusedJudgeId && 'bg-primary/10')}>
                        <MatrixCell
                          assignment={getAssignment(project.id, judge.id)}
                          isMutating={isMutating}
                          onToggle={() => toggleAssignment(project.id, judge.id)}
                          t={t}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="text-center bg-muted/10">
                      {s && s.averageScore > 0 ? <span className="text-sm font-semibold tabular-nums">{s.averageScore.toFixed(1)}</span> : <span className="text-muted-foreground/40">-</span>}
                    </TableCell>
                    <TableCell className="text-center bg-muted/10">
                      <span className="text-xs tabular-nums text-muted-foreground">{s?.completedAssignments ?? 0}/{s?.totalAssignments ?? 0}</span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination controls */}
      {sortedProjects.length > DISPLAY_PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
          <span>
            {t('common.showing_range', {
              from: (displayPage - 1) * DISPLAY_PAGE_SIZE + 1,
              to: Math.min(displayPage * DISPLAY_PAGE_SIZE, sortedProjects.length),
              total: sortedProjects.length,
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={displayPage <= 1} onClick={() => setDisplayPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 tabular-nums">{displayPage} / {displayTotalPages}</span>
            <Button variant="outline" size="icon" className="h-7 w-7"
              disabled={displayPage >= displayTotalPages} onClick={() => setDisplayPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}

/* ── Judge chip in list view ── */

function JudgeChip({
  judgeName, status, totalScore, canRemove, isMutating, onRemove, t,
}: {
  judgeName: string; status: string; totalScore?: number | null
  canRemove: boolean; isMutating: boolean; onRemove: () => void
  t: (key: string) => string
}) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors'

  if (status === 'completed') {
    return (
      <span className={cn(baseClasses, 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400')}
        title={t('judging.status.completed')}>
        {judgeName}
        <span className="font-semibold tabular-nums ml-0.5">{totalScore ?? '-'}</span>
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span className={cn(baseClasses, 'border border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400')}
        title={t('judging.status.in_progress')}>
        {judgeName}
      </span>
    )
  }

  // pending — removable
  return (
    <span className={cn(baseClasses, 'border border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400 group')}
      title={t('judging.status.pending')}>
      {judgeName}
      {canRemove && (
        <button type="button" onClick={onRemove} disabled={isMutating}
          className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors disabled:pointer-events-none opacity-0 group-hover:opacity-100">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}

/* ── Add judge popover ── */

function AddJudgePopover({
  judges, isMutating, onAdd, t,
}: {
  judges: { id: string; name: string }[]
  isMutating: boolean
  onAdd: (judgeId: string) => void
  t: (key: string) => string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return judges
    const q = search.trim().toLowerCase()
    return judges.filter(j => j.name.toLowerCase().includes(q))
  }, [judges, search])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={isMutating}
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground/50 hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors disabled:pointer-events-none"
          title={t('assignments.click_to_assign')}>
          <Plus className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2" align="start">
        {judges.length > 5 && (
          <Input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('assignments.search_judge')} className="h-7 text-xs mb-2" autoFocus />
        )}
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{t('assignments.no_judges')}</p>
          ) : filtered.map((judge) => (
            <button key={judge.id} type="button"
              onClick={() => { onAdd(judge.id); setOpen(false); setSearch('') }}
              disabled={isMutating}
              className="w-full text-left rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors disabled:pointer-events-none">
              {judge.name}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ── Matrix cell ── */

function MatrixCell({
  assignment, isMutating, onToggle, t,
}: {
  assignment: { id: string; status: string; totalScore?: number | null } | undefined
  isMutating: boolean; onToggle: () => void; t: (key: string) => string
}) {
  if (!assignment) {
    return (
      <button type="button" onClick={onToggle} disabled={isMutating}
        className="group inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/20 hover:bg-primary/10 hover:text-primary transition-colors disabled:pointer-events-none"
        title={t('assignments.click_to_assign')}>
        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }
  if (assignment.status === 'completed') {
    return (
      <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        title={t('judging.status.completed')}>{assignment.totalScore ?? '-'}</span>
    )
  }
  if (assignment.status === 'in_progress') {
    return (
      <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium border border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400"
        title={t('judging.status.in_progress')}>{t('judging.status.in_progress')}</span>
    )
  }
  return (
    <button type="button" onClick={onToggle} disabled={isMutating} className="disabled:pointer-events-none" title={t('judging.status.pending')}>
      <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20 cursor-pointer transition-colors">
        {t('judging.status.pending')}
      </span>
    </button>
  )
}

