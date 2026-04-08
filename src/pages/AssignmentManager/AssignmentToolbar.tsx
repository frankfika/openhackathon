import { Search, List, Grid3X3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { StatusFilter, ViewMode, FilterCounts } from './types'
import type { SubmissionField } from '@/lib/types'

interface AssignmentToolbarProps {
  projectQuery: string
  onProjectQueryChange: (value: string) => void
  submissionFilters: Record<string, string>
  onSubmissionFilterChange: (fieldId: string, value: string) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (status: StatusFilter) => void
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  filterableFields: SubmissionField[]
  filterCounts: FilterCounts
  activeFilterCount: number
  onClearFilters: () => void
  getFieldLabel: (fieldId: string, defaultLabel: string, t: (key: string) => string) => string
  getFilterOptions: (field: SubmissionField) => string[]
  t: (key: string) => string
}

export function AssignmentToolbar({
  projectQuery,
  onProjectQueryChange,
  submissionFilters,
  onSubmissionFilterChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  filterableFields,
  filterCounts,
  activeFilterCount,
  onClearFilters,
  getFieldLabel,
  getFilterOptions,
  t,
}: AssignmentToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[180px] max-w-[280px] flex-1">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={projectQuery}
          onChange={(e) => onProjectQueryChange(e.target.value)}
          placeholder={t('assignments.search_projects_placeholder')}
          className="h-8 pl-8 text-sm"
        />
      </div>

      {/* Submission field filters */}
      {filterableFields.map((field) => {
        const options = getFilterOptions(field)
        return (
          <Select
            key={field.id}
            value={submissionFilters[field.id] || '__all__'}
            onValueChange={(value) =>
              onSubmissionFilterChange(field.id, value === '__all__' ? '' : value)
            }
          >
            <SelectTrigger className="h-8 w-[140px] text-sm">
              <SelectValue placeholder={getFieldLabel(field.id, field.label, t)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t('assignments.all_filter_values')}</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      })}

      {/* Clear filters */}
      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClearFilters}>
          {t('assignments.clear_filters')}
        </Button>
      )}

      <div className="flex-1" />

      {/* View toggle */}
      <div className="flex items-center rounded-lg border bg-muted/40 p-0.5 mr-1">
        <button
          type="button"
          onClick={() => onViewModeChange('list')}
          title={t('assignments.view_list')}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            viewMode === 'list'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange('matrix')}
          title={t('assignments.view_matrix')}
          className={cn(
            'rounded-md p-1.5 transition-colors',
            viewMode === 'matrix'
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Grid3X3 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => onStatusFilterChange(status)}
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              statusFilter === status
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t(`reports.filter_${status}`)}
            <span className="ml-1 tabular-nums">({filterCounts[status]})</span>
          </button>
        ))}
      </div>
    </div>
  )
}
