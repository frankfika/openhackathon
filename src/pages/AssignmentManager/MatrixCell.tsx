import { memo } from 'react'
import { Plus } from 'lucide-react'
import type { Assignment } from '@/lib/types'

interface MatrixCellProps {
  assignment: Assignment | undefined
  isMutating: boolean
  onToggle: () => void
  t: (key: string) => string
}

function MatrixCellComponent({ assignment, isMutating, onToggle, t }: MatrixCellProps) {
  if (!assignment) {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={isMutating}
        className="group inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground/20 hover:bg-primary/10 hover:text-primary transition-colors disabled:pointer-events-none"
        title={t('assignments.click_to_assign')}
      >
        <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )
  }

  if (assignment.status === 'completed') {
    return (
      <span
        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
        title={t('judging.status.completed')}
      >
        {assignment.totalScore ?? '-'}
      </span>
    )
  }

  if (assignment.status === 'in_progress') {
    return (
      <span
        className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium border border-blue-200 text-blue-600 dark:border-blue-800 dark:text-blue-400"
        title={t('judging.status.in_progress')}
      >
        {t('judging.status.in_progress')}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isMutating}
      className="disabled:pointer-events-none"
      title={t('judging.status.pending')}
    >
      <span className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[11px] font-medium border border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-900/20 cursor-pointer transition-colors">
        {t('judging.status.pending')}
      </span>
    </button>
  )
}

export const MatrixCell = memo(MatrixCellComponent)
