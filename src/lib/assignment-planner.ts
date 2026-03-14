type AssignableProject = {
  id: string
}

type ExistingAssignment = {
  sessionId: string
  projectId: string
  judgeId: string
}

type AssignmentPlanInput = {
  sessionId: string
  projects: AssignableProject[]
  judgeIds: string[]
  existingAssignments: ExistingAssignment[]
  judgesPerProject?: number
  random?: () => number
}

type PlannedAssignment = {
  sessionId: string
  projectId: string
  judgeId: string
}

type PlannedAssignmentResult = {
  assignments: PlannedAssignment[]
}

function clampJudgesPerProject(count: number | undefined, judgeCount: number) {
  if (judgeCount <= 0) return 0
  const requested = Number.isFinite(count) ? Math.floor(count as number) : 1
  return Math.min(Math.max(requested, 1), judgeCount)
}

function shuffleInPlace<T>(items: T[], random: () => number) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = items[index]
    items[index] = items[swapIndex]
    items[swapIndex] = current
  }
}

export function planBulkAssignments(input: AssignmentPlanInput): PlannedAssignmentResult {
  const { sessionId, projects, judgeIds, existingAssignments } = input
  if (!sessionId || projects.length === 0 || judgeIds.length === 0) {
    return { assignments: [] }
  }

  const existingKeys = new Set(
    existingAssignments
      .filter((assignment) => assignment.sessionId === sessionId)
      .map((assignment) => `${assignment.projectId}:${assignment.judgeId}`)
  )

  const assignments: PlannedAssignment[] = []
  for (const project of projects) {
    for (const judgeId of judgeIds) {
      const key = `${project.id}:${judgeId}`
      if (existingKeys.has(key)) continue
      assignments.push({ sessionId, projectId: project.id, judgeId })
      existingKeys.add(key)
    }
  }

  return { assignments }
}

export function planBalancedRandomAssignments(input: AssignmentPlanInput): PlannedAssignmentResult {
  const { sessionId, projects, judgeIds, existingAssignments } = input
  if (!sessionId || projects.length === 0 || judgeIds.length === 0) {
    return { assignments: [] }
  }

  const random = input.random || Math.random
  const targetPerProject = clampJudgesPerProject(input.judgesPerProject, judgeIds.length)
  if (targetPerProject === 0) {
    return { assignments: [] }
  }

  const selectedJudgeIds = new Set(judgeIds)
  const loadByJudge = new Map<string, number>()
  const existingByProject = new Map<string, Set<string>>()

  for (const judgeId of judgeIds) {
    loadByJudge.set(judgeId, 0)
  }

  for (const assignment of existingAssignments) {
    if (assignment.sessionId !== sessionId) continue
    if (!selectedJudgeIds.has(assignment.judgeId)) continue

    loadByJudge.set(assignment.judgeId, (loadByJudge.get(assignment.judgeId) || 0) + 1)

    const judgeSet = existingByProject.get(assignment.projectId) || new Set<string>()
    judgeSet.add(assignment.judgeId)
    existingByProject.set(assignment.projectId, judgeSet)
  }

  const shuffledProjects = [...projects]
  shuffleInPlace(shuffledProjects, random)

  const assignments: PlannedAssignment[] = []
  for (const project of shuffledProjects) {
    const assignedJudges = new Set(existingByProject.get(project.id) || [])
    const missingAssignments = targetPerProject - assignedJudges.size
    if (missingAssignments <= 0) continue

    const availableJudges = judgeIds.filter((judgeId) => !assignedJudges.has(judgeId))
    for (let index = 0; index < missingAssignments && availableJudges.length > 0; index += 1) {
      const rankedJudges = [...availableJudges]
      shuffleInPlace(rankedJudges, random)
      rankedJudges.sort((judgeA, judgeB) => (loadByJudge.get(judgeA) || 0) - (loadByJudge.get(judgeB) || 0))

      const selectedJudgeId = rankedJudges[0]
      assignments.push({
        sessionId,
        projectId: project.id,
        judgeId: selectedJudgeId,
      })
      assignedJudges.add(selectedJudgeId)
      loadByJudge.set(selectedJudgeId, (loadByJudge.get(selectedJudgeId) || 0) + 1)

      const availableIndex = availableJudges.indexOf(selectedJudgeId)
      if (availableIndex >= 0) {
        availableJudges.splice(availableIndex, 1)
      }
    }
  }

  return { assignments }
}
