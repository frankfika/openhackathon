import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JudgeChipProps {
  judgeName: string
  status: string
  totalScore?: number | null
  canRemove: boolean
  isMutating: boolean
  onRemove: () => void
  t: (key: string) => string
}

export function JudgeChip({
  judgeName,
  status,
  totalScore,
  canRemove,
  isMutating,
  onRemove,
  t,
}: JudgeChipProps) {
  const baseClasses = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors'

  if (status === 'completed') {
    return (
      <span
        className={cn(baseClasses, 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400')}
        title={t('judging.status.completed')}
      >
        {judgeName}
        <span className="font-semibold tabular-nums ml-0.5">{totalScore ?? '-'}</span>
      </span>
    )
  }

  if (status === 'in_progress') {
    return (
      <span
        className={cn(baseClasses, 'border border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400')}
        title={t('judging.status.in_progress')}
      >
        {judgeName}
      </span>
    )
  }

  // pending — removable
  return (
    <span
      className={cn(baseClasses, 'border border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-400 group')}
      title={t('judging.status.pending')}
    >
      {judgeName}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={isMutating}
          className="ml-0.5 rounded-full p-0.5 hover:bg-amber-200/60 dark:hover:bg-amber-800/40 transition-colors disabled:pointer-events-none opacity-0 group-hover:opacity-100"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </span>
  )
}
