import { describe, expect, it } from 'vitest'
import { planBalancedRandomAssignments, planBulkAssignments } from '@/lib/assignment-planner'

const projects = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }]
const judgeIds = ['j1', 'j2', 'j3']

describe('planBulkAssignments', () => {
  it('creates missing assignments for every selected judge and project', () => {
    const result = planBulkAssignments({
      sessionId: 's1',
      projects,
      judgeIds: ['j1', 'j2'],
      existingAssignments: [{ sessionId: 's1', projectId: 'p1', judgeId: 'j1' }],
    })

    expect(result.assignments).toEqual([
      { sessionId: 's1', projectId: 'p1', judgeId: 'j2' },
      { sessionId: 's1', projectId: 'p2', judgeId: 'j1' },
      { sessionId: 's1', projectId: 'p2', judgeId: 'j2' },
      { sessionId: 's1', projectId: 'p3', judgeId: 'j1' },
      { sessionId: 's1', projectId: 'p3', judgeId: 'j2' },
    ])
  })
})

describe('planBalancedRandomAssignments', () => {
  it('fills each project up to the requested judge count without duplicating existing assignments', () => {
    const result = planBalancedRandomAssignments({
      sessionId: 's1',
      projects: [{ id: 'p1' }, { id: 'p2' }],
      judgeIds,
      judgesPerProject: 2,
      existingAssignments: [{ sessionId: 's1', projectId: 'p1', judgeId: 'j1' }],
      random: () => 0,
    })

    const p1Assignments = result.assignments.filter((assignment) => assignment.projectId === 'p1')
    const p2Assignments = result.assignments.filter((assignment) => assignment.projectId === 'p2')

    expect(p1Assignments).toHaveLength(1)
    expect(p1Assignments[0].judgeId).not.toBe('j1')
    expect(p2Assignments).toHaveLength(2)
    expect(new Set(p2Assignments.map((assignment) => assignment.judgeId)).size).toBe(2)
  })

  it('balances new assignments toward the least-loaded judges', () => {
    const result = planBalancedRandomAssignments({
      sessionId: 's1',
      projects: [{ id: 'p3' }, { id: 'p4' }],
      judgeIds,
      judgesPerProject: 1,
      existingAssignments: [
        { sessionId: 's1', projectId: 'p1', judgeId: 'j1' },
        { sessionId: 's1', projectId: 'p2', judgeId: 'j1' },
      ],
      random: () => 0,
    })

    expect(result.assignments).toEqual([
      { sessionId: 's1', projectId: 'p4', judgeId: 'j2' },
      { sessionId: 's1', projectId: 'p3', judgeId: 'j3' },
    ])
  })
})
