import { Assignment } from './types'

/**
 * Calculate the average score for a project from all completed assignments
 */
export function calculateProjectScore(
  projectId: string,
  assignments: Assignment[]
): number {
  const completedAssignments = assignments.filter(
    (a) => a.projectId === projectId && a.status === 'completed' && a.totalScore !== undefined
  )

  if (completedAssignments.length === 0) {
    return 0
  }

  const totalScore = completedAssignments.reduce(
    (sum, a) => sum + (a.totalScore || 0),
    0
  )

  return Math.round((totalScore / completedAssignments.length) * 10) / 10
}

/**
 * Get all projects with their calculated scores
 */
export function getProjectsWithScores(
  projects: { id: string; [key: string]: any }[],
  assignments: Assignment[]
): Array<{ id: string; score: number; [key: string]: any }> {
  return projects.map((project) => ({
    ...project,
    score: calculateProjectScore(project.id, assignments),
  }))
}

/**
 * Validate that scoring criteria totals 100 points
 */
export function validateScoringCriteria(
  criteria: { maxScore: number }[]
): boolean {
  const total = criteria.reduce((sum, c) => sum + c.maxScore, 0)
  return total === 100
}

/**
 * Calculate total score from individual criterion scores
 */
export function calculateTotalScore(scores: Record<string, number>): number {
  return Object.values(scores).reduce((sum, score) => sum + score, 0)
}
