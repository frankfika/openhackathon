import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { Download, BarChart3, TrendingUp, Loader2, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { AssignmentStatus, Project } from '@/lib/types'
import { useNavigate } from 'react-router-dom'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getFilterableSubmissionFields, getProjectSubmissionFieldValue, getSubmissionFieldFilterOptions } from '@/lib/submission-fields'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'

type ProjectScoringReportItem = {
  projectId: string
  projectTitle: string
  submitterName?: string | null
  submitterEmail: string
  averageScore: number
  totalAssignments: number
  completedAssignments: number
  pendingAssignments: number
  inProgressAssignments: number
  judges: {
    assignmentId: string
    judgeId: string
    judgeName: string
    judgeEmail: string
    status: AssignmentStatus
    totalScore?: number | null
  }[]
}

export function ScoringReport() {
  const { t } = useTranslation()
  const { activeHackathon } = useActiveHackathon()
  const navigate = useNavigate()
  const { adminBasePath } = useAdminRoutes()
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all')
  const [projectQuery, setProjectQuery] = useState('')
  const [submissionFilters, setSubmissionFilters] = useState<Record<string, string>>({})

  const { data: reportData = [], isLoading: isLoadingReport } = useQuery({
    queryKey: ['project-scoring-report', activeHackathon?.id],
    queryFn: () => api.getProjectScoringReport({
      hackathonId: activeHackathon?.id,
    }),
    enabled: !!activeHackathon?.id,
  })

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['projects', activeHackathon?.id, 'report-filters'],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon?.id }) as Promise<Project[]>,
    enabled: !!activeHackathon?.id,
  })

  const { data: judges = [] } = useQuery({
    queryKey: ['hackathon-judges', activeHackathon?.id],
    queryFn: () => api.getHackathonJudges(activeHackathon.id),
    enabled: !!activeHackathon?.id,
  })

  const filterableFields = useMemo(
    () => getFilterableSubmissionFields(activeHackathon?.submissionSchema),
    [activeHackathon?.submissionSchema]
  )

  const projectLookup = useMemo(
    () => new Map(allProjects.map((project) => [project.id, project])),
    [allProjects]
  )

  const scopedReportData = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLowerCase()

    return reportData.filter((item) => {
      const project = projectLookup.get(item.projectId)

      if (normalizedQuery) {
        const searchableText = [
          item.projectTitle,
          item.submitterName,
          item.submitterEmail,
          project?.oneLiner,
          ...(project?.tags || []),
          ...filterableFields.map((field) => (project ? getProjectSubmissionFieldValue(project, field.id) : '')),
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
        const projectValue = project ? getProjectSubmissionFieldValue(project, fieldId) : ''
        if (projectValue !== selectedValue) {
          return false
        }
      }

      return true
    })
  }, [reportData, projectLookup, projectQuery, submissionFilters, filterableFields])

  const stats = useMemo(() => {
    const totalProjects = scopedReportData.length
    const scoredProjects = scopedReportData.filter((project) => project.completedAssignments > 0).length
    const totalAssignments = scopedReportData.reduce((sum, project) => sum + project.totalAssignments, 0)
    const completedAssignments = scopedReportData.reduce((sum, project) => sum + project.completedAssignments, 0)
    const inProgressAssignments = scopedReportData.reduce((sum, project) => sum + project.inProgressAssignments, 0)
    const pendingAssignments = scopedReportData.reduce((sum, project) => sum + project.pendingAssignments, 0)

    const totalCompletedScore = scopedReportData.reduce(
      (sum, project) =>
        sum +
        project.judges.reduce((projectSum, judge) => {
          if (judge.status !== 'completed') return projectSum
          return projectSum + (judge.totalScore || 0)
        }, 0),
      0
    )

    const avgScore = completedAssignments > 0 ? totalCompletedScore / completedAssignments : 0
    const completionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0

    return {
      totalProjects,
      scoredProjects,
      avgScore: avgScore.toFixed(1),
      completionRate: completionRate.toFixed(0),
      totalAssignments,
      completedAssignments,
      inProgressAssignments,
      pendingAssignments,
    }
  }, [scopedReportData])

  const filteredReportData = useMemo(() => {
    if (statusFilter === 'all') return scopedReportData
    if (statusFilter === 'pending') {
      return scopedReportData.filter((project) => project.pendingAssignments > 0)
    }
    if (statusFilter === 'in_progress') {
      return scopedReportData.filter((project) => project.inProgressAssignments > 0)
    }
    return scopedReportData.filter(
      (project) => project.totalAssignments > 0 && project.completedAssignments === project.totalAssignments
    )
  }, [scopedReportData, statusFilter])

  const filterCounts = useMemo(
    () => ({
      all: scopedReportData.length,
      pending: scopedReportData.filter((project) => project.pendingAssignments > 0).length,
      in_progress: scopedReportData.filter((project) => project.inProgressAssignments > 0).length,
      completed: scopedReportData.filter(
        (project) => project.totalAssignments > 0 && project.completedAssignments === project.totalAssignments
      ).length,
    }),
    [scopedReportData]
  )

  const getJudgeAssignment = (project: ProjectScoringReportItem, judgeId: string) =>
    project.judges.find((judge) => judge.judgeId === judgeId)

  const downloadCSV = () => {
    const headers = ['Rank', 'Project', 'Submitter', ...judges.map((j) => j.name), 'Average Score', 'Progress']

    const rows = filteredReportData.map((project, index) => {
      const judgeCells = judges.map((judge) => {
        const assignment = getJudgeAssignment(project, judge.id)
        if (!assignment) return 'unassigned'
        if (assignment.status === 'completed' && assignment.totalScore !== null && assignment.totalScore !== undefined) {
          return `${assignment.totalScore} (completed)`
        }
        return assignment.status
      })

      return [
        index + 1,
        `"${project.projectTitle}"`,
        `"${project.submitterName || project.submitterEmail}"`,
        ...judgeCells,
        project.averageScore > 0 ? project.averageScore.toFixed(1) : '-',
        `${project.completedAssignments}/${project.totalAssignments}`,
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `project-scoring-report-${activeHackathon?.id}-${Date.now()}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (isLoadingReport) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
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

  const activeFilterCount = (projectQuery.trim() ? 1 : 0) + Object.values(submissionFilters).filter(Boolean).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {t('reports.title', 'Scoring Report')}
          </h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('reports.subtitle')}
          </p>
        </div>
        <div className="flex w-full items-center gap-2 md:w-auto">
          <Button onClick={downloadCSV}>
            <Download className="mr-2 h-4 w-4" />
            {t('reports.download_csv')}
          </Button>
        </div>
      </div>

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
              <Label htmlFor="reportProjectQuery">{t('assignments.search_projects')}</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reportProjectQuery"
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder={t('assignments.search_projects_placeholder')}
                  className="pl-9"
                />
              </div>
            </div>

            {filterableFields.map((field) => {
              const sourceProjects = scopedReportData
                .map((item) => projectLookup.get(item.projectId))
                .filter((project): project is Project => Boolean(project))
              const options = getSubmissionFieldFilterOptions(field, sourceProjects)

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
              {t('assignments.filtered_projects_count', { count: scopedReportData.length, total: reportData.length })}
            </Badge>
            {activeFilterCount > 0 ? (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                {t('assignments.clear_filters')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="surface-panel border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.total_projects')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {t('reports.scored_count', { count: stats.scoredProjects })}
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.avg_score')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avgScore}</div>
            <p className="text-xs text-muted-foreground">{t('reports.out_of', { max: 100 })}</p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.completion_rate')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedAssignments}/{stats.totalAssignments} {t('reports.assignments_completed')}
            </p>
          </CardContent>
        </Card>

        <Card className="surface-panel border-none shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('reports.judges')}</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{judges.length}</div>
            <p className="text-xs text-muted-foreground">
              {t('reports.pending_short', 'Pending')} {stats.pendingAssignments} · {t('reports.in_progress_short', 'In Progress')} {stats.inProgressAssignments}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          {t('reports.filter_all', 'All')} ({filterCounts.all})
        </Button>
        <Button
          variant={statusFilter === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('pending')}
        >
          {t('reports.filter_pending', 'Pending')} ({filterCounts.pending})
        </Button>
        <Button
          variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('in_progress')}
        >
          {t('reports.filter_in_progress', 'In Progress')} ({filterCounts.in_progress})
        </Button>
        <Button
          variant={statusFilter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('completed')}
        >
          {t('reports.filter_completed', 'Completed')} ({filterCounts.completed})
        </Button>
      </div>

      <Card className="surface-panel border-none shadow-none">
        <CardHeader>
          <CardTitle>{t('reports.scoring_matrix')}</CardTitle>
          <CardDescription>
            {t('reports.scoring_matrix_desc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="table-shell overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">{t('reports.rank')}</TableHead>
                  <TableHead className="min-w-[220px]">{t('reports.project')}</TableHead>
                  <TableHead className="min-w-[140px]">{t('reports.submitter')}</TableHead>
                  {judges.map((judge) => (
                    <TableHead key={judge.id} className="text-center min-w-[130px]">
                      {judge.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-center font-semibold min-w-[100px]">
                    {t('reports.average')}
                  </TableHead>
                  <TableHead className="text-center font-semibold min-w-[120px]">{t('reports.progress', 'Progress')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReportData.map((project, index) => (
                  <TableRow key={project.projectId}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams({ tab: 'scores' })
                          navigate(`${buildAdminPath(adminBasePath, `projects/${project.projectId}`)}?${params.toString()}`)
                        }}
                        className="font-medium text-left hover:underline"
                      >
                        {project.projectTitle}
                      </button>
                    </TableCell>
                    <TableCell className="text-sm">
                      {project.submitterName || project.submitterEmail}
                    </TableCell>
                    {judges.map((judge) => {
                      const assignment = getJudgeAssignment(project, judge.id)
                      if (!assignment) {
                        return (
                          <TableCell key={judge.id} className="text-center">
                            <Badge variant="outline">{t('reports.unassigned', 'Unassigned')}</Badge>
                          </TableCell>
                        )
                      }

                      if (assignment.status === 'pending') {
                        return (
                          <TableCell key={judge.id} className="text-center">
                            <Badge variant="outline" className="border-amber-300 text-amber-700">
                              {t('judging.status.pending', 'Pending')}
                            </Badge>
                          </TableCell>
                        )
                      }

                      if (assignment.status === 'in_progress') {
                        return (
                          <TableCell key={judge.id} className="text-center">
                            <Badge variant="outline" className="border-blue-300 text-blue-700">
                              {t('judging.status.in_progress', 'In Progress')}
                            </Badge>
                          </TableCell>
                        )
                      }

                      if (assignment.status === 'completed') {
                        return (
                          <TableCell key={judge.id} className="text-center">
                            <Badge variant="secondary">
                              {assignment.totalScore ?? '-'}
                            </Badge>
                          </TableCell>
                        )
                      }

                      return (
                        <TableCell key={judge.id} className="text-center">
                          <Badge variant="outline">
                            {String(t(`judging.status.${assignment.status}`, assignment.status))}
                          </Badge>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-center">
                      {project.averageScore > 0 ? (
                        <Badge variant="default" className="font-semibold">
                          {project.averageScore.toFixed(1)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">
                        {project.completedAssignments}/{project.totalAssignments}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
