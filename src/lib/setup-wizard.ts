export type SetupWizardFormat = 'single_round' | 'prelim_final' | 'three_stage'
export type SetupWizardSubmissionStyle = 'lean' | 'standard' | 'detailed'
export type SetupWizardDimension = 'region' | 'class_name' | 'category'

export type SetupWizardSessionBlueprint = {
  key: 'main' | 'preliminary' | 'semi_final' | 'final'
  type: 'preliminary' | 'semi_final' | 'final'
  status: 'active' | 'draft'
  startAt: string
  endAt: string
}

export type SetupWizardSubmissionFieldBlueprint = {
  id: string
  kind: 'project' | 'dimension' | 'custom'
  type: 'text' | 'textarea' | 'url'
  required: boolean
  filterable?: boolean
}

export type SetupWizardScoringCriterionBlueprint = {
  key: 'innovation' | 'execution' | 'impact'
  maxScore: number
  sortOrder: number
}

export type SetupWizardBlueprint = {
  sessions: SetupWizardSessionBlueprint[]
  submissionFields: SetupWizardSubmissionFieldBlueprint[]
  scoringCriteria: SetupWizardScoringCriterionBlueprint[]
}

type Input = {
  startAt: string
  endAt: string
  format: SetupWizardFormat
  submissionStyle: SetupWizardSubmissionStyle
  dimensions: SetupWizardDimension[]
}

function safeIsoDate(value: string, fallback: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return date.toISOString()
}

function createSessionRange(startAt: string, endAt: string, partIndex: number, partCount: number) {
  const startMs = new Date(startAt).getTime()
  const endMs = new Date(endAt).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return {
      startAt,
      endAt,
    }
  }

  const total = endMs - startMs
  const segmentStart = startMs + Math.floor((total * partIndex) / partCount)
  const segmentEnd = partIndex === partCount - 1
    ? endMs
    : startMs + Math.floor((total * (partIndex + 1)) / partCount)

  return {
    startAt: new Date(segmentStart).toISOString(),
    endAt: new Date(segmentEnd).toISOString(),
  }
}

function buildSessions(startAt: string, endAt: string, format: SetupWizardFormat): SetupWizardSessionBlueprint[] {
  if (format === 'single_round') {
    return [
      {
        key: 'main',
        type: 'preliminary',
        status: 'active',
        startAt,
        endAt,
      },
    ]
  }

  if (format === 'prelim_final') {
    return ['preliminary', 'final'].map((key, index) => {
      const range = createSessionRange(startAt, endAt, index, 2)
      return {
        key: key as 'preliminary' | 'final',
        type: key === 'preliminary' ? 'preliminary' : 'final',
        status: index === 0 ? 'active' : 'draft',
        startAt: range.startAt,
        endAt: range.endAt,
      }
    })
  }

  return ['preliminary', 'semi_final', 'final'].map((key, index) => {
    const range = createSessionRange(startAt, endAt, index, 3)
    return {
      key: key as 'preliminary' | 'semi_final' | 'final',
      type: key as 'preliminary' | 'semi_final' | 'final',
      status: index === 0 ? 'active' : 'draft',
      startAt: range.startAt,
      endAt: range.endAt,
    }
  })
}

function buildSubmissionFields(style: SetupWizardSubmissionStyle, dimensions: SetupWizardDimension[]): SetupWizardSubmissionFieldBlueprint[] {
  const baseFields: SetupWizardSubmissionFieldBlueprint[] = [
    { id: 'title', kind: 'project', type: 'text', required: true },
    { id: 'oneLiner', kind: 'project', type: 'text', required: style !== 'lean' ? true : false },
    { id: 'description', kind: 'project', type: 'textarea', required: style === 'detailed' },
    { id: 'demoUrl', kind: 'project', type: 'url', required: false },
    { id: 'repoUrl', kind: 'project', type: 'url', required: false },
    { id: 'tags', kind: 'project', type: 'text', required: false },
  ]

  const dimensionFields: Record<SetupWizardDimension, SetupWizardSubmissionFieldBlueprint> = {
    region: { id: 'region', kind: 'dimension', type: 'text', required: true, filterable: true },
    class_name: { id: 'className', kind: 'dimension', type: 'text', required: true, filterable: true },
    category: { id: 'category', kind: 'dimension', type: 'text', required: true, filterable: true },
  }

  return [
    ...baseFields.filter((field) => {
      if (style === 'lean') {
        return ['title', 'demoUrl', 'repoUrl'].includes(field.id)
      }
      if (style === 'standard') {
        return ['title', 'oneLiner', 'description', 'demoUrl', 'repoUrl', 'tags'].includes(field.id)
      }
      return true
    }),
    ...dimensions.map((dimension) => dimensionFields[dimension]),
  ]
}

function buildScoringCriteria(): SetupWizardScoringCriterionBlueprint[] {
  return [
    { key: 'innovation', maxScore: 40, sortOrder: 0 },
    { key: 'execution', maxScore: 35, sortOrder: 1 },
    { key: 'impact', maxScore: 25, sortOrder: 2 },
  ]
}

export function shouldSuggestSetupWizard(input: {
  sessionCount: number
  submissionFieldCount: number
  scoringCriteriaCount: number
}): boolean {
  return input.sessionCount <= 1 || input.submissionFieldCount === 0 || input.scoringCriteriaCount === 0
}

export function planSetupWizardSessions(
  existingSessions: Array<{ id: string }>,
  generatedSessions: SetupWizardSessionBlueprint[]
): {
  mode: 'generated' | 'preserve_existing'
  sessions?: Array<SetupWizardSessionBlueprint & { id?: string }>
} {
  if (existingSessions.length > 1) {
    return { mode: 'preserve_existing' }
  }

  return {
    mode: 'generated',
    sessions: generatedSessions.map((session, index) => ({
      ...session,
      id: index === 0 ? existingSessions[0]?.id : undefined,
    })),
  }
}

export function createSetupWizardBlueprint(input: Input): SetupWizardBlueprint {
  const startAt = safeIsoDate(input.startAt, new Date().toISOString())
  const endAt = safeIsoDate(input.endAt, startAt)

  return {
    sessions: buildSessions(startAt, endAt, input.format),
    submissionFields: buildSubmissionFields(input.submissionStyle, input.dimensions),
    scoringCriteria: buildScoringCriteria(),
  }
}
