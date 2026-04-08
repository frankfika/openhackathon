import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TFunction } from 'i18next'

interface AssignmentPaginationProps {
  displayPage: number
  displayTotalPages: number
  totalItems: number
  displayPageSize: number
  onPageChange: (page: number) => void
  t: TFunction
}

export function AssignmentPagination({
  displayPage,
  displayTotalPages,
  totalItems,
  displayPageSize,
  onPageChange,
  t,
}: AssignmentPaginationProps) {
  if (totalItems <= displayPageSize) return null

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
      <span>
        {t('common.showing_range', {
          from: (displayPage - 1) * displayPageSize + 1,
          to: Math.min(displayPage * displayPageSize, totalItems),
          total: totalItems,
        })}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={displayPage <= 1}
          onClick={() => onPageChange(displayPage - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="px-2 tabular-nums">
          {displayPage} / {displayTotalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={displayPage >= displayTotalPages}
          onClick={() => onPageChange(displayPage + 1)}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
