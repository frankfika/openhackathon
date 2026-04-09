import { memo, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { Assignment, AdminUser } from '@/lib/types'

interface JudgeScoreComparisonProps {
  assignments: Assignment[]
  judges: AdminUser[]
  title?: string
}

export const JudgeScoreComparison = memo(function JudgeScoreComparison({
  assignments,
  judges,
  title = '评委评分对比',
}: JudgeScoreComparisonProps) {
  const data = useMemo(() => {
    const judgeStats = new Map<string, { total: number; count: number; name: string }>()

    // Initialize with all judges (even those with no assignments)
    for (const judge of judges) {
      judgeStats.set(judge.id, { total: 0, count: 0, name: judge.name })
    }

    // Calculate stats for completed assignments
    for (const assignment of assignments) {
      if (assignment.status === 'completed' && typeof assignment.totalScore === 'number') {
        const stats = judgeStats.get(assignment.judgeId)
        if (stats) {
          stats.total += assignment.totalScore
          stats.count += 1
        }
      }
    }

    return Array.from(judgeStats.entries())
      .map(([id, stats]) => ({
        id,
        name: stats.name,
        average: stats.count > 0 ? Number((stats.total / stats.count).toFixed(1)) : 0,
        count: stats.count,
      }))
      .filter((j) => j.count > 0)
      .sort((a, b) => b.average - a.average)
  }, [assignments, judges])

  const overallAverage = useMemo(() => {
    if (data.length === 0) return 0
    const total = data.reduce((sum, j) => sum + j.average, 0)
    return Number((total / data.length).toFixed(1))
  }, [data])

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        暂无评分数据
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium">{title}</h4>}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11 }}
              width={55}
            />
            <Tooltip
              formatter={(value: number, _name, props) => {
                const item = props.payload
                return [`平均分: ${value} (${item.count} 个评分)`, item.name]
              }}
            />
            <ReferenceLine
              x={overallAverage}
              stroke="#888"
              strokeDasharray="3 3"
              label={{
                value: `平均: ${overallAverage}`,
                position: 'top',
                fontSize: 10,
              }}
            />
            <Bar
              dataKey="average"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
})
