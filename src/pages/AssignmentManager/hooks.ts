import { useMemo } from 'react'
import type { Project, Assignment } from '@/lib/types'
import type { ProjectStats, AssignmentAggregateStats, FilterCounts, StatusFilter } from './types'

export function useAssignmentIndex(assignments: Assignment[]) {
  return useMemo(() => {
    const map = new Map<string, Assignment>()
    for (const a of assignments) {
      map.set(`${a.projectId}:${a.judgeId}`, a)
    }
    return map
  }, [assignments])
}

export function useProjectAssignmentsMap(assignments: Assignment[]) {
  return useMemo(() => {
    const map = new Map<string, Assignment[]>()
    for (const a of assignments) {
      const list = map.get(a.projectId) || []
      list.push(a)
      map.set(a.projectId, list)
    }
    return map
  }, [assignments])
}

export function useJudgeAssignmentCounts(
  assignments: Assignment[],
  filteredProjectIds: Set<string>
) {
  return useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of assignments) {
      if (filteredProjectIds.has(a.projectId)) {
        counts.set(a.judgeId, (counts.get(a.judgeId) || 0) + 1)
      }
    }
    return counts
  }, [assignments, filteredProjectIds])
}

export function useProjectStats(
  filteredProjects: Project[],
  projectAssignmentsMap: Map<string, Assignment[]>
) {
  return useMemo(() => {
    const map = new Map<string, ProjectStats>()
    for (const project of filteredProjects) {
      const pa = projectAssignmentsMap.get(project.id) || []
      let completedCount = 0
      let pendingCount = 0
      let inProgressCount = 0
      let totalScore = 0

      for (const a of pa) {
        if (a.status === 'completed') {
          completedCount++
          totalScore += a.totalScore || 0
        } else if (a.status === 'pending') {
          pendingCount++
        } else if (a.status === 'in_progress') {
          inProgressCount++
        }
      }

      map.set(project.id, {
        totalAssignments: pa.length,
        completedAssignments: completedCount,
        pendingAssignments: pendingCount,
        inProgressAssignments: inProgressCount,
        totalScore,
        averageScore: completedCount > 0 ? totalScore / completedCount : 0,
      })
    }
    return map
  }, [filteredProjects, projectAssignmentsMap])
}

export function useAggregateStats(projectStats: Map<string, ProjectStats>): AssignmentAggregateStats {
  return useMemo(() => {
    const entries = Array.from(projectStats.values())
    const totalAssignments = entries.reduce((sum, s) => sum + s.totalAssignments, 0)
    const completedAssignments = entries.reduce((sum, s) => sum + s.completedAssignments, 0)
    const totalCompletedScore = entries.reduce((sum, s) => sum + s.totalScore, 0)
    const avgScore = completedAssignments > 0 ? totalCompletedScore / completedAssignments : 0
    const completionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0

    return {
      totalProjects: entries.length,
      avgScore: avgScore.toFixed(1),
      completionRate: completionRate.toFixed(0),
      completedAssignments,
      totalAssignments,
    }
  }, [projectStats])
}

export function useStatusFilteredProjects(
  filteredProjects: Project[],
  statusFilter: StatusFilter,
  projectStats: Map<string, ProjectStats>
) {
  return useMemo(() => {
    if (statusFilter === 'all') return filteredProjects

    return filteredProjects.filter((project) => {
      const s = projectStats.get(project.id)
      if (!s) return false
      if (statusFilter === 'pending') return s.pendingAssignments > 0
      if (statusFilter === 'in_progress') return s.inProgressAssignments > 0
      return s.totalAssignments > 0 && s.completedAssignments === s.totalAssignments
    })
  }, [filteredProjects, statusFilter, projectStats])
}

export function useFilterCounts(
  filteredProjects: Project[],
  projectStats: Map<string, ProjectStats>
): FilterCounts {
  return useMemo(() => {
    let pending = 0
    let in_progress = 0
    let completed = 0

    for (const p of filteredProjects) {
      const s = projectStats.get(p.id)
      if (!s) continue
      if (s.pendingAssignments > 0) pending++
      if (s.inProgressAssignments > 0) in_progress++
      if (s.totalAssignments > 0 && s.completedAssignments === s.totalAssignments) completed++
    }

    return { all: filteredProjects.length, pending, in_progress, completed }
  }, [filteredProjects, projectStats])
}

export function useSortedProjects(
  statusFilteredProjects: Project[],
  projectStats: Map<string, ProjectStats>
) {
  return useMemo(() => {
    return [...statusFilteredProjects].sort((a, b) => {
      const sa = projectStats.get(a.id)
      const sb = projectStats.get(b.id)
      return (sb?.averageScore ?? 0) - (sa?.averageScore ?? 0)
    })
  }, [statusFilteredProjects, projectStats])
}

export function usePendingCount(assignments: Assignment[]): number {
  return useMemo(() => {
    let count = 0
    for (const a of assignments) if (a.status === 'pending') count++
    return count
  }, [assignments])
}
