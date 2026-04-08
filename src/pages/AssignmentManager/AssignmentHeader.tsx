import { Shuffle, Download, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { planBalancedRandomAssignments } from '@/lib/assignment-planner'
import type { Project, Assignment } from '@/lib/types'

interface AssignmentHeaderProps {
  hackathonId: string | undefined
  judgesCount: number
  projectsCount: number
  judgesPerProject: number | null
  effectiveJudgesPerProject: number
  pendingCount: number
  isMutating: boolean
  isResetting: boolean
  assignments: Assignment[]
  projects: Project[]
  judgeIds: string[]
  onJudgesPerProjectChange: (value: number | null) => void
  onRandomAssign: (assignments: { projectId: string; judgeId: string }[], count: number, judgesPerProject: number) => void
  onReset: () => void
  onDownloadCSV: () => void
  t: (key: string) => string
}

export function AssignmentHeader({
  hackathonId,
  judgesCount,
  projectsCount,
  judgesPerProject,
  effectiveJudgesPerProject,
  pendingCount,
  isMutating,
  isResetting,
  assignments,
  projects,
  judgeIds,
  onJudgesPerProjectChange,
  onRandomAssign,
  onReset,
  onDownloadCSV,
  t,
}: AssignmentHeaderProps) {
  const randomPlan = planBalancedRandomAssignments({
    projects,
    judgeIds,
    existingAssignments: assignments,
    judgesPerProject: effectiveJudgesPerProject,
  })

  const canRandomAssign =
    !isMutating &&
    hackathonId &&
    judgesCount > 0 &&
    projectsCount > 0 &&
    randomPlan.assignments.length > 0

  const canReset = !isMutating && !isResetting && pendingCount > 0

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('assignments.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('assignments.subtitle')}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onDownloadCSV}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('reports.download_csv')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canReset}
          onClick={onReset}
          className="gap-1.5 text-destructive hover:text-destructive"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('assignments.reset_title')}
        </Button>
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={1}
            max={Math.max(judgesCount, 1)}
            value={effectiveJudgesPerProject}
            onChange={(e) => {
              const v = Number.parseInt(e.target.value, 10)
              onJudgesPerProjectChange(Number.isFinite(v) && v > 0 ? v : null)
            }}
            className="h-8 w-16 text-center text-sm tabular-nums"
            title={t('assignments.judges_per_project')}
          />
          <Button
            size="sm"
            disabled={!canRandomAssign}
            onClick={() =>
              onRandomAssign(
                randomPlan.assignments,
                randomPlan.assignments.length,
                effectiveJudgesPerProject
              )
            }
            className="gap-1.5"
          >
            <Shuffle className="h-3.5 w-3.5" />
            {t('assignments.random_assign')}
          </Button>
        </div>
      </div>
    </div>
  )
}
