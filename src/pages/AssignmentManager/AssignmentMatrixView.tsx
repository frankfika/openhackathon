import { useNavigate } from 'react-router-dom'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { buildAdminPath, useAdminRoutes } from '@/lib/admin-routing'
import { MatrixCell } from './MatrixCell'
import type { Project, Assignment, AdminUser } from '@/lib/types'
import type { ProjectStats } from './types'

interface AssignmentMatrixViewProps {
  projects: Project[]
  judges: AdminUser[]
  assignments: Assignment[]
  projectStats: Map<string, ProjectStats>
  judgeAssignmentCounts: Map<string, number>
  focusedJudgeId: string
  isMutating: boolean
  onToggleAssignment: (projectId: string, judgeId: string) => void
  getAssignment: (projectId: string, judgeId: string) => Assignment | undefined
  displayPage: number
  displayPageSize: number
  t: (key: string) => string
}

export function AssignmentMatrixView({
  projects,
  judges,
  projectStats,
  judgeAssignmentCounts,
  focusedJudgeId,
  isMutating,
  onToggleAssignment,
  getAssignment,
  displayPage,
  displayPageSize,
  t,
}: AssignmentMatrixViewProps) {
  const navigate = useNavigate()
  const { adminBasePath } = useAdminRoutes()

  return (
    <div className="overflow-auto max-h-[calc(100vh-300px)] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 sticky left-0 z-20 bg-background text-center">#</TableHead>
            <TableHead className="sticky left-10 z-20 bg-background min-w-[180px]">
              {t('assignments.project')}
            </TableHead>
            {judges.map((judge) => (
              <TableHead
                key={judge.id}
                className={cn(
                  'text-center whitespace-nowrap sticky top-0 z-10 bg-background min-w-[90px]',
                  judge.id === focusedJudgeId && 'bg-primary/10'
                )}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-medium">{judge.name}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {judgeAssignmentCounts.get(judge.id) || 0}
                  </span>
                </div>
              </TableHead>
            ))}
            <TableHead className="text-center font-semibold min-w-[70px] bg-muted/30">
              {t('reports.average')}
            </TableHead>
            <TableHead className="text-center font-semibold min-w-[70px] bg-muted/30">
              {t('reports.progress')}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project, index) => {
            const globalIndex = (displayPage - 1) * displayPageSize + index
            const s = projectStats.get(project.id)

            return (
              <TableRow key={project.id} className="h-10">
                <TableCell className="sticky left-0 z-10 bg-background text-center text-muted-foreground text-xs tabular-nums">
                  {globalIndex + 1}
                </TableCell>
                <TableCell className="sticky left-10 z-10 bg-background">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `${buildAdminPath(adminBasePath, `projects/${project.id}`)}?tab=scores`
                      )
                    }
                    className="truncate text-sm text-left hover:underline block max-w-[220px]"
                  >
                    {project.title}
                  </button>
                  <p className="truncate text-[11px] font-mono text-muted-foreground max-w-[220px]">
                    {project.id}
                  </p>
                </TableCell>
                {judges.map((judge) => (
                  <TableCell
                    key={judge.id}
                    className={cn(
                      'text-center p-1',
                      judge.id === focusedJudgeId && 'bg-primary/10'
                    )}
                  >
                    <MatrixCell
                      assignment={getAssignment(project.id, judge.id)}
                      isMutating={isMutating}
                      onToggle={() => onToggleAssignment(project.id, judge.id)}
                      t={t}
                    />
                  </TableCell>
                ))}
                <TableCell className="text-center bg-muted/10">
                  {s && s.averageScore > 0 ? (
                    <span className="text-sm font-semibold tabular-nums">
                      {s.averageScore.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/40">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center bg-muted/10">
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
