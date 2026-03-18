import { describe, it, expect } from 'vitest'
import {
  calculateProjectScore,
  getProjectsWithScores,
  validateScoringCriteria,
  calculateTotalScore,
} from '@/lib/scoring'
import type { Assignment } from '@/lib/types'

describe('calculateProjectScore', () => {
  const makeAssignment = (
    overrides: Partial<Assignment> = {}
  ): Assignment => ({
    id: 'a1',
    projectId: 'p1',
    judgeId: 'j1',
    status: 'completed',
    totalScore: 80,
    ...overrides,
  })

  it('returns 0 when no assignments match the project', () => {
    const result = calculateProjectScore('p1', [])
    expect(result).toBe(0)
  })

  it('returns 0 when no assignments are completed', () => {
    const assignments = [
      makeAssignment({ status: 'pending', totalScore: 80 }),
      makeAssignment({ id: 'a2', status: 'in_progress', totalScore: 90 }),
    ]
    expect(calculateProjectScore('p1', assignments)).toBe(0)
  })

  it('returns 0 when assignments belong to different project', () => {
    const assignments = [
      makeAssignment({ projectId: 'p2', totalScore: 80 }),
    ]
    expect(calculateProjectScore('p1', assignments)).toBe(0)
  })

  it('calculates average for single completed assignment', () => {
    const assignments = [makeAssignment({ totalScore: 85 })]
    expect(calculateProjectScore('p1', assignments)).toBe(85)
  })

  it('calculates average for multiple completed assignments', () => {
    const assignments = [
      makeAssignment({ id: 'a1', totalScore: 80 }),
      makeAssignment({ id: 'a2', judgeId: 'j2', totalScore: 90 }),
      makeAssignment({ id: 'a3', judgeId: 'j3', totalScore: 70 }),
    ]
    // average = (80 + 90 + 70) / 3 = 80
    expect(calculateProjectScore('p1', assignments)).toBe(80)
  })

  it('rounds to 1 decimal place', () => {
    const assignments = [
      makeAssignment({ id: 'a1', totalScore: 85 }),
      makeAssignment({ id: 'a2', judgeId: 'j2', totalScore: 90 }),
      makeAssignment({ id: 'a3', judgeId: 'j3', totalScore: 72 }),
    ]
    // average = (85 + 90 + 72) / 3 = 82.333...
    expect(calculateProjectScore('p1', assignments)).toBe(82.3)
  })

  it('treats undefined totalScore as 0', () => {
    const assignments = [
      makeAssignment({ id: 'a1', totalScore: 80 }),
      makeAssignment({ id: 'a2', judgeId: 'j2', totalScore: undefined }),
    ]
    // Only the first assignment matches (totalScore !== undefined filter)
    expect(calculateProjectScore('p1', assignments)).toBe(80)
  })

  it('filters out assignments for other projects in mixed list', () => {
    const assignments = [
      makeAssignment({ id: 'a1', projectId: 'p1', totalScore: 80 }),
      makeAssignment({ id: 'a2', projectId: 'p2', totalScore: 100 }),
      makeAssignment({ id: 'a3', projectId: 'p1', judgeId: 'j2', totalScore: 60 }),
    ]
    // Only p1 assignments: (80 + 60) / 2 = 70
    expect(calculateProjectScore('p1', assignments)).toBe(70)
  })
})

describe('getProjectsWithScores', () => {
  it('enriches each project with its score', () => {
    const projects = [
      { id: 'p1', title: 'Project 1' },
      { id: 'p2', title: 'Project 2' },
    ]
    const assignments: Assignment[] = [
      {
        id: 'a1', projectId: 'p1',
        judgeId: 'j1', status: 'completed', totalScore: 80,
      },
      {
        id: 'a2', projectId: 'p2',
        judgeId: 'j1', status: 'completed', totalScore: 95,
      },
    ]

    const result = getProjectsWithScores(projects, assignments)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ id: 'p1', title: 'Project 1', score: 80 })
    expect(result[1]).toEqual({ id: 'p2', title: 'Project 2', score: 95 })
  })

  it('returns 0 for projects with no assignments', () => {
    const projects = [{ id: 'p1', title: 'No Scores' }]
    const result = getProjectsWithScores(projects, [])
    expect(result[0].score).toBe(0)
  })
})

describe('validateScoringCriteria', () => {
  it('returns true when total equals 100', () => {
    const criteria = [
      { maxScore: 40 },
      { maxScore: 30 },
      { maxScore: 30 },
    ]
    expect(validateScoringCriteria(criteria)).toBe(true)
  })

  it('returns false when total is less than 100', () => {
    const criteria = [
      { maxScore: 40 },
      { maxScore: 30 },
    ]
    expect(validateScoringCriteria(criteria)).toBe(false)
  })

  it('returns false when total exceeds 100', () => {
    const criteria = [
      { maxScore: 60 },
      { maxScore: 60 },
    ]
    expect(validateScoringCriteria(criteria)).toBe(false)
  })

  it('returns false for empty criteria', () => {
    expect(validateScoringCriteria([])).toBe(false)
  })

  it('returns true for single criterion of 100', () => {
    expect(validateScoringCriteria([{ maxScore: 100 }])).toBe(true)
  })
})

describe('calculateTotalScore', () => {
  it('sums all criterion scores', () => {
    const scores = { c1: 25, c2: 30, c3: 20 }
    expect(calculateTotalScore(scores)).toBe(75)
  })

  it('returns 0 for empty scores', () => {
    expect(calculateTotalScore({})).toBe(0)
  })

  it('handles single score', () => {
    expect(calculateTotalScore({ c1: 42 })).toBe(42)
  })
})
