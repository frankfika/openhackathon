// Centralized React Query key factory.
//
// Why: queryKey strings were spread across 30+ files. A typo in one
// invalidateQueries call could miss invalidating dependent data and
// leave stale UI after a mutation. Centralizing them gives:
//   1. Type-safe key construction
//   2. Single source of truth for invalidation targets
//   3. IDE autocomplete (vs typing a string literal each time)
//
// Migration plan: incrementally replace string literals in the codebase with
// the factory helpers below. Existing string-based keys still work because
// react-query compares by deep equality on the array, not reference.
//
// Usage:
//   import { queryKeys } from '@/lib/queryKeys'
//   useQuery({ queryKey: queryKeys.projects.list(hackathonId), ... })
//   queryClient.invalidateQueries({ queryKey: queryKeys.projects.all })

export const queryKeys = {
  // ==================== Hackathon ====================
  hackathons: {
    all: ['hackathons'] as const,
    current: () => [...queryKeys.hackathons.all, 'current'] as const,
    detail: (id: string) => [...queryKeys.hackathons.all, 'detail', id] as const,
    metrics: (id: string) => [...queryKeys.hackathons.all, id, 'metrics'] as const,
  },

  // ==================== Project ====================
  projects: {
    all: ['projects'] as const,
    list: (hackathonId: string) => [...queryKeys.projects.all, hackathonId] as const,
    lite: (hackathonId: string) => [...queryKeys.projects.all, hackathonId, 'lite'] as const,
    paginated: (
      hackathonId: string,
      page: number,
      query: string,
      status: string,
      filters: Record<string, unknown>,
    ) =>
      [
        ...queryKeys.projects.all,
        hackathonId,
        'paginated',
        page,
        query,
        status,
        filters,
      ] as const,
    detail: (id: string) => [...queryKeys.projects.all, 'detail', id] as const,
  },

  // ==================== Assignment ====================
  assignments: {
    all: ['assignments'] as const,
    forJudge: (judgeId: string) => [...queryKeys.assignments.all, 'judge', judgeId] as const,
  },

  // ==================== Site / Branding ====================
  siteSettings: {
    all: ['site-settings'] as const,
    admin: () => [...queryKeys.siteSettings.all, 'admin'] as const,
  },

  // ==================== Dashboard ====================
  dashboard: {
    stats: (hackathonId?: string) =>
      hackathonId
        ? (['dashboard-stats', hackathonId] as const)
        : (['dashboard-stats'] as const),
  },

  // ==================== AI ====================
  ai: {
    assessment: (projectId: string) => ['ai-assessment', projectId] as const,
    batchStatus: (taskId: string | null) => ['batch-status', taskId] as const,
    metrics: () => ['ai-metrics'] as const,
  },

  // ==================== Activity Log ====================
  activityLogs: {
    list: (params: Record<string, unknown>) => ['activity-logs', 'list', params] as const,
    entity: (entityType: string, entityId: string) =>
      ['activity-logs', 'entity', entityType, entityId] as const,
  },
} as const
