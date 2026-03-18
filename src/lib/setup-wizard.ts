export type SetupWizardSubmissionStyle = 'lean' | 'standard' | 'detailed'
export type SetupWizardDimension = 'class_name' | 'category'

export type SetupWizardSubmissionFieldBlueprint = {
  id: string
  kind: 'project' | 'dimension' | 'custom'
  type: 'text' | 'textarea' | 'url' | 'select'
  required: boolean
  filterable?: boolean
  options?: string[]
}

export type SetupWizardScoringCriterionBlueprint = {
  key: 'innovation' | 'execution' | 'impact'
  maxScore: number
  sortOrder: number
}

export type SetupWizardBlueprint = {
  submissionFields: SetupWizardSubmissionFieldBlueprint[]
  scoringCriteria: SetupWizardScoringCriterionBlueprint[]
}

type Input = {
  startAt: string
  endAt: string
  submissionStyle: SetupWizardSubmissionStyle
  dimensions: SetupWizardDimension[]
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
  submissionFieldCount: number
  scoringCriteriaCount: number
}): boolean {
  return input.submissionFieldCount === 0 || input.scoringCriteriaCount === 0
}

export function createSetupWizardBlueprint(input: Input): SetupWizardBlueprint {
  return {
    submissionFields: buildSubmissionFields(input.submissionStyle, input.dimensions),
    scoringCriteria: buildScoringCriteria(),
  }
}
