import React, { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Project, Assignment } from '@/lib/types'
import { useActiveHackathon } from '@/lib/active-hackathon'
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, Pencil, Trash2, Eye, Loader2, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { getFilterableSubmissionFields, getFieldLabel, getProjectSubmissionFieldValue, getSubmissionFieldFilterOptions } from '@/lib/submission-fields'
import { useDebounce } from '@/lib/use-debounce'

const PAGE_SIZE = 50

type ProjectWithAssignments = Project & {
  assignments?: Assignment[]
}

function calculateProjectScore(projectId: string, assignments: Assignment[] = []) {
  const done = assignments.filter((a) => a.projectId === projectId && a.status === 'completed')
  if (done.length === 0) return null
  return done.reduce((sum, a) => sum + (a.totalScore || 0), 0) / done.length
}

export function Projects() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { adminBasePath } = useAdminRoutes()
  const { activeHackathon } = useActiveHackathon()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, 300)
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null)
  const [submissionFilters, setSubmissionFilters] = useState<Record<string, string>>({})

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1) }, [debouncedQuery, submissionFilters])

  // Lite query for filter-option population (all projects, no nested data)
  const { data: allProjectsLite = [] } = useQuery<Project[]>({
    queryKey: ['projects', activeHackathon.id, 'lite'],
    queryFn: () => api.getProjects({ hackathonId: activeHackathon.id, lite: true }),
    enabled: !!activeHackathon.id,
    staleTime: 2 * 60 * 1000,
  })

  const filterableFields = useMemo(
    () => getFilterableSubmissionFields(activeHackathon?.submissionSchema),
    [activeHackathon?.submissionSchema]
  )

  useEffect(() => {
    const allowed = new Set(filterableFields.map((f) => f.id))
    setSubmissionFilters((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k, v]) => allowed.has(k) && v))
    )
  }, [filterableFields])

  const updateFilter = (fieldId: string, value: string) =>
    setSubmissionFilters((prev) =>
      value ? { ...prev, [fieldId]: value } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== fieldId))
    )

  // Main paginated query (server search)
  const { data: pageResult, isLoading, isError } = useQuery({
    queryKey: ['projects', activeHackathon.id, 'paginated', page, debouncedQuery],
    queryFn: () => api.getProjectsPaginated({
      hackathonId: activeHackathon.id,
      page,
      pageSize: PAGE_SIZE,
      search: debouncedQuery || undefined,
    }),
    enabled: !!activeHackathon.id,
    placeholderData: (prev) => prev,
  })

  const projects: ProjectWithAssignments[] = pageResult?.data ?? []
  const total = pageResult?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', activeHackathon.id] })
      toast.success(t('projects.delete_success'))
      setProjectToDelete(null)
    },
    onError: () => toast.error(t('projects.delete_error')),
  })

  // Client-side submission field filter on current page
  const filteredProjects = useMemo(() => projects.filter((project) => {
    for (const [fieldId, val] of Object.entries(submissionFilters)) {
      if (val && getProjectSubmissionFieldValue(project, fieldId) !== val) return false
    }
    return true
  }), [projects, submissionFilters])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('projects.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('projects.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('projects.search_placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 w-60"
            />
          </div>
          {filterableFields.map((field) => (
            <Select
              key={field.id}
              value={submissionFilters[field.id] || '__all__'}
              onValueChange={(v) => updateFilter(field.id, v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder={getFieldLabel(field.id, field.label, t)} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('assignments.all_filter_values')}</SelectItem>
                {getSubmissionFieldFilterOptions(field, allProjectsLite).map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-shell">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('projects.project_name')}</TableHead>
              <TableHead>{t('projects.submitter')}</TableHead>
              <TableHead>{t('projects.status')}</TableHead>
              <TableHead className="text-right">{t('projects.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {t('projects.loading')}
                  </div>
                </TableCell>
              </TableRow>
            ) : isError ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-red-500">
                  {t('projects.load_error')}
                </TableCell>
              </TableRow>
            ) : filteredProjects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {t('projects.no_projects')}
                </TableCell>
              </TableRow>
            ) : (
              filteredProjects.map((project) => {
                const score = calculateProjectScore(project.id, project.assignments || [])
                return (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => navigate(buildAdminPath(adminBasePath, `projects/${project.id}`))}
                  >
                    <TableCell className="font-medium">
                      <div>
                        <span>{project.title}</span>
                        {project.oneLiner && (
                          <p className="text-xs text-muted-foreground truncate max-w-[260px]">{project.oneLiner}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span>{project.submitterName || t('common.anonymous')}</span>
                        <p className="text-xs text-muted-foreground">{project.submitterEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={project.status === 'submitted' ? 'default' : 'secondary'}>
                          {project.status === 'submitted' ? t('projects.status_options.submitted') : t('projects.status_options.draft')}
                        </Badge>
                        {score !== null && (
                          <span className="text-xs text-muted-foreground font-mono">{score.toFixed(1)} pts</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t('common.view_details')}
                          onClick={() => navigate(buildAdminPath(adminBasePath, `projects/${project.id}`))}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t('projects.view_scores')}
                          onClick={() => navigate(`${buildAdminPath(adminBasePath, `projects/${project.id}`)}?tab=scores`)}
                        >
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={t('common.edit')}
                          onClick={() => navigate(`${buildAdminPath(adminBasePath, `projects/${project.id}`)}?edit=1`)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                          title={t('common.delete')}
                          onClick={() => setProjectToDelete(project)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {t('common.showing_range', {
              from: (page - 1) * PAGE_SIZE + 1,
              to: Math.min(page * PAGE_SIZE, total),
              total,
            })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 tabular-nums">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('projects.delete_confirm_title')}</DialogTitle>
            <DialogDescription>
              {t('projects.delete_confirm_desc', { title: projectToDelete?.title })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectToDelete(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={() => projectToDelete && deleteMutation.mutate(projectToDelete.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('projects.delete_project')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
