import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Assignment, AssignmentStatus } from '@/lib/types'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, ExternalLink, Loader2, Mail, Pencil, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { getSubmissionFields } from '@/lib/submission-fields'
import { useActiveHackathon } from '@/lib/active-hackathon'

type ProjectDetailData = {
  id: string
  title: string
  oneLiner: string
  description?: string
  tags?: string[]
  demoUrl?: string
  repoUrl?: string
  status?: 'draft' | 'submitted'
  submitterName?: string
  submitterEmail: string
  submissionData?: Record<string, unknown>
  hackathon?: {
    scoringCriteria?: { id: string; name: string; maxScore: number }[]
  }
}

const STATUS_OPTIONS: AssignmentStatus[] = ['pending', 'in_progress', 'completed']

export function ProjectDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { adminBasePath } = useAdminRoutes()
  const queryClient = useQueryClient()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<'overview' | 'scores'>(
    searchParams.get('tab') === 'scores' ? 'scores' : 'overview'
  )
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1')
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentStatus>('all')
  const [form, setForm] = useState({
    title: '',
    oneLiner: '',
    description: '',
    tags: '',
    demoUrl: '',
    repoUrl: '',
    status: 'submitted' as 'draft' | 'submitted',
  })

  const { data: project, isLoading: isLoadingProject } = useQuery({
    queryKey: ['project', id, 'detail'],
    queryFn: () => api.getProject(id!) as Promise<ProjectDetailData>,
    enabled: !!id,
  })

  const { data: assignments = [], isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['assignments', 'project', id],
    queryFn: () => api.getAssignments({ projectId: id! }),
    enabled: !!id,
  })

  const { activeHackathon } = useActiveHackathon()

  const submissionFieldLabels = useMemo(() => {
    const fields = getSubmissionFields(activeHackathon?.submissionSchema)
    return new Map(fields.map((field) => [field.id, field.label || field.id]))
  }, [activeHackathon?.submissionSchema])

  const receiptId = useMemo(() => {
    const receipt = project?.submissionData?._receipt
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) return null
    const value = (receipt as Record<string, unknown>).id
    return typeof value === 'string' && value.trim().length > 0 ? value : null
  }, [project?.submissionData])

  const visibleSubmissionEntries = useMemo(() => {
    if (!project?.submissionData) return []
    return Object.entries(project.submissionData).filter(([key]) => !key.startsWith('_'))
  }, [project?.submissionData])

  useEffect(() => {
    if (!project) return
    setForm({
      title: project.title || '',
      oneLiner: project.oneLiner || '',
      description: project.description || '',
      tags: Array.isArray(project.tags) ? project.tags.join(', ') : '',
      demoUrl: project.demoUrl || '',
      repoUrl: project.repoUrl || '',
      status: project.status || 'submitted',
    })
  }, [project])

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => {
      if (!id) throw new Error('Project id is required')
      return api.updateProject(id, {
        title: data.title,
        oneLiner: data.oneLiner,
        description: data.description,
        tags: data.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        demoUrl: data.demoUrl || undefined,
        repoUrl: data.repoUrl || undefined,
        status: data.status,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['project', id, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success(t('projects.update_success'))
      setIsEditing(false)
    },
    onError: () => {
      toast.error(t('projects.update_error'))
    },
  })

  const completedAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'completed'),
    [assignments]
  )
  const pendingAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'pending'),
    [assignments]
  )
  const inProgressAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'in_progress'),
    [assignments]
  )
  const avgScore = useMemo(() => {
    if (completedAssignments.length === 0) return 0
    const total = completedAssignments.reduce((sum, assignment) => sum + (assignment.totalScore || 0), 0)
    return total / completedAssignments.length
  }, [completedAssignments])

  const filteredAssignments = useMemo(() => {
    return assignments.filter((assignment) => {
      if (statusFilter !== 'all' && assignment.status !== statusFilter) return false
      return true
    })
  }, [assignments, statusFilter])

  const criterionNameMap = useMemo(() => {
    const map = new Map<string, string>()
    project?.hackathon?.scoringCriteria?.forEach((criterion) => {
      map.set(criterion.id, criterion.name)
    })
    return map
  }, [project?.hackathon?.scoringCriteria])

  const formatScoreBreakdown = (assignment: Assignment) => {
    if (!assignment.scores || !Array.isArray(assignment.scores) || assignment.scores.length === 0) {
      return '-'
    }

    return assignment.scores
      .map((score) => {
        const criterionName = criterionNameMap.get(score.criterionId) || score.criterionId
        return `${criterionName}: ${score.score}`
      })
      .join(' / ')
  }

  const renderSubmissionValue = (value: unknown) => {
    if (value == null || value === '') return '-'
    if (typeof value === 'boolean') return value ? t('common.yes', 'Yes') : t('common.no', 'No')
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const handleSave = () => {
    updateMutation.mutate(form)
  }

  if (isLoadingProject || isLoadingAssignments) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!project) {
    return <div className="p-6">{t('projects.not_found')}</div>
  }

  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="surface-panel-strong border-none shadow-none">
        <div className="space-y-6 p-6 md:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <Button
                variant="ghost"
                className="px-0"
                onClick={() => navigate(buildAdminPath(adminBasePath, 'projects'))}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('common.back')}
              </Button>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={form.status === 'submitted' ? 'default' : 'secondary'}>
                    {t(`projects.status_options.${form.status}`)}
                  </Badge>
                  <span className="grand-chip">{t('projects.project_id')}: {project.id.slice(0, 8)}</span>
                  {receiptId ? (
                    <span className="grand-chip">
                      {t('submission.receipt_number_label')}: {receiptId}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight md:text-4xl">{project.title}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">
                    {project.oneLiner || t('projects.subtitle')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/55">
                  <Mail className="h-3.5 w-3.5" />
                  <span>{project.submitterName || project.submitterEmail}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-3 py-1.5 backdrop-blur-sm dark:border-slate-700/60 dark:bg-slate-900/55">
                  <span className="font-medium text-foreground">{t('reports.progress')}</span>
                  <span>{completedAssignments.length}/{assignments.length}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isEditing ? (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t('common.edit')}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="mr-2 h-4 w-4" />
                    {t('common.cancel')}
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    {t('common.save')}
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card className="surface-inset border-none shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('projects.score')}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{avgScore > 0 ? avgScore.toFixed(1) : '-'}</CardContent>
            </Card>
            <Card className="surface-inset border-none shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.progress')}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">
                {completedAssignments.length}/{assignments.length}
              </CardContent>
            </Card>
            <Card className="surface-inset border-none shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.pending_short')}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{pendingAssignments.length}</CardContent>
            </Card>
            <Card className="surface-inset border-none shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{t('reports.in_progress_short')}</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-bold">{inProgressAssignments.length}</CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('overview')}
            >
              {t('common.overview')}
            </Button>
            <Button
              variant={activeTab === 'scores' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveTab('scores')}
            >
              {t('projects.view_scores')}
            </Button>
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.95fr)]">
          <div className="space-y-6">
            <Card className="surface-panel border-none shadow-none">
              <CardHeader>
                <CardTitle>{t('projects.details')}</CardTitle>
                <CardDescription>{t('projects.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="surface-inset space-y-4 p-4 md:p-5">
                      <div className="space-y-2">
                        <Label>{t('projects.project_name')}</Label>
                        <Input
                          value={form.title}
                          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('projects.one_liner')}</Label>
                        <Input
                          value={form.oneLiner}
                          onChange={(e) => setForm((prev) => ({ ...prev, oneLiner: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('projects.description')}</Label>
                        <Textarea
                          value={form.description}
                          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                          rows={7}
                        />
                      </div>
                    </div>

                    <div className="surface-inset space-y-4 p-4 md:p-5">
                      <div className="space-y-2">
                        <Label>{t('projects.tags')}</Label>
                        <Input
                          value={form.tags}
                          onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
                        />
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{t('projects.demo_url')}</Label>
                          <Input
                            value={form.demoUrl}
                            onChange={(e) => setForm((prev) => ({ ...prev, demoUrl: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t('projects.repo_url')}</Label>
                          <Input
                            value={form.repoUrl}
                            onChange={(e) => setForm((prev) => ({ ...prev, repoUrl: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{t('projects.status')}</Label>
                        <select
                          value={form.status}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, status: e.target.value as 'draft' | 'submitted' }))
                          }
                          className="w-full rounded-xl border border-white/80 bg-white/78 px-3 py-2 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/58 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                        >
                          <option value="draft">{t('projects.status_options.draft')}</option>
                          <option value="submitted">{t('projects.status_options.submitted')}</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="surface-inset space-y-3 p-4 md:p-5">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t('projects.one_liner')}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-foreground">{project.oneLiner || '-'}</p>
                      </div>
                      <div className="h-px bg-border/60" />
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t('projects.description')}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                          {project.description || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="surface-inset space-y-3 p-4 md:p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t('projects.tags')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(project.tags || []).length > 0 ? (
                            (project.tags || []).map((tag) => (
                              <Badge key={tag} variant="outline">
                                {tag}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">-</p>
                          )}
                        </div>
                      </div>

                      <div className="surface-inset space-y-3 p-4 md:p-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                          {t('projects.links', 'Project Links')}
                        </p>
                        <div className="space-y-2 text-sm">
                          {project.demoUrl ? (
                            <a
                              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                              href={project.demoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                              {t('projects.demo_url')}
                            </a>
                          ) : null}
                          {project.repoUrl ? (
                            <a
                              className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                              href={project.repoUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                              {t('projects.repo_url')}
                            </a>
                          ) : null}
                          {!project.demoUrl && !project.repoUrl ? (
                            <p className="text-sm text-muted-foreground">-</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {visibleSubmissionEntries.length > 0 && (
              <Card className="surface-panel border-none shadow-none">
                <CardHeader>
                  <CardTitle>{t('projects.submission_data', 'Submission Data')}</CardTitle>
                  <CardDescription>
                    {t('projects.submission_data_desc', 'Custom fields submitted with the project')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleSubmissionEntries.map(([key, value]) => (
                    <div key={key} className="surface-inset space-y-2 p-4 md:p-5">
                      <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {submissionFieldLabels.get(key) || key}
                      </Label>
                      <p className="whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
                        {renderSubmissionValue(value)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="surface-panel border-none shadow-none">
              <CardHeader>
                <CardTitle>{t('projects.project_id')}</CardTitle>
                <CardDescription>{t('projects.submitter')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="surface-inset space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('projects.project_id')}
                  </p>
                  <p className="break-all font-mono text-sm text-foreground">{project.id}</p>
                </div>

                {receiptId ? (
                  <div className="surface-inset space-y-2 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t('submission.receipt_number_label')}
                    </p>
                    <p className="break-all font-mono text-sm text-foreground">{receiptId}</p>
                  </div>
                ) : null}

                <div className="surface-inset space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('projects.submitter')}
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {project.submitterName || t('common.anonymous')}
                  </p>
                  <p className="break-all text-sm text-muted-foreground">{project.submitterEmail}</p>
                </div>

                <div className="surface-inset space-y-2 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('projects.status')}
                  </p>
                  <div>
                    <Badge variant={form.status === 'submitted' ? 'default' : 'secondary'}>
                      {t(`projects.status_options.${form.status}`)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="surface-panel border-none shadow-none">
              <CardHeader>
                <CardTitle>{t('projects.view_scores')}</CardTitle>
                <CardDescription>{t('reports.scoring_matrix_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="surface-inset flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t('reports.judges')}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{assignments.length}</p>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <p>{t('reports.pending_short')}: {pendingAssignments.length}</p>
                    <p>{t('reports.in_progress_short')}: {inProgressAssignments.length}</p>
                  </div>
                </div>
                <div className="surface-inset p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {t('projects.score')}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-foreground">
                    {avgScore > 0 ? avgScore.toFixed(1) : '-'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'scores' && (
        <Card className="surface-panel border-none shadow-none">
          <CardHeader>
            <CardTitle>{t('projects.view_scores')}</CardTitle>
            <CardDescription>{t('reports.scoring_matrix_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('all')}
              >
                {t('reports.filter_all')}
              </Button>
              {STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(status)}
                >
                  {t(`judging.status.${status}`)}
                </Button>
              ))}
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="surface-inset p-6 text-sm text-muted-foreground">
                {t('judging.no_assignments')}
              </div>
            ) : (
              <div className="table-shell overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.judges')}</TableHead>
                      <TableHead>{t('projects.status')}</TableHead>
                      <TableHead>{t('projects.score')}</TableHead>
                      <TableHead>{t('reports.scoring_matrix')}</TableHead>
                      <TableHead>{t('judging.comments')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>{assignment.judge?.name || assignment.judgeId}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {String(t(`judging.status.${assignment.status}`))}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {assignment.status === 'completed' ? assignment.totalScore ?? '-' : '-'}
                        </TableCell>
                        <TableCell className="max-w-[340px] text-sm text-muted-foreground">
                          {formatScoreBreakdown(assignment)}
                        </TableCell>
                        <TableCell className="max-w-[280px] whitespace-pre-wrap text-sm">
                          {assignment.comment || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
