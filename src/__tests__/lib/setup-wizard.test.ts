import { describe, expect, it } from 'vitest'
import { createSetupWizardBlueprint, shouldSuggestSetupWizard } from '@/lib/setup-wizard'

describe('setup wizard blueprint', () => {
  it('creates a blueprint with selected dimensions', () => {
    const result = createSetupWizardBlueprint({
      startAt: '2026-04-01T00:00:00.000Z',
      endAt: '2026-04-05T00:00:00.000Z',
      submissionStyle: 'standard',
      dimensions: ['category'],
    })

    expect(result.submissionFields.some((field) => field.id === 'category' && field.filterable)).toBe(true)
    expect(result.scoringCriteria.map((criterion) => criterion.maxScore)).toEqual([40, 35, 25])
  })

  it('keeps lean mode minimal', () => {
    const result = createSetupWizardBlueprint({
      startAt: '2026-04-01T00:00:00.000Z',
      endAt: '2026-04-05T00:00:00.000Z',
      submissionStyle: 'lean',
      dimensions: [],
    })

    expect(result.submissionFields.map((field) => field.id)).toEqual(['title', 'demoUrl', 'repoUrl'])
  })
})

describe('shouldSuggestSetupWizard', () => {
  it('suggests setup when core config is still sparse', () => {
    expect(shouldSuggestSetupWizard({ submissionFieldCount: 0, scoringCriteriaCount: 0 })).toBe(true)
    expect(shouldSuggestSetupWizard({ submissionFieldCount: 4, scoringCriteriaCount: 3 })).toBe(false)
  })
})
