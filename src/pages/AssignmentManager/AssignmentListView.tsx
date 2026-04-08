import { useNavigate } from 'react-router-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { JudgeChip } from './JudgeChip'
import { AddJudgePopover } from './AddJudgePopover'
import type { Project, Assignment, AdminUser } from '@/lib/types'
import type { ProjectStats } from './types'

interface AssignmentListViewProps {
  projects: Project[]
  judges: AdminUser[]
  assignments: Assignment[]
  projectStats: Map<string, ProjectStats>
  projectAssignmentsMap: Map<string, Assignment[]>
  judgeMap: Map<string, AdminUser>
  isMutating: boolean
  onRemoveAssignment: (id: string) => void
  onAddAssignment: (projectId: string, judgeId: string) => void
  getAssignment: (projectId: string, judgeId: string) => Assignment | undefined
  displayPage: number
  displayPageSize: number
  t: (key: string) => string
}

export function AssignmentListView({
  projects,
  judges,
  assignments,
  projectStats,
  projectAssignmentsMap,
  judgeMap,
  isMutating,
  onRemoveAssignment,
  onAddAssignment,
  getAssignment,
  displayPage,
  displayPageSize,
  t,
}: AssignmentListViewProps) {
  const navigate = useNavigate()
  const { adminBasePath } = useAdminRoutes()

  return (
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
          {projects.map((project, index) => {
            const globalIndex = (displayPage - 1) * displayPageSize + index
            const s = projectStats.get(project.id)
            const pa = projectAssignmentsMap.get(project.id) || []
            const unassignedJudges = judges.filter((j) => !pa.some((a) => a.judgeId === j.id))

            return (
              <TableRow key={project.id}>
                <TableCell className="text-center text-muted-foreground text-xs tabular-nums">
                  {globalIndex + 1}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `${buildAdminPath(adminBasePath, `projects/${project.id}`)}?tab=scores`
                      )
                    }
                    className="truncate text-sm text-left hover:underline block max-w-[220px] font-medium"
                  >
                    {project.title}
                  </button>
                  <p className="truncate text-[11px] font-mono text-muted-foreground max-w-[220px]">
                    {project.id}
                  </p>
                  {project.submitterName && (
                    <p className="truncate text-[11px] text-muted-foreground max-w-[220px]">
                      {project.submitterName}
                    </p>
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
                          onRemove={() => onRemoveAssignment(a.id)}
                          t={t}
                        />
                      )
                    })}

                    {/* Add judge button */}
                    {unassignedJudges.length > 0 && (
                      <AddJudgePopover
                        judges={unassignedJudges}
                        isMutating={isMutating}
                        onAdd={(judgeId) => onAddAssignment(project.id, judgeId)}
                        t={t}
                      />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {s && s.averageScore > 0 ? (
                    <span className="text-sm font-semibold tabular-nums">
                      {s.averageScore.toFixed(1)}
                    </span>
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
  )
}
