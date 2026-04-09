import { memo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { Assignment } from '@/lib/types'

interface ScoreDistributionChartProps {
  assignments: Assignment[]
  maxScore: number
  title?: string
}

export const ScoreDistributionChart = memo(function ScoreDistributionChart({
  assignments,
  maxScore,
  title = '评分分布',
}: ScoreDistributionChartProps) {
  // Only include completed assignments with scores
  const scoredAssignments = assignments.filter(
    (a) => a.status === 'completed' && typeof a.totalScore === 'number'
  )

  if (scoredAssignments.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        暂无评分数据
      </div>
    )
  }

  // Create score buckets (e.g., 0-10, 11-20, etc.)
  const bucketSize = Math.max(1, Math.round(maxScore / 10))
  const buckets = new Map<number, number>()

  for (const assignment of scoredAssignments) {
    const bucket = Math.floor((assignment.totalScore || 0) / bucketSize) * bucketSize
    buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
  }

  const data = Array.from(buckets.entries())
    .map(([bucket, count]) => ({
      range: `${bucket}-${Math.min(bucket + bucketSize - 1, maxScore)}`,
      count,
      bucket,
    }))
    .sort((a, b) => a.bucket - b.bucket)

  const colors = [
    '#ef4444', // red-500
    '#f97316', // orange-500
    '#eab308', // yellow-500
    '#22c55e', // green-500
    '#10b981', // emerald-500
  ]

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium">{title}</h4>}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 11 }}
              interval={0}
              angle={-45}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${value} 个评分`, '数量']}
              labelFormatter={(label) => `分数段: ${label}`}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[Math.min(index, colors.length - 1)]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>平均分: {(scoredAssignments.reduce((sum, a) => sum + (a.totalScore || 0), 0) / scoredAssignments.length).toFixed(1)}</span>
        <span>评分数: {scoredAssignments.length}</span>
      </div>
    </div>
  )
})
