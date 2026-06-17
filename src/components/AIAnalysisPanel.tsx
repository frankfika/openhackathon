/**
 * AI Analysis Panel - 显示AI项目分析的详细面板
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, RefreshCw, TrendingUp, AlertTriangle, Lightbulb, Code2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface AIAnalysisPanelProps {
  projectId: string
  className?: string
}

interface ProjectAssessment {
  overallScore: number
  dimensions: {
    completeness: { score: number; reasoning: string }
    innovation: { score: number; reasoning: string }
    technicalDepth: { score: number; reasoning: string }
    presentation: { score: number; reasoning: string }
  }
  highlights: string[]
  concerns: string[]
  suggestedPriority: 'high' | 'medium' | 'low'
  technicalTags: string[]
  estimatedComplexity: 'beginner' | 'intermediate' | 'advanced' | 'expert'
}

export function AIAnalysisPanel({ projectId, className }: AIAnalysisPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const queryClient = useQueryClient()

  // 获取AI评估结果
  const { data: assessment, isLoading, error } = useQuery<ProjectAssessment>({
    queryKey: ['ai-assessment', projectId],
    queryFn: async () => {
      const response = await api.post(`/ai/analyze-project/${projectId}`)
      return response.data
    },
    staleTime: 60 * 60 * 1000, // 1小时缓存
  })

  // 重新分析
  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post(`/ai/analyze-project/${projectId}`)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assessment', projectId] })
      toast.success('AI分析已更新')
    },
    onError: () => {
      toast.error('AI分析失败，请稍后重试')
    },
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>AI质量分析</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error || !assessment) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>AI质量分析</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>AI分析暂时不可用，请稍后重试</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => reanalyzeMutation.mutate()}
            disabled={reanalyzeMutation.isPending}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', reanalyzeMutation.isPending && 'animate-spin')} />
            重新分析
          </Button>
        </CardContent>
      </Card>
    )
  }

  const priorityConfig = {
    high: { label: '高优先级', color: 'bg-red-500/10 text-red-700 border-red-500/30' },
    medium: { label: '中优先级', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
    low: { label: '低优先级', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  }

  const complexityConfig = {
    beginner: { label: '入门级', color: 'bg-green-500/10 text-green-700' },
    intermediate: { label: '中级', color: 'bg-blue-500/10 text-blue-700' },
    advanced: { label: '高级', color: 'bg-purple-500/10 text-purple-700' },
    expert: { label: '专家级', color: 'bg-orange-500/10 text-orange-700' },
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>AI质量分析</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => reanalyzeMutation.mutate()}
              disabled={reanalyzeMutation.isPending}
            >
              <RefreshCw className={cn('h-4 w-4', reanalyzeMutation.isPending && 'animate-spin')} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <CardDescription>基于AI模型的智能项目评估</CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* 综合评分 */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">综合评分</p>
              <p className="text-3xl font-bold">{assessment.overallScore}/100</p>
            </div>
            <div className="flex gap-2">
              <Badge className={priorityConfig[assessment.suggestedPriority].color}>
                {priorityConfig[assessment.suggestedPriority].label}
              </Badge>
              <Badge className={complexityConfig[assessment.estimatedComplexity].color}>
                {complexityConfig[assessment.estimatedComplexity].label}
              </Badge>
            </div>
          </div>

          {/* 各维度评分 */}
          <div className="space-y-4">
            <p className="text-sm font-semibold">评估维度</p>
            {Object.entries(assessment.dimensions).map(([key, dim]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {key === 'completeness'
                      ? '完整性'
                      : key === 'innovation'
                      ? '创新性'
                      : key === 'technicalDepth'
                      ? '技术深度'
                      : '呈现质量'}
                  </span>
                  <span className="text-muted-foreground">{dim.score}/100</span>
                </div>
                <Progress value={dim.score} className="h-2" />
                <p className="text-xs text-muted-foreground">{dim.reasoning}</p>
              </div>
            ))}
          </div>

          {/* 项目亮点 */}
          {assessment.highlights.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span>项目亮点</span>
              </div>
              <ul className="space-y-1.5">
                {assessment.highlights.map((highlight, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 潜在问题 */}
          {assessment.concerns.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>待改进</span>
              </div>
              <ul className="space-y-1.5">
                {assessment.concerns.map((concern, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{concern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 技术标签 */}
          {assessment.technicalTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Code2 className="h-4 w-4 text-blue-500" />
                <span>技术标签</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {assessment.technicalTags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground pt-4 border-t">
            <p>💡 提示：AI评估仅供参考，最终评分以评委打分为准</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
