import React, { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { Users, Info, Loader2, ChevronDown, ChevronUp, Shuffle, Wand2, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { planBalancedRandomAssignments, planBulkAssignments } from '@/lib/assignment-planner'
import { getFilterableSubmissionFields, getProjectSubmissionFieldValue, getSubmissionFieldFilterOptions } from '@/lib/submission-fields'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export function AssignmentManager() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [selectedAutoJudgeIds, setSelectedAutoJudgeIds] = useState<string[]>([])
  const [judgesPerProject, setJudgesPerProject] = useState('2')
  const [hasInitializedAutoJudges, setHasInitializedAutoJudges] = useState(false)
  const [projectQuery, setProjectQuery] = useState('')
  const [submissionFilters, setSubmissionFilters] = useState<Record<string, string>>({})

  useEffect(() => {
    const firstSessionId = activeHackathon?.sessions?.[0]?.id || ''
    if (!selectedSessionId || !activeHackathon?.sessions?.some((session) => session.id === selectedSessionId)) {
      setSelectedSessionId(firstSessionId)
    }
  }, [activeHackathon?.sessions, selectedSessionId])

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', activeHackathon?.id, selectedSessionId],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id, sessionId: selectedSessionId || undefined }),
    enabled: !!activeHackathon?.id && !!selectedSessionId,
  })

  // Fetch judges (users with judge role)
  const { data: judges = [], isLoading: isLoadingJudges } = useQuery({
    queryKey: ['users', 'judges'],
    queryFn: () => api.getUsers({ role: 'judge' }),
  })

  useEffect(() => {
    if (!hasInitializedAutoJudges && judges.length > 0) {
      setSelectedAutoJudgeIds(judges.map((judge) => judge.id))
      setHasInitializedAutoJudges(true)
      return
    }

    if (hasInitializedAutoJudges) {
      const validJudgeIds = new Set(judges.map((judge) => judge.id))
      setSelectedAutoJudgeIds((previous) => previous.filter((judgeId) => validJudgeIds.has(judgeId)))
    }
  }, [judges, hasInitializedAutoJudges])

  // Fetch existing assignments
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', activeHackathon?.id, selectedSessionId],
    queryFn: async () => {
      if (!selectedSessionId) return []
      return api.getAssignments({ sessionId: selectedSessionId })
    },
    enabled: !!selectedSessionId,
  })

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

  // Create assignments mutation
  const createMutation = useMutation({
    mutationFn: (data: { sessionId: string; projectId: string; judgeId: string }[]) =>
      api.createAssignments(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })

  // Delete assignment mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })

  // Check if a project is assigned to a judge
  const isAssigned = (projectId: string, judgeId: string) => {
    return assignments.some(a => a.projectId === projectId && a.judgeId === judgeId)
  }

  // Get assignment ID
  const getAssignmentId = (projectId: string, judgeId: string) => {
    return assignments.find(a => a.projectId === projectId && a.judgeId === judgeId)?.id
  }

  // Get assignment counts
  const getJudgeAssignmentCount = (judgeId: string, projectIds?: Set<string>) => {
    return assignments.filter((assignment) => {
      if (assignment.judgeId !== judgeId) return false
      if (!projectIds) return true
      return projectIds.has(assignment.projectId)
    }).length
  }

  const getProjectAssignmentCount = (projectId: string) => {
    return assignments.filter(a => a.projectId === projectId).length
  }

  const updateSubmissionFilter = (fieldId: string, value: string) => {
    setSubmissionFilters((previous) => {
      if (!value) {
        const next = { ...previous }
        delete next[fieldId]
        return next
      }
      return { ...previous, [fieldId]: value }
    })
  }

  const clearFilters = () => {
    setProjectQuery('')
    setSubmissionFilters({})
  }

  const filteredProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLowerCase()
    return projects.filter((project) => {
      if (normalizedQuery) {
        const searchableText = [
          project.title,
          project.oneLiner,
          project.submitterName,
          project.submitterEmail,
          ...(project.tags || []),
          ...filterableFields.map((field) => getProjectSubmissionFieldValue(project, field.id)),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        if (!searchableText.includes(normalizedQuery)) {
          return false
        }
      }

      for (const [fieldId, selectedValue] of Object.entries(submissionFilters)) {
        if (!selectedValue) continue
        if (getProjectSubmissionFieldValue(project, fieldId) !== selectedValue) {
          return false
        }
      }

      return true
    })
  }, [projects, projectQuery, submissionFilters, filterableFields])

  const filteredProjectIds = useMemo(
    () => new Set(filteredProjects.map((project) => project.id)),
    [filteredProjects]
  )

  // Toggle assignment
  const createAssignments = async (
    rows: { sessionId: string; projectId: string; judgeId: string }[],
    successMessage: string
  ) => {
    if (rows.length === 0) {
      toast.message(t('assignments.no_changes'))
      return
    }

    try {
      await createMutation.mutateAsync(rows)
      toast.success(successMessage)
    } catch {
      toast.error(t('assignments.create_failed'))
    }
  }

  const removeAssignment = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast.success(t('assignments.removed'))
    } catch {
      toast.error(t('assignments.remove_failed'))
    }
  }

  const toggleAssignment = async (projectId: string, judgeId: string) => {
    const existingId = getAssignmentId(projectId, judgeId)
    const sessionId = selectedSessionId

    if (existingId) {
      await removeAssignment(existingId)
    } else if (sessionId) {
      await createAssignments([{ sessionId, projectId, judgeId }], t('assignments.created'))
    }
  }

  // Assign all projects to a judge
  const assignAllToJudge = async (judgeId: string) => {
    const sessionId = selectedSessionId
    if (!sessionId) return

    const newAssignments = filteredProjects
      .filter(project => !isAssigned(project.id, judgeId))
      .map(project => ({
        sessionId,
        projectId: project.id,
        judgeId,
      }))

    await createAssignments(
      newAssignments,
      t('assignments.assigned_count', { count: newAssignments.length, name: judges.find(j => j.id === judgeId)?.name })
    )
  }

  const toggleAutoJudge = (judgeId: string) => {
    setSelectedAutoJudgeIds((previous) =>
      previous.includes(judgeId)
        ? previous.filter((id) => id !== judgeId)
        : [...previous, judgeId]
    )
  }

  const parsedJudgesPerProject = Number.parseInt(judgesPerProject, 10)
  const autoAssignTarget = Number.isFinite(parsedJudgesPerProject) && parsedJudgesPerProject > 0
    ? parsedJudgesPerProject
    : 1

  const bulkPlan = planBulkAssignments({
    sessionId: selectedSessionId,
    projects: filteredProjects,
    judgeIds: selectedAutoJudgeIds,
    existingAssignments: assignments,
  })

  const balancedPlan = planBalancedRandomAssignments({
    sessionId: selectedSessionId,
    projects: filteredProjects,
    judgeIds: selectedAutoJudgeIds,
    existingAssignments: assignments,
    judgesPerProject: autoAssignTarget,
  })

  const runBulkAutoAssign = async () => {
    await createAssignments(
      bulkPlan.assignments,
      t('assignments.bulk_created', {
        count: bulkPlan.assignments.length,
        judges: selectedAutoJudgeIds.length,
      })
    )
  }

  const runBalancedAutoAssign = async () => {
    await createAssignments(
      balancedPlan.assignments,
      t('assignments.random_created', {
        count: balancedPlan.assignments.length,
        judgesPerProject: Math.min(autoAssignTarget, Math.max(selectedAutoJudgeIds.length, 1)),
      })
    )
  }

  const isLoading = isLoadingProjects || isLoadingJudges || isLoadingAssignments
  const isMutating = createMutation.isPending || deleteMutation.isPending
  const effectiveJudgesPerProject = Math.min(autoAssignTarget, Math.max(selectedAutoJudgeIds.length, 1))
  const activeFilterCount = (projectQuery.trim() ? 1 : 0) + Object.values(submissionFilters).filter(Boolean).length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t('assignments.title', 'Project Assignments')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('assignments.subtitle')}
          </p>
        </div>
        <div className="w-full md:w-[280px]">
          <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
            <SelectTrigger>
              <SelectValue placeholder={t('reports.session', 'Session')} />
            </SelectTrigger>
            <SelectContent>
              {(activeHackathon?.sessions || []).map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  <span className="flex items-center gap-1.5">
                    {session.name}
                    {session.region && (
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {session.region}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          {t('assignments.help')}
        </AlertDescription>
      </Alert>

      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5" />
            {t('assignments.filters_title')}
          </CardTitle>
          <CardDescription>{t('assignments.filters_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(auto-fit,minmax(180px,1fr))]">
            <div className="space-y-2">
              <Label htmlFor="projectQuery">{t('assignments.search_projects')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="projectQuery"
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder={t('assignments.search_projects_placeholder')}
                  className="pl-9"
                />
              </div>
            </div>

            {filterableFields.map((field) => {
              const options = getSubmissionFieldFilterOptions(field, projects)
              return (
                <div key={field.id} className="space-y-2">
                  <Label>{field.label}</Label>
                  <Select
                    value={submissionFilters[field.id] || '__all__'}
                    onValueChange={(value) => updateSubmissionFilter(field.id, value === '__all__' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('assignments.all_filter_values')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">{t('assignments.all_filter_values')}</SelectItem>
                      {options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {t('assignments.filtered_projects_count', { count: filteredProjects.length, total: projects.length })}
            </Badge>
            <Badge variant="secondary">
              {t('assignments.current_scope_count', { count: assignments.filter((assignment) => filteredProjectIds.has(assignment.projectId)).length })}
            </Badge>
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                {t('assignments.clear_filters')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            {t('assignments.auto_title')}
          </CardTitle>
          <CardDescription>{t('assignments.auto_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label>{t('assignments.auto_judges')}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedAutoJudgeIds(judges.map((judge) => judge.id))}
                    disabled={isMutating || judges.length === 0}
                  >
                    {t('common.select_all')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedAutoJudgeIds([])}
                    disabled={isMutating || selectedAutoJudgeIds.length === 0}
                  >
                    {t('assignments.clear_selection')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {judges.map((judge) => (
                  <label
                    key={judge.id}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedAutoJudgeIds.includes(judge.id)}
                      onCheckedChange={() => toggleAutoJudge(judge.id)}
                      disabled={isMutating}
                    />
                    <span>{judge.name}</span>
                    <Badge variant="outline" className="rounded-full">
                      {getJudgeAssignmentCount(judge.id)}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="judgesPerProject">{t('assignments.judges_per_project')}</Label>
                <Input
                  id="judgesPerProject"
                  type="number"
                  min={1}
                  max={Math.max(judges.length, 1)}
                  value={judgesPerProject}
                  onChange={(event) => setJudgesPerProject(event.target.value)}
                  disabled={isMutating}
                />
                <p className="text-xs text-muted-foreground">
                  {t('assignments.judges_per_project_desc')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{t('assignments.filtered_projects_count', { count: filteredProjects.length, total: projects.length })}</Badge>
                <Badge variant="secondary">{t('assignments.selected_judges', { count: selectedAutoJudgeIds.length })}</Badge>
                <Badge variant="secondary">{t('assignments.current_scope_count', { count: assignments.filter((assignment) => filteredProjectIds.has(assignment.projectId)).length })}</Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
              <div className="flex items-center gap-2">
                <Shuffle className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t('assignments.random_mode_title')}</p>
                <Badge variant="outline" className="rounded-full">
                  {t('assignments.recommended')}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('assignments.random_mode_desc', {
                  judgesPerProject: effectiveJudgesPerProject,
                  count: balancedPlan.assignments.length,
                })}
              </p>
              <Button
                className="mt-4 gap-2"
                onClick={runBalancedAutoAssign}
                disabled={isMutating || !selectedSessionId || balancedPlan.assignments.length === 0 || selectedAutoJudgeIds.length === 0}
              >
                <Shuffle className="h-4 w-4" />
                {t('assignments.random_assign_button', { count: balancedPlan.assignments.length })}
              </Button>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">{t('assignments.bulk_mode_title')}</p>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('assignments.bulk_mode_desc', {
                  judges: selectedAutoJudgeIds.length,
                  count: bulkPlan.assignments.length,
                })}
              </p>
              <Button
                variant="secondary"
                className="mt-4 gap-2"
                onClick={runBulkAutoAssign}
                disabled={isMutating || !selectedSessionId || bulkPlan.assignments.length === 0}
              >
                <Users className="h-4 w-4" />
                {t('assignments.bulk_assign_button', { count: bulkPlan.assignments.length })}
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('assignments.auto_hint', {
              judgesPerProject: effectiveJudgesPerProject,
              count: filteredProjects.length,
            })}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Projects Panel */}
        <Card className="surface-panel border-none shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('assignments.filtered_projects_count', { count: filteredProjects.length, total: projects.length })}
            </CardTitle>
            <CardDescription>
              {t('assignments.projects_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {filteredProjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('assignments.no_projects')}
                </div>
              )}
              {filteredProjects.map(project => {
                const assignedCount = getProjectAssignmentCount(project.id)

                return (
                  <div
                    key={project.id}
                    className="surface-inset p-4 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{project.title}</h4>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {project.oneLiner}
                        </p>
                        {project.sessionId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {activeHackathon?.sessions?.find((s) => s.id === project.sessionId)?.name || '-'}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {filterableFields.map((field) => {
                            const value = getProjectSubmissionFieldValue(project, field.id)
                            if (!value) return null
                            return (
                              <Badge key={`${project.id}-${field.id}`} variant="outline" className="rounded-full text-[10px]">
                                {field.label}: {value}
                              </Badge>
                            )
                          })}
                        </div>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {t(assignedCount === 1 ? 'assignments.judge_count' : 'assignments.judges_count_label', { count: assignedCount })}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {judges.map(judge => (
                        <label
                          key={judge.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={isAssigned(project.id, judge.id)}
                            onCheckedChange={() => toggleAssignment(project.id, judge.id)}
                            disabled={isMutating}
                          />
                          <span className="text-xs">{judge.name.split(' ')[0]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Judges Panel */}
        <Card className="surface-panel border-none shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('assignments.judges_count', { count: judges.length })}
            </CardTitle>
            <CardDescription>
              {t('assignments.judges_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {judges.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  {t('assignments.no_judges')}
                </div>
              )}
              {judges.map(judge => {
                const assignedCount = getJudgeAssignmentCount(judge.id)
                const visibleAssignedCount = getJudgeAssignmentCount(judge.id, filteredProjectIds)
                const isExpanded = expandedJudge === judge.id

                return (
                  <div
                    key={judge.id}
                    className="surface-inset p-4"
                  >
                    <div
                      className="flex items-start justify-between gap-3 cursor-pointer"
                      onClick={() => setExpandedJudge(isExpanded ? null : judge.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{judge.name}</h4>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {judge.email}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('assignments.judge_total_assigned', { count: assignedCount })}
                        </p>
                      </div>
                      <Badge variant="default">
                        {visibleAssignedCount}/{filteredProjects.length}
                      </Badge>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs text-muted-foreground">{t('assignments.select_projects')}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => assignAllToJudge(judge.id)}
                            disabled={isMutating || visibleAssignedCount === filteredProjects.length || filteredProjects.length === 0}
                          >
                            {t('assignments.assign_all_for_judge')}
                          </Button>
                        </div>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {filteredProjects.map(project => (
                            <label
                              key={project.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                            >
                              <Checkbox
                                checked={isAssigned(project.id, judge.id)}
                                onCheckedChange={() => toggleAssignment(project.id, judge.id)}
                                disabled={isMutating}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{project.title}</p>
                                <p className="text-xs text-muted-foreground truncate">{project.oneLiner}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isExpanded && visibleAssignedCount > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="space-y-1">
                          {filteredProjects
                            .filter(p => isAssigned(p.id, judge.id))
                            .slice(0, 3)
                            .map(project => (
                              <p key={project.id} className="text-xs truncate">
                                • {project.title}
                              </p>
                            ))}
                          {visibleAssignedCount > 3 && (
                            <p className="text-xs text-muted-foreground">
                              {t('common.more_count', { count: visibleAssignedCount - 3 })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
