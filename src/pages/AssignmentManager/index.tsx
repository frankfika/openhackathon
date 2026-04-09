import { useEffect, useMemo, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useActiveHackathon } from '@/lib/active-hackathon'
import { api } from '@/lib/api'
import {
  getFilterableSubmissionFields,
  getProjectSubmissionFieldValue,
  getSubmissionFieldFilterOptions,
  getFieldLabel,
} from '@/lib/submission-fields'

import { AssignmentHeader } from './AssignmentHeader'
import { AssignmentStats } from './AssignmentStats'
import { AssignmentToolbar } from './AssignmentToolbar'
import { AssignmentListView } from './AssignmentListView'
import { AssignmentMatrixView } from './AssignmentMatrixView'
import { AssignmentPagination } from './AssignmentPagination'
import { ScoreDistributionChart } from '@/components/ScoreDistributionChart'
import { JudgeScoreComparison } from '@/components/JudgeScoreComparison'

import {
  useAssignmentIndex,
  useProjectAssignmentsMap,
  useJudgeAssignmentCounts,
  useProjectStats,
  useAggregateStats,
  useStatusFilteredProjects,
  useFilterCounts,
  useSortedProjects,
  usePendingCount,
} from './hooks'
import type { StatusFilter, ViewMode } from './types'

const DISPLAY_PAGE_SIZE = 50

