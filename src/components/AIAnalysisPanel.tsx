/**
 * AI Analysis Panel - displays AI project analysis results.
 * Fully i18n'd: zh is the source of truth (see i18n.ts fallback chain
 * ['zh', 'en']); English users get Chinese strings until v2.4 mirror pass.
 */

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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

type Priority = 'high' | 'medium' | 'low'
type Complexity = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export function AIAnalysisPanel({ projectId, className }: AIAnalysisPanelProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)
  const queryClient = useQueryClient()

  // Fetch AI assessment
  const { data: assessment, isLoading, error } = useQuery<ProjectAssessment>({
    queryKey: ['ai-assessment', projectId],
    queryFn: async () => {
      return await api.analyzeProject(projectId)
    },
    staleTime: 60 * 60 * 1000, // 1h cache
  })

  const reanalyzeMutation = useMutation({
    mutationFn: async () => {
      return await api.analyzeProject(projectId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-assessment', projectId] })
      toast.success(t('ai_analysis_panel.updated'))
    },
    onError: () => {
      toast.error(t('ai_analysis_panel.failed'))
    },
  })

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>{t('ai_analysis_panel.title')}</CardTitle>
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
            <CardTitle>{t('ai_analysis_panel.title')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{t('ai_analysis_panel.unavailable')}</AlertDescription>
          </Alert>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => reanalyzeMutation.mutate()}
            disabled={reanalyzeMutation.isPending}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', reanalyzeMutation.isPending && 'animate-spin')} />
            {t('ai_analysis_panel.reanalyze')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  const priorityConfig: Record<Priority, { labelKey: string; color: string }> = {
    high: { labelKey: 'priority_high', color: 'bg-red-500/10 text-red-700 border-red-500/30' },
    medium: { labelKey: 'priority_medium', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
    low: { labelKey: 'priority_low', color: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
  }

  const complexityConfig: Record<Complexity, { labelKey: string; color: string }> = {
    beginner: { labelKey: 'complexity_beginner', color: 'bg-green-500/10 text-green-700' },
    intermediate: { labelKey: 'complexity_intermediate', color: 'bg-blue-500/10 text-blue-700' },
    advanced: { labelKey: 'complexity_advanced', color: 'bg-purple-500/10 text-purple-700' },
    expert: { labelKey: 'complexity_expert', color: 'bg-orange-500/10 text-orange-700' },
  }

  const dimensionLabelKey: Record<keyof ProjectAssessment['dimensions'], string> = {
    completeness: 'dim_completeness',
    innovation: 'dim_innovation',
    technicalDepth: 'dim_technicalDepth',
    presentation: 'dim_presentation',
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle>{t('ai_analysis_panel.title')}</CardTitle>
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
        <CardDescription>{t('ai_analysis_panel.subtitle')}</CardDescription>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{t('ai_analysis_panel.overall_score')}</p>
              <p className="text-3xl font-bold">{assessment.overallScore}/100</p>
            </div>
            <div className="flex gap-2">
              <Badge className={priorityConfig[assessment.suggestedPriority].color}>
                {t(`ai_analysis_panel.${priorityConfig[assessment.suggestedPriority].labelKey}`)}
              </Badge>
              <Badge className={complexityConfig[assessment.estimatedComplexity].color}>
                {t(`ai_analysis_panel.${complexityConfig[assessment.estimatedComplexity].labelKey}`)}
              </Badge>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-sm font-semibold">{t('ai_analysis_panel.dimensions')}</p>
            {Object.entries(assessment.dimensions).map(([key, dim]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {t(`ai_analysis_panel.${dimensionLabelKey[key as keyof ProjectAssessment['dimensions']]}`)}
                  </span>
                  <span className="text-muted-foreground">{dim.score}/100</span>
                </div>
                <Progress value={dim.score} className="h-2" />
                <p className="text-xs text-muted-foreground">{dim.reasoning}</p>
              </div>
            ))}
          </div>

          {assessment.highlights.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <span>{t('ai_analysis_panel.highlights')}</span>
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

          {assessment.concerns.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>{t('ai_analysis_panel.concerns')}</span>
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

          {assessment.technicalTags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Code2 className="h-4 w-4 text-blue-500" />
                <span>{t('ai_analysis_panel.tech_tags')}</span>
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
            <p>{t('ai_analysis_panel.disclaimer')}</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
