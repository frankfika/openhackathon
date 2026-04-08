export type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed'
export type ViewMode = 'list' | 'matrix'

export interface ProjectStats {
  totalAssignments: number
  completedAssignments: number
  pendingAssignments: number
  inProgressAssignments: number
  totalScore: number
  averageScore: number
}

export interface AssignmentAggregateStats {
  totalProjects: number
  avgScore: string
  completionRate: string
  completedAssignments: number
  totalAssignments: number
}

export interface FilterCounts {
  all: number
  pending: number
  in_progress: number
  completed: number
}
