import type { AssignmentAggregateStats } from './types'

interface AssignmentStatsProps {
  stats: AssignmentAggregateStats
  judgesCount: number
  t: (key: string) => string
}

export function AssignmentStats({ stats, judgesCount, t }: AssignmentStatsProps) {
  return (
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
        <span className="ml-1 text-xs text-muted-foreground">
          ({stats.completedAssignments}/{stats.totalAssignments})
        </span>
      </div>
      <div className="h-4 w-px bg-border" />
      <div>
        <span className="text-lg font-semibold">{judgesCount}</span>
        <span className="ml-1.5 text-muted-foreground">{t('reports.judges')}</span>
      </div>
    </div>
  )
}
