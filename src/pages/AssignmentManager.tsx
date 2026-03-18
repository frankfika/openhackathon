import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { toast } from 'sonner'
import { Users, Loader2, ChevronDown, ChevronUp, Shuffle, Wand2, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'
import { planBalancedRandomAssignments, planBulkAssignments } from '@/lib/assignment-planner'
import { getFilterableSubmissionFields, getProjectSubmissionFieldValue, getSubmissionFieldFilterOptions } from '@/lib/submission-fields'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function AssignmentManager() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [projectQuery, setProjectQuery] = useState('')
  const [submissionFilters, setSubmissionFilters] = useState<Record<string, string>>({})
  const [autoAssignOpen, setAutoAssignOpen] = useState(false)
  const focusedJudgeId = searchParams.get('judgeId') || ''
  const hackathonId = activeHackathon?.id
  const focusedColRef = useRef<HTMLTableCellElement>(null)

  // Fetch projects
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', hackathonId],
    queryFn: () => api.getProjects({ hackathonId }),
    enabled: !!hackathonId,
  })

  // Fetch judges registered to current hackathon
  const { data: judges = [], isLoading: isLoadingJudges } = useQuery({
    queryKey: ['hackathon-judges', hackathonId],
    queryFn: () => api.getHackathonJudges(activeHackathon.id),
    enabled: !!hackathonId,
  })

  // Fetch existing assignments
  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', hackathonId],
    queryFn: async () => {
      if (!hackathonId) return []
      return api.getAssignments({ hackathonId })
    },
    enabled: !!hackathonId,
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

  // Scroll to focused judge column
  useEffect(() => {
    if (!focusedJudgeId || !focusedColRef.current) return
    focusedColRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [focusedJudgeId, judges])

  // Create assignments mutation
  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; judgeId: string }[]) =>
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

  const getAssignment = (projectId: string, judgeId: string) =>
    assignments.find(a => a.projectId === projectId && a.judgeId === judgeId)

  const getJudgeAssignmentCount = (judgeId: string, projectIds: Set<string>) =>
    assignments.filter(a => a.judgeId === judgeId && projectIds.has(a.projectId)).length

  const updateSubmissionFilter = (fieldId: string, value: string) =>
    setSubmissionFilters(prev => value ? { ...prev, [fieldId]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== fieldId)))

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
    rows: { projectId: string; judgeId: string }[],
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
    const existing = getAssignment(projectId, judgeId)

    if (existing) {
      await removeAssignment(existing.id)
    } else if (hackathonId) {
      await createAssignments([{ projectId, judgeId }], t('assignments.created'))
    }
  }

  const isMutating = createMutation.isPending || deleteMutation.isPending
  const activeFilterCount = (projectQuery.trim() ? 1 : 0) + Object.values(submissionFilters).filter(Boolean).length
  const isLoading = isLoadingProjects || isLoadingJudges || isLoadingAssignments

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t('assignments.title', 'Project Assignments')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('assignments.subtitle')}
          </p>
        </div>
        <Button onClick={() => setAutoAssignOpen(true)} className="gap-2">
          <Wand2 className="h-4 w-4" />
          {t('assignments.auto_title')}
        </Button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder={t('assignments.search_projects_placeholder')}
            className="pl-9"
          />
        </div>

        {filterableFields.map((field) => {
          const options = getSubmissionFieldFilterOptions(field, projects)
          return (
            <Select
              key={field.id}
              value={submissionFilters[field.id] || '__all__'}
              onValueChange={(value) => updateSubmissionFilter(field.id, value === '__all__' ? '' : value)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={field.label} />
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
          )
        })}

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
            {t('assignments.clear_filters')}
          </Button>
        )}

        <Badge variant="secondary" className="h-9 px-3 flex items-center">
          {t('assignments.filtered_projects_count', { count: filteredProjects.length, total: projects.length })}
        </Badge>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm border border-primary bg-primary" />
          {t('judging.status.pending')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-amber-500" />
          {t('judging.status.in_progress')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-600" />
          {t('judging.status.completed')}
        </span>
      </div>

      {/* Matrix table */}
      {judges.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('assignments.no_judges')}</p>
          <p className="text-xs mt-1">{t('assignments.no_judges_hint')}</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {t('assignments.no_projects')}
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-280px)] rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-20 bg-background min-w-[200px]">
                  {t('assignments.project')}
                </TableHead>
                {judges.map((judge) => (
                  <TableHead
                    key={judge.id}
                    ref={judge.id === focusedJudgeId ? focusedColRef : undefined}
                    className={cn(
                      'text-center whitespace-nowrap sticky top-0 z-10 bg-background',
                      judge.id === focusedJudgeId && 'bg-primary/10'
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-medium">{judge.name}</span>
                      <Badge variant="outline" className="rounded-full text-[10px] px-1.5">
                        {getJudgeAssignmentCount(judge.id, filteredProjectIds)}
                      </Badge>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="sticky left-0 z-10 bg-background font-medium">
                    <div className="max-w-[240px]">
                      <p className="truncate text-sm">{project.title}</p>
                      {project.oneLiner && (
                        <p className="truncate text-xs text-muted-foreground">{project.oneLiner}</p>
                      )}
                    </div>
                  </TableCell>
                  {judges.map((judge) => {
                    const assignment = getAssignment(project.id, judge.id)
                    const assigned = !!assignment
                    const status = assignment?.status

                    return (
                      <TableCell
                        key={judge.id}
                        className={cn(
                          'text-center',
                          judge.id === focusedJudgeId && 'bg-primary/10'
                        )}
                      >
                        <Checkbox
                          checked={assigned}
                          onCheckedChange={() => toggleAssignment(project.id, judge.id)}
                          disabled={isMutating}
                          className={cn(
                            status === 'in_progress' && 'data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500',
                            status === 'completed' && 'data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600'
                          )}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Auto-assign Dialog */}
      <Dialog open={autoAssignOpen} onOpenChange={setAutoAssignOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {t('assignments.auto_title')}
            </DialogTitle>
            <DialogDescription>{t('assignments.auto_desc')}</DialogDescription>
          </DialogHeader>
          {autoAssignOpen && (
            <AutoAssignDialogBody
              judges={judges}
              filteredProjects={filteredProjects}
              filteredProjectIds={filteredProjectIds}
              assignments={assignments}
              hackathonId={hackathonId}
              isMutating={isMutating}
              createAssignments={createAssignments}
              t={t}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AutoAssignDialogBody({
  judges,
  filteredProjects,
  filteredProjectIds,
  assignments,
  hackathonId,
  isMutating,
  createAssignments,
  t,
}: {
  judges: { id: string; name: string; email: string }[]
  filteredProjects: { id: string; title: string }[]
  filteredProjectIds: Set<string>
  assignments: { id: string; projectId: string; judgeId: string; status: string }[]
  hackathonId: string | undefined
  isMutating: boolean
  createAssignments: (rows: { projectId: string; judgeId: string }[], msg: string) => Promise<void>
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const [selectedJudgeIds, setSelectedJudgeIds] = useState<string[]>(() => judges.map((j) => j.id))
  const [judgesPerProject, setJudgesPerProject] = useState('2')
  const [showBulk, setShowBulk] = useState(false)

  const parsedJudgesPerProject = Number.parseInt(judgesPerProject, 10)
  const autoAssignTarget = Number.isFinite(parsedJudgesPerProject) && parsedJudgesPerProject > 0
    ? parsedJudgesPerProject
    : 1

  const effectiveJudgesPerProject = Math.min(autoAssignTarget, Math.max(selectedJudgeIds.length, 1))

  const getJudgeAssignmentCount = (judgeId: string) => {
    return assignments.filter((a) => a.judgeId === judgeId && filteredProjectIds.has(a.projectId)).length
  }

  const toggleJudge = (judgeId: string) => {
    setSelectedJudgeIds((prev) =>
      prev.includes(judgeId) ? prev.filter((id) => id !== judgeId) : [...prev, judgeId]
    )
  }

  const balancedPlan = planBalancedRandomAssignments({
    projects: filteredProjects,
    judgeIds: selectedJudgeIds,
    existingAssignments: assignments,
    judgesPerProject: autoAssignTarget,
  })

  const bulkPlan = planBulkAssignments({
    projects: filteredProjects,
    judgeIds: selectedJudgeIds,
    existingAssignments: assignments,
  })

  const runBalancedAutoAssign = async () => {
    await createAssignments(
      balancedPlan.assignments,
      t('assignments.random_created', {
        count: balancedPlan.assignments.length,
        judgesPerProject: effectiveJudgesPerProject,
      })
    )
  }

  const runBulkAutoAssign = async () => {
    await createAssignments(
      bulkPlan.assignments,
      t('assignments.bulk_created', {
        count: bulkPlan.assignments.length,
        judges: selectedJudgeIds.length,
      })
    )
  }

  return (
    <div className="space-y-4">
      {/* Judge selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('assignments.auto_judges')}</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedJudgeIds(judges.map((j) => j.id))}
              disabled={isMutating || judges.length === 0}
            >
              {t('common.select_all')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSelectedJudgeIds([])}
              disabled={isMutating || selectedJudgeIds.length === 0}
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
                checked={selectedJudgeIds.includes(judge.id)}
                onCheckedChange={() => toggleJudge(judge.id)}
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

      {/* Judges per project */}
      <div className="space-y-2">
        <Label htmlFor="dialogJudgesPerProject">{t('assignments.judges_per_project')}</Label>
        <Input
          id="dialogJudgesPerProject"
          type="number"
          min={1}
          max={Math.max(judges.length, 1)}
          value={judgesPerProject}
          onChange={(e) => setJudgesPerProject(e.target.value)}
          disabled={isMutating}
        />
        <p className="text-xs text-muted-foreground">{t('assignments.judges_per_project_desc')}</p>
      </div>

      {/* Balanced random (recommended) */}
      <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
        <div className="flex items-center gap-2">
          <Shuffle className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{t('assignments.random_mode_title')}</p>
          <Badge variant="outline" className="rounded-full">{t('assignments.recommended')}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('assignments.random_mode_desc', {
            judgesPerProject: effectiveJudgesPerProject,
            count: balancedPlan.assignments.length,
          })}
        </p>
        <Button
          className="mt-3 gap-2"
          onClick={runBalancedAutoAssign}
          disabled={isMutating || !hackathonId || balancedPlan.assignments.length === 0 || selectedJudgeIds.length === 0}
        >
          <Shuffle className="h-4 w-4" />
          {t('assignments.random_assign_button', { count: balancedPlan.assignments.length })}
        </Button>
      </div>

      {/* Bulk assign (collapsed) */}
      <div className="space-y-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => setShowBulk((prev) => !prev)}
        >
          {showBulk ? <ChevronUp className="mr-1 h-3.5 w-3.5" /> : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
          {showBulk ? t('assignments.hide_advanced_auto') : t('assignments.show_advanced_auto')}
        </Button>

        {showBulk && (
          <div className="rounded-2xl border border-border/60 bg-background/75 p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">{t('assignments.bulk_mode_title')}</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('assignments.bulk_mode_desc', {
                judges: selectedJudgeIds.length,
                count: bulkPlan.assignments.length,
              })}
            </p>
            <Button
              variant="secondary"
              className="mt-3 gap-2"
              onClick={runBulkAutoAssign}
              disabled={isMutating || !hackathonId || bulkPlan.assignments.length === 0 || selectedJudgeIds.length === 0}
            >
              <Users className="h-4 w-4" />
              {t('assignments.bulk_assign_button', { count: bulkPlan.assignments.length })}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