export function AssignmentManager() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  // Local state
  const [projectQuery, setProjectQuery] = useState('')
  const [submissionFilters, setSubmissionFilters] = useState<Record<string, string>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [judgesPerProject, setJudgesPerProject] = useState<number | null>(null)
  const [displayPage, setDisplayPage] = useState(1)

  const focusedJudgeId = searchParams.get('judgeId') || ''
  const hackathonId = activeHackathon?.id

  // Data fetching
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects', hackathonId, 'lite'],
    queryFn: () => api.getProjects({ hackathonId, lite: true }),
    enabled: !!hackathonId,
    staleTime: 30_000,
  })

  const { data: judges = [], isLoading: isLoadingJudges } = useQuery({
    queryKey: ['hackathon-judges', hackathonId],
    queryFn: () => api.getHackathonJudges(activeHackathon!.id),
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

  // Derived data
  const judgeMap = useMemo(() => new Map(judges.map((j) => [j.id, j])), [judges])

  const filterableFields = useMemo(
    () => getFilterableSubmissionFields(activeHackathon?.submissionSchema),
    [activeHackathon?.submissionSchema]
  )

  // Reset filters when filterable fields change
  useEffect(() => {
    const allowedFieldIds = new Set(filterableFields.map((field) => field.id))
    setSubmissionFilters((previous) => {
      const nextEntries = Object.entries(previous).filter(
        ([fieldId, value]) => allowedFieldIds.has(fieldId) && value
      )
      return Object.fromEntries(nextEntries)
    })
  }, [filterableFields])

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: { projectId: string; judgeId: string }[]) => api.createAssignments(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => api.deleteAssignment(id, force),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
    },
  })

  const resetMutation = useMutation({
    mutationFn: (hId: string) => api.resetAssignments(hId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['assignments'] })
      toast.success(t('assignments.reset_success', { count: data.deleted }))
    },
    onError: () => {
      toast.error(t('assignments.reset_failed'))
    },
  })

  // Custom hooks for data processing
  const assignmentIndex = useAssignmentIndex(assignments)
  const projectAssignmentsMap = useProjectAssignmentsMap(assignments)

  const getAssignment = useCallback(
    (projectId: string, judgeId: string) => assignmentIndex.get(`${projectId}:${judgeId}`),
    [assignmentIndex]
  )

  // Filtering
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

  // Stats
  const judgeAssignmentCounts = useJudgeAssignmentCounts(assignments, filteredProjectIds)
  const projectStats = useProjectStats(filteredProjects, projectAssignmentsMap)
  const stats = useAggregateStats(projectStats)
  const statusFilteredProjects = useStatusFilteredProjects(filteredProjects, statusFilter, projectStats)
  const filterCounts = useFilterCounts(filteredProjects, projectStats)
  const sortedProjects = useSortedProjects(statusFilteredProjects, projectStats)
  const pendingCount = usePendingCount(assignments)

  // Calculate max possible score from scoring criteria
  const maxScore = useMemo(() => {
    const criteria = activeHackathon?.scoringCriteria || []
    return criteria.reduce((sum, c) => sum + (c.maxScore || 0), 0)
  }, [activeHackathon?.scoringCriteria])

  // Reset display page when filters change
  useEffect(() => {
    setDisplayPage(1)
  }, [projectQuery, submissionFilters, statusFilter])

  // Pagination
  const displayTotalPages = Math.max(1, Math.ceil(sortedProjects.length / DISPLAY_PAGE_SIZE))
  const pagedProjects = useMemo(
    () => sortedProjects.slice((displayPage - 1) * DISPLAY_PAGE_SIZE, displayPage * DISPLAY_PAGE_SIZE),
    [sortedProjects, displayPage]
  )

  // Actions
  const createAssignments = useCallback(
    async (rows: { projectId: string; judgeId: string }[], successMessage: string) => {
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
    },
    [createMutation, t]
  )

  const removeAssignment = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync({ id })
        toast.success(t('assignments.removed'))
      } catch (error: unknown) {
        const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code
        toast.error(
          code === 'ALREADY_SCORED' ? t('assignments.remove_scored_blocked') : t('assignments.remove_failed')
        )
      }
    },
    [deleteMutation, t]
  )

  const addAssignment = useCallback(
    async (projectId: string, judgeId: string) => {
      if (!hackathonId) return
      await createAssignments([{ projectId, judgeId }], t('assignments.created'))
    },
    [createAssignments, hackathonId, t]
  )

  const toggleAssignment = useCallback(
    async (projectId: string, judgeId: string) => {
      const existing = getAssignment(projectId, judgeId)
      if (existing) {
        if (existing.status !== 'pending') return
        await removeAssignment(existing.id)
      } else if (hackathonId) {
        await createAssignments([{ projectId, judgeId }], t('assignments.created'))
      }
    },
    [createAssignments, getAssignment, hackathonId, removeAssignment, t]
  )

  const handleRandomAssign = useCallback(
    (newAssignments: { projectId: string; judgeId: string }[], count: number, effectiveJudgesPerProject: number) => {
      createAssignments(newAssignments, t('assignments.random_created', { count, judgesPerProject: effectiveJudgesPerProject }))
    },
    [createAssignments, t]
  )

  const handleReset = useCallback(() => {
    if (window.confirm(t('assignments.reset_confirm', { count: pendingCount }))) {
      resetMutation.mutate(hackathonId!)
    }
  }, [hackathonId, pendingCount, resetMutation, t])

  const downloadCSV = useCallback(() => {
    const headers = [
      t('reports.rank'),
      t('projects.project_id'),
      t('reports.project'),
      t('reports.submitter'),
      ...judges.map((j) => j.name),
      t('reports.average'),
      t('reports.progress'),
    ]
    const rows = sortedProjects.map((project, index) => {
      const judgeCells = judges.map((judge) => {
        const a = getAssignment(project.id, judge.id)
        if (!a) return ''
        if (a.status === 'completed' && a.totalScore != null) return `${a.totalScore}`
        return a.status
      })
      const s = projectStats.get(project.id)
      return [
        index + 1,
        `"${project.id}"`,
        `"${project.title}"`,
        `"${project.submitterName || project.submitterEmail}"`,
        ...judgeCells,
        s && s.averageScore > 0 ? s.averageScore.toFixed(1) : '-',
        `${s?.completedAssignments ?? 0}/${s?.totalAssignments ?? 0}`,
      ]
    })
    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `review-management-${hackathonId}-${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [getAssignment, hackathonId, judges, projectStats, sortedProjects, t])

  const updateSubmissionFilter = useCallback(
    (fieldId: string, value: string) =>
      setSubmissionFilters((prev) =>
        value ? { ...prev, [fieldId]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== fieldId))
      ),
    []
  )

  const clearFilters = useCallback(() => {
    setProjectQuery('')
    setSubmissionFilters({})
  }, [])

  const isMutating = createMutation.isPending || deleteMutation.isPending
  const activeFilterCount = (projectQuery.trim() ? 1 : 0) + Object.values(submissionFilters).filter(Boolean).length
  const isLoading = isLoadingProjects || isLoadingJudges || isLoadingAssignments
  const effectiveJudgesPerProject = judgesPerProject ?? activeHackathon?.judgesPerProject ?? 2

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Empty states
  if (judges.length === 0) {
    return (
      <div className="space-y-3">
        <AssignmentHeader
          hackathonId={hackathonId}
          judgesCount={judges.length}
          projectsCount={projects.length}
          judgesPerProject={judgesPerProject}
          effectiveJudgesPerProject={effectiveJudgesPerProject}
          pendingCount={pendingCount}
          isMutating={isMutating}
          isResetting={resetMutation.isPending}
          assignments={assignments}
          projects={projects}
          judgeIds={judges.map((j) => j.id)}
          onJudgesPerProjectChange={setJudgesPerProject}
          onRandomAssign={handleRandomAssign}
          onReset={handleReset}
          onDownloadCSV={downloadCSV}
          t={t}
        />
        <div className="text-center py-12 text-muted-foreground">
          <p>{t('assignments.no_judges')}</p>
          <p className="text-xs mt-1">{t('assignments.no_judges_hint')}</p>
        </div>
      </div>
    )
  }

  if (sortedProjects.length === 0) {
    return (
      <div className="space-y-3">
        <AssignmentHeader
          hackathonId={hackathonId}
          judgesCount={judges.length}
          projectsCount={projects.length}
          judgesPerProject={judgesPerProject}
          effectiveJudgesPerProject={effectiveJudgesPerProject}
          pendingCount={pendingCount}
          isMutating={isMutating}
          isResetting={resetMutation.isPending}
          assignments={assignments}
          projects={projects}
          judgeIds={judges.map((j) => j.id)}
          onJudgesPerProjectChange={setJudgesPerProject}
          onRandomAssign={handleRandomAssign}
          onReset={handleReset}
          onDownloadCSV={downloadCSV}
          t={t}
        />
        <AssignmentStats stats={stats} judgesCount={judges.length} t={t} />
        <AssignmentToolbar
          projectQuery={projectQuery}
          onProjectQueryChange={setProjectQuery}
          submissionFilters={submissionFilters}
          onSubmissionFilterChange={updateSubmissionFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          filterableFields={filterableFields}
          filterCounts={filterCounts}
          activeFilterCount={activeFilterCount}
          onClearFilters={clearFilters}
          getFieldLabel={getFieldLabel}
          getFilterOptions={(field) => getSubmissionFieldFilterOptions(field, projects)}
          t={t}
        />
        <div className="text-center py-12 text-muted-foreground">{t('assignments.no_projects')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <AssignmentHeader
        hackathonId={hackathonId}
        judgesCount={judges.length}
        projectsCount={projects.length}
        judgesPerProject={judgesPerProject}
        effectiveJudgesPerProject={effectiveJudgesPerProject}
        pendingCount={pendingCount}
        isMutating={isMutating}
        isResetting={resetMutation.isPending}
        assignments={assignments}
        projects={projects}
        judgeIds={judges.map((j) => j.id)}
        onJudgesPerProjectChange={setJudgesPerProject}
        onRandomAssign={handleRandomAssign}
        onReset={handleReset}
        onDownloadCSV={downloadCSV}
        t={t}
      />

      <AssignmentStats stats={stats} judgesCount={judges.length} t={t} />

      {/* Charts - only show when there's data */}
      {stats.completedAssignments > 0 && maxScore > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <ScoreDistributionChart
              assignments={assignments}
              maxScore={maxScore}
            />
          </div>
          <div className="rounded-lg border p-4">
            <JudgeScoreComparison
              assignments={assignments}
              judges={judges}
            />
          </div>
        </div>
      )}

      <AssignmentToolbar
        projectQuery={projectQuery}
        onProjectQueryChange={setProjectQuery}
        submissionFilters={submissionFilters}
        onSubmissionFilterChange={updateSubmissionFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filterableFields={filterableFields}
        filterCounts={filterCounts}
        activeFilterCount={activeFilterCount}
        onClearFilters={clearFilters}
        getFieldLabel={getFieldLabel}
        getFilterOptions={(field) => getSubmissionFieldFilterOptions(field, projects)}
        t={t}
      />

      {viewMode === 'list' ? (
        <AssignmentListView
          projects={pagedProjects}
          judges={judges}
          assignments={assignments}
          projectStats={projectStats}
          projectAssignmentsMap={projectAssignmentsMap}
          judgeMap={judgeMap}
          isMutating={isMutating}
          onRemoveAssignment={removeAssignment}
          onAddAssignment={addAssignment}
          getAssignment={getAssignment}
          displayPage={displayPage}
          displayPageSize={DISPLAY_PAGE_SIZE}
          t={t}
        />
      ) : (
        <AssignmentMatrixView
          projects={pagedProjects}
          judges={judges}
          assignments={assignments}
          projectStats={projectStats}
          judgeAssignmentCounts={judgeAssignmentCounts}
          focusedJudgeId={focusedJudgeId}
          isMutating={isMutating}
          onToggleAssignment={toggleAssignment}
          getAssignment={getAssignment}
          displayPage={displayPage}
          displayPageSize={DISPLAY_PAGE_SIZE}
          t={t}
        />
      )}

      <AssignmentPagination
        displayPage={displayPage}
        displayTotalPages={displayTotalPages}
        totalItems={sortedProjects.length}
        displayPageSize={DISPLAY_PAGE_SIZE}
        onPageChange={setDisplayPage}
        t={t}
      />
    </div>
  )
}

export default AssignmentManager
