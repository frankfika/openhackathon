/**
 * AI Score Badge - 显示AI评估分数的徽章组件
 */

import React from 'react'
import { Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface AIScoreBadgeProps {
  score: number // 0-100
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  showTrend?: boolean
  previousScore?: number
  className?: string
}

export function AIScoreBadge({
  score,
  size = 'md',
  showIcon = true,
  showTrend = false,
  previousScore,
  className,
}: AIScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
    if (score >= 60) return 'bg-blue-500/10 text-blue-700 border-blue-500/30'
    if (score >= 40) return 'bg-amber-500/10 text-amber-700 border-amber-500/30'
    return 'bg-red-500/10 text-red-700 border-red-500/30'
  }

  const getScoreLabel = (score: number) => {
    if (score >= 80) return '优秀'
    if (score >= 60) return '良好'
    if (score >= 40) return '中等'
    return '待改进'
  }

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  }

  const trend = previousScore !== undefined ? score - previousScore : 0
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border font-medium backdrop-blur-sm',
              getScoreColor(score),
              sizeClasses[size],
              className
            )}
          >
            {showIcon && <Sparkles className="h-3 w-3" />}
            <span>AI: {score}</span>
            {showTrend && previousScore !== undefined && (
              <TrendIcon className={cn('h-3 w-3', trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-600' : 'text-gray-500')} />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-semibold">AI质量评估: {getScoreLabel(score)}</p>
          <p className="text-xs text-muted-foreground">综合评分 {score}/100</p>
          {showTrend && previousScore !== undefined && (
            <p className="text-xs mt-1">
              较上次 {trend > 0 ? '+' : ''}{trend.toFixed(1)}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
